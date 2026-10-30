"""Rate limiting.

An in-process sliding window. It is enough for a single worker and for
protecting a shared provider key from a runaway client; a multi-worker
deployment should move the same interface onto Redis.
"""

import time
from collections import defaultdict, deque

from ..core.errors import RateLimitedError


class SlidingWindowLimiter:
    def __init__(self, limit_per_minute: int) -> None:
        self._limit = max(1, limit_per_minute)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, identity: str) -> None:
        now = time.monotonic()
        window = self._hits[identity]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self._limit:
            retry_after = int(60 - (now - window[0])) + 1
            raise RateLimitedError(
                f"Too many requests. Try again in about {retry_after} seconds."
            )
        window.append(now)

    def remaining(self, identity: str) -> int:
        now = time.monotonic()
        window = self._hits[identity]
        while window and now - window[0] > 60:
            window.popleft()
        return max(0, self._limit - len(window))
