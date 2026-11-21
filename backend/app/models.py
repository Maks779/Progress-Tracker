"""Every model module, imported so that Base.metadata knows all tables (Alembic, tests)."""

from app.auth.models import PasswordResetToken, RefreshToken
from app.books.models import Book
from app.database import Base
from app.exercises.models import Exercise
from app.sessions.models import (
    CardioEntry,
    GeneralEntry,
    ReadingEntry,
    Session,
    StrengthEntry,
    StrengthSet,
)
from app.trackers.models import Tracker
from app.users.models import UserAccount

__all__ = [
    "Base",
    "Book",
    "CardioEntry",
    "Exercise",
    "GeneralEntry",
    "PasswordResetToken",
    "ReadingEntry",
    "RefreshToken",
    "Session",
    "StrengthEntry",
    "StrengthSet",
    "Tracker",
    "UserAccount",
]
