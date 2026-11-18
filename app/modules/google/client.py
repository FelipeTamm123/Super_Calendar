"""Llamadas a Google (OAuth 2.0 + Calendar API v3) por HTTP.

Permisos mínimos que se piden:
- calendar.app.created: crear el calendario "Super Calendar" y manejar SOLO sus eventos.
- calendar.events.readonly: LEER tus eventos para mostrarlos en el calendario de la página.
- openid + email: saber con qué cuenta te conectaste.
La app nunca puede modificar ni borrar eventos de tus otros calendarios.
"""
import logging
from functools import lru_cache
from typing import Any
from urllib.parse import quote, urlencode

import httpx
import jwt

from app.config import get_settings
from app.shared.errors import AppError

log = logging.getLogger("app.google")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
API_URL = "https://www.googleapis.com/calendar/v3"

SCOPE_APP_CALENDARS = "https://www.googleapis.com/auth/calendar.app.created"
SCOPE_READ_EVENTS = "https://www.googleapis.com/auth/calendar.events.readonly"
SCOPES = ["openid", "email", SCOPE_APP_CALENDARS, SCOPE_READ_EVENTS]


class GoogleNotConfigured(AppError):
    def __init__(self):
        super().__init__(
            503,
            "La conexión con Google no está configurada en el servidor (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)",
            title="Google no disponible",
        )


class GoogleAuthExpired(AppError):
    """El usuario revocó el permiso o el token venció: hay que volver a conectar."""

    def __init__(self):
        super().__init__(401, "La conexión con Google venció o fue revocada: volvé a conectar tu cuenta", title="Reconectar Google")


class GoogleApiError(AppError):
    def __init__(self, status: int, message: str):
        self.google_status = status
        super().__init__(502, f"Google respondió con un error ({status})", title="Error de Google")
        self.google_message = message


@lru_cache
def _http() -> httpx.Client:
    return httpx.Client(timeout=20.0)


def _require_config() -> tuple[str, str]:
    s = get_settings()
    if not s.google_enabled:
        raise GoogleNotConfigured()
    return s.google_client_id, s.google_client_secret.get_secret_value()


def _send(method: str, url: str, **kwargs) -> httpx.Response:
    try:
        return _http().request(method, url, **kwargs)
    except httpx.TransportError as e:
        raise AppError(503, "No se pudo conectar con Google", title="Google no disponible") from e


def authorization_url(state: str) -> str:
    client_id, _ = _require_config()
    params = {
        "client_id": client_id,
        "redirect_uri": get_settings().google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",  # para recibir refresh token y sincronizar sin volver a pedir login
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict[str, Any]:
    """Cambia el código del login por tokens. Devuelve refresh_token, scope y email."""
    client_id, secret = _require_config()
    r = _send("POST", TOKEN_URL, data={
        "code": code,
        "client_id": client_id,
        "client_secret": secret,
        "redirect_uri": get_settings().google_redirect_uri,
        "grant_type": "authorization_code",
    })
    if r.status_code != 200:
        log.warning("Google rechazó el código de autorización: %s", r.text[:200])
        raise AppError(400, "Google rechazó la autorización. Probá conectar de nuevo.")
    data = r.json()
    email = None
    if data.get("id_token"):
        # El id_token viene directo de Google por HTTPS en esta misma respuesta, así que se puede leer sin verificar firma
        email = jwt.decode(data["id_token"], options={"verify_signature": False}).get("email")
    return {"refresh_token": data.get("refresh_token"), "scope": data.get("scope", ""), "email": email}


def access_token(refresh_token: str) -> str:
    client_id, secret = _require_config()
    r = _send("POST", TOKEN_URL, data={
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": secret,
        "grant_type": "refresh_token",
    })
    body = r.json() if "json" in r.headers.get("content-type", "") else {}
    if r.status_code in (400, 401) and body.get("error") in ("invalid_grant", "unauthorized_client"):
        raise GoogleAuthExpired()
    if r.status_code != 200:
        raise GoogleApiError(r.status_code, r.text[:200])
    return r.json()["access_token"]


def revoke(refresh_token: str) -> None:
    try:
        _send("POST", REVOKE_URL, params={"token": refresh_token})
    except AppError:
        log.warning("No se pudo revocar el token de Google")


def api(method: str, path: str, token: str, *, json: Any = None, params: dict | None = None) -> dict[str, Any] | None:
    """Llamada a la Calendar API. 404/410 se devuelven como GoogleApiError con google_status."""
    r = _send(method, f"{API_URL}{path}", headers={"Authorization": f"Bearer {token}"}, json=json, params=params)
    if r.status_code == 401:
        raise GoogleAuthExpired()
    if r.status_code >= 400:
        raise GoogleApiError(r.status_code, r.text[:300])
    return r.json() if r.content else None


def calendar_path(calendar_id: str) -> str:
    return f"/calendars/{quote(calendar_id, safe='')}"
