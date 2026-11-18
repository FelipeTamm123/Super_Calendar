from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from app.config import get_settings
from app.modules.auth import service
from app.modules.auth.schemas import LoginIn, SessionOut, SignUpIn, SignUpOut, UserOut
from app.shared.errors import Unauthorized
from app.shared.security import AuthUser

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "super_calendar_refresh"
COOKIE_PATH = "/api/v1/auth"  # el navegador solo la manda a las rutas de auth
COOKIE_MAX_AGE = 60 * 60 * 24 * 30


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=COOKIE_MAX_AGE,
        path=COOKIE_PATH,
        httponly=True,  # JavaScript no la puede leer (protege contra XSS)
        secure=get_settings().is_production,  # solo HTTPS en producción
        samesite="strict",  # no se envía desde otros sitios (protege contra CSRF)
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, httponly=True, samesite="strict")


@router.post("/signup", response_model=SignUpOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignUpIn, response: Response):
    out, refresh_token = service.sign_up(body)
    if refresh_token:
        _set_refresh_cookie(response, refresh_token)
    return out


@router.post("/login", response_model=SessionOut)
def login(body: LoginIn, response: Response):
    out, refresh_token = service.login(body)
    _set_refresh_cookie(response, refresh_token)
    return out


@router.post("/refresh", response_model=SessionOut)
def refresh(response: Response, super_calendar_refresh: Annotated[str | None, Cookie(max_length=512)] = None):
    if not super_calendar_refresh:
        raise Unauthorized("No hay una sesión activa")
    out, refresh_token = service.refresh(super_calendar_refresh)
    _set_refresh_cookie(response, refresh_token)  # Supabase rota el refresh token en cada uso
    return out


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: AuthUser, response: Response):
    service.logout(user.token)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: AuthUser):
    return UserOut(id=user.id, email=user.email)
