from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict

from app.modules.calendar.events import EventKind


class CalendarEventOut(BaseModel):
    key: str
    kind: EventKind
    title: str
    date: date
    start_time: time | None
    end_time: time | None
    subject_name: str | None
    subject_color: str | None
    location: str | None
    meeting_url: str | None
    modality: str | None
    description: str | None
    done: bool
    ref_id: int | None


class GoogleStatus(BaseModel):
    available: bool  # el servidor tiene configuradas las credenciales de Google
    connected: bool
    email: str | None = None
    connected_at: datetime | None = None
    last_sync_at: datetime | None = None
    last_error: str | None = None


class CalendarSettingsOut(BaseModel):
    feed_active: bool
    feed_created_at: datetime | None
    include_classes: bool
    include_tasks: bool
    include_questions: bool
    google: GoogleStatus


class CalendarSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    include_classes: bool | None = None
    include_tasks: bool | None = None
    include_questions: bool | None = None


class FeedOut(BaseModel):
    url: str
