from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PLACEHOLDER_PREFIX = "change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), extra="ignore", hide_input_in_errors=True
    )

    database_url: str
    cors_origins: str = "http://localhost:8081"

    jwt_secret: SecretStr = Field(min_length=32)
    jwt_access_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    password_reset_ttl_minutes: int = 30
    web_app_url: str = "http://localhost:8081"
    proxy_secret: SecretStr | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_starttls: bool = True
    email_from: str = "Ember <no-reply@ember.local>"

    @field_validator("jwt_secret", "proxy_secret")
    @classmethod
    def _not_the_example(cls, value: SecretStr | None) -> SecretStr | None:
        """Refuse to start with the placeholder from .env.example."""
        if value is not None and value.get_secret_value().startswith(PLACEHOLDER_PREFIX):
            raise ValueError("replace the example value with a long random string")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
