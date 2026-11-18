import logging
import re
from datetime import date, time
from typing import Any

from postgrest import SyncPostgrestClient
from pydantic import ValidationError

from app.ai import tasks as ai
from app.modules.schedule.schemas import ImportantDateIn, ScheduleDraft, ScheduleIn, SessionIn, SubjectScheduleIn
from app.modules.subjects.service import list_subjects
from app.shared.errors import AppError
from app.shared.study_calendar import load_period, today
from app.shared.uploads import Upload

log = logging.getLogger("app.schedule")


def get_schedule(db: SyncPostgrestClient) -> dict[str, Any]:
    sessions = (
        db.table("class_sessions").select("*, subjects(name, color)")
        .order("weekday").order("start_time").execute().data
    )
    dates = db.table("important_dates").select("*, subjects(name)").order("date").execute().data
    period = load_period(db)
    return {
        "sessions": [
            {
                **{k: v for k, v in s.items() if k != "subjects"},
                "subject_name": s["subjects"]["name"],
                "subject_color": s["subjects"]["color"],
            }
            for s in sessions
        ],
        "important_dates": [
            {
                **{k: v for k, v in d.items() if k != "subjects"},
                "subject_name": d["subjects"]["name"] if d.get("subjects") else None,
            }
            for d in dates
        ],
        "starts_on": period.starts_on,
        "ends_on": period.ends_on,
    }


def apply_schedule(db: SyncPostgrestClient, data: ScheduleIn) -> dict[str, Any]:
    """Reemplaza horario, fechas importantes y vigencia en una sola transacción (función SQL apply_schedule)."""
    db.rpc("apply_schedule", {"payload": data.model_dump(mode="json")}).execute()
    result = get_schedule(db)
    # Si la base no tiene la migración 0005, la vigencia se pierde sin error: avisar
    if (data.starts_on, data.ends_on) != (result["starts_on"], result["ends_on"]):
        raise AppError(
            503,
            "El horario se guardó, pero sin la fecha de vigencia: corré la migración db/migrations/0005_vigencia_horario.sql "
            "en Supabase y volvé a guardarlo",
            title="Base de datos desactualizada",
        )
    # Si la base no tiene la migración 0003, la modalidad y los links se pierden sin error: avisar
    if result["sessions"] and "modality" not in result["sessions"][0]:
        raise AppError(
            503,
            "El horario se guardó, pero sin modalidad ni links: corré la migración db/migrations/0003_modalidad_clases.sql "
            "en Supabase y volvé a guardarlo",
            title="Base de datos desactualizada",
        )
    return result


def _parse_time(value: str) -> time:
    return time.fromisoformat(value.strip().zfill(5))


_URL_RE = re.compile(r"^https?://\S+$")


def _clean_meeting_url(value: str | None) -> str | None:
    """Normaliza el link que leyó la IA. Agrega https:// si falta (ej: 'zoom.us/j/123'); si no es un link válido, None."""
    if not value:
        return None
    url = value.strip().rstrip(".,;)")
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url) and re.match(r"^[\w-]+(\.[\w-]+)+(/\S*)?$", url):
        url = "https://" + url
    return url if _URL_RE.match(url) and len(url) <= 500 else None


def import_from_file(db: SyncPostgrestClient, upload: Upload) -> ScheduleDraft:
    """La IA lee la foto/PDF y arma un BORRADOR. Lo que no valida se descarta y se avisa."""
    existing = [s["name"] for s in list_subjects(db)]
    result = ai.extract_calendar(data=upload.data, media_type=upload.media_type, subjects=existing, today=today())

    warnings = list(result.warnings)
    subjects: list[SubjectScheduleIn] = []
    for s in result.subjects:
        sessions = []
        for sess in s.sessions:
            try:
                url = _clean_meeting_url(sess.meeting_url)
                if sess.meeting_url and not url:
                    warnings.append(f"El link de videollamada de {s.name} no es válido ({sess.meeting_url[:60]}); cargalo a mano.")
                sessions.append(
                    SessionIn(
                        weekday=sess.weekday,
                        start_time=_parse_time(sess.start_time),
                        end_time=_parse_time(sess.end_time),
                        location=(sess.location or "")[:100] or None,
                        modality=sess.modality,
                        meeting_url=url,
                    )
                )
            except (ValueError, ValidationError):
                warnings.append(f"Se descartó un horario de {s.name} que no se pudo interpretar ({sess.start_time}-{sess.end_time}).")
        try:
            subjects.append(SubjectScheduleIn(name=s.name, sessions=sessions))
        except ValidationError:
            warnings.append(f"Se descartó la materia «{s.name[:50]}» porque el nombre no es válido.")

    dates: list[ImportantDateIn] = []
    for d in result.important_dates:
        try:
            dates.append(
                ImportantDateIn(date=date.fromisoformat(d.date), kind=d.kind, title=d.title[:200], subject_name=d.subject_name)
            )
        except (ValueError, ValidationError):
            warnings.append(f"Se descartó la fecha «{d.title[:50]}» porque no se pudo interpretar ({d.date}).")

    starts_on, ends_on = _parse_date(result.period_start), _parse_date(result.period_end)
    if starts_on and ends_on and ends_on < starts_on:
        warnings.append("La vigencia que leyó la IA no tiene sentido (termina antes de empezar); revisala.")
        starts_on = ends_on = None
    if not ends_on:
        warnings.append("No se encontró hasta cuándo vale este horario: elegí la fecha de fin para que las clases no se repitan para siempre.")
    return ScheduleDraft(subjects=subjects, important_dates=dates, warnings=warnings, starts_on=starts_on, ends_on=ends_on)


def _parse_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None
