import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.client import ai_enabled
from app.config import get_settings
from app.db.supabase import get_http_client
from app.modules.agenda.router import router as agenda_router
from app.modules.auth.router import router as auth_router
from app.modules.calendar.router import router as calendar_router
from app.modules.google.router import router as google_router
from app.modules.notes.router import router as notes_router
from app.modules.profiles.router import router as profiles_router
from app.modules.questions.router import router as questions_router
from app.modules.schedule.router import router as schedule_router
from app.modules.subjects.router import router as subjects_router
from app.shared.errors import register_error_handlers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
for noisy in ("httpx", "httpx2"):
    logging.getLogger(noisy).setLevel(logging.WARNING)  # no loguear cada URL interna


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings()  # falla rápido si falta alguna variable de entorno
    yield
    get_http_client().close()
    get_http_client.cache_clear()  # si la app vuelve a arrancar, se crea un pool nuevo


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Super Calendar API",
        version="1.0.0",
        lifespan=lifespan,
        # En producción no publicamos la documentación interactiva
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    register_error_handlers(app)

    v1 = APIRouter(prefix="/api/v1")
    v1.include_router(auth_router)
    v1.include_router(profiles_router)
    v1.include_router(subjects_router)
    v1.include_router(schedule_router)
    v1.include_router(notes_router)
    v1.include_router(questions_router)
    v1.include_router(agenda_router)
    v1.include_router(calendar_router)
    v1.include_router(google_router)

    @v1.get("/status", tags=["health"])
    def status():
        """Para que el frontend sepa qué funciones están disponibles."""
        return {"ai_enabled": ai_enabled()}

    app.include_router(v1)

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
