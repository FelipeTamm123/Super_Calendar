from datetime import date, time
from typing import Annotated

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.modules.calendar import service as calendar_service
from app.modules.calendar.schemas import CalendarSettingsOut
from app.modules.google import client as google
from app.modules.google import sync
from app.shared import crypto
from app.shared.errors import AppError
from app.shared.security import AuthUser, UserDB

router = APIRouter(prefix="/google", tags=["google calendar"])


class AuthUrlOut(BaseModel):
    url: str


class CallbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=2048)
    state: str = Field(min_length=1, max_length=2048)


class SyncOut(BaseModel):
    created: int
    updated: int
    deleted: int
    settings: CalendarSettingsOut


class GoogleEventOut(BaseModel):
    id: str
    title: str
    date: date
    end_date: date
    start_time: time | None
    end_time: time | None
    all_day: bool
    location: str | None
    html_link: str | None


@router.get("/auth-url", response_model=AuthUrlOut)
def auth_url(user: AuthUser):
    """Link para iniciar el login con Google. El `state` firmado ata la respuesta a este usuario."""
    return {"url": google.authorization_url(crypto.sign_state(str(user.id)))}


@router.post("/callback", response_model=SyncOut)
async def callback(body: CallbackIn, user: AuthUser, db: UserDB):
    """Termina la conexión (el frontend reenvía acá el `code` que devolvió Google) y hace la primera sincronización."""
    stats = await run_in_threadpool(sync.connect, db, user, body.code, body.state)
    return {**stats, "settings": calendar_service.settings_out(calendar_service.get_row(db, str(user.id)))}


@router.post("/sync", response_model=SyncOut)
async def sync_now(user: AuthUser, db: UserDB):
    stats = await run_in_threadpool(sync.run_sync, db, str(user.id))
    return {**stats, "settings": calendar_service.settings_out(calendar_service.get_row(db, str(user.id)))}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(user: AuthUser, db: UserDB):
    """Desconecta: borra el calendario "Super Calendar" de Google y revoca el permiso."""
    await run_in_threadpool(sync.disconnect, db, str(user.id))


@router.get("/events", response_model=list[GoogleEventOut])
async def events(
    user: AuthUser,
    db: UserDB,
    start: Annotated[date, Query(alias="from")],
    end: Annotated[date, Query(alias="to")],
):
    """Tus eventos de Google (calendario principal) para mostrarlos en el calendario de la página."""
    if end < start or (end - start).days > calendar_service.MAX_RANGE_DAYS:
        raise AppError(400, f"Rango de fechas inválido (máximo {calendar_service.MAX_RANGE_DAYS} días)")
    return await run_in_threadpool(sync.google_events, db, str(user.id), start, end)
