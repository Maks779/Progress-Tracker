from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, SoftDeleteMixin, TimestampMixin

MUSCLE_GROUPS = ("chest", "back", "legs", "shoulders", "arms", "core", "full_body")
EQUIPMENT = ("barbell", "dumbbell", "machine", "cable", "kettlebell", "bodyweight", "band", "other")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


class Exercise(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "exercise"
    __table_args__ = (
        CheckConstraint(_in("muscle_group", MUSCLE_GROUPS), name="muscle_group"),
        CheckConstraint(_in("equipment", EQUIPMENT), name="equipment"),
        CheckConstraint("mechanic IN ('compound', 'isolation')", name="mechanic"),
        CheckConstraint(
            "(user_id IS NULL AND key IS NOT NULL AND name IS NULL)"
            " OR (user_id IS NOT NULL AND key IS NULL AND name IS NOT NULL)",
            name="builtin_or_custom",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str | None] = mapped_column(unique=True)
    name: Mapped[str | None]
    muscle_group: Mapped[str]
    equipment: Mapped[str]
    mechanic: Mapped[str | None]
