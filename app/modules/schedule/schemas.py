from datetime import date, time
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

DateKind = Literal["exam", "holiday", "deadline", "other"]
Modality = Literal["in_person", "virtual", "unknown"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
# Solo links http(s): evita que se guarde algo como "javascript:..." y se muestre como link
MeetingUrl = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://\S+$")]


class SessionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weekday: int = Field(ge=0, le=6, description="0 = lunes ... 6 = domingo")
    start_time: time
    end_time: time
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    modality: Modality = "unknown"
    meeting_url: MeetingUrl | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.end_time <= self.start_time:
            raise ValueError("La hora de fin tiene que ser posterior a la de inicio")
        if self.meeting_url and self.modality == "unknown":
            self.modality = "virtual"  # si tiene link de videollamada, es virtual
        return self


class SubjectScheduleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    color: Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")] | None = None
    sessions: list[SessionIn] = Field(default_factory=list, max_length=20)


class ImportantDateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    kind: DateKind
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    subject_name: Name | None = None


class ScheduleIn(BaseModel):
    """Horario completo. Se usa para guardar lo que armó la IA (revisado) o una edición manual."""

    model_config = ConfigDict(extra="forbid")
    subjects: list[SubjectScheduleIn] = Field(max_length=40)
    important_dates: list[ImportantDateIn] = Field(default_factory=list, max_length=300)
    # Vigencia del horario (ej: el cuatrimestre). Sin fechas = las clases se repiten sin fin.
    starts_on: date | None = None
    ends_on: date | None = None

    @model_validator(mode="after")
    def _check_period(self):
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("La fecha de fin del horario tiene que ser posterior a la de inicio")
        if self.starts_on and self.ends_on and (self.ends_on - self.starts_on).days > 3 * 366:
            raise ValueError("El horario no puede durar más de 3 años")
        return self


class ScheduleDraft(ScheduleIn):
    """Borrador que devuelve la IA al leer una foto. NO se guarda hasta que el usuario lo confirma."""

    warnings: list[str] = Field(default_factory=list)


class SessionOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_color: str
    weekday: int
    start_time: time
    end_time: time
    location: str | None
    modality: Modality = "unknown"
    meeting_url: str | None = None


class ImportantDateOut(BaseModel):
    id: int
    date: date
    kind: DateKind
    title: str
    subject_id: int | None
    subject_name: str | None


class ScheduleOut(BaseModel):
    sessions: list[SessionOut]
    important_dates: list[ImportantDateOut]
    starts_on: date | None = None
    ends_on: date | None = None
