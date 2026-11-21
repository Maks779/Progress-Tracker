"""Goals with versioned targets.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-12 20:46:47.420405+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goal",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("tracker_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("period", sa.String(), nullable=True),
        sa.Column("metric", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(kind = 'cumulative') = (end_date IS NOT NULL)", name=op.f("ck_goal_end_date")
        ),
        sa.CheckConstraint(
            "(kind = 'frequency' AND period = 'week')"
            " OR (kind = 'amount' AND period IN ('day', 'week'))"
            " OR (kind = 'cumulative' AND period IS NULL)",
            name=op.f("ck_goal_period"),
        ),
        sa.CheckConstraint("NOT is_pinned OR period = 'week'", name=op.f("ck_goal_pinned_weekly")),
        sa.CheckConstraint(
            "kind IN ('frequency', 'amount', 'cumulative')", name=op.f("ck_goal_kind")
        ),
        sa.CheckConstraint(
            "metric IN ('sessions', 'distance', 'duration', 'pages', 'count', 'books')",
            name=op.f("ck_goal_metric"),
        ),
        sa.CheckConstraint(
            "end_date IS NULL OR end_date >= start_date", name=op.f("ck_goal_date_order")
        ),
        sa.ForeignKeyConstraint(
            ["tracker_id"],
            ["tracker.id"],
            name=op.f("fk_goal_tracker_id_tracker"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_goal_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal")),
    )
    op.create_index(op.f("ix_goal_user_id"), "goal", ["user_id"])
    op.create_index(
        "uq_goal_pinned_per_tracker",
        "goal",
        ["tracker_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND is_pinned"),
    )
    op.create_index(
        "uq_goal_tracker_kind_period_metric",
        "goal",
        ["tracker_id", "kind", "period", "metric"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND kind <> 'cumulative'"),
    )
    op.create_table(
        "goal_target",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Uuid(), nullable=False),
        sa.Column("target", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.CheckConstraint("target > 0", name=op.f("ck_goal_target_target")),
        sa.ForeignKeyConstraint(
            ["goal_id"], ["goal.id"], name=op.f("fk_goal_target_goal_id_goal"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_target")),
        sa.UniqueConstraint("goal_id", "effective_from", name="uq_goal_target_goal_effective_from"),
    )


def downgrade() -> None:
    op.drop_table("goal_target")
    op.drop_index(
        "uq_goal_tracker_kind_period_metric",
        table_name="goal",
        postgresql_where=sa.text("deleted_at IS NULL AND kind <> 'cumulative'"),
    )
    op.drop_index(
        "uq_goal_pinned_per_tracker",
        table_name="goal",
        postgresql_where=sa.text("deleted_at IS NULL AND is_pinned"),
    )
    op.drop_index(op.f("ix_goal_user_id"), table_name="goal")
    op.drop_table("goal")
