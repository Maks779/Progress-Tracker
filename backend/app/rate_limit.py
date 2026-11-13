import math
import time
from collections import defaultdict, deque

from app.errors import AppError

_registry: list["RateLimiter"] = []


class RateLimiter:
    """In-memory sliding-window limiter. Enough for one API instance (Cloud Run max-instances=1)."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        _registry.append(self)

    def hit(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window_seconds:
            hits.popleft()
        if len(hits) >= self.limit:
            retry_after = math.ceil(hits[0] + self.window_seconds - now)
            raise AppError(429, headers={"Retry-After": str(max(retry_after, 1))})
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()


def reset_all() -> None:
    for limiter in _registry:
        limiter.reset()
