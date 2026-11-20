"""Trackers and the user's main tracker.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-12 16:49:17.612901+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tracker",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("icon", sa.String(), nullable=False),
        sa.Column("general_mode", sa.String(), nullable=True),
        sa.Column("counter_unit", sa.String(), nullable=True),
        sa.Column("counter_unit_note", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(general_mode = 'counter' AND counter_unit IS NOT NULL)"
            " OR (general_mode IS DISTINCT FROM 'counter'"
            " AND counter_unit IS NULL AND counter_unit_note IS NULL)",
            name=op.f("ck_tracker_counter_unit"),
        ),
        sa.CheckConstraint(
            "(type = 'general') = (general_mode IS NOT NULL)",
            name=op.f("ck_tracker_general_mode_type"),
        ),
        sa.CheckConstraint(
            "color IN ('strength', 'cardio', 'reading', 'general')", name=op.f("ck_tracker_color")
        ),
        sa.CheckConstraint(
            "general_mode IN ('duration', 'counter')", name=op.f("ck_tracker_general_mode")
        ),
        sa.CheckConstraint(
            "type IN ('strength', 'cardio', 'reading', 'general')", name=op.f("ck_tracker_type")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_tracker_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tracker")),
    )
    op.create_index(op.f("ix_tracker_user_id"), "tracker", ["user_id"])
    op.add_column("user_account", sa.Column("main_tracker_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_user_account_main_tracker_id_tracker"),
        "user_account",
        "tracker",
        ["main_tracker_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_user_account_main_tracker_id_tracker"), "user_account", type_="foreignkey"
    )
    op.drop_column("user_account", "main_tracker_id")
    op.drop_index(op.f("ix_tracker_user_id"), table_name="tracker")
    op.drop_table("tracker")
