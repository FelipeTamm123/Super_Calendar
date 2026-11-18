"""Conexión con Supabase (PostgREST).

Por defecto cada request habla con la base USANDO EL TOKEN DEL USUARIO, así
Postgres aplica las políticas RLS (Row Level Security): un usuario nunca puede
leer/modificar filas que no le pertenecen, aunque haya un bug en el backend.
"""
from functools import lru_cache

import httpx
from postgrest import SyncPostgrestClient
from storage3 import SyncStorageClient
from supabase_auth import SyncGoTrueClient

from app.config import get_settings


@lru_cache
def get_http_client() -> httpx.Client:
    """Un único pool de conexiones HTTP compartido por toda la app."""
    return httpx.Client(timeout=10.0, follow_redirects=True)


def _rest_client(bearer: str, apikey: str) -> SyncPostgrestClient:
    # No cerrar este cliente (ni usarlo con `with`): postgrest cerraría el pool compartido.
    return SyncPostgrestClient(
        get_settings().rest_url,
        headers={
            "apikey": apikey,
            "Authorization": f"Bearer {bearer}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        http_client=get_http_client(),
    )


def user_db(access_token: str) -> SyncPostgrestClient:
    """Cliente con los permisos del usuario logueado (respeta RLS)."""
    key = get_settings().supabase_publishable_key.get_secret_value()
    return _rest_client(access_token, key)


def admin_db() -> SyncPostgrestClient:
    """Cliente con la secret key: SALTEA RLS. Usar solo en tareas internas/admin."""
    secret = get_settings().supabase_secret_key
    if secret is None:
        raise RuntimeError("SUPABASE_SECRET_KEY no está configurada")
    key = secret.get_secret_value()
    return _rest_client(key, key)


NOTES_BUCKET = "notes"


def upload_note_file(access_token: str, path: str, data: bytes, content_type: str) -> None:
    """Sube un archivo al bucket privado con el token del usuario (aplican las políticas de Storage)."""
    with _storage(access_token) as storage:
        # cache-control corto: un archivo borrado no queda servido por el CDN más que el link (5 min)
        storage.from_(NOTES_BUCKET).upload(
            path, data, {"content-type": content_type, "upsert": "false", "cache-control": "300"}
        )


def signed_note_url(access_token: str, path: str, expires_in: int = 300) -> str:
    """Link temporal (5 min por defecto) para ver un archivo privado."""
    with _storage(access_token) as storage:
        res = storage.from_(NOTES_BUCKET).create_signed_url(path, expires_in)
    url = (res.get("signedURL") or res.get("signedUrl")) if isinstance(res, dict) else str(res)
    if not url:
        raise RuntimeError("Supabase Storage no devolvió un link firmado")
    return url


def remove_note_file(access_token: str, path: str) -> None:
    with _storage(access_token) as storage:
        storage.from_(NOTES_BUCKET).remove([path])


class _storage:
    """Cliente de Storage con sesión HTTP propia que se cierra al terminar."""

    def __init__(self, access_token: str):
        s = get_settings()
        self.client = SyncStorageClient(
            s.storage_url,
            {"apikey": s.supabase_publishable_key.get_secret_value(), "Authorization": f"Bearer {access_token}"},
        )

    def __enter__(self) -> SyncStorageClient:
        return self.client

    def __exit__(self, *exc) -> None:
        self.client.session.close()


def auth_client() -> SyncGoTrueClient:
    """Cliente de Supabase Auth sin estado (no guarda sesión entre requests)."""
    s = get_settings()
    return SyncGoTrueClient(
        url=s.auth_url,
        headers={"apikey": s.supabase_publishable_key.get_secret_value()},
        auto_refresh_token=False,
        persist_session=False,
        http_client=get_http_client(),
    )
