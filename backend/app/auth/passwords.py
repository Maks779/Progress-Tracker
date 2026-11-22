from functools import cache
from pathlib import Path

from pydantic_core import PydanticCustomError

COMMON_PASSWORDS_FILE = Path(__file__).with_name("common_passwords.txt")


@cache
def _common_passwords() -> frozenset[str]:
    """The 10,000 most common leaked passwords of 8+ characters (NCSC list, via SecLists)."""
    return frozenset(COMMON_PASSWORDS_FILE.read_text(encoding="utf-8").split())


def is_common_password(password: str) -> bool:
    return password.lower() in _common_passwords()


def reject_common_password(password: str) -> str:
    """Block breached passwords instead of demanding digits or symbols (NIST SP 800-63B)."""
    if is_common_password(password):
        raise PydanticCustomError(
            "password_too_common", "This password is too common. Choose a less predictable one."
        )
    return password
