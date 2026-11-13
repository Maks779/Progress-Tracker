"""Accounts: users, refresh tokens and password reset tokens.

Revision ID: 0001
Revises:
Create Date: 2026-11-12 16:43:37.345883+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_account",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("theme", sa.String(), server_default="system", nullable=False),
        sa.Column("weight_unit", sa.String(), server_default="kg", nullable=False),
        sa.Column("distance_unit", sa.String(), server_default="km", nullable=False),
        sa.Column("notify_rest_timer", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("notify_weekly_reminder", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("language IN ('en', 'pl', 'uk')", name=op.f("ck_user_account_language")),
        sa.CheckConstraint(
            "theme IN ('system', 'light', 'dark')", name=op.f("ck_user_account_theme")
        ),
        sa.CheckConstraint("weight_unit IN ('kg', 'lb')", name=op.f("ck_user_account_weight_unit")),
        sa.CheckConstraint(
            "distance_unit IN ('km', 'mi')", name=op.f("ck_user_account_distance_unit")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_account")),
        sa.UniqueConstraint("email", name=op.f("uq_user_account_email")),
    )
    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("client", sa.String(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("client IN ('web', 'native')", name=op.f("ck_refresh_token_client")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_refresh_token_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_token")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_token_token_hash")),
    )
    op.create_index(op.f("ix_refresh_token_user_id"), "refresh_token", ["user_id"])
    op.create_index(op.f("ix_refresh_token_family_id"), "refresh_token", ["family_id"])
    op.create_table(
        "password_reset_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_password_reset_token_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_password_reset_token")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_password_reset_token_token_hash")),
    )
    op.create_index(op.f("ix_password_reset_token_user_id"), "password_reset_token", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_password_reset_token_user_id"), table_name="password_reset_token")
    op.drop_table("password_reset_token")
    op.drop_index(op.f("ix_refresh_token_family_id"), table_name="refresh_token")
    op.drop_index(op.f("ix_refresh_token_user_id"), table_name="refresh_token")
    op.drop_table("refresh_token")
    op.drop_table("user_account")
