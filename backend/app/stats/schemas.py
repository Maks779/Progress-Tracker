from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.goals.schemas import GoalOut, Number
from app.sessions.schemas import Kg, SessionListItem
from app.stats.rules import BucketKind, Period
from app.trackers.schemas import TrackerType


class UpNext(BaseModel):
    session_id: UUID
    name: str
    exercise_count: int
    estimated_duration_s: int | None


class WeekDay(BaseModel):
    """A day of the current week with sessions, and the trackers they were logged in."""

    local_date: date
    tracker_ids: list[UUID]


class HomeStats(BaseModel):
    week_start: date
    main_tracker_id: UUID | None
    pinned_goal: GoalOut | None
    active_time_s: int
    volume_kg: Kg
    pages_read: int
    recent_sessions: list[SessionListItem]
    up_next: UpNext | None
    week_days: list[WeekDay]


class CalendarDay(BaseModel):
    local_date: date
    tracker_types: list[TrackerType]


class CalendarMonth(BaseModel):
    month: str
    days: list[CalendarDay]
    session_count: int
    active_time_s: int


class Bucket(BaseModel):
    start_date: date
    value: Number


class Consistency(BaseModel):
    active_days: int
    days: list[date]


class ProgressTotals(BaseModel):
    volume_kg: Kg
    volume_change_percent: Number | None
    pages_read: int
    books_read: int


class ProgressStats(BaseModel):
    period: Period
    bucket: BucketKind
    volume_kg: list[Bucket]
    pages: list[Bucket]
    consistency: Consistency
    totals: ProgressTotals


class ExercisePoint(BaseModel):
    session_id: UUID
    local_date: date
    weight_kg: Kg


class ExerciseProgress(BaseModel):
    exercise_id: UUID
    period: Period
    change_kg: Kg | None
    points: list[ExercisePoint]
