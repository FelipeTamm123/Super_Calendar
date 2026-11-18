from fastapi import APIRouter, BackgroundTasks, UploadFile
from starlette.concurrency import run_in_threadpool

from app.modules.google.sync import queue_google_sync
from app.modules.schedule import service
from app.modules.schedule.schemas import ScheduleDraft, ScheduleIn, ScheduleOut
from app.shared.security import AuthUser, UserDB
from app.shared.uploads import read_upload

router = APIRouter(prefix="/schedule", tags=["horario"])

CALENDAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}


@router.get("", response_model=ScheduleOut)
def get_schedule(db: UserDB):
    return service.get_schedule(db)


@router.put("", response_model=ScheduleOut)
def replace_schedule(body: ScheduleIn, user: AuthUser, db: UserDB, background: BackgroundTasks):
    """Guarda el horario completo (reemplaza el anterior). Las materias existentes se conservan."""
    result = service.apply_schedule(db, body)
    queue_google_sync(background, user)
    return result


@router.post("/import", response_model=ScheduleDraft)
async def import_schedule(file: UploadFile, db: UserDB):
    """La IA lee una foto/PDF del calendario y devuelve un borrador para revisar. No guarda nada."""
    upload = await read_upload(file, allowed=CALENDAR_TYPES)
    return await run_in_threadpool(service.import_from_file, db, upload)
