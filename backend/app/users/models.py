from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, true
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class UserAccount(TimestampMixin, Base):
    __tablename__ = "user_account"
    __table_args__ = (
        CheckConstraint("language IN ('en', 'pl', 'uk')", name="language"),
        CheckConstraint("theme IN ('system', 'light', 'dark')", name="theme"),
        CheckConstraint("weight_unit IN ('kg', 'lb')", name="weight_unit"),
        CheckConstraint("distance_unit IN ('km', 'mi')", name="distance_unit"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    password_hash: Mapped[str]
    timezone: Mapped[str]
    language: Mapped[str]
    theme: Mapped[str] = mapped_column(default="system", server_default="system")
    weight_unit: Mapped[str] = mapped_column(default="kg", server_default="kg")
    distance_unit: Mapped[str] = mapped_column(default="km", server_default="km")
    notify_rest_timer: Mapped[bool] = mapped_column(default=True, server_default=true())
    notify_weekly_reminder: Mapped[bool] = mapped_column(default=True, server_default=true())
