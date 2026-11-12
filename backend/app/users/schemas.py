from datetime import datetime
from functools import cache
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import available_timezones

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints, model_validator

Language = Literal["en", "pl", "uk"]
Theme = Literal["system", "light", "dark"]
WeightUnit = Literal["kg", "lb"]
DistanceUnit = Literal["km", "mi"]


@cache
def _timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def _check_timezone(value: str) -> str:
    if value not in _timezones():
        raise ValueError("must be an IANA timezone name, e.g. Europe/Warsaw")
    return value


TimezoneName = Annotated[str, AfterValidator(_check_timezone)]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class Me(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    timezone: str
    language: Language
    theme: Theme
    weight_unit: WeightUnit
    distance_unit: DistanceUnit
    notify_rest_timer: bool
    notify_weekly_reminder: bool
    created_at: datetime


class MeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: PersonName | None = None
    timezone: TimezoneName | None = None
    language: Language | None = None
    theme: Theme | None = None
    weight_unit: WeightUnit | None = None
    distance_unit: DistanceUnit | None = None
    notify_rest_timer: bool | None = None
    notify_weekly_reminder: bool | None = None

    @model_validator(mode="after")
    def _require_values(self) -> "MeUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        nulls = sorted(name for name in self.model_fields_set if getattr(self, name) is None)
        if nulls:
            raise ValueError(f"cannot be null: {', '.join(nulls)}")
        return self


class PasswordChange(BaseModel):
    current_password: str
    new_password: Password


class AccountDeletion(BaseModel):
    password: str
