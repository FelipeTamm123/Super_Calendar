"""Acceso a la tabla public.profiles (la única capa que habla con la base)."""
from typing import Any
from uuid import UUID

from postgrest import SyncPostgrestClient

TABLE = "profiles"


def get_by_id(db: SyncPostgrestClient, user_id: UUID) -> dict[str, Any] | None:
    res = db.table(TABLE).select("*").eq("id", str(user_id)).limit(1).execute()
    return res.data[0] if res.data else None


def update(db: SyncPostgrestClient, user_id: UUID, fields: dict[str, Any]) -> dict[str, Any] | None:
    res = db.table(TABLE).update(fields).eq("id", str(user_id)).execute()
    return res.data[0] if res.data else None
