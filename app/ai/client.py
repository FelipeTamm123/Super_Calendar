"""Cliente de Gemini (Google) con salida estructurada (JSON validado con Pydantic).

Todas las funciones de IA pasan por `ask()`, que:
- pide la respuesta en JSON con un schema Pydantic y la valida,
- acepta texto y archivos (imágenes / PDF) como entrada,
- traduce los errores de la API a errores HTTP de nuestra app (RFC 9457).
"""
import logging
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import TypeVar

import httpx
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.shared.errors import AppError

log = logging.getLogger("app.ai")

T = TypeVar("T", bound=BaseModel)

AI_FILE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
TIMEOUT_MS = 180_000

try:  # el SDK usa httpx2 si está instalado, si no httpx
    import httpx2

    TRANSPORT_ERRORS: tuple[type[Exception], ...] = (httpx.TransportError, httpx2.TransportError)
except ImportError:
    TRANSPORT_ERRORS = (httpx.TransportError,)


@dataclass(frozen=True)
class FileInput:
    """Un archivo (imagen o PDF) para mandarle a la IA."""

    data: bytes
    media_type: str


# Lo que se le puede pasar a ask(): textos y archivos, en orden
Content = list[str | FileInput]


class AINotConfigured(AppError):
    def __init__(self):
        super().__init__(503, "La IA no está configurada: falta GEMINI_API_KEY en el .env", title="IA no disponible")


def ai_enabled() -> bool:
    return get_settings().gemini_api_key is not None


@lru_cache
def get_ai_client() -> genai.Client:
    key = get_settings().gemini_api_key
    if key is None:
        raise AINotConfigured()
    return genai.Client(api_key=key.get_secret_value(), http_options=types.HttpOptions(timeout=TIMEOUT_MS))


def _to_parts(content: Content) -> list[types.Part]:
    parts = []
    for item in content:
        if isinstance(item, FileInput):
            if item.media_type not in AI_FILE_TYPES:
                raise ValueError(f"Tipo de archivo no soportado por la IA: {item.media_type}")
            parts.append(types.Part.from_bytes(data=item.data, mime_type=item.media_type))
        else:
            parts.append(types.Part.from_text(text=item))
    return parts


RETRY_DELAYS = (2.0, 5.0)  # segundos de espera antes de cada reintento


def _generate(client: genai.Client, **kwargs):
    """Llama a Gemini reintentando los errores pasajeros (servidor saturado, 5xx)."""
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            return client.models.generate_content(**kwargs)
        except errors.ServerError as e:
            if attempt == len(RETRY_DELAYS):
                raise
            log.warning("Gemini respondió %s (intento %d), reintentando en %.0fs", e.code, attempt + 1, RETRY_DELAYS[attempt])
            time.sleep(RETRY_DELAYS[attempt])


def ask(schema: type[T], *, system: str, content: Content, max_tokens: int = 16000) -> T:
    client = get_ai_client()
    try:
        response = _generate(
            client,
            model=get_settings().ai_model,
            contents=[types.Content(role="user", parts=_to_parts(content))],
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,  # la respuesta tiene que cumplir este schema
                max_output_tokens=max_tokens,
            ),
        )
    except errors.ClientError as e:
        if e.code == 429:
            raise AppError(429, "La IA está ocupada o se alcanzó el límite de uso, probá de nuevo en un minuto") from e
        if e.code in (401, 403):
            log.error("Clave de Gemini inválida o sin permisos")
            raise AppError(503, "La clave de la IA es inválida", title="IA no disponible") from e
        if e.code == 404:
            log.error("Modelo de IA no encontrado: %s", get_settings().ai_model)
            raise AppError(503, "El modelo de IA configurado no existe", title="IA no disponible") from e
        log.error("Pedido inválido a la IA: %s %s", e.code, e.message)
        raise AppError(422, "La IA no pudo procesar este contenido (¿archivo muy grande o dañado?)") from e
    except errors.ServerError as e:
        log.error("Error del servidor de IA: %s %s", e.code, e.message)
        if e.code == 503:
            raise AppError(503, "La IA está saturada en este momento (alta demanda en Google). Probá de nuevo en unos minutos.", title="IA no disponible") from e
        raise AppError(502, "La IA tuvo un problema, probá de nuevo", title="Error de la IA") from e
    except errors.APIError as e:
        log.error("Error de la API de IA: %s %s", e.code, e.message)
        raise AppError(502, "La IA tuvo un problema, probá de nuevo", title="Error de la IA") from e
    except TRANSPORT_ERRORS as e:  # sin conexión, timeout, etc.
        raise AppError(503, "No se pudo conectar con la IA", title="IA no disponible") from e

    # ¿Se bloqueó el pedido o se cortó la respuesta?
    if response.prompt_feedback and response.prompt_feedback.block_reason:
        raise AppError(422, "La IA no puede procesar este contenido")
    finish = response.candidates[0].finish_reason if response.candidates else None
    if finish == types.FinishReason.MAX_TOKENS:
        raise AppError(422, "El contenido es demasiado largo para procesarlo de una vez; probá dividirlo")
    if finish in (types.FinishReason.SAFETY, types.FinishReason.PROHIBITED_CONTENT, types.FinishReason.BLOCKLIST):
        raise AppError(422, "La IA no puede procesar este contenido")

    parsed = response.parsed
    if isinstance(parsed, schema):
        return parsed
    # Por las dudas: validar el texto a mano si el SDK no lo parseó
    try:
        return schema.model_validate_json(response.text or "")
    except ValidationError as e:
        log.error("La IA devolvió una respuesta inválida (finish_reason=%s)", finish)
        raise AppError(502, "La IA devolvió una respuesta inválida, probá de nuevo", title="Error de la IA") from e
