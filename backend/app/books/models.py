from datetime import date
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, SoftDeleteMixin, TimestampMixin


class Book(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "book"
    __table_args__ = (
        CheckConstraint("total_pages BETWEEN 1 AND 10000", name="total_pages"),
        CheckConstraint("start_page >= 0 AND start_page < total_pages", name="start_page"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str]
    author: Mapped[str | None]
    total_pages: Mapped[int]
    start_page: Mapped[int] = mapped_column(default=0, server_default="0")
    finished_date: Mapped[date | None]
