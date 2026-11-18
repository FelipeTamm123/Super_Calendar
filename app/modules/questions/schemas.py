from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

QuestionText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class QuestionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: QuestionText
    subject_id: int | None = Field(default=None, ge=1, description="Si no se manda, la IA detecta la materia")
    scheduled_for: date | None = Field(default=None, description="Si no se manda, se agenda antes de la próxima clase")


class QuestionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: QuestionText | None = None
    subject_id: int | None = Field(default=None, ge=1)
    scheduled_for: date | None = None
    resolved: bool | None = None
    answer: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None = None


class QuestionOut(BaseModel):
    id: int
    text: str
    subject_id: int | None
    subject_name: str | None
    subject_color: str | None
    scheduled_for: date | None
    resolved: bool
    answer: str | None
    created_at: datetime
