"""Tiny in-memory sliding-window rate limiter keyed by client IP."""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import RATE_LIMIT_PER_MIN

WINDOW_S = 60.0
PRUNE_AT_KEYS = 5000


def client_ip(request: Request, trusted_hops: int = 0) -> str:
    """Peer address, or the Nth-from-right X-Forwarded-For entry when behind N trusted proxies.

    Entries left of that are client-controlled, so they are never used.
    """
    peer = request.client.host if request.client else "unknown"
    if trusted_hops < 1:
        return peer
    forwarded = request.headers.get("x-forwarded-for", "")
    parts = [p.strip() for p in forwarded.split(",") if p.strip()]
    return parts[-trusted_hops] if len(parts) >= trusted_hops else peer


class RateLimiter:
    def __init__(
        self, limit: int = RATE_LIMIT_PER_MIN, window_s: float = WINDOW_S, trusted_hops: int = 0
    ) -> None:
        self._limit = limit
        self._trusted_hops = trusted_hops
        self._window_s = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, request: Request) -> None:
        now = time.monotonic()
        key = client_ip(request, self._trusted_hops)
        hits = self._hits[key]
        while hits and now - hits[0] > self._window_s:
            hits.popleft()
        if len(hits) >= self._limit:
            raise HTTPException(status_code=429, detail="too many requests, slow down")
        hits.append(now)
        if len(self._hits) > PRUNE_AT_KEYS:
            self._prune(now)

    def _prune(self, now: float) -> None:
        stale = [k for k, h in self._hits.items() if not h or now - h[-1] > self._window_s]
        for key in stale:
            del self._hits[key]
