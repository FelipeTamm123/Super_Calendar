from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Color = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]


class SubjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    color: Color = "#10b981"


class SubjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name | None = None
    color: Color | None = None


class SubjectOut(BaseModel):
    id: int
    name: str
    color: str
    created_at: datetime


class SubjectSummary(SubjectOut):
    next_class: date | None = None
    open_questions: int = 0
    pending_topics: int = 0
    pending_tasks: int = 0


# --- Hoja de dudas -----------------------------------------------------------

class SheetQuestion(BaseModel):
    id: int
    text: str
    scheduled_for: date | None
    created_at: datetime


class SheetTopic(BaseModel):
    id: int
    topic: str
    note_id: int | None
    created_at: datetime


class SheetTask(BaseModel):
    id: int
    title: str
    detail: str | None
    due_date: date


class SubjectSheet(BaseModel):
    subject: SubjectOut
    next_class: date | None
    questions: list[SheetQuestion]
    topics: list[SheetTopic]
    tasks: list[SheetTask]
