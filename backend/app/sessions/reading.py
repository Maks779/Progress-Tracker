"""Reading history: end pages per session and the pages each session added."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.books.models import Book
from app.sessions.models import ReadingEntry, Session


@dataclass(frozen=True)
class ReadingRow:
    session_id: UUID
    book_id: UUID
    end_page: int
    previous_end_page: int
    local_date: date
    started_at: datetime

    @property
    def pages_read(self) -> int:
        return self.end_page - self.previous_end_page


async def reading_rows(
    db: AsyncSession, user_id: UUID, book_ids: set[UUID] | None = None
) -> list[ReadingRow]:
    """Active reading sessions in time order, each with the end page of the one before."""
    previous = func.lag(ReadingEntry.end_page).over(
        partition_by=ReadingEntry.book_id, order_by=(Session.started_at, Session.id)
    )
    query = (
        select(
            ReadingEntry.session_id,
            ReadingEntry.book_id,
            ReadingEntry.end_page,
            func.coalesce(previous, Book.start_page),
            Session.local_date,
            Session.started_at,
        )
        .join(Session, Session.id == ReadingEntry.session_id)
        .join(Book, Book.id == ReadingEntry.book_id)
        .where(Session.user_id == user_id, Session.deleted_at.is_(None))
        .order_by(Session.started_at, Session.id)
    )
    if book_ids is not None:
        query = query.where(ReadingEntry.book_id.in_(book_ids))
    return [ReadingRow(*row) for row in (await db.execute(query)).all()]


async def refresh_finished(db: AsyncSession, user_id: UUID, book_ids: set[UUID]) -> None:
    """Recompute the finished date cache: the date of the session that reached the last page."""
    if not book_ids:
        return
    rows = await reading_rows(db, user_id, book_ids)
    for book_id in book_ids:
        book = await db.get(Book, book_id)
        if book is None:
            continue
        last = next((row for row in reversed(rows) if row.book_id == book_id), None)
        reached_end = last is not None and last.end_page >= book.total_pages
        book.finished_date = last.local_date if reached_end and last else None
