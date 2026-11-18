"""Lectura segura de archivos subidos: límite de tamaño y tipo detectado por contenido."""
from dataclasses import dataclass

from fastapi import UploadFile

from app.shared.errors import AppError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB (mismo límite que el bucket)

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "text/plain": "txt",
}


@dataclass(frozen=True)
class Upload:
    data: bytes
    media_type: str
    filename: str

    @property
    def extension(self) -> str:
        return EXTENSIONS[self.media_type]

    @property
    def is_text(self) -> bool:
        return self.media_type == "text/plain"


def _sniff(data: bytes) -> str | None:
    """Detecta el tipo real mirando los primeros bytes (no confiamos en el Content-Type del cliente)."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    try:
        data.decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return None


async def read_upload(file: UploadFile, *, allowed: set[str]) -> Upload:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError(413, "El archivo supera el máximo de 10 MB", title="Archivo demasiado grande")
    if not data:
        raise AppError(422, "El archivo está vacío")
    media_type = _sniff(data)
    if media_type is None or media_type not in allowed:
        nice = ", ".join(sorted(EXTENSIONS[m] for m in allowed))
        raise AppError(415, f"Tipo de archivo no permitido. Formatos aceptados: {nice}", title="Formato no soportado")
    return Upload(data=data, media_type=media_type, filename=file.filename or f"archivo.{EXTENSIONS[media_type]}")
