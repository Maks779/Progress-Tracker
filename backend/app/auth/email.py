import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    async def send_password_reset(self, email: str, link: str) -> None: ...


class LogEmailSender:
    """Stub until a real email provider is chosen: the link goes to the server log."""

    async def send_password_reset(self, email: str, link: str) -> None:
        logger.warning("Password reset link for %s: %s", email, link)


def get_email_sender() -> EmailSender:
    return LogEmailSender()
