from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentUser
from app.books import service
from app.books.schemas import BookList, BookOut, BookWrite
from app.database import DbSession

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=BookList, summary="List books")
async def list_books(
    user: CurrentUser, db: DbSession, status: Literal["reading", "finished"] | None = None
) -> BookList:
    return BookList(items=await service.list_books(db, user, status))


@router.get("/{book_id}", response_model=BookOut, summary="Get a book with progress and estimate")
async def get_book(book_id: UUID, user: CurrentUser, db: DbSession) -> BookOut:
    return await service.get_book(db, user, book_id)


@router.put(
    "/{book_id}",
    response_model=BookOut,
    responses={201: {"model": BookOut, "description": "Created."}},
    summary="Add or update a book (idempotent)",
)
async def put_book(
    book_id: UUID, data: BookWrite, user: CurrentUser, db: DbSession, response: Response
) -> BookOut:
    book, created = await service.put_book(db, user, book_id, data)
    response.status_code = 201 if created else 200
    return book


@router.delete("/{book_id}", status_code=204, summary="Delete a book (soft)")
async def delete_book(book_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    await service.delete_book(db, user, book_id)
    return Response(status_code=204)
