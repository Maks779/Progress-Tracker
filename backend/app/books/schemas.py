from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Author = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class BookOut(BaseModel):
    id: UUID
    title: str
    author: str | None
    total_pages: int
    start_page: int
    current_page: int
    progress_percent: int
    finished_date: date | None
    estimated_finish_date: date | None
    created_at: datetime
    updated_at: datetime


class BookList(BaseModel):
    items: list[BookOut]


class BookWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    author: Author | None = None
    total_pages: int = Field(ge=1, le=10000)
    start_page: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _start_before_end(self) -> "BookWrite":
        if self.start_page >= self.total_pages:
            raise ValueError("start_page must be less than total_pages")
        return self
