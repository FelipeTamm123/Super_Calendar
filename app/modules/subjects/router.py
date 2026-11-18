from typing import Annotated

from fastapi import APIRouter, Path, status

from app.modules.subjects import service
from app.modules.subjects.schemas import SubjectCreate, SubjectOut, SubjectSheet, SubjectSummary, SubjectUpdate
from app.shared.security import AuthUser, UserDB

router = APIRouter(prefix="/subjects", tags=["materias"])

SubjectId = Annotated[int, Path(ge=1)]


@router.get("", response_model=list[SubjectSummary])
def list_subjects(db: UserDB):
    return service.list_with_summary(db)


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(body: SubjectCreate, user: AuthUser, db: UserDB):
    return service.create_subject(db, str(user.id), body)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: SubjectId, body: SubjectUpdate, db: UserDB):
    return service.update_subject(db, subject_id, body)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: SubjectId, db: UserDB):
    service.delete_subject(db, subject_id)


@router.get("/{subject_id}/sheet", response_model=SubjectSheet)
def subject_sheet(subject_id: SubjectId, db: UserDB):
    """Hoja de dudas y temas pendientes de la materia."""
    return service.build_sheet(db, subject_id)
