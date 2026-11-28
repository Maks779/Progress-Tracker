import hmac
import ipaddress
import math
import time
from collections import deque

from fastapi import Request

from app.config import get_settings
from app.errors import AppError

SWEEP_EVERY = 1000
PROXY_SECRET_HEADER = "x-proxy-secret"

_registry: list["RateLimiter"] = []


class RateLimiter:
    """In-memory sliding-window limiter. Enough for one API instance (Cloud Run max-instances=1)."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._added = 0
        _registry.append(self)

    def hit(self, key: str) -> None:
        """Count one attempt, or answer 429 when the key has used up its window."""
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - self.window_seconds:
            hits.popleft()
        if len(hits) >= self.limit:
            retry_after = math.ceil(hits[0] + self.window_seconds - now)
            raise AppError(429, headers={"Retry-After": str(max(retry_after, 1))})
        hits.append(now)
        self._added += 1
        if self._added % SWEEP_EVERY == 0:
            self._sweep(now)

    def release(self, key: str) -> None:
        """Take back the latest attempt, e.g. a login that turned out to be right."""
        hits = self._hits.get(key)
        if hits:
            hits.pop()

    def forget(self, key: str) -> None:
        """Drop every attempt of a key, e.g. after the person proved who they are another way."""
        self._hits.pop(key, None)

    def forget_starting_with(self, prefix: str) -> None:
        """Drop the attempts of every key that starts with `prefix`."""
        for key in [key for key in self._hits if key.startswith(prefix)]:
            del self._hits[key]

    def _sweep(self, now: float) -> None:
        """Forget keys with nothing left in the window, so made-up emails cannot fill the memory."""
        cutoff = now - self.window_seconds
        for key in [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()

    def __len__(self) -> int:
        return len(self._hits)


def reset_all() -> None:
    for limiter in _registry:
        limiter.reset()


def client_ip(request: Request) -> str:
    """The caller's network, for per-IP limits.

    Behind the Cloudflare Worker every request comes from Cloudflare, so the Worker names the
    caller in CF-Connecting-IP and proves it is the Worker with the shared proxy secret. Anyone
    else could write any address there, so without the secret the header is ignored.
    """
    address = request.client.host if request.client else "unknown"
    secret = get_settings().proxy_secret
    named = request.headers.get("cf-connecting-ip")
    sent = request.headers.get(PROXY_SECRET_HEADER, "")
    if (
        secret is not None
        and named
        and hmac.compare_digest(sent.encode(), secret.get_secret_value().encode())
    ):
        address = named
    return network_of(address)


def network_of(address: str) -> str:
    """IPv4 addresses as they are; IPv6 ones as their /64, which one person usually holds whole."""
    try:
        ip = ipaddress.ip_address(address.strip())
    except ValueError:
        return address
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return str(ip.ipv4_mapped)
        return str(ipaddress.IPv6Network((int(ip) >> 64 << 64, 64)))
    return str(ip)
