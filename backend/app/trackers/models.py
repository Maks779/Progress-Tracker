from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, SoftDeleteMixin, TimestampMixin

TRACKER_TYPES = ("strength", "cardio", "reading", "general")


class Tracker(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tracker"
    __table_args__ = (
        CheckConstraint("type IN ('strength', 'cardio', 'reading', 'general')", name="type"),
        CheckConstraint("color IN ('strength', 'cardio', 'reading', 'general')", name="color"),
        CheckConstraint("general_mode IN ('duration', 'counter')", name="general_mode"),
        CheckConstraint(
            "(type = 'general') = (general_mode IS NOT NULL)", name="general_mode_type"
        ),
        CheckConstraint(
            "(general_mode = 'counter' AND counter_unit IS NOT NULL)"
            " OR (general_mode IS DISTINCT FROM 'counter'"
            " AND counter_unit IS NULL AND counter_unit_note IS NULL)",
            name="counter_unit",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str]
    name: Mapped[str]
    description: Mapped[str | None]
    color: Mapped[str]
    icon: Mapped[str]
    general_mode: Mapped[str | None]
    counter_unit: Mapped[str | None]
    counter_unit_note: Mapped[str | None]
    position: Mapped[int]
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
