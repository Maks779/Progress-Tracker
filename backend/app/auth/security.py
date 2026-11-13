import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from functools import cache
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app import clock
from app.config import get_settings

ALGORITHM = "HS256"

_password_hash = PasswordHash.recommended()


@dataclass(frozen=True)
class AccessClaims:
    user_id: UUID
    family_id: UUID


@cache
def _dummy_hash() -> str:
    return _password_hash.hash("timing-equalizer")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Check a password. Without a hash it still spends the same time, so timing reveals nothing."""
    if password_hash is None:
        _password_hash.verify(password, _dummy_hash())
        return False
    return _password_hash.verify(password, password_hash)


def create_access_token(user_id: UUID, family_id: UUID) -> tuple[str, int]:
    settings = get_settings()
    now = clock.utcnow()
    ttl = timedelta(minutes=settings.jwt_access_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "fid": str(family_id),
        "type": "access",
        "iat": now,
        "exp": now + ttl,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> AccessClaims | None:
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "fid"]},
        )
        if payload.get("type") != "access":
            return None
        return AccessClaims(user_id=UUID(payload["sub"]), family_id=UUID(payload["fid"]))
    except (jwt.InvalidTokenError, ValueError, TypeError):
        return None


def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
