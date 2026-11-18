"""Eventos de calendario: une clases, fechas importantes, repasos y preguntas.

Lo usan tres cosas: el calendario de la página, el link .ics y la sincronización con Google.
Cada evento tiene una `key` ESTABLE (no cambia entre sincronizaciones) para que los
calendarios externos actualicen el mismo evento en vez de duplicarlo.

Todas las consultas filtran por owner_id explícitamente: el link .ics se sirve con la
clave de admin (sin RLS), así que este filtro es lo que separa los datos de cada usuario.
"""
import hashlib
from dataclasses import dataclass
from datetime import date, time, timedelta
from typing import Any, Literal

from postgrest import SyncPostgrestClient

from app.shared.study_calendar import Period, load_period

EventKind = Literal["class", "exam", "holiday", "deadline", "other", "task", "question"]

KIND_LABEL: dict[str, str] = {
    "class": "Clase",
    "exam": "Examen",
    "holiday": "Feriado",
    "deadline": "Entrega",
    "other": "Fecha importante",
    "task": "Repaso",
    "question": "Pregunta",
}


@dataclass(frozen=True)
class CalEvent:
    key: str
    kind: EventKind
    title: str
    date: date  # fecha del evento (en clases semanales: primera ocurrencia)
    start_time: time | None = None
    end_time: time | None = None
    subject_name: str | None = None
    subject_color: str | None = None
    location: str | None = None
    meeting_url: str | None = None
    modality: str | None = None
    description: str | None = None
    weekday: int | None = None  # solo clases: se repiten cada semana ese día
    until: date | None = None  # solo clases: último día en que se repiten (fin de la vigencia del horario)
    done: bool = False
    ref_id: int | None = None  # id del repaso / pregunta (para marcarlos desde el calendario)

    @property
    def all_day(self) -> bool:
        return self.start_time is None


def _short_hash(*parts: Any) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:12]


def _t(value: str | None) -> time | None:
    return time.fromisoformat(value) if value else None


@dataclass
class CalendarData:
    """Datos crudos de un usuario, cargados una vez y reutilizados."""

    subjects: dict[int, dict[str, Any]]
    sessions: list[dict[str, Any]]
    dates: list[dict[str, Any]]
    tasks: list[dict[str, Any]]
    questions: list[dict[str, Any]]
    period: Period = Period()

    @property
    def holidays(self) -> set[date]:
        return {date.fromisoformat(d["date"]) for d in self.dates if d["kind"] == "holiday"}

    @classmethod
    def load(
        cls,
        db: SyncPostgrestClient,
        owner_id: str,
        *,
        start: date,
        end: date,
        tasks: bool = True,
        questions: bool = True,
        only_pending: bool = False,
    ) -> "CalendarData":
        subjects = {
            s["id"]: s for s in db.table("subjects").select("id, name, color").eq("owner_id", owner_id).execute().data
        }
        sessions = db.table("class_sessions").select("*").eq("owner_id", owner_id).execute().data
        dates = (
            db.table("important_dates").select("*").eq("owner_id", owner_id)
            .gte("date", start.isoformat()).lte("date", end.isoformat()).order("date").execute().data
        )
        task_rows: list[dict] = []
        if tasks:
            q = (
                db.table("study_tasks").select("*").eq("owner_id", owner_id)
                .gte("due_date", start.isoformat()).lte("due_date", end.isoformat())
            )
            if only_pending:
                q = q.eq("done", False)
            task_rows = q.order("due_date").limit(1000).execute().data
        question_rows: list[dict] = []
        if questions:
            q = (
                db.table("questions").select("*").eq("owner_id", owner_id)
                .gte("scheduled_for", start.isoformat()).lte("scheduled_for", end.isoformat())
            )
            if only_pending:
                q = q.eq("resolved", False)
            question_rows = q.order("scheduled_for").limit(1000).execute().data
        return cls(subjects, sessions, dates, task_rows, question_rows, load_period(db, owner_id))

    def _subject(self, subject_id: int | None) -> dict[str, Any]:
        return self.subjects.get(subject_id or -1, {})

    # --- Eventos sueltos (fechas, repasos, preguntas) ---------------------------

    def single_events(self) -> list[CalEvent]:
        events: list[CalEvent] = []
        for d in self.dates:
            subject = self._subject(d.get("subject_id"))
            events.append(CalEvent(
                key=f"date:{d['kind']}:{d['date']}:{_short_hash(d['title'], subject.get('name'))}",
                kind=d["kind"],
                title=d["title"],
                date=date.fromisoformat(d["date"]),
                subject_name=subject.get("name"),
                subject_color=subject.get("color"),
            ))
        for t in self.tasks:
            subject = self._subject(t["subject_id"])
            events.append(CalEvent(
                key=f"task:{t['id']}",
                kind="task",
                title=t["title"],
                date=date.fromisoformat(t["due_date"]),
                subject_name=subject.get("name"),
                subject_color=subject.get("color"),
                description=t.get("detail"),
                done=t["done"],
                ref_id=t["id"],
            ))
        for q in self.questions:
            subject = self._subject(q.get("subject_id"))
            events.append(CalEvent(
                key=f"question:{q['id']}",
                kind="question",
                title=q["text"],
                date=date.fromisoformat(q["scheduled_for"]),
                subject_name=subject.get("name"),
                subject_color=subject.get("color"),
                description=q.get("answer"),
                done=q["resolved"],
                ref_id=q["id"],
            ))
        return events

    # --- Clases ---------------------------------------------------------------

    def _class_event(self, s: dict[str, Any], on: date) -> CalEvent:
        subject = self._subject(s["subject_id"])
        name = subject.get("name", "Clase")
        start = _t(s["start_time"])
        return CalEvent(
            key=f"class:{_short_hash(name.lower(), s['weekday'], start)}",
            kind="class",
            title=name,
            date=on,
            start_time=start,
            end_time=_t(s["end_time"]),
            subject_name=name,
            subject_color=subject.get("color"),
            location=s.get("location"),
            meeting_url=s.get("meeting_url"),
            modality=s.get("modality", "unknown"),
            weekday=s["weekday"],
            until=self.period.ends_on,
        )

    def class_occurrences(self, start: date, end: date) -> list[CalEvent]:
        """Clases día por día en el rango (sin feriados ni fuera de la vigencia). Para el calendario de la página."""
        holidays = self.holidays
        events = []
        day = start
        while day <= end:
            if day not in holidays and self.period.contains(day):
                events.extend(self._class_event(s, day) for s in self.sessions if s["weekday"] == day.weekday())
            day += timedelta(days=1)
        return events

    def weekly_classes(self, anchor: date) -> list[CalEvent]:
        """Una clase semanal por horario, con fecha = primera ocurrencia desde `anchor` (o desde el inicio de la
        vigencia) hasta el fin de la vigencia. Para .ics y Google."""
        if self.period.starts_on and self.period.starts_on > anchor:
            anchor = self.period.starts_on
        events = []
        for s in self.sessions:
            first = anchor + timedelta(days=(s["weekday"] - anchor.weekday()) % 7)
            if self.period.ends_on and first > self.period.ends_on:
                continue  # el horario ya terminó: no se manda la clase
            events.append(self._class_event(s, first))
        return events


def sort_key(e: CalEvent) -> tuple:
    order = {"exam": 0, "holiday": 1, "deadline": 2, "class": 3, "other": 4, "task": 5, "question": 6}
    return (e.date, e.start_time or time.min, order.get(e.kind, 9), e.title)
