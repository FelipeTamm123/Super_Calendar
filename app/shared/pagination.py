from typing import Annotated, Generic, TypeVar

from fastapi import Depends, Query
from pydantic import BaseModel

T = TypeVar("T")
MAX_LIMIT = 100  # nunca devolver "todos" los registros


class PageParams(BaseModel):
    limit: int
    offset: int


def page_params(
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PageParams:
    return PageParams(limit=limit, offset=offset)


Paging = Annotated[PageParams, Depends(page_params)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
