"""Sincronización con Google Calendar.

App -> Google: los eventos de la app se escriben en un calendario aparte llamado
"Super Calendar" (no se mezcla con tus eventos personales). Se reconcilia por `key`:
lo nuevo se crea, lo que cambió se actualiza (mismo evento de Google) y lo que ya no
existe se borra. Se ejecuta sola, en segundo plano, después de cada cambio.

Google -> App: tus eventos de Google se LEEN para mostrarlos en el calendario de la página.
"""
import hashlib
import json
import logging
import threading
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks
from postgrest import SyncPostgrestClient

from app.config import get_settings
from app.db.supabase import user_db
from app.modules.calendar import service as calendar_service
from app.modules.calendar.events import CalEvent
from app.modules.calendar.ics import description_for, summary_for, weekly_rule
from app.modules.google import client as google
from app.shared import crypto
from app.shared.errors import AppError
from app.shared.security import CurrentUser

log = logging.getLogger("app.google")

CALENDAR_NAME = "Super Calendar"
_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)  # una sincronización a la vez por usuario


# --- Armar los eventos para Google -------------------------------------------

def _all_day(d: date) -> dict[str, str]:
    return {"date": d.isoformat()}


def _timed(d: date, t: time, tz: str) -> dict[str, str]:
    return {"dateTime": datetime.combine(d, t).isoformat(), "timeZone": tz}


def event_payload(e: CalEvent, holidays: set[date], tz: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "summary": summary_for(e),
        "description": description_for(e),
    }
    if e.all_day:
        payload["start"] = _all_day(e.date)
        payload["end"] = _all_day(e.date + timedelta(days=1))
        payload["transparency"] = "transparent"  # un día completo no te marca como ocupado
    else:
        payload["start"] = _timed(e.date, e.start_time, tz)
        payload["end"] = _timed(e.date, e.end_time or e.start_time, tz)
    if e.weekday is not None:
        rules = [f"RRULE:{weekly_rule(e, tz)}"]
        excluded = [h for h in sorted(holidays) if h.weekday() == e.weekday and h >= e.date and (e.until is None or h <= e.until)]
        if excluded:
            rules.append("EXDATE;TZID=" + tz + ":" + ",".join(f"{h:%Y%m%d}T{e.start_time:%H%M%S}" for h in excluded))
        payload["recurrence"] = rules
    location = e.meeting_url if e.modality == "virtual" and e.meeting_url else e.location
    if location:
        payload["location"] = location
    if e.kind == "exam":  # recordatorios: el día anterior a las 18 h y 3 días antes
        payload["reminders"] = {"useDefault": False, "overrides": [{"method": "popup", "minutes": 360}, {"method": "popup", "minutes": 2 * 1440 + 360}]}
    elif e.all_day:
        payload["reminders"] = {"useDefault": False, "overrides": []}
    return payload


def payload_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# --- Sincronizar --------------------------------------------------------------

def _connection(db: SyncPostgrestClient, owner_id: str) -> tuple[dict[str, Any], str]:
    row = calendar_service.get_row(db, owner_id)
    if not row or not row.get("google_refresh_token_enc"):
        raise AppError(409, "Tu cuenta de Google no está conectada", title="Google no conectado")
    refresh = crypto.decrypt(row["google_refresh_token_enc"])
    if refresh is None:
        raise google.GoogleAuthExpired()
    return row, refresh


def _ensure_calendar(db: SyncPostgrestClient, owner_id: str, row: dict[str, Any], token: str) -> str:
    cal_id = row.get("google_calendar_id")
    if cal_id:
        try:
            google.api("GET", google.calendar_path(cal_id), token)
            return cal_id
        except google.GoogleApiError as e:
            if e.google_status not in (403, 404, 410):
                raise
            # Lo borraron desde Google: se crea de nuevo y se olvidan los eventos viejos
            db.table("google_event_links").delete().eq("owner_id", owner_id).execute()
    created = google.api("POST", "/calendars", token, json={"summary": CALENDAR_NAME, "timeZone": get_settings().app_timezone})
    calendar_service.save_row(db, owner_id, {"google_calendar_id": created["id"]})
    return created["id"]


def run_sync(db: SyncPostgrestClient, owner_id: str) -> dict[str, int]:
    """Reconciliación completa app -> Google. Devuelve cuántos eventos creó, actualizó y borró."""
    with _locks[owner_id]:
        try:
            row, refresh = _connection(db, owner_id)
            token = google.access_token(refresh)
            cal_id = _ensure_calendar(db, owner_id, row, token)
            events_path = google.calendar_path(cal_id) + "/events"

            events, data = calendar_service.export_events(db, owner_id, calendar_service.prefs_of(row))
            tz = get_settings().app_timezone
            desired = {e.key: event_payload(e, data.holidays, tz) for e in events}
            links = {l["key"]: l for l in db.table("google_event_links").select("*").eq("owner_id", owner_id).execute().data}
            stats = {"created": 0, "updated": 0, "deleted": 0}

            for key, payload in desired.items():
                h = payload_hash(payload)
                link = links.get(key)
                if link and link["payload_hash"] == h:
                    continue
                if link:
                    try:
                        google.api("PUT", f"{events_path}/{link['google_event_id']}", token, json=payload)
                        db.table("google_event_links").update({"payload_hash": h}).eq("owner_id", owner_id).eq("key", key).execute()
                        stats["updated"] += 1
                        continue
                    except google.GoogleApiError as e:
                        if e.google_status not in (404, 410):
                            raise
                        # el evento se borró en Google: se vuelve a crear
                created = google.api("POST", events_path, token, json=payload)
                db.table("google_event_links").upsert(
                    {"owner_id": owner_id, "key": key, "google_event_id": created["id"], "payload_hash": h},
                    on_conflict="owner_id,key",
                ).execute()
                stats["created"] += 1

            for key, link in links.items():
                if key in desired:
                    continue
                try:
                    google.api("DELETE", f"{events_path}/{link['google_event_id']}", token)
                except google.GoogleApiError as e:
                    if e.google_status not in (404, 410):
                        raise
                db.table("google_event_links").delete().eq("owner_id", owner_id).eq("key", key).execute()
                stats["deleted"] += 1

            calendar_service.save_row(db, owner_id, {"google_last_sync_at": datetime.now(UTC).isoformat(), "google_last_error": None})
            return stats
        except google.GoogleAuthExpired:
            calendar_service.save_row(db, owner_id, {
                "google_refresh_token_enc": None,
                "google_last_error": "La conexión con Google venció o fue revocada: volvé a conectar tu cuenta",
            })
            raise
        except AppError as e:
            calendar_service.save_row(db, owner_id, {"google_last_error": (e.detail or e.title)[:500]})
            raise


def _background_sync(token: str, owner_id: str) -> None:
    try:
        db = user_db(token)
        row = calendar_service.get_row(db, owner_id)
        if row and row.get("google_refresh_token_enc"):
            stats = run_sync(db, owner_id)
            log.info("Google sincronizado: %s", stats)
    except Exception:  # en segundo plano no hay a quién devolverle el error: queda en google_last_error
        log.exception("Falló la sincronización con Google en segundo plano")


def queue_google_sync(background: BackgroundTasks, user: CurrentUser) -> None:
    """Después de un cambio, sincroniza con Google en segundo plano (si el usuario lo conectó)."""
    if get_settings().google_enabled:
        background.add_task(_background_sync, user.token, str(user.id))


# --- Conectar / desconectar ----------------------------------------------------

def connect(db: SyncPostgrestClient, user: CurrentUser, code: str, state: str) -> dict[str, int]:
    owner_id = str(user.id)
    if not crypto.verify_state(state, owner_id):
        raise AppError(400, "La autorización de Google venció o no es válida. Probá conectar de nuevo.")
    tokens = google.exchange_code(code)
    granted = set(tokens["scope"].split())
    if google.SCOPE_APP_CALENDARS not in granted:
        if tokens.get("refresh_token"):
            google.revoke(tokens["refresh_token"])
        raise AppError(400, "Para sincronizar hace falta aceptar el permiso de calendarios. Probá conectar de nuevo.")
    if not tokens.get("refresh_token"):
        raise AppError(400, "Google no devolvió un permiso permanente. Quitá el acceso de la app en tu cuenta de Google y conectá de nuevo.")
    calendar_service.save_row(db, owner_id, {
        "google_refresh_token_enc": crypto.encrypt(tokens["refresh_token"]),
        "google_email": tokens.get("email"),
        "google_connected_at": datetime.now(UTC).isoformat(),
        "google_last_error": None,
    })
    return run_sync(db, owner_id)


def disconnect(db: SyncPostgrestClient, owner_id: str) -> None:
    """Borra el calendario "Super Calendar" de Google, revoca el permiso y olvida la conexión."""
    row = calendar_service.get_row(db, owner_id) or {}
    enc = row.get("google_refresh_token_enc")
    refresh = crypto.decrypt(enc) if enc else None
    if refresh:
        try:
            if row.get("google_calendar_id"):
                google.api("DELETE", google.calendar_path(row["google_calendar_id"]), google.access_token(refresh))
        except AppError:
            log.warning("No se pudo borrar el calendario de Google al desconectar")
        google.revoke(refresh)
    db.table("google_event_links").delete().eq("owner_id", owner_id).execute()
    calendar_service.save_row(db, owner_id, {
        "google_refresh_token_enc": None,
        "google_calendar_id": None,
        "google_email": None,
        "google_connected_at": None,
        "google_last_sync_at": None,
        "google_last_error": None,
    })


# --- Leer tus eventos de Google --------------------------------------------------

def google_events(db: SyncPostgrestClient, owner_id: str, start: date, end: date) -> list[dict[str, Any]]:
    row, refresh = _connection(db, owner_id)
    token = google.access_token(refresh)
    tz = ZoneInfo(get_settings().app_timezone)
    data = google.api("GET", "/calendars/primary/events", token, params={
        "timeMin": datetime.combine(start, time.min, tz).isoformat(),
        "timeMax": datetime.combine(end + timedelta(days=1), time.min, tz).isoformat(),
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "250",
    }) or {}
    out = []
    for ev in data.get("items", []):
        if ev.get("status") == "cancelled":
            continue
        s, e = ev.get("start", {}), ev.get("end", {})
        all_day = "date" in s
        start_dt = date.fromisoformat(s["date"]) if all_day else datetime.fromisoformat(s["dateTime"]).astimezone(tz)
        end_dt = date.fromisoformat(e["date"]) if all_day else datetime.fromisoformat(e["dateTime"]).astimezone(tz)
        out.append({
            "id": ev["id"],
            "title": ev.get("summary") or "(Sin título)",
            "date": start_dt if all_day else start_dt.date(),
            "end_date": (end_dt - timedelta(days=1)) if all_day else end_dt.date(),
            "start_time": None if all_day else start_dt.time().replace(tzinfo=None),
            "end_time": None if all_day else end_dt.time().replace(tzinfo=None),
            "all_day": all_day,
            "location": ev.get("location"),
            "html_link": ev.get("htmlLink"),
        })
    return out
