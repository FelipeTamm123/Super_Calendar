from collections import Counter
from datetime import timedelta
from typing import Any

from postgrest import SyncPostgrestClient

from app.modules.subjects.schemas import SubjectCreate, SubjectUpdate
from app.shared.errors import AppError, NotFound
from app.shared.study_calendar import ScheduleInfo, today


TABLE = "subjects"


def list_subjects(db: SyncPostgrestClient) -> list[dict[str, Any]]:
    return db.table(TABLE).select("*").order("name").execute().data


def list_with_summary(db: SyncPostgrestClient) -> list[dict[str, Any]]:
    subjects = list_subjects(db)
    q = Counter(r["subject_id"] for r in db.table("questions").select("subject_id").eq("resolved", False).execute().data)
    t = Counter(r["subject_id"] for r in db.table("pending_topics").select("subject_id").eq("resolved", False).execute().data)
    k = Counter(r["subject_id"] for r in db.table("study_tasks").select("subject_id").eq("done", False).execute().data)
    schedule, now = ScheduleInfo(db), today()

    return [
        {
            **s,
            "next_class": schedule.next_class(s["id"], now - timedelta(days=1)),
            "open_questions": q[s["id"]],
            "pending_topics": t[s["id"]],
            "pending_tasks": k[s["id"]],
        }
        for s in subjects
    ]


def get_subject(db: SyncPostgrestClient, subject_id: int) -> dict[str, Any]:
    res = db.table(TABLE).select("*").eq("id", subject_id).limit(1).execute()
    if not res.data:
        raise NotFound("Materia no encontrada")
    return res.data[0]


def find_by_name(subjects: list[dict[str, Any]], name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    wanted = name.strip().lower()
    return next((s for s in subjects if s["name"].strip().lower() == wanted), None)


def get_or_create_by_name(db: SyncPostgrestClient, owner_id: str, subjects: list[dict[str, Any]], name: str) -> dict[str, Any]:
    existing = find_by_name(subjects, name)
    if existing:
        return existing
    created = db.table(TABLE).insert({"name": name.strip()[:100], "owner_id": owner_id}).execute().data[0]
    subjects.append(created)
    return created


def create_subject(db: SyncPostgrestClient, owner_id: str, data: SubjectCreate) -> dict[str, Any]:
    return db.table(TABLE).insert({**data.model_dump(), "owner_id": owner_id}).execute().data[0]


def update_subject(db: SyncPostgrestClient, subject_id: int, data: SubjectUpdate) -> dict[str, Any]:
    fields = data.model_dump(exclude_unset=True, exclude_none=True)
    if not fields:
        raise AppError(400, "No se envió ningún campo para actualizar")
    res = db.table(TABLE).update(fields).eq("id", subject_id).execute()
    if not res.data:
        raise NotFound("Materia no encontrada")
    return res.data[0]


def delete_subject(db: SyncPostgrestClient, subject_id: int) -> None:
    if not db.table(TABLE).delete().eq("id", subject_id).execute().data:
        raise NotFound("Materia no encontrada")


def build_sheet(db: SyncPostgrestClient, subject_id: int) -> dict[str, Any]:
    """Hoja de dudas: se arma en el momento a partir de los datos, así siempre está actualizada."""
    subject = get_subject(db, subject_id)
    questions = (
        db.table("questions").select("id, text, scheduled_for, created_at")
        .eq("subject_id", subject_id).eq("resolved", False).order("created_at").execute().data
    )
    topics = (
        db.table("pending_topics").select("id, topic, note_id, created_at")
        .eq("subject_id", subject_id).eq("resolved", False).order("created_at").execute().data
    )
    tasks = (
        db.table("study_tasks").select("id, title, detail, due_date")
        .eq("subject_id", subject_id).eq("done", False).order("due_date").execute().data
    )

    next_class = ScheduleInfo(db).next_class(subject_id, today() - timedelta(days=1))
    return {"subject": subject, "next_class": next_class, "questions": questions, "topics": topics, "tasks": tasks}
