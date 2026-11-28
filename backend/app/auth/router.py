from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Request, Response

from app.auth import service
from app.auth.dependencies import Client
from app.auth.email import EmailSender, deliver_reset_email, get_email_sender
from app.auth.schemas import (
    ClientKind,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetTokenCheck,
    TokenResponse,
)
from app.config import get_settings
from app.database import DbSession
from app.rate_limit import RateLimiter, client_ip

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "__Secure-refresh_token"
COOKIE_PATH = "/api/v1/auth"
WINDOW_SECONDS = 15 * 60

attempts_by_email = RateLimiter(limit=5, window_seconds=WINDOW_SECONDS)
attempts_by_ip = RateLimiter(limit=20, window_seconds=WINDOW_SECONDS)
failed_logins_by_account_and_ip = RateLimiter(limit=5, window_seconds=WINDOW_SECONDS)
failed_logins_by_account = RateLimiter(limit=20, window_seconds=WINDOW_SECONDS)


def _limit(request: Request, action: str, email: str | None = None) -> None:
    attempts_by_ip.hit(f"{action}:{client_ip(request)}")
    if email is not None:
        attempts_by_email.hit(f"{action}:{service.normalize_email(email)}")


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=get_settings().refresh_token_ttl_days * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="strict",
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE, httponly=True, secure=True, samesite="strict", path=COOKIE_PATH
    )


def _token_response(
    tokens: service.IssuedTokens, client: ClientKind, response: Response
) -> TokenResponse:
    if client == "web":
        set_refresh_cookie(response, tokens.refresh_token)
        return TokenResponse(access_token=tokens.access_token, expires_in=tokens.expires_in)
    return TokenResponse(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        refresh_token=tokens.refresh_token,
    )


@router.post(
    "/register",
    status_code=201,
    response_model=TokenResponse,
    response_model_exclude_none=True,
    summary="Create an account and sign in",
)
async def register(
    data: RegisterRequest, client: Client, request: Request, response: Response, db: DbSession
) -> TokenResponse:
    _limit(request, "register")
    tokens = await service.register(db, data, client)
    return _token_response(tokens, client, response)


@router.post(
    "/login",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    summary="Sign in with email and password",
)
async def login(
    data: LoginRequest, client: Client, request: Request, response: Response, db: DbSession
) -> TokenResponse:
    ip = client_ip(request)
    account = service.normalize_email(data.email)
    _count_login(ip, account)
    tokens = await service.login(db, data.email, data.password, client)
    _uncount_login(ip, account)
    return _token_response(tokens, client, response)


def _count_login(ip: str, account: str) -> None:
    """Wrong passwords count per account and network, and more loosely per account: guessing stays
    slow, while locking someone else out takes many networks at once (and a reset ends it)."""
    attempts_by_ip.hit(f"login:{ip}")
    failed_logins_by_account_and_ip.hit(f"{account}|{ip}")
    failed_logins_by_account.hit(account)


def _uncount_login(ip: str, account: str) -> None:
    """A right password is not a failed attempt."""
    failed_logins_by_account_and_ip.release(f"{account}|{ip}")
    failed_logins_by_account.release(account)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    summary="Rotate the refresh token and get a new access token",
)
async def refresh(
    client: Client,
    response: Response,
    db: DbSession,
    data: RefreshRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> TokenResponse:
    raw_token = refresh_cookie if client == "web" else (data.refresh_token if data else None)
    tokens = await service.refresh(db, raw_token)
    return _token_response(tokens, client, response)


@router.post("/logout", status_code=204, summary="Revoke the current refresh token family")
async def logout(
    client: Client,
    db: DbSession,
    data: RefreshRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> Response:
    raw_token = refresh_cookie if client == "web" else (data.refresh_token if data else None)
    await service.logout(db, raw_token)
    response = Response(status_code=204)
    clear_refresh_cookie(response)
    return response


@router.post("/password/forgot", status_code=202, summary="Request a password reset link")
async def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: DbSession,
    sender: Annotated[EmailSender, Depends(get_email_sender)],
    background: BackgroundTasks,
) -> Response:
    _limit(request, "forgot", data.email)
    mail = await service.request_password_reset(db, data.email)
    if mail is not None:
        background.add_task(deliver_reset_email, sender, mail)
    return Response(status_code=202)


@router.post(
    "/password/reset/check",
    status_code=204,
    summary="Check that a reset link is still unused and not expired",
)
async def check_reset_token(data: ResetTokenCheck, request: Request, db: DbSession) -> Response:
    _limit(request, "reset-check")
    await service.check_reset_token(db, data.token)
    return Response(status_code=204)


@router.post("/password/reset", status_code=204, summary="Set a new password with a reset token")
async def reset_password(data: ResetPasswordRequest, request: Request, db: DbSession) -> Response:
    _limit(request, "reset")
    email = await service.reset_password(db, data.token, data.new_password)
    failed_logins_by_account.forget(email)
    failed_logins_by_account_and_ip.forget_starting_with(f"{email}|")
    return Response(status_code=204)
