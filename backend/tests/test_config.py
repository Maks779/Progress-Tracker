import pytest
from pydantic import ValidationError

from app.config import Settings

DATABASE_URL = "postgresql+psycopg://unused"
GOOD_SECRET = "a-long-random-string-made-for-this-test"


@pytest.mark.parametrize("secret", ["too-short", "change-me-to-a-long-random-string"])
def test_the_api_refuses_a_weak_jwt_secret_without_printing_it(secret: str):
    with pytest.raises(ValidationError) as refused:
        Settings(database_url=DATABASE_URL, jwt_secret=secret, _env_file=None)

    assert "jwt_secret" in str(refused.value)
    assert secret not in str(refused.value)


def test_the_api_refuses_the_example_proxy_secret():
    with pytest.raises(ValidationError):
        Settings(
            database_url=DATABASE_URL,
            jwt_secret=GOOD_SECRET,
            proxy_secret="change-me-too",
            _env_file=None,
        )


def test_secrets_stay_hidden_when_settings_are_printed():
    settings = Settings(
        database_url=DATABASE_URL,
        jwt_secret=GOOD_SECRET,
        proxy_secret="another-long-random-string-for-the-proxy",
        _env_file=None,
    )

    assert GOOD_SECRET not in repr(settings)
    assert "another-long-random-string" not in repr(settings)
