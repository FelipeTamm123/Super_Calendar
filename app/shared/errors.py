"""Errores en formato estándar RFC 9457 (application/problem+json)."""
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException as StarletteHTTPException
from supabase_auth.errors import AuthApiError

log = logging.getLogger("app")

TITLES = {
    400: "Pedido inválido",
    401: "No autenticado",
    403: "Sin permiso",
    404: "No encontrado",
    409: "Conflicto",
    413: "Archivo demasiado grande",
    415: "Formato no soportado",
    422: "Datos inválidos",
    429: "Demasiados pedidos",
    500: "Error interno",
    502: "Error de un servicio externo",
    503: "Servicio no disponible",
}


class AppError(Exception):
    def __init__(self, status: int, detail: str | None = None, *, title: str | None = None):
        self.status = status
        self.title = title or TITLES.get(status, "Error")
        self.detail = detail
        super().__init__(detail or self.title)


class NotFound(AppError):
    def __init__(self, detail: str = "El recurso no existe"):
        super().__init__(404, detail)


class Unauthorized(AppError):
    def __init__(self, detail: str = "Token ausente o inválido"):
        super().__init__(401, detail)


def problem(
    request: Request,
    status: int,
    detail: str | None = None,
    *,
    title: str | None = None,
    errors: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": title or TITLES.get(status, "Error"),
        "status": status,
        "instance": request.url.path,
    }
    if detail:
        body["detail"] = detail
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type="application/problem+json", headers=headers)


# Códigos de error de Postgres/PostgREST -> HTTP
_PG_STATUS = {
    "23505": (409, "Ya existe un registro con esos datos"),
    "23503": (409, "Referencia a un registro inexistente"),
    "23514": (422, "Los datos no cumplen una restricción de la base"),
    "23502": (422, "Falta un campo obligatorio"),
    "22P02": (400, "Formato de dato inválido"),
    "42501": (403, "No tenés permiso para esta operación"),
    "PGRST116": (404, "El recurso no existe"),
    "PGRST204": (503, "La base de datos no está actualizada: corré las migraciones de db/migrations"),
    "PGRST202": (503, "La base de datos no está actualizada: corré las migraciones de db/migrations"),
    "PGRST205": (503, "La base de datos no está actualizada: corré las migraciones de db/migrations"),
    "42P01": (503, "La base de datos no está actualizada: corré las migraciones de db/migrations"),
    "PGRST301": (401, "Token inválido o vencido"),
    "PGRST303": (401, "Token inválido o vencido"),
}

# Errores de Supabase Auth -> HTTP (mensajes propios, sin filtrar detalles internos)
_AUTH_STATUS = {
    "invalid_credentials": (401, "Email o contraseña incorrectos"),
    "email_not_confirmed": (403, "Tenés que confirmar tu email antes de iniciar sesión"),
    "user_already_exists": (409, "Ya existe una cuenta con ese email"),
    "email_exists": (409, "Ya existe una cuenta con ese email"),
    "weak_password": (422, "La contraseña es demasiado débil"),
    "refresh_token_not_found": (401, "Sesión inválida o vencida"),
    "refresh_token_already_used": (401, "Sesión inválida o vencida"),
    "over_request_rate_limit": (429, "Demasiados intentos, probá más tarde"),
    "over_email_send_rate_limit": (429, "Demasiados emails enviados, probá más tarde"),
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status == 401 else None
        return problem(request, exc.status, exc.detail, title=exc.title, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        errors = [
            {"pointer": "/" + "/".join(str(p) for p in e["loc"][1:]), "detail": e["msg"]}
            for e in exc.errors()
        ]
        return problem(request, 422, "Uno o más campos no son válidos", errors=errors)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        return problem(request, exc.status_code, exc.detail if isinstance(exc.detail, str) else None)

    @app.exception_handler(APIError)
    async def _postgrest(request: Request, exc: APIError):
        code = getattr(exc, "code", None) or ""
        status, detail = _PG_STATUS.get(code, (500, "Ocurrió un error inesperado"))
        if status == 500:
            log.error("Error de PostgREST no mapeado: code=%s message=%s", code, getattr(exc, "message", ""))
        return problem(request, status, detail)

    @app.exception_handler(AuthApiError)
    async def _auth(request: Request, exc: AuthApiError):
        code = str(getattr(exc, "code", "") or "")
        if code in _AUTH_STATUS:
            status, detail = _AUTH_STATUS[code]
        elif 400 <= (exc.status or 0) < 500:
            status, detail = exc.status, "No se pudo completar la operación de autenticación"
        else:
            log.error("Error de Supabase Auth: status=%s code=%s", exc.status, code)
            status, detail = 500, "Ocurrió un error inesperado"
        return problem(request, status, detail)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("Error no controlado en %s", request.url.path)
        return problem(request, 500, "Ocurrió un error inesperado")  # nunca mostrar detalles internos
