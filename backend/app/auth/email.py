"""Password reset emails: the message in the account's language, and the ways to send it."""

import asyncio
import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from html import escape
from pathlib import Path
from typing import Annotated, Protocol

from fastapi import Depends

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 15


@dataclass(frozen=True)
class ResetEmail:
    to: str
    name: str
    link: str
    language: str


class EmailSender(Protocol):
    async def send_password_reset(self, mail: ResetEmail) -> None: ...


def minutes_text(language: str, minutes: int) -> str:
    """The minutes in the case the sentence needs ("po 30 minutach"), on one line."""
    if language == "pl":
        return f"{minutes}\u00a0{'minucie' if minutes == 1 else 'minutach'}"
    if language == "uk":
        last, last_two = minutes % 10, minutes % 100
        if last == 1 and last_two != 11:
            return f"{minutes}\u00a0хвилину"
        if 2 <= last <= 4 and not 12 <= last_two <= 14:
            return f"{minutes}\u00a0хвилини"
        return f"{minutes}\u00a0хвилин"
    return f"{minutes}\u00a0{'minute' if minutes == 1 else 'minutes'}"


TEXTS = {
    "en": {
        "subject": "Reset your Ember password",
        "greeting": "Hi {name},",
        "title": "Choose a new password.",
        "body": "Someone asked to reset the password for {email}. If it was you, use the button "
        "below. The link works once and expires in {minutes}.",
        "button": "Set new password",
        "fallback": "Or open this link in your browser:",
        "ignore": "Didn’t ask for this? Ignore this email. Your password stays the same.",
        "tagline": "Your pace. Your progress.",
    },
    "pl": {
        "subject": "Reset hasła do Ember",
        "greeting": "Cześć {name},",
        "title": "Ustaw nowe hasło.",
        "body": "Ktoś poprosił o zmianę hasła do konta {email}. Jeśli to Ty, użyj przycisku "
        "poniżej. Link działa jeden raz i wygasa po {minutes}.",
        "button": "Ustaw nowe hasło",
        "fallback": "Albo otwórz ten link w przeglądarce:",
        "ignore": "To nie Ty? Zignoruj tę wiadomość. Twoje hasło się nie zmieni.",
        "tagline": "Twoje tempo. Twój postęp.",
    },
    "uk": {
        "subject": "Скидання пароля Ember",
        "greeting": "Привіт, {name}!",
        "title": "Обери новий пароль.",
        "body": "Хтось попросив скинути пароль для акаунта {email}. Якщо це ти, натисни кнопку "
        "нижче. Посилання спрацьовує один раз і діє {minutes}.",
        "button": "Обрати новий пароль",
        "fallback": "Або відкрий це посилання в браузері:",
        "ignore": "Не твій запит? Просто проігноруй цей лист. Пароль залишиться тим самим.",
        "tagline": "Твій темп. Твій прогрес.",
    },
}

HTML = (Path(__file__).parent / "reset_email.html").read_text(encoding="utf-8")


def reset_message(mail: ResetEmail, sender: str, ttl_minutes: int) -> EmailMessage:
    """The email as plain text and HTML, in the account's language (English if unknown)."""
    language = mail.language if mail.language in TEXTS else "en"
    text = TEXTS[language]
    body = text["body"].format(email=mail.to, minutes=minutes_text(language, ttl_minutes))
    greeting = text["greeting"].format(name=mail.name)
    message = EmailMessage()
    message["Subject"] = text["subject"]
    message["From"] = sender
    message["To"] = mail.to
    message.set_content(
        f"{greeting}\n\n{text['title']}\n\n{body}\n\n{text['button']}: {mail.link}\n\n"
        f"{text['ignore']}\n\nEmber · {text['tagline']}\n"
    )
    message.add_alternative(
        HTML.format(
            lang=language,
            subject=escape(text["subject"]),
            greeting=escape(greeting),
            title=escape(text["title"]),
            body=escape(body),
            link=escape(mail.link),
            button=escape(text["button"]),
            fallback=escape(text["fallback"]),
            ignore=escape(text["ignore"]),
            tagline=escape(text["tagline"]),
        ),
        subtype="html",
    )
    return message


class LogEmailSender:
    """Without an SMTP server (tests, CI): the link goes to the server log."""

    async def send_password_reset(self, mail: ResetEmail) -> None:
        logger.warning("Password reset link for %s: %s", mail.to, mail.link)


class SmtpEmailSender:
    """Sends through an SMTP server: Mailpit in development, Gmail with an app password live."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_password_reset(self, mail: ResetEmail) -> None:
        message = reset_message(
            mail, self.settings.email_from, self.settings.password_reset_ttl_minutes
        )
        await asyncio.to_thread(self._send, message)

    def _send(self, message: EmailMessage) -> None:
        settings = self.settings
        assert settings.smtp_host is not None
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=SMTP_TIMEOUT_SECONDS)
        with server as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            smtp.send_message(message)


def get_email_sender(settings: Annotated[Settings, Depends(get_settings)]) -> EmailSender:
    if settings.smtp_host:
        return SmtpEmailSender(settings)
    return LogEmailSender()


async def deliver_reset_email(sender: EmailSender, mail: ResetEmail) -> None:
    """Runs after the response, so the answer takes as long for unknown emails as for real ones."""
    try:
        await sender.send_password_reset(mail)
    except (OSError, smtplib.SMTPException) as error:
        logger.error("Could not send the password reset email: %s", error)
