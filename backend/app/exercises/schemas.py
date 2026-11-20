from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

MuscleGroup = Literal["chest", "back", "legs", "shoulders", "arms", "core", "full_body"]
Equipment = Literal[
    "barbell", "dumbbell", "machine", "cable", "kettlebell", "bodyweight", "band", "other"
]
Mechanic = Literal["compound", "isolation"]
ExerciseName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    key: str | None
    name: str | None
    is_custom: bool
    muscle_group: MuscleGroup
    equipment: Equipment
    mechanic: Mechanic | None
    last_used_date: date | None


class ExerciseList(BaseModel):
    items: list[ExerciseOut]


class ExerciseWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ExerciseName
    muscle_group: MuscleGroup
    equipment: Equipment
    mechanic: Mechanic | None = None
