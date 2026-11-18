from fastapi import APIRouter

from app.modules.profiles import repository
from app.modules.profiles.schemas import ProfileOut, ProfileUpdate
from app.shared.errors import AppError, NotFound
from app.shared.security import AuthUser, UserDB

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileOut)
def get_my_profile(user: AuthUser, db: UserDB):
    profile = repository.get_by_id(db, user.id)
    if profile is None:
        raise NotFound("Perfil no encontrado")
    return profile


@router.patch("/me", response_model=ProfileOut)
def update_my_profile(body: ProfileUpdate, user: AuthUser, db: UserDB):
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise AppError(400, "No se envió ningún campo para actualizar")
    profile = repository.update(db, user.id, fields)
    if profile is None:
        raise NotFound("Perfil no encontrado")
    return profile
