from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Form, Path, Query, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.modules.google.sync import queue_google_sync
from app.modules.notes import service
from app.modules.notes.schemas import FileLink, NoteDetail, NoteListItem
from app.shared.pagination import Page, Paging
from app.shared.security import AuthUser, UserDB
from app.shared.uploads import EXTENSIONS, read_upload

router = APIRouter(prefix="/notes", tags=["apuntes"])

NoteId = Annotated[int, Path(ge=1)]


@router.get("", response_model=Page[NoteListItem])
def list_notes(db: UserDB, page: Paging, subject_id: Annotated[int | None, Query(ge=1)] = None):
    items, total = service.list_notes(db, subject_id=subject_id, limit=page.limit, offset=page.offset)
    return Page[NoteListItem](items=items, total=total, limit=page.limit, offset=page.offset)


@router.post("", response_model=NoteDetail, status_code=status.HTTP_201_CREATED)
async def create_note(
    user: AuthUser,
    db: UserDB,
    background: BackgroundTasks,
    subject_id: Annotated[int | None, Form(ge=1)] = None,
    class_date: Annotated[date | None, Form()] = None,
    title: Annotated[str | None, Form(max_length=200)] = None,
    text: Annotated[str | None, Form(max_length=100000)] = None,
    file: UploadFile | None = None,
):
    """Sube un apunte (texto, foto o PDF). La IA detecta materia y fecha si no se indican,
    lo resume y arma qué repasar antes de la próxima clase."""
    upload = await read_upload(file, allowed=set(EXTENSIONS)) if file is not None and file.filename else None
    note = await run_in_threadpool(
        service.create_note, db, user,
        subject_id=subject_id, class_date=class_date, title=title, text=text, upload=upload,
    )
    queue_google_sync(background, user)
    return note


@router.get("/{note_id}", response_model=NoteDetail)
def get_note(note_id: NoteId, db: UserDB):
    return service.get_note(db, note_id)


@router.get("/{note_id}/file", response_model=FileLink)
def get_note_file(note_id: NoteId, user: AuthUser, db: UserDB):
    """Link temporal para ver el archivo original del apunte."""
    return service.file_link(db, user, note_id)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: NoteId, user: AuthUser, db: UserDB, background: BackgroundTasks):
    service.delete_note(db, user, note_id)
    queue_google_sync(background, user)
