from dataclasses import dataclass
from datetime import date
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.books import rules
from app.books.models import Book
from app.books.schemas import BookOut, BookWrite
from app.errors import field_error, not_found
from app.ownership import get_owned
from app.users.models import UserAccount


@dataclass(frozen=True)
class ReadingState:
    current_page: int
    pages_in_window: int


async def reading_states(
    db: AsyncSession, books: list[Book], window_start: date
) -> dict[UUID, ReadingState]:
    """Latest end page and pages read since window_start, per book (from reading sessions)."""
    return {book.id: ReadingState(book.start_page, 0) for book in books}


def to_out(book: Book, state: ReadingState, today: date) -> BookOut:
    finished = book.finished_date is not None
    return BookOut(
        id=book.id,
        title=book.title,
        author=book.author,
        total_pages=book.total_pages,
        start_page=book.start_page,
        current_page=state.current_page,
        progress_percent=rules.progress_percent(state.current_page, book.total_pages),
        finished_date=book.finished_date,
        estimated_finish_date=None
        if finished
        else rules.estimated_finish(
            state.current_page, book.total_pages, state.pages_in_window, today
        ),
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


async def describe(db: AsyncSession, user: UserAccount, books: list[Book]) -> list[BookOut]:
    today = clock.today_in(user.timezone)
    states = await reading_states(db, books, rules.pace_window_start(today))
    return [to_out(book, states[book.id], today) for book in books]


async def list_books(
    db: AsyncSession, user: UserAccount, status: Literal["reading", "finished"] | None
) -> list[BookOut]:
    query = select(Book).where(Book.user_id == user.id, Book.deleted_at.is_(None))
    if status == "reading":
        query = query.where(Book.finished_date.is_(None))
    elif status == "finished":
        query = query.where(Book.finished_date.is_not(None))
    books = list((await db.scalars(query.order_by(Book.updated_at.desc()))).all())
    return await describe(db, user, books)


async def get_book(db: AsyncSession, user: UserAccount, book_id: UUID) -> BookOut:
    book = await get_owned(db, Book, book_id, user.id)
    return (await describe(db, user, [book]))[0]


async def put_book(
    db: AsyncSession, user: UserAccount, book_id: UUID, data: BookWrite
) -> tuple[BookOut, bool]:
    """Create or update a book under a client-generated ID; also says if it was new."""
    book = await db.get(Book, book_id)
    created = book is None
    if created:
        book = Book(id=book_id, user_id=user.id, **data.model_dump())
        db.add(book)
    elif book.user_id != user.id or book.deleted_at is not None:
        raise not_found()
    else:
        window_start = rules.pace_window_start(clock.today_in(user.timezone))
        state = (await reading_states(db, [book], window_start))[book.id]
        if data.total_pages < state.current_page:
            raise field_error(
                "total_pages", "below_current_page", "Total pages cannot go below the last page."
            )
        for field, value in data.model_dump().items():
            setattr(book, field, value)
    await db.commit()
    await db.refresh(book)
    return (await describe(db, user, [book]))[0], created


async def delete_book(db: AsyncSession, user: UserAccount, book_id: UUID) -> None:
    book = await get_owned(db, Book, book_id, user.id)
    book.deleted_at = clock.utcnow()
    await db.commit()
