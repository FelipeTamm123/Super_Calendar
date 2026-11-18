"""Preguntas al aire: la IA detecta la materia y se agendan antes de la próxima clase."""
import logging
from typing import Any

from postgrest import SyncPostgrestClient
from postgrest.types import CountMethod

from app.ai import tasks as ai
from app.ai.client import ai_enabled
from app.modules.questions.schemas import QuestionCreate, QuestionUpdate
from app.modules.subjects.service import find_by_name, get_subject, list_subjects
from app.shared.errors import AppError, NotFound
from app.shared.study_calendar import ScheduleInfo, today

log = logging.getLogger("app.questions")

COLUMNS = "*, subjects(name, color)"


def flatten(row: dict[str, Any]) -> dict[str, Any]:
    subject = row.pop("subjects", None) or {}
    return {**row, "subject_name": subject.get("name"), "subject_color": subject.get("color")}


def list_questions(
    db: SyncPostgrestClient, *, resolved: bool | None, subject_id: int | None, limit: int, offset: int
) -> tuple[list[dict], int]:
    q = db.table("questions").select(COLUMNS, count=CountMethod.exact)
    if resolved is not None:
        q = q.eq("resolved", resolved)
    if subject_id is not None:
        q = q.eq("subject_id", subject_id)
    res = q.order("resolved").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return [flatten(r) for r in res.data], res.count or 0


def _get(db: SyncPostgrestClient, question_id: int) -> dict[str, Any]:
    res = db.table("questions").select(COLUMNS).eq("id", question_id).limit(1).execute()
    if not res.data:
        raise NotFound("Pregunta no encontrada")
    return flatten(res.data[0])


def create_question(db: SyncPostgrestClient, owner_id: str, data: QuestionCreate) -> dict[str, Any]:
    now = today()
    subject_id = data.subject_id
    if subject_id is not None:
        get_subject(db, subject_id)  # valida que exista y sea del usuario
    elif ai_enabled():
        subjects = list_subjects(db)
        if subjects:
            try:
                result = ai.classify_question(text=data.text, subjects=[s["name"] for s in subjects])
                match = find_by_name(subjects, result.subject_name)
                subject_id = match["id"] if match else None
            except AppError as e:
                # Si la IA falla, la pregunta se guarda igual (sin materia): anotarla rápido es lo importante
                log.warning("No se pudo clasificar la pregunta: %s", e.detail)

    scheduled_for = data.scheduled_for
    if scheduled_for is None:
        scheduled_for = ScheduleInfo(db).review_date_for(subject_id, now, now) if subject_id else now

    row = db.table("questions").insert({
        "owner_id": owner_id,
        "text": data.text,
        "subject_id": subject_id,
        "scheduled_for": scheduled_for.isoformat(),
    }).execute().data[0]
    return _get(db, row["id"])


def update_question(db: SyncPostgrestClient, question_id: int, data: QuestionUpdate) -> dict[str, Any]:
    fields = data.model_dump(mode="json", exclude_unset=True)
    if not fields:
        raise AppError(400, "No se envió ningún campo para actualizar")
    if fields.get("text", ...) is None or fields.get("resolved", ...) is None:
        raise AppError(422, "text y resolved no pueden ser null")
    if fields.get("subject_id") is not None:
        get_subject(db, fields["subject_id"])
    res = db.table("questions").update(fields).eq("id", question_id).execute()
    if not res.data:
        raise NotFound("Pregunta no encontrada")
    return _get(db, question_id)


def delete_question(db: SyncPostgrestClient, question_id: int) -> None:
    if not db.table("questions").delete().eq("id", question_id).execute().data:
        raise NotFound("Pregunta no encontrada")
