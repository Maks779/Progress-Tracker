import pytest

from app import rate_limit
from app.errors import AppError
from app.rate_limit import SWEEP_EVERY, RateLimiter, network_of


def test_a_released_attempt_frees_its_place():
    limiter = RateLimiter(limit=2, window_seconds=60)
    limiter.hit("alex@example.com")
    limiter.hit("alex@example.com")

    limiter.release("alex@example.com")
    limiter.hit("alex@example.com")

    with pytest.raises(AppError) as refused:
        limiter.hit("alex@example.com")
    assert refused.value.status == 429


def test_keys_past_their_window_are_forgotten(monkeypatch: pytest.MonkeyPatch):
    now = [1000.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: now[0])
    limiter = RateLimiter(limit=5, window_seconds=60)
    for n in range(SWEEP_EVERY - 1):
        limiter.hit(f"made-up-{n}@example.com")

    now[0] += 61
    limiter.hit("alex@example.com")

    assert len(limiter) == 1


@pytest.mark.parametrize(
    ("address", "network"),
    [
        ("203.0.113.5", "203.0.113.5"),
        ("2001:db8:1:2::1", "2001:db8:1:2::/64"),
        ("2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"),
        ("::ffff:203.0.113.5", "203.0.113.5"),
        ("unknown", "unknown"),
    ],
)
def test_callers_are_counted_per_network(address: str, network: str):
    assert network_of(address) == network
