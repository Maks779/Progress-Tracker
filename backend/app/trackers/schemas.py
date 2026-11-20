from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    NonNegativeInt,
    StringConstraints,
    computed_field,
    model_validator,
)

TrackerType = Literal["strength", "cardio", "reading", "general"]
TrackerColor = Literal["strength", "cardio", "reading", "general"]
GeneralMode = Literal["duration", "counter"]
TrackerIcon = Literal[
    "dumbbell",
    "activity",
    "bike",
    "footprints",
    "waves",
    "mountain",
    "book-open",
    "library",
    "sparkles",
    "brain",
    "droplet",
    "moon",
    "target",
    "flame",
    "timer",
    "heart",
]

TrackerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
CounterUnit = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
CounterUnitNote = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


class TrackerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: TrackerType
    name: str
    description: str | None
    color: TrackerColor
    icon: str
    general_mode: GeneralMode | None
    counter_unit: str | None
    counter_unit_note: str | None
    position: int
    archived_at: datetime | None = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def archived(self) -> bool:
        return self.archived_at is not None


class TrackerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: TrackerType
    name: TrackerName
    description: Description | None = None
    color: TrackerColor
    icon: TrackerIcon
    general_mode: GeneralMode | None = None
    counter_unit: CounterUnit | None = None
    counter_unit_note: CounterUnitNote | None = None

    @model_validator(mode="after")
    def _check_general_fields(self) -> "TrackerCreate":
        if self.type == "general" and self.general_mode is None:
            raise ValueError("general_mode is required for general trackers")
        if self.type != "general" and self.general_mode is not None:
            raise ValueError("general_mode is only for general trackers")
        if self.general_mode == "counter" and self.counter_unit is None:
            raise ValueError("counter_unit is required for counter trackers")
        if self.general_mode != "counter" and (self.counter_unit or self.counter_unit_note):
            raise ValueError("counter_unit is only for counter trackers")
        return self


class TrackerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: TrackerName | None = None
    description: Description | None = None
    color: TrackerColor | None = None
    icon: TrackerIcon | None = None
    counter_unit: CounterUnit | None = None
    counter_unit_note: CounterUnitNote | None = None
    position: NonNegativeInt | None = None
    archived: bool | None = None

    @model_validator(mode="after")
    def _require_values(self) -> "TrackerUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        nullable = {"description", "counter_unit_note"}
        nulls = sorted(
            name for name in self.model_fields_set - nullable if getattr(self, name) is None
        )
        if nulls:
            raise ValueError(f"cannot be null: {', '.join(nulls)}")
        return self
