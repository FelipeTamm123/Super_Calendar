from datetime import date, datetime

from pydantic import BaseModel


class NoteListItem(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_color: str
    class_date: date
    title: str
    summary: str | None
    file_type: str | None
    created_at: datetime


class NoteTask(BaseModel):
    id: int
    title: str
    detail: str | None
    due_date: date
    done: bool


class NoteTopic(BaseModel):
    id: int
    topic: str
    resolved: bool


class NoteDetail(NoteListItem):
    content: str | None
    tasks: list[NoteTask]
    topics: list[NoteTopic]
    ai_used: bool = True


class FileLink(BaseModel):
    url: str
    expires_in: int
