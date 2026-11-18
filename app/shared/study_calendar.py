"""Cálculos de fechas: hoy, próxima clase de una materia, cuándo repasar y vigencia del horario.

Esta lógica es determinística (no usa IA): la IA decide QUÉ estudiar y de qué
materia es algo; el CUÁNDO sale del horario de clases.
"""
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from postgrest import SyncPostgrestClient
from postgrest.exceptions import APIError

from app.config import get_settings

log = logging.getLogger("app.calendar")

HORIZON_DAYS = 120  # hasta cuántos días buscamos la próxima clase


def today() -> date:
    return datetime.now(ZoneInfo(get_settings().app_timezone)).date()


@dataclass(frozen=True)
class Period:
    """Vigencia del horario. Sin fechas = sin límite (como antes)."""

    starts_on: date | None = None
    ends_on: date | None = None

    def contains(self, d: date) -> bool:
        return (self.starts_on is None or d >= self.starts_on) and (self.ends_on is None or d <= self.ends_on)


def load_period(db: SyncPostgrestClient, owner_id: str | None = None) -> Period:
    """Lee el período del horario. Si la migración 0005 no se corrió todavía, no hay límite."""
    try:
        q = db.table("schedule_periods").select("starts_on, ends_on")
        if owner_id:
            q = q.eq("owner_id", owner_id)
        rows = q.limit(1).execute().data
    except APIError as e:
        log.warning("No se pudo leer el período del horario (¿falta la migración 0005?): %s", getattr(e, "code", ""))
        return Period()
    if not rows:
        return Period()
    r = rows[0]
    return Period(
        starts_on=date.fromisoformat(r["starts_on"]) if r.get("starts_on") else None,
        ends_on=date.fromisoformat(r["ends_on"]) if r.get("ends_on") else None,
    )


def next_class_date(
    weekdays: set[int], after: date, holidays: set[date] = frozenset(), period: Period = Period()
) -> date | None:
    """Primera fecha ESTRICTAMENTE posterior a `after` en que hay clase (salteando feriados y fuera de vigencia)."""
    if not weekdays:
        return None
    for offset in range(1, HORIZON_DAYS + 1):
        d = after + timedelta(days=offset)
        if period.ends_on and d > period.ends_on:
            return None
        if d.weekday() in weekdays and d not in holidays and period.contains(d):
            return d
    return None


def review_date(next_class: date | None, today_: date) -> date:
    """Día para repasar: el día anterior a la próxima clase (nunca antes de hoy).
    Si la materia no tiene horario cargado (o ya terminó): mañana."""
    if next_class is not None:
        return max(today_, next_class - timedelta(days=1))
    return today_ + timedelta(days=1)


class ScheduleInfo:
    """Horario, feriados y vigencia del usuario, cargados una vez por request."""

    def __init__(self, db: SyncPostgrestClient):
        sessions = db.table("class_sessions").select("subject_id, weekday").execute().data
        self.weekdays: dict[int, set[int]] = {}
        for s in sessions:
            self.weekdays.setdefault(s["subject_id"], set()).add(s["weekday"])
        hol = db.table("important_dates").select("date").eq("kind", "holiday").execute().data
        self.holidays = {date.fromisoformat(h["date"]) for h in hol}
        self.period = load_period(db)

    def next_class(self, subject_id: int, after: date) -> date | None:
        return next_class_date(self.weekdays.get(subject_id, set()), after, self.holidays, self.period)

    def review_date_for(self, subject_id: int, after: date, today_: date) -> date:
        """Cuándo repasar algo de esta materia visto en la fecha `after`."""
        # La "próxima clase" se cuenta desde hoy si la fecha del apunte es vieja
        reference = max(after, today_ - timedelta(days=1))
        return review_date(self.next_class(subject_id, reference), today_)
