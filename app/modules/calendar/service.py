"""Calendario: eventos para la página, preferencias de sincronización y link .ics."""
from datetime import UTC, date, datetime, timedelta
from typing import Any

from postgrest import SyncPostgrestClient

from app.config import get_settings
from app.db.supabase import admin_db
from app.modules.calendar.events import CalEvent, CalendarData, sort_key
from app.modules.calendar.ics import build_ics
from app.shared.crypto import hash_feed_token, new_feed_token
from app.shared.errors import AppError, NotFound
from app.shared.study_calendar import today

DEFAULTS = {"include_classes": True, "include_tasks": False, "include_questions": False}
MAX_RANGE_DAYS = 62


# --- Calendario de la página ---------------------------------------------------

def events_between(db: SyncPostgrestClient, owner_id: str, start: date, end: date) -> list[CalEvent]:
    if end < start:
        raise AppError(400, "La fecha final tiene que ser posterior a la inicial")
    if (end - start).days > MAX_RANGE_DAYS:
        raise AppError(400, f"El rango no puede superar {MAX_RANGE_DAYS} días")
    data = CalendarData.load(db, owner_id, start=start, end=end)
    return sorted(data.single_events() + data.class_occurrences(start, end), key=sort_key)


# --- Eventos para calendarios externos (.ics y Google) -------------------------

def export_events(db: SyncPostgrestClient, owner_id: str, prefs: dict[str, Any]) -> tuple[list[CalEvent], CalendarData]:
    """Lo que se manda afuera: fechas importantes siempre; clases, repasos y preguntas según preferencias."""
    now = today()
    data = CalendarData.load(
        db,
        owner_id,
        start=now - timedelta(days=60),
        end=now + timedelta(days=400),
        tasks=prefs.get("include_tasks", False),
        questions=prefs.get("include_questions", False),
        only_pending=True,
    )
    events = data.single_events()
    if prefs.get("include_classes", True):
        events += data.weekly_classes(anchor=now - timedelta(days=now.weekday()))
    return sorted(events, key=sort_key), data


def ics_for(db: SyncPostgrestClient, owner_id: str, prefs: dict[str, Any]) -> str:
    events, data = export_events(db, owner_id, prefs)
    return build_ics(events, owner_id=owner_id, tz_name=get_settings().app_timezone, holidays=data.holidays)


# --- Preferencias ------------------------------------------------------------

def get_row(db: SyncPostgrestClient, owner_id: str) -> dict[str, Any] | None:
    res = db.table("calendar_settings").select("*").eq("owner_id", owner_id).limit(1).execute()
    return res.data[0] if res.data else None


def prefs_of(row: dict[str, Any] | None) -> dict[str, Any]:
    row = row or {}
    return {k: row.get(k, default) for k, default in DEFAULTS.items()}


def settings_out(row: dict[str, Any] | None) -> dict[str, Any]:
    row = row or {}
    return {
        **prefs_of(row),
        "feed_active": bool(row.get("feed_token_hash")),
        "feed_created_at": row.get("feed_created_at"),
        "google": {
            "available": get_settings().google_enabled,
            "connected": bool(row.get("google_refresh_token_enc")),
            "email": row.get("google_email"),
            "connected_at": row.get("google_connected_at"),
            "last_sync_at": row.get("google_last_sync_at"),
            "last_error": row.get("google_last_error"),
        },
    }


def save_row(db: SyncPostgrestClient, owner_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    """Crea la fila si no existe, o actualiza los campos indicados."""
    res = db.table("calendar_settings").upsert({"owner_id": owner_id, **fields}, on_conflict="owner_id").execute()
    return res.data[0]


def update_prefs(db: SyncPostgrestClient, owner_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    if not fields:
        raise AppError(400, "No se envió ningún campo para actualizar")
    return save_row(db, owner_id, fields)


# --- Link .ics -----------------------------------------------------------------

def feed_url(token: str) -> str:
    return f"{get_settings().public_api_url}/api/v1/calendar/feed/{token}.ics"


def rotate_feed(db: SyncPostgrestClient, owner_id: str) -> str:
    """Crea un link nuevo. El anterior deja de funcionar. Solo se guarda el hash del token."""
    token, token_hash = new_feed_token()
    save_row(db, owner_id, {"feed_token_hash": token_hash, "feed_created_at": datetime.now(UTC).isoformat()})
    return feed_url(token)


def delete_feed(db: SyncPostgrestClient, owner_id: str) -> None:
    save_row(db, owner_id, {"feed_token_hash": None, "feed_created_at": None})


def public_feed(token: str) -> str:
    """Link .ics público: el calendario externo no puede mandar login, así que se busca por el token
    con la clave de admin y TODAS las consultas filtran por el dueño de ese token."""
    db = admin_db()
    res = (
        db.table("calendar_settings").select("owner_id, include_classes, include_tasks, include_questions")
        .eq("feed_token_hash", hash_feed_token(token)).limit(1).execute()
    )
    if not res.data:
        raise NotFound("Calendario no encontrado")
    row = res.data[0]
    return ics_for(db, row["owner_id"], prefs_of(row))
