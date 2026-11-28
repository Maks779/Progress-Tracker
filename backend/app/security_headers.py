"""Security headers on every answer of the API."""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

DOCS_PATH = "/api/docs"

HEADERS = (
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
    (b"cache-control", b"no-store"),
)
API_POLICY = (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'")


class SecurityHeaders:
    """Adds each header the answer does not set itself.

    JSON never needs scripts, styles or frames, so the API forbids them all; only the docs page
    (Swagger UI, which loads its own scripts) goes without that policy.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        extra = HEADERS if scope["path"].startswith(DOCS_PATH) else (*HEADERS, API_POLICY)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                headers.extend(header for header in extra if header[0] not in present)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
