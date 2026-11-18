from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints


class ProfileOut(BaseModel):
    id: UUID
    username: str | None = None
    full_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # lista blanca: solo estos campos se pueden tocar
    username: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-zA-Z0-9_]{3,30}$")] | None = None
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
