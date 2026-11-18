from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, Query, Response, status

from app.modules.calendar import service
from app.modules.calendar.schemas import CalendarEventOut, CalendarSettingsOut, CalendarSettingsUpdate, FeedOut
from app.modules.google.sync import queue_google_sync
from app.shared.security import AuthUser, UserDB

router = APIRouter(prefix="/calendar", tags=["calendario"])

ICS_HEADERS = {"Cache-Control": "private, max-age=900", "X-Content-Type-Options": "nosniff"}


@router.get("/events", response_model=list[CalendarEventOut])
def list_events(
    user: AuthUser,
    db: UserDB,
    start: Annotated[date, Query(alias="from")],
    end: Annotated[date, Query(alias="to")],
):
    """Todo lo del rango, día por día: clases, fechas importantes, repasos y preguntas."""
    return service.events_between(db, str(user.id), start, end)


@router.get("/settings", response_model=CalendarSettingsOut)
def get_settings_(user: AuthUser, db: UserDB):
    return service.settings_out(service.get_row(db, str(user.id)))


@router.patch("/settings", response_model=CalendarSettingsOut)
def update_settings(body: CalendarSettingsUpdate, user: AuthUser, db: UserDB, background: BackgroundTasks):
    row = service.update_prefs(db, str(user.id), body.model_dump(exclude_unset=True, exclude_none=True))
    queue_google_sync(background, user)
    return service.settings_out(row)


@router.post("/feed", response_model=FeedOut)
def create_feed(user: AuthUser, db: UserDB):
    """Genera el link secreto .ics. Si ya había uno, el anterior deja de funcionar."""
    return {"url": service.rotate_feed(db, str(user.id))}


@router.delete("/feed", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed(user: AuthUser, db: UserDB):
    service.delete_feed(db, str(user.id))


@router.get("/export.ics", response_class=Response)
def export_ics(user: AuthUser, db: UserDB):
    """Descarga el .ics una vez (para importarlo a mano)."""
    prefs = service.prefs_of(service.get_row(db, str(user.id)))
    return Response(
        service.ics_for(db, str(user.id), prefs),
        media_type="text/calendar; charset=utf-8",
        headers={**ICS_HEADERS, "Content-Disposition": 'attachment; filename="super-calendar.ics"'},
    )


@router.get("/feed/{token}.ics", response_class=Response, include_in_schema=False)
def public_feed(token: Annotated[str, Path(min_length=20, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")]):
    """Link público y secreto al que se suscriben Google, Apple u Outlook (no lleva login)."""
    return Response(service.public_feed(token), media_type="text/calendar; charset=utf-8", headers=ICS_HEADERS)
