from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, SoftDeleteMixin, TimestampMixin

METRICS = ("sessions", "distance", "duration", "pages", "count", "books")


class Goal(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "goal"
    __table_args__ = (
        CheckConstraint("kind IN ('frequency', 'amount', 'cumulative')", name="kind"),
        CheckConstraint(
            "(kind = 'frequency' AND period = 'week')"
            " OR (kind = 'amount' AND period IN ('day', 'week'))"
            " OR (kind = 'cumulative' AND period IS NULL)",
            name="period",
        ),
        CheckConstraint(
            "metric IN ('sessions', 'distance', 'duration', 'pages', 'count', 'books')",
            name="metric",
        ),
        CheckConstraint("(kind = 'cumulative') = (end_date IS NOT NULL)", name="end_date"),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="date_order"),
        CheckConstraint("NOT is_pinned OR period = 'week'", name="pinned_weekly"),
        Index(
            "uq_goal_tracker_kind_period_metric",
            "tracker_id",
            "kind",
            "period",
            "metric",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND kind <> 'cumulative'"),
        ),
        Index(
            "uq_goal_pinned_per_tracker",
            "tracker_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND is_pinned"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), index=True
    )
    tracker_id: Mapped[UUID] = mapped_column(ForeignKey("tracker.id", ondelete="CASCADE"))
    kind: Mapped[str]
    period: Mapped[str | None]
    metric: Mapped[str]
    name: Mapped[str | None]
    start_date: Mapped[date]
    end_date: Mapped[date | None]
    is_pinned: Mapped[bool] = mapped_column(default=False, server_default=text("false"))

    targets: Mapped[list["GoalTarget"]] = relationship(
        order_by="GoalTarget.effective_from", cascade="all, delete-orphan", lazy="selectin"
    )


class GoalTarget(Base):
    __tablename__ = "goal_target"
    __table_args__ = (
        CheckConstraint("target > 0", name="target"),
        UniqueConstraint("goal_id", "effective_from", name="uq_goal_target_goal_effective_from"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goal.id", ondelete="CASCADE"))
    target: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    effective_from: Mapped[date]
