import smtplib
from email.message import EmailMessage
from typing import Any

import pytest
from pydantic import SecretStr

from app.auth import email as email_module
from app.auth.email import (
    LogEmailSender,
    ResetEmail,
    SmtpEmailSender,
    deliver_reset_email,
    get_email_sender,
    minutes_text,
    reset_message,
)
from app.config import Settings

pytestmark = pytest.mark.anyio

LINK = "https://ember.example.workers.dev/reset-password?token=abc&x=<1>"


def settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "database_url": "postgresql+psycopg://unused",
        "jwt_secret": "unused",
        "smtp_host": "smtp.example.com",
        "smtp_port": 587,
        "smtp_username": "ember@example.com",
        "smtp_password": SecretStr("app-password"),
        "smtp_starttls": True,
        "email_from": "Ember <ember@example.com>",
        **overrides,
    }
    return Settings(**values)


def mail(language: str = "en") -> ResetEmail:
    return ResetEmail(to="alex@example.com", name="Alex <Morgan>", link=LINK, language=language)


def parts(message: EmailMessage) -> tuple[str, str]:
    plain = message.get_body(("plain",))
    html = message.get_body(("html",))
    assert plain is not None and html is not None
    return plain.get_content(), html.get_content()


@pytest.mark.parametrize(
    ("language", "subject", "sentence"),
    [
        ("en", "Reset your Ember password", "The link works once and expires in 30 minutes."),
        ("pl", "Reset hasła do Ember", "Link działa jeden raz i wygasa po 30 minutach."),
        ("uk", "Скидання пароля Ember", "Посилання спрацьовує один раз і діє 30 хвилин."),
    ],
)
def test_the_email_speaks_the_accounts_language(language: str, subject: str, sentence: str):
    message = reset_message(mail(language), "Ember <ember@example.com>", 30)

    assert message["Subject"] == subject
    assert message["To"] == "alex@example.com"
    assert message["From"] == "Ember <ember@example.com>"
    plain, html = parts(message)
    assert sentence.replace("30 ", "30\u00a0") in plain
    assert LINK in plain
    assert f'lang="{language}"' in html


def test_the_html_escapes_what_it_did_not_write():
    _, html = parts(reset_message(mail(), "Ember <ember@example.com>", 30))

    assert (
        'href="https://ember.example.workers.dev/reset-password?token=abc&amp;x=&lt;1&gt;"' in html
    )
    assert "Alex &lt;Morgan&gt;" in html
    assert "<Morgan>" not in html


def test_an_unknown_language_gets_english():
    assert reset_message(mail("de"), "Ember <e@example.com>", 30)["Subject"] == (
        "Reset your Ember password"
    )


@pytest.mark.parametrize(
    ("language", "minutes", "expected"),
    [
        ("en", 1, "1 minute"),
        ("en", 30, "30 minutes"),
        ("pl", 1, "1 minucie"),
        ("pl", 30, "30 minutach"),
        ("uk", 1, "1 хвилину"),
        ("uk", 3, "3 хвилини"),
        ("uk", 11, "11 хвилин"),
        ("uk", 21, "21 хвилину"),
        ("uk", 30, "30 хвилин"),
    ],
)
def test_minutes_take_the_right_form(language: str, minutes: int, expected: str):
    assert minutes_text(language, minutes) == expected.replace(" ", "\u00a0")


class FakeSmtp:
    opened: list["FakeSmtp"] = []

    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.address = (host, port, timeout)
        self.calls: list[str] = []
        self.login_with: tuple[str, str] | None = None
        self.messages: list[EmailMessage] = []
        FakeSmtp.opened.append(self)

    def __enter__(self) -> "FakeSmtp":
        return self

    def __exit__(self, *_: object) -> None:
        self.calls.append("quit")

    def starttls(self, context: object) -> None:
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append("login")
        self.login_with = (user, password)

    def send_message(self, message: EmailMessage) -> None:
        self.calls.append("send")
        self.messages.append(message)


@pytest.fixture
def fake_smtp(monkeypatch: pytest.MonkeyPatch) -> type[FakeSmtp]:
    FakeSmtp.opened = []
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSmtp)
    return FakeSmtp


async def test_gmail_style_sending_encrypts_then_logs_in(fake_smtp: type[FakeSmtp]):
    await SmtpEmailSender(settings()).send_password_reset(mail("uk"))

    [server] = fake_smtp.opened
    assert server.address == ("smtp.example.com", 587, email_module.SMTP_TIMEOUT_SECONDS)
    assert server.calls == ["starttls", "login", "send", "quit"]
    assert server.login_with == ("ember@example.com", "app-password")
    assert server.messages[0]["Subject"] == "Скидання пароля Ember"


async def test_a_local_mailbox_needs_neither_encryption_nor_login(fake_smtp: type[FakeSmtp]):
    local = settings(
        smtp_host="mail",
        smtp_port=1025,
        smtp_starttls=False,
        smtp_username=None,
        smtp_password=None,
    )

    await SmtpEmailSender(local).send_password_reset(mail())

    [server] = fake_smtp.opened
    assert server.address[:2] == ("mail", 1025)
    assert server.calls == ["send", "quit"]


def test_without_an_smtp_server_the_link_goes_to_the_log():
    assert isinstance(get_email_sender(settings(smtp_host=None)), LogEmailSender)
    assert isinstance(get_email_sender(settings()), SmtpEmailSender)


async def test_a_failed_delivery_is_logged_without_the_link(caplog: pytest.LogCaptureFixture):
    class Refusing:
        async def send_password_reset(self, mail: ResetEmail) -> None:
            raise smtplib.SMTPAuthenticationError(535, b"Username and Password not accepted")

    await deliver_reset_email(Refusing(), mail())

    assert "Could not send the password reset email" in caplog.text
    assert "token=" not in caplog.text
