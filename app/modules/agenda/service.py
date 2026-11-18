"""Agenda de estudio: qué estudiar hoy, tareas de repaso y temas pendientes."""
from datetime import date, timedelta
from typing import Any

from postgrest import SyncPostgrestClient

from app.modules.agenda.schemas import StudyTaskCreate, StudyTaskUpdate, TopicCreate
from app.modules.questions.service import flatten as flatten_question
from app.modules.subjects.service import get_subject
from app.shared.errors import AppError, NotFound
from app.shared.study_calendar import load_period

TASK_COLUMNS = "*, subjects(name, color)"
UPCOMING_DAYS = 14


def _flatten(row: dict[str, Any]) -> dict[str, Any]:
    subject = row.pop("subjects", None) or {}
    return {**row, "subject_name": subject.get("name", ""), "subject_color": subject.get("color", "#10b981")}


def agenda_for(db: SyncPostgrestClient, day: date) -> dict[str, Any]:
    """Lo de hoy: clases del día, repasos pendientes (incluye atrasados), preguntas agendadas y próximas fechas."""
    holidays = {
        r["date"] for r in db.table("important_dates").select("date").eq("kind", "holiday").eq("date", day.isoformat()).execute().data
    }
    classes = []
    if not holidays and load_period(db).contains(day):
        rows = (
            db.table("class_sessions").select("*, subjects(name, color)")
            .eq("weekday", day.weekday()).order("start_time").execute().data
        )
        classes = [_flatten(r) for r in rows]

    tasks = (
        db.table("study_tasks").select(TASK_COLUMNS)
        .eq("done", False).lte("due_date", day.isoformat()).order("due_date").order("id").execute().data
    )
    questions = (
        db.table("questions").select("*, subjects(name, color)")
        .eq("resolved", False).lte("scheduled_for", day.isoformat()).order("scheduled_for").order("id").execute().data
    )
    upcoming = (
        db.table("important_dates").select("date, kind, title, subjects(name)")
        .gte("date", day.isoformat()).lte("date", (day + timedelta(days=UPCOMING_DAYS)).isoformat())
        .order("date").execute().data
    )
    return {
        "date": day,
        "classes": classes,
        "tasks": [_flatten(t) for t in tasks],
        "questions": [flatten_question(q) for q in questions],
        "upcoming": [
            {**{k: v for k, v in u.items() if k != "subjects"}, "subject_name": (u.get("subjects") or {}).get("name")}
            for u in upcoming
        ],
    }


# --- Tareas de estudio -------------------------------------------------------

def list_tasks(db: SyncPostgrestClient, *, start: date | None, end: date | None, subject_id: int | None, done: bool | None) -> list[dict]:
    q = db.table("study_tasks").select(TASK_COLUMNS)
    if start:
        q = q.gte("due_date", start.isoformat())
    if end:
        q = q.lte("due_date", end.isoformat())
    if subject_id is not None:
        q = q.eq("subject_id", subject_id)
    if done is not None:
        q = q.eq("done", done)
    return [_flatten(r) for r in q.order("due_date").order("id").limit(500).execute().data]


def _get_task(db: SyncPostgrestClient, task_id: int) -> dict[str, Any]:
    res = db.table("study_tasks").select(TASK_COLUMNS).eq("id", task_id).limit(1).execute()
    if not res.data:
        raise NotFound("Tarea no encontrada")
    return _flatten(res.data[0])


def create_task(db: SyncPostgrestClient, owner_id: str, data: StudyTaskCreate) -> dict[str, Any]:
    get_subject(db, data.subject_id)
    row = db.table("study_tasks").insert({**data.model_dump(mode="json"), "owner_id": owner_id}).execute().data[0]
    return _get_task(db, row["id"])


def update_task(db: SyncPostgrestClient, task_id: int, data: StudyTaskUpdate) -> dict[str, Any]:
    fields = data.model_dump(mode="json", exclude_unset=True)
    if not fields:
        raise AppError(400, "No se envió ningún campo para actualizar")
    if any(fields.get(k, ...) is None for k in ("done", "due_date", "title")):
        raise AppError(422, "done, due_date y title no pueden ser null")
    if not db.table("study_tasks").update(fields).eq("id", task_id).execute().data:
        raise NotFound("Tarea no encontrada")
    return _get_task(db, task_id)


def delete_task(db: SyncPostgrestClient, task_id: int) -> None:
    if not db.table("study_tasks").delete().eq("id", task_id).execute().data:
        raise NotFound("Tarea no encontrada")


# --- Temas pendientes --------------------------------------------------------

def create_topic(db: SyncPostgrestClient, owner_id: str, data: TopicCreate) -> dict[str, Any]:
    get_subject(db, data.subject_id)
    return db.table("pending_topics").insert({**data.model_dump(), "owner_id": owner_id}).execute().data[0]


def update_topic(db: SyncPostgrestClient, topic_id: int, resolved: bool) -> dict[str, Any]:
    res = db.table("pending_topics").update({"resolved": resolved}).eq("id", topic_id).execute()
    if not res.data:
        raise NotFound("Tema no encontrado")
    return res.data[0]


def delete_topic(db: SyncPostgrestClient, topic_id: int) -> None:
    if not db.table("pending_topics").delete().eq("id", topic_id).execute().data:
        raise NotFound("Tema no encontrado")
