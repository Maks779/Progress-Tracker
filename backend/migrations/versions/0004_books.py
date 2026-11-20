"""Books for reading trackers.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-12 16:58:38.005316+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "book",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("author", sa.String(), nullable=True),
        sa.Column("total_pages", sa.Integer(), nullable=False),
        sa.Column("start_page", sa.Integer(), server_default="0", nullable=False),
        sa.Column("finished_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "start_page >= 0 AND start_page < total_pages", name=op.f("ck_book_start_page")
        ),
        sa.CheckConstraint("total_pages BETWEEN 1 AND 10000", name=op.f("ck_book_total_pages")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_book_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_book")),
    )
    op.create_index(op.f("ix_book_user_id"), "book", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_book_user_id"), table_name="book")
    op.drop_table("book")
