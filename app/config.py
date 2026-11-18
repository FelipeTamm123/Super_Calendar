"""Configuración leída UNA sola vez al arrancar. Si falta una variable obligatoria, la app no arranca."""
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_publishable_key: SecretStr
    supabase_secret_key: SecretStr | None = None  # solo para tareas admin (saltea RLS)
    supabase_jwks_url: str

    # IA (Gemini). Sin clave, las funciones de IA responden 503 y el resto de la app sigue andando.
    gemini_api_key: SecretStr | None = None
    ai_model: str = "gemini-3.5-flash-lite"

    # Zona horaria para calcular "hoy" y la próxima clase
    app_timezone: str = "America/Argentina/Buenos_Aires"

    # Google Calendar (opcional). Sin estas dos variables, la conexión con Google queda desactivada
    # (el link .ics funciona igual).
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str = "http://localhost:5173/calendario/google/callback"

    # URL pública del backend, para armar el link .ics (Google tiene que poder llegar a ella)
    public_api_url: str = "http://localhost:8000"

    app_env: str = "development"
    cors_origins: list[str] = []

    @field_validator("supabase_url", "public_api_url")
    @classmethod
    def _strip_slash(cls, v: str) -> str:
        return v.rstrip("/")

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @field_validator("app_timezone")
    @classmethod
    def _valid_tz(cls, v: str) -> str:
        ZoneInfo(v)  # falla al arrancar si la zona no existe
        return v

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"

    @property
    def auth_url(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def storage_url(self) -> str:
        return f"{self.supabase_url}/storage/v1/"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
