"""Lógica de autenticación: delega en Supabase Auth (no implementamos auth a mano).

Cada función que abre sesión devuelve (sesión pública, refresh_token). El router
guarda el refresh token en una cookie HttpOnly; nunca se manda en el body.
"""
from app.db.supabase import auth_client
from app.modules.auth.schemas import LoginIn, SessionOut, SignUpIn, SignUpOut, UserOut
from app.shared.errors import AppError, Unauthorized


def _session_out(session) -> tuple[SessionOut, str]:
    out = SessionOut(
        access_token=session.access_token,
        token_type=session.token_type or "bearer",
        expires_in=session.expires_in,
        expires_at=session.expires_at,
        user=UserOut(id=session.user.id, email=session.user.email),
    )
    return out, session.refresh_token


def sign_up(data: SignUpIn) -> tuple[SignUpOut, str | None]:
    options = {"data": {"full_name": data.full_name}} if data.full_name else {}
    res = auth_client().sign_up({"email": data.email, "password": data.password, "options": options})
    if res.user is None:
        raise AppError(400, "No se pudo crear la cuenta")
    session, refresh_token = _session_out(res.session) if res.session else (None, None)
    return SignUpOut(user=UserOut(id=res.user.id, email=res.user.email), session=session), refresh_token


def login(data: LoginIn) -> tuple[SessionOut, str]:
    res = auth_client().sign_in_with_password({"email": data.email, "password": data.password})
    if res.session is None:
        raise Unauthorized("Email o contraseña incorrectos")
    return _session_out(res.session)


def refresh(refresh_token: str) -> tuple[SessionOut, str]:
    res = auth_client().refresh_session(refresh_token)
    if res.session is None:
        raise Unauthorized("Sesión inválida o vencida")
    return _session_out(res.session)


def logout(access_token: str) -> None:
    # Revoca los refresh tokens de esta sesión en Supabase
    auth_client().admin.sign_out(access_token, scope="local")
