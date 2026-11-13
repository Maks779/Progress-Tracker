import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

PROBLEM_MEDIA_TYPE = "application/problem+json"

STATUS_CODES = {
    400: ("bad_request", "Bad request"),
    401: ("unauthorized", "Unauthorized"),
    403: ("forbidden", "Forbidden"),
    404: ("not_found", "Not found"),
    405: ("method_not_allowed", "Method not allowed"),
    409: ("conflict", "Conflict"),
    422: ("validation_error", "Validation error"),
    429: ("rate_limited", "Too many requests"),
    500: ("internal_error", "Internal server error"),
}


class AppError(Exception):
    """An error that becomes an RFC 9457 problem details response."""

    def __init__(
        self,
        status: int,
        code: str | None = None,
        detail: str | None = None,
        errors: list[dict[str, str]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        default_code, title = STATUS_CODES.get(status, ("error", "Error"))
        super().__init__(detail or title)
        self.status = status
        self.code = code or default_code
        self.title = title
        self.detail = detail
        self.errors = errors
        self.headers = headers


def not_found(detail: str = "Not found.") -> AppError:
    return AppError(404, detail=detail)


def conflict(code: str, detail: str) -> AppError:
    return AppError(409, code=code, detail=detail)


def field_error(field: str, code: str, message: str) -> AppError:
    return AppError(422, errors=[{"field": field, "code": code, "message": message}])


def problem_response(
    status: int,
    code: str,
    title: str,
    detail: str | None = None,
    errors: list[dict[str, str]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {"type": "about:blank", "title": title, "status": status, "code": code}
    if detail:
        body["detail"] = detail
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type=PROBLEM_MEDIA_TYPE, headers=headers)


def _field_path(location: tuple[Any, ...]) -> str:
    path = ""
    for part in location[1:] or location:
        if isinstance(part, int):
            path += f"[{part}]"
        else:
            path += f".{part}" if path else str(part)
    return path


async def _app_error(_: Request, exc: AppError) -> JSONResponse:
    return problem_response(exc.status, exc.code, exc.title, exc.detail, exc.errors, exc.headers)


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"field": _field_path(tuple(e["loc"])), "code": e["type"], "message": e["msg"]}
        for e in exc.errors()
    ]
    return problem_response(422, "validation_error", "Validation error", errors=errors)


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, title = STATUS_CODES.get(exc.status_code, ("error", "Error"))
    return problem_response(exc.status_code, code, title, headers=getattr(exc, "headers", None))


async def _unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return problem_response(500, "internal_error", "Internal server error")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected_error)
