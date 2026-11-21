from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    model_validator,
)

from app.goals.rules import GoalKind, GoalPeriod, GoalStatus

Number = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
Metric = Literal["sessions", "distance", "duration", "pages", "count", "books"]
GoalName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Target = Annotated[int, Field(ge=1, le=100_000_000)]


class GoalProgressOut(BaseModel):
    period_start: date
    period_end: date
    value: Number
    target: Number
    expected: Number | None
    status: GoalStatus


class GoalOut(BaseModel):
    id: UUID
    tracker_id: UUID
    kind: GoalKind
    period: GoalPeriod | None
    metric: Metric
    name: str | None
    start_date: date
    end_date: date | None
    is_pinned: bool
    target: Number
    progress: GoalProgressOut
    streak_weeks: int | None
    created_at: datetime
    updated_at: datetime


class GoalList(BaseModel):
    items: list[GoalOut]


class GoalCreate(BaseModel):
    """Targets use canonical units: metres for distance, seconds for duration."""

    model_config = ConfigDict(extra="forbid")

    tracker_id: UUID
    kind: GoalKind
    period: GoalPeriod | None = None
    metric: Metric
    name: GoalName | None = None
    start_date: date | None = None
    end_date: date | None = None
    target: Target
    is_pinned: bool = False

    @model_validator(mode="after")
    def _check_kind(self) -> "GoalCreate":
        if self.kind == "frequency" and self.period != "week":
            raise ValueError("frequency goals have period 'week'")
        if self.kind == "amount" and self.period is None:
            raise ValueError("amount goals need a period: 'day' or 'week'")
        if self.kind == "cumulative":
            if self.period is not None:
                raise ValueError("cumulative goals have no period")
            if self.end_date is None:
                raise ValueError("cumulative goals need an end_date")
            if self.start_date and self.end_date < self.start_date:
                raise ValueError("end_date must not be before start_date")
        elif self.start_date is not None or self.end_date is not None:
            raise ValueError("only cumulative goals have start_date and end_date")
        if self.is_pinned and self.period != "week":
            raise ValueError("only weekly goals can be pinned")
        return self


class GoalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: GoalName | None = None
    target: Target | None = None
    end_date: date | None = None
    is_pinned: bool | None = None

    @model_validator(mode="after")
    def _require_values(self) -> "GoalUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        nulls = sorted(
            name for name in self.model_fields_set - {"name"} if getattr(self, name) is None
        )
        if nulls:
            raise ValueError(f"cannot be null: {', '.join(nulls)}")
        return self
