"""Sessions with per-type entries: strength exercises and sets, cardio, reading, general.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-12 17:01:31.289972+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "session",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("tracker_id", sa.Uuid(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("duration_s", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "duration_s IS NULL OR duration_s BETWEEN 1 AND 86400", name=op.f("ck_session_duration")
        ),
        sa.ForeignKeyConstraint(
            ["tracker_id"],
            ["tracker.id"],
            name=op.f("fk_session_tracker_id_tracker"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_session_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session")),
    )
    op.create_index(
        "ix_session_tracker_started_at",
        "session",
        ["tracker_id", "started_at"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_session_user_local_date",
        "session",
        ["user_id", "local_date"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_table(
        "cardio_entry",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("distance_m", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "distance_m IS NULL OR distance_m BETWEEN 1 AND 1000000",
            name=op.f("ck_cardio_entry_distance"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["session.id"],
            name=op.f("fk_cardio_entry_session_id_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("session_id", name=op.f("pk_cardio_entry")),
    )
    op.create_table(
        "general_entry",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.CheckConstraint("count BETWEEN 1 AND 1000", name=op.f("ck_general_entry_count")),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["session.id"],
            name=op.f("fk_general_entry_session_id_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("session_id", name=op.f("pk_general_entry")),
    )
    op.create_table(
        "reading_entry",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("book_id", sa.Uuid(), nullable=False),
        sa.Column("end_page", sa.Integer(), nullable=False),
        sa.CheckConstraint("end_page >= 1", name=op.f("ck_reading_entry_end_page")),
        sa.ForeignKeyConstraint(
            ["book_id"], ["book.id"], name=op.f("fk_reading_entry_book_id_book"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["session.id"],
            name=op.f("fk_reading_entry_session_id_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("session_id", name=op.f("pk_reading_entry")),
    )
    op.create_index(op.f("ix_reading_entry_book_id"), "reading_entry", ["book_id"])
    op.create_table(
        "strength_entry",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("superset_group", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "superset_group IS NULL OR superset_group >= 1",
            name=op.f("ck_strength_entry_superset_group"),
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercise.id"],
            name=op.f("fk_strength_entry_exercise_id_exercise"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["session.id"],
            name=op.f("fk_strength_entry_session_id_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_strength_entry")),
    )
    op.create_index(
        "ix_strength_entry_exercise_session", "strength_entry", ["exercise_id", "session_id"]
    )
    op.create_index(op.f("ix_strength_entry_session_id"), "strength_entry", ["session_id"])
    op.create_table(
        "strength_set",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("strength_entry_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(precision=9, scale=4), nullable=True),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.CheckConstraint("kind IN ('working', 'warmup')", name=op.f("ck_strength_set_kind")),
        sa.CheckConstraint("reps BETWEEN 1 AND 100", name=op.f("ck_strength_set_reps")),
        sa.CheckConstraint(
            "weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 1000)",
            name=op.f("ck_strength_set_weight"),
        ),
        sa.ForeignKeyConstraint(
            ["strength_entry_id"],
            ["strength_entry.id"],
            name=op.f("fk_strength_set_strength_entry_id_strength_entry"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_strength_set")),
    )
    op.create_index(
        op.f("ix_strength_set_strength_entry_id"), "strength_set", ["strength_entry_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_strength_set_strength_entry_id"), table_name="strength_set")
    op.drop_table("strength_set")
    op.drop_index(op.f("ix_strength_entry_session_id"), table_name="strength_entry")
    op.drop_index("ix_strength_entry_exercise_session", table_name="strength_entry")
    op.drop_table("strength_entry")
    op.drop_index(op.f("ix_reading_entry_book_id"), table_name="reading_entry")
    op.drop_table("reading_entry")
    op.drop_table("general_entry")
    op.drop_table("cardio_entry")
    op.drop_index(
        "ix_session_user_local_date",
        table_name="session",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        "ix_session_tracker_started_at",
        table_name="session",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("session")
