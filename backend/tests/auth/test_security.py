from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.auth import security
from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)
from app.config import get_settings


def test_password_hash_verifies_only_the_right_password():
    hashed = hash_password("correct-horse")

    assert hashed.startswith("$argon2id$")
    assert verify_password("correct-horse", hashed)
    assert not verify_password("wrong-horse", hashed)


def test_verify_without_hash_is_false():
    assert verify_password("anything", None) is False


def test_access_token_round_trip():
    user_id, family_id = uuid4(), uuid4()
    token, expires_in = create_access_token(user_id, family_id)

    claims = decode_access_token(token)

    assert expires_in == 15 * 60
    assert claims is not None
    assert (claims.user_id, claims.family_id) == (user_id, family_id)


def test_access_token_expires_on_the_app_clock(monkeypatch: pytest.MonkeyPatch):
    issued = datetime(2026, 10, 29, 20, tzinfo=UTC)
    monkeypatch.setattr(security.clock, "utcnow", lambda: issued)
    token, ttl = create_access_token(uuid4(), uuid4())

    monkeypatch.setattr(security.clock, "utcnow", lambda: issued + timedelta(seconds=ttl - 1))
    assert decode_access_token(token) is not None

    monkeypatch.setattr(security.clock, "utcnow", lambda: issued + timedelta(seconds=ttl))
    assert decode_access_token(token) is None


def test_token_signed_with_another_secret_is_rejected():
    token = jwt.encode(
        {"sub": str(uuid4()), "fid": str(uuid4()), "type": "access", "exp": 9999999999},
        "another-secret-that-is-long-enough-for-hs256",
        algorithm="HS256",
    )

    assert decode_access_token(token) is None


@pytest.mark.parametrize(
    "payload",
    [
        {"sub": "not-a-uuid", "fid": "00000000-0000-0000-0000-000000000000", "type": "access"},
        {"sub": "00000000-0000-0000-0000-000000000000", "type": "access"},
        {"sub": "00000000-0000-0000-0000-000000000000", "fid": "x", "type": "refresh"},
    ],
)
def test_malformed_access_tokens_are_rejected(payload: dict[str, str]):
    token = jwt.encode({**payload, "exp": 9999999999}, get_settings().jwt_secret, algorithm="HS256")

    assert decode_access_token(token) is None


def test_garbage_is_rejected():
    assert decode_access_token("not.a.jwt") is None


def test_opaque_tokens_are_unique_and_hashed():
    first, second = new_opaque_token(), new_opaque_token()

    assert first != second
    assert len(first) >= 40
    assert hash_token(first) == hash_token(first)
    assert hash_token(first) != first
