from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, SoftDeleteMixin, TimestampMixin

ACTIVE = text("deleted_at IS NULL")


class Session(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "session"
    __table_args__ = (
        CheckConstraint("duration_s IS NULL OR duration_s BETWEEN 1 AND 86400", name="duration"),
        Index("ix_session_user_local_date", "user_id", "local_date", postgresql_where=ACTIVE),
        Index("ix_session_tracker_started_at", "tracker_id", "started_at", postgresql_where=ACTIVE),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("user_account.id", ondelete="CASCADE"))
    tracker_id: Mapped[UUID] = mapped_column(ForeignKey("tracker.id", ondelete="CASCADE"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    local_date: Mapped[date]
    duration_s: Mapped[int | None]
    name: Mapped[str | None]
    note: Mapped[str | None]

    strength_entries: Mapped[list["StrengthEntry"]] = relationship(
        order_by="StrengthEntry.position", cascade="all, delete-orphan", lazy="selectin"
    )
    cardio_entry: Mapped["CardioEntry | None"] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    reading_entry: Mapped["ReadingEntry | None"] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    general_entry: Mapped["GeneralEntry | None"] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class StrengthEntry(Base):
    __tablename__ = "strength_entry"
    __table_args__ = (
        CheckConstraint("superset_group IS NULL OR superset_group >= 1", name="superset_group"),
        Index("ix_strength_entry_exercise_session", "exercise_id", "session_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[UUID] = mapped_column(ForeignKey("exercise.id", ondelete="CASCADE"))
    position: Mapped[int]
    superset_group: Mapped[int | None]

    sets: Mapped[list["StrengthSet"]] = relationship(
        order_by="StrengthSet.position", cascade="all, delete-orphan", lazy="selectin"
    )


class StrengthSet(Base):
    __tablename__ = "strength_set"
    __table_args__ = (
        CheckConstraint(
            "weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 1000)", name="weight"
        ),
        CheckConstraint("reps BETWEEN 1 AND 100", name="reps"),
        CheckConstraint("kind IN ('working', 'warmup')", name="kind"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    strength_entry_id: Mapped[UUID] = mapped_column(
        ForeignKey("strength_entry.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int]
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(9, 4))
    reps: Mapped[int]
    kind: Mapped[str]


class CardioEntry(Base):
    __tablename__ = "cardio_entry"
    __table_args__ = (
        CheckConstraint("distance_m IS NULL OR distance_m BETWEEN 1 AND 1000000", name="distance"),
    )

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), primary_key=True
    )
    distance_m: Mapped[int | None]


class ReadingEntry(Base):
    __tablename__ = "reading_entry"
    __table_args__ = (CheckConstraint("end_page >= 1", name="end_page"),)

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), primary_key=True
    )
    book_id: Mapped[UUID] = mapped_column(ForeignKey("book.id", ondelete="CASCADE"), index=True)
    end_page: Mapped[int]


class GeneralEntry(Base):
    __tablename__ = "general_entry"
    __table_args__ = (CheckConstraint("count BETWEEN 1 AND 1000", name="count"),)

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), primary_key=True
    )
    count: Mapped[int]
