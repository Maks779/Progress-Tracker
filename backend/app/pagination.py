import base64
import binascii
import json
from typing import Annotated, Any

from fastapi import Query

from app.errors import field_error

Limit = Annotated[int, Query(ge=1, le=100)]


def encode_cursor(values: dict[str, Any]) -> str:
    raw = json.dumps(values, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict[str, Any]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        values = json.loads(raw)
    except (binascii.Error, ValueError) as error:
        raise field_error("cursor", "invalid", "The cursor is not valid.") from error
    if not isinstance(values, dict):
        raise field_error("cursor", "invalid", "The cursor is not valid.")
    return values
