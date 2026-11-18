from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, Query, status

from app.modules.google.sync import queue_google_sync
from app.modules.questions import service
from app.modules.questions.schemas import QuestionCreate, QuestionOut, QuestionUpdate
from app.shared.pagination import Page, Paging
from app.shared.security import AuthUser, UserDB

router = APIRouter(prefix="/questions", tags=["preguntas"])

QuestionId = Annotated[int, Path(ge=1)]


@router.get("", response_model=Page[QuestionOut])
def list_questions(
    db: UserDB,
    page: Paging,
    resolved: bool | None = None,
    subject_id: Annotated[int | None, Query(ge=1)] = None,
):
    items, total = service.list_questions(db, resolved=resolved, subject_id=subject_id, limit=page.limit, offset=page.offset)
    return Page[QuestionOut](items=items, total=total, limit=page.limit, offset=page.offset)


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(body: QuestionCreate, user: AuthUser, db: UserDB, background: BackgroundTasks):
    """Anota una pregunta. La IA detecta la materia y se agenda antes de la próxima clase."""
    question = service.create_question(db, str(user.id), body)
    queue_google_sync(background, user)
    return question


@router.patch("/{question_id}", response_model=QuestionOut)
def update_question(question_id: QuestionId, body: QuestionUpdate, user: AuthUser, db: UserDB, background: BackgroundTasks):
    question = service.update_question(db, question_id, body)
    queue_google_sync(background, user)
    return question


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: QuestionId, user: AuthUser, db: UserDB, background: BackgroundTasks):
    service.delete_question(db, question_id)
    queue_google_sync(background, user)
