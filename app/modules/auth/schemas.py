from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]
# 72 bytes es el límite de bcrypt, que es lo que usa Supabase Auth por dentro
Password = Annotated[str, StringConstraints(min_length=8, max_length=72)]


class SignUpIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: Email
    password: Password
    full_name: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=100)] = None


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: Email
    password: Annotated[str, StringConstraints(min_length=1, max_length=72)]


class UserOut(BaseModel):
    id: UUID
    email: str | None = None


class SessionOut(BaseModel):
    """El refresh token NO va en el body: viaja en una cookie HttpOnly."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    expires_at: int | None = None
    user: UserOut


class SignUpOut(BaseModel):
    user: UserOut
    session: SessionOut | None = Field(
        default=None, description="null si el proyecto exige confirmar el email antes de iniciar sesión"
    )
