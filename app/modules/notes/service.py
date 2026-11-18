"""Apuntes: guardar, analizar con IA y generar la agenda de repaso."""
import logging
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

from postgrest import SyncPostgrestClient
from postgrest.types import CountMethod

from app.ai import tasks as ai
from app.ai.client import ai_enabled
from app.db.supabase import remove_note_file, signed_note_url, upload_note_file
from app.modules.subjects.service import get_or_create_by_name, get_subject, list_subjects
from app.shared.errors import AppError, NotFound
from app.shared.security import CurrentUser
from app.shared.study_calendar import ScheduleInfo, today
from app.shared.uploads import Upload

log = logging.getLogger("app.notes")

LIST_COLUMNS = "id, subject_id, class_date, title, summary, file_type, created_at, subjects(name, color)"


def _flatten(row: dict[str, Any]) -> dict[str, Any]:
    subject = row.pop("subjects", None) or {}
    return {**row, "subject_name": subject.get("name", ""), "subject_color": subject.get("color", "#10b981")}


def list_notes(db: SyncPostgrestClient, *, subject_id: int | None, limit: int, offset: int) -> tuple[list[dict], int]:
    q = db.table("notes").select(LIST_COLUMNS, count=CountMethod.exact)
    if subject_id is not None:
        q = q.eq("subject_id", subject_id)
    res = q.order("class_date", desc=True).order("id", desc=True).range(offset, offset + limit - 1).execute()
    return [_flatten(r) for r in res.data], res.count or 0


def get_note(db: SyncPostgrestClient, note_id: int) -> dict[str, Any]:
    res = db.table("notes").select(LIST_COLUMNS + ", content, file_path").eq("id", note_id).limit(1).execute()
    if not res.data:
        raise NotFound("Apunte no encontrado")
    note = _flatten(res.data[0])
    note["tasks"] = (
        db.table("study_tasks").select("id, title, detail, due_date, done").eq("note_id", note_id).order("due_date").execute().data
    )
    note["topics"] = db.table("pending_topics").select("id, topic, resolved").eq("note_id", note_id).order("id").execute().data
    return note


def file_link(db: SyncPostgrestClient, user: CurrentUser, note_id: int) -> dict[str, Any]:
    res = db.table("notes").select("file_path").eq("id", note_id).limit(1).execute()
    if not res.data:
        raise NotFound("Apunte no encontrado")
    path = res.data[0]["file_path"]
    if not path:
        raise NotFound("Este apunte no tiene archivo")
    return {"url": signed_note_url(user.token, path, 300), "expires_in": 300}


def _parse_ai_date(value: str | None, now: date) -> date | None:
    """Fecha que detectó la IA; se descarta si es inválida o absurda (futuro lejano / muy vieja)."""
    if not value:
        return None
    try:
        d = date.fromisoformat(value)
    except ValueError:
        return None
    return d if now - timedelta(days=365) <= d <= now + timedelta(days=1) else None


def create_note(
    db: SyncPostgrestClient,
    user: CurrentUser,
    *,
    subject_id: int | None,
    class_date: date | None,
    title: str | None,
    text: str | None,
    upload: Upload | None,
) -> dict[str, Any]:
    now = today()
    owner = str(user.id)
    text = (text or "").strip() or None

    if upload and upload.is_text:  # un .txt se trata como texto escrito
        text = "\n\n".join(filter(None, [text, upload.data.decode("utf-8").strip()])) or None
    binary = (upload.data, upload.media_type) if upload and not upload.is_text else None
    if not text and not binary:
        raise AppError(422, "Escribí el apunte o subí un archivo")

    subjects = list_subjects(db)
    subject = get_subject(db, subject_id) if subject_id else None

    # 1) Análisis con IA (si está configurada)
    analysis = None
    if ai_enabled():
        analysis = ai.analyze_note(
            subjects=[s["name"] for s in subjects],
            today=now,
            text=text,
            file=binary,
            subject_hint=subject["name"] if subject else None,
        )
    elif subject is None:
        raise AppError(422, "Elegí la materia: la IA no está configurada para detectarla sola")

    if subject is None:
        subject = get_or_create_by_name(db, owner, subjects, analysis.subject_name)

    final_date = class_date or (_parse_ai_date(analysis.class_date, now) if analysis else None) or now
    final_title = (title or "").strip() or (analysis.title.strip()[:200] if analysis else "") or f"Clase del {final_date:%d/%m/%Y}"
    content = text or (analysis.transcription.strip() if analysis and analysis.transcription.strip() else None)

    # 2) Guardar el archivo original en Storage (carpeta privada del usuario)
    file_path = None
    if upload:
        file_path = f"{owner}/{uuid4().hex}.{upload.extension}"
        upload_note_file(user.token, file_path, upload.data, upload.media_type)

    # 3) Guardar apunte + temas pendientes + agenda de repaso
    try:
        note = db.table("notes").insert({
            "owner_id": owner,
            "subject_id": subject["id"],
            "class_date": final_date.isoformat(),
            "title": final_title,
            "content": content[:100000] if content else None,
            "summary": analysis.summary[:5000] if analysis else None,
            "file_path": file_path,
            "file_type": upload.media_type if upload else None,
        }).execute().data[0]

        if analysis:
            topics = [t.strip()[:300] for t in analysis.pending_topics if t.strip()]
            if topics:
                db.table("pending_topics").insert(
                    [{"owner_id": owner, "subject_id": subject["id"], "note_id": note["id"], "topic": t} for t in topics]
                ).execute()

            due = ScheduleInfo(db).review_date_for(subject["id"], final_date, now)
            items = [i for i in analysis.review_items if i.title.strip()]
            if items:
                db.table("study_tasks").insert([
                    {
                        "owner_id": owner,
                        "subject_id": subject["id"],
                        "note_id": note["id"],
                        "due_date": due.isoformat(),
                        "title": i.title.strip()[:300],
                        "detail": i.detail.strip()[:2000] or None,
                    }
                    for i in items
                ]).execute()
    except Exception:
        if file_path:  # no dejar archivos huérfanos si falló la base
            try:
                remove_note_file(user.token, file_path)
            except Exception:
                log.warning("No se pudo borrar el archivo huérfano %s", file_path)
        raise

    detail = get_note(db, note["id"])
    detail["ai_used"] = analysis is not None
    return detail


def delete_note(db: SyncPostgrestClient, user: CurrentUser, note_id: int) -> None:
    res = db.table("notes").delete().eq("id", note_id).execute()  # borra en cascada su agenda y temas
    if not res.data:
        raise NotFound("Apunte no encontrado")
    path = res.data[0].get("file_path")
    if path:
        try:
            remove_note_file(user.token, path)
        except Exception:
            log.warning("No se pudo borrar el archivo %s del apunte %s", path, note_id)
