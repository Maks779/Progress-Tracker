from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    NonNegativeInt,
    PlainSerializer,
    StringConstraints,
)

from app.trackers.schemas import TrackerType

Kg = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
SetKind = Literal["working", "warmup"]
RecordType = Literal["max_weight", "max_reps", "estimated_1rm"]
SessionName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class StrengthSetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: NonNegativeInt
    weight_kg: Annotated[Decimal, Field(gt=0, le=1000, decimal_places=4)] | None
    reps: int = Field(ge=1, le=100)
    kind: SetKind = "working"


class StrengthEntryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    exercise_id: UUID
    position: NonNegativeInt
    superset_group: int | None = Field(default=None, ge=1)
    sets: list[StrengthSetIn] = Field(min_length=1, max_length=50)


class StrengthIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exercises: list[StrengthEntryIn] = Field(min_length=1, max_length=30)


class CardioIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    distance_m: int | None = Field(default=None, ge=1, le=1_000_000)


class ReadingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    book_id: UUID
    end_page: int = Field(ge=1)


class GeneralIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    count: int = Field(ge=1, le=1000)


class SessionWrite(BaseModel):
    """Exactly one of strength, cardio, reading and general is present, matching the tracker."""

    model_config = ConfigDict(extra="forbid")

    tracker_id: UUID
    started_at: AwareDatetime
    local_date: date
    duration_s: int | None = Field(default=None, ge=1, le=86400)
    name: SessionName | None = None
    note: Note | None = None
    strength: StrengthIn | None = None
    cardio: CardioIn | None = None
    reading: ReadingIn | None = None
    general: GeneralIn | None = None


class StrengthSetOut(BaseModel):
    position: int
    weight_kg: Kg | None
    reps: int
    kind: SetKind


class StrengthEntryOut(BaseModel):
    id: UUID
    exercise_id: UUID
    position: int
    superset_group: int | None
    sets: list[StrengthSetOut]


class StrengthOut(BaseModel):
    exercises: list[StrengthEntryOut]


class SessionStats(BaseModel):
    volume_kg: Kg | None = None
    working_sets: int | None = None
    pages_read: int | None = None
    pace_s_per_km: int | None = None


class SessionOut(BaseModel):
    id: UUID
    tracker_id: UUID
    tracker_type: TrackerType
    started_at: datetime
    local_date: date
    duration_s: int | None
    name: str | None
    note: str | None
    strength: StrengthOut | None
    cardio: CardioIn | None
    reading: ReadingIn | None
    general: GeneralIn | None
    stats: SessionStats
    record_count: int
    created_at: datetime
    updated_at: datetime


class RecordOut(BaseModel):
    exercise_id: UUID
    record_type: RecordType
    value: Kg
    weight_kg: Kg | None
    reps: int
    session_id: UUID
    local_date: date


class SessionSaved(BaseModel):
    session: SessionOut
    new_records: list[RecordOut]
    goals: list[Any] = []


class Headline(BaseModel):
    metric: Literal["volume_kg", "distance_m", "pages", "count", "duration_s"]
    value: float
    unit_label: str | None = None


class SessionListItem(BaseModel):
    id: UUID
    tracker_id: UUID
    tracker_type: TrackerType
    name: str
    started_at: datetime
    local_date: date
    duration_s: int | None
    headline: Headline


class SessionPage(BaseModel):
    items: list[SessionListItem]
    next_cursor: str | None


class LastSets(BaseModel):
    exercise_id: UUID
    session_id: UUID | None
    local_date: date | None
    sets: list[StrengthSetOut]


class ExerciseRecords(BaseModel):
    exercise_id: UUID
    max_weight: RecordOut | None
    max_reps: RecordOut | None
    estimated_1rm: RecordOut | None


class RecordPage(BaseModel):
    items: list[RecordOut]
    new_this_week: int
    next_cursor: str | None
