from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, Query, status

from app.modules.agenda import service
from app.modules.agenda.schemas import (
    AgendaOut,
    StudyTaskCreate,
    StudyTaskOut,
    StudyTaskUpdate,
    TopicCreate,
    TopicOut,
    TopicUpdate,
)
from app.modules.google.sync import queue_google_sync
from app.shared.errors import AppError
from app.shared.security import AuthUser, UserDB
from app.shared.study_calendar import today

router = APIRouter(tags=["agenda"])

Id = Annotated[int, Path(ge=1)]


@router.get("/agenda", response_model=AgendaOut)
def get_agenda(db: UserDB, day: Annotated[date | None, Query(alias="date")] = None):
    """Qué estudiar hoy (o el día indicado): clases, repasos, preguntas agendadas y próximas fechas."""
    return service.agenda_for(db, day or today())


@router.get("/study-tasks", response_model=list[StudyTaskOut])
def list_tasks(
    db: UserDB,
    start: Annotated[date | None, Query(alias="from")] = None,
    end: Annotated[date | None, Query(alias="to")] = None,
    subject_id: Annotated[int | None, Query(ge=1)] = None,
    done: bool | None = None,
):
    if start and end and (end - start).days > 366:
        raise AppError(400, "El rango de fechas no puede superar un año")
    return service.list_tasks(db, start=start, end=end, subject_id=subject_id, done=done)


@router.post("/study-tasks", response_model=StudyTaskOut, status_code=status.HTTP_201_CREATED)
def create_task(body: StudyTaskCreate, user: AuthUser, db: UserDB, background: BackgroundTasks):
    task = service.create_task(db, str(user.id), body)
    queue_google_sync(background, user)
    return task


@router.patch("/study-tasks/{task_id}", response_model=StudyTaskOut)
def update_task(task_id: Id, body: StudyTaskUpdate, user: AuthUser, db: UserDB, background: BackgroundTasks):
    task = service.update_task(db, task_id, body)
    queue_google_sync(background, user)
    return task


@router.delete("/study-tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: Id, user: AuthUser, db: UserDB, background: BackgroundTasks):
    service.delete_task(db, task_id)
    queue_google_sync(background, user)


@router.post("/pending-topics", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
def create_topic(body: TopicCreate, user: AuthUser, db: UserDB):
    return service.create_topic(db, str(user.id), body)


@router.patch("/pending-topics/{topic_id}", response_model=TopicOut)
def update_topic(topic_id: Id, body: TopicUpdate, db: UserDB):
    return service.update_topic(db, topic_id, body.resolved)


@router.delete("/pending-topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: Id, db: UserDB):
    service.delete_topic(db, topic_id)
