"""Cifrado y firma con claves derivadas de SUPABASE_SECRET_KEY (no hace falta otra variable de entorno).

- Cifrar el refresh token de Google antes de guardarlo en la base.
- Firmar el parámetro `state` del login con Google (protege contra CSRF).

Si se rota SUPABASE_SECRET_KEY, las conexiones con Google guardadas dejan de poder
descifrarse y hay que volver a conectar (la app lo detecta y lo avisa).
"""
import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.config import get_settings
from app.shared.errors import AppError


def _derive(purpose: bytes) -> bytes:
    secret = get_settings().supabase_secret_key
    if secret is None:
        raise AppError(503, "Falta SUPABASE_SECRET_KEY en el .env", title="Configuración incompleta")
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"super-calendar", info=purpose).derive(
        secret.get_secret_value().encode()
    )


def _fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(_derive(b"google-refresh-token-v1")))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str | None:
    """Devuelve None si no se puede descifrar (por ejemplo, si cambió la clave)."""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return None


def sign_state(subject: str, minutes: int = 10) -> str:
    payload = {"sub": subject, "nonce": secrets.token_urlsafe(16), "exp": datetime.now(UTC) + timedelta(minutes=minutes)}
    return jwt.encode(payload, _derive(b"oauth-state-v1"), algorithm="HS256")


def verify_state(state: str, subject: str) -> bool:
    try:
        payload = jwt.decode(state, _derive(b"oauth-state-v1"), algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return False
    return secrets.compare_digest(str(payload.get("sub")), subject)


def new_feed_token() -> tuple[str, str]:
    """Token secreto para el link .ics y su hash (en la base solo va el hash)."""
    token = secrets.token_urlsafe(32)
    return token, hash_feed_token(token)


def hash_feed_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
