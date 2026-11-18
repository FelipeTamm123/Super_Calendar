from datetime import date, time
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.modules.questions.schemas import QuestionOut

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Detail = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class StudyTaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_id: int = Field(ge=1)
    due_date: date
    title: Title
    detail: Detail | None = None


class StudyTaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    done: bool | None = None
    due_date: date | None = None
    title: Title | None = None
    detail: Detail | None = None


class StudyTaskOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_color: str
    note_id: int | None
    due_date: date
    title: str
    detail: str | None
    done: bool


class TopicCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_id: int = Field(ge=1)
    topic: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]


class TopicUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resolved: bool


class TopicOut(BaseModel):
    id: int
    subject_id: int
    note_id: int | None
    topic: str
    resolved: bool


class TodayClass(BaseModel):
    subject_id: int
    subject_name: str
    subject_color: str
    start_time: time
    end_time: time
    location: str | None
    modality: Literal["in_person", "virtual", "unknown"] = "unknown"
    meeting_url: str | None = None


class UpcomingDate(BaseModel):
    date: date
    kind: Literal["exam", "holiday", "deadline", "other"]
    title: str
    subject_name: str | None


class AgendaOut(BaseModel):
    date: date
    classes: list[TodayClass]
    tasks: list[StudyTaskOut]
    questions: list[QuestionOut]
    upcoming: list[UpcomingDate]
