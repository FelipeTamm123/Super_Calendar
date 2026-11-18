"""Autenticación: verifica el JWT de Supabase con sus claves públicas (JWKS)."""
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest import SyncPostgrestClient

from app.config import get_settings
from app.db.supabase import user_db
from app.shared.errors import Unauthorized

# Fijamos los algoritmos aceptados: nunca dejar que el token elija ("none", HS256, etc.)
ALLOWED_ALGS = ["ES256", "RS256"]

# Tolerancia para diferencias de reloj entre esta PC y Supabase: si el reloj local
# está atrasado unos segundos, el token parece emitido "en el futuro" y se rechazaría.
CLOCK_SKEW_SECONDS = 30

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    role: str
    token: str


@lru_cache
def get_jwks_client() -> jwt.PyJWKClient:
    # Cachea las claves públicas para no pedirlas en cada request
    return jwt.PyJWKClient(get_settings().supabase_jwks_url, cache_jwk_set=True, lifespan=600)


def decode_token(token: str) -> dict:
    s = get_settings()
    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=ALLOWED_ALGS,
            audience="authenticated",
            issuer=s.auth_url,
            leeway=CLOCK_SKEW_SECONDS,
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise Unauthorized("El token venció") from e
    except (jwt.PyJWTError, jwt.PyJWKClientError) as e:
        raise Unauthorized() from e


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> CurrentUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise Unauthorized()
    claims = decode_token(creds.credentials)
    try:
        user_id = UUID(claims["sub"])
    except ValueError as e:
        raise Unauthorized() from e
    return CurrentUser(
        id=user_id,
        email=claims.get("email"),
        role=claims.get("role", ""),
        token=creds.credentials,
    )


def get_db(user: Annotated[CurrentUser, Depends(get_current_user)]) -> SyncPostgrestClient:
    """Cliente de base de datos con los permisos del usuario actual (RLS).

    OJO: no usar `with`. El cliente comparte el pool HTTP de toda la app y
    postgrest lo cerraría al salir del bloque, rompiendo los requests siguientes.
    """
    return user_db(user.token)


AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
UserDB = Annotated[SyncPostgrestClient, Depends(get_db)]
