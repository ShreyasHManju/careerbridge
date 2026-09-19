"""
CareerBridge Rate Limiting Module
Provides thread-safe in-memory sliding window rate limiting for authentication
and sensitive endpoints to mitigate brute-force and credential-stuffing attacks.
"""

import threading
import time
from typing import Dict, List, Optional, Tuple

from app.core.exceptions import RateLimitExceededException


class RateLimiter:
    """
    Thread-safe in-memory sliding-window rate limiter.
    Maintains timestamp history of attempts within a rolling time window.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._attempts: Dict[str, List[float]] = {}

    def is_rate_limited(
        self, key: str, max_attempts: int, window_seconds: int
    ) -> Tuple[bool, int]:
        """
        Check whether the given key has exceeded max_attempts within the sliding window.
        Returns a tuple of (is_limited: bool, retry_after_seconds: int).
        Does NOT record a new attempt.
        """
        with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            timestamps = [t for t in self._attempts.get(key, []) if t > cutoff]
            self._attempts[key] = timestamps

            if len(timestamps) >= max_attempts:
                oldest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - oldest)))
                return True, retry_after

            return False, 0

    def check_rate_limit(
        self, key: str, max_attempts: int, window_seconds: int
    ) -> None:
        """
        Evaluate rate limit for a key. If exceeded, immediately raises
        RateLimitExceededException (HTTP 429) containing Retry-After metadata.
        """
        limited, retry_after = self.is_rate_limited(key, max_attempts, window_seconds)
        if limited:
            raise RateLimitExceededException(
                message=f"Too many failed attempts. Please try again after {retry_after} seconds.",
                detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                retry_after=retry_after,
            )

    def record_attempt(self, key: str) -> None:
        """
        Record an attempt timestamp for the specified key.
        """
        with self._lock:
            now = time.time()
            if key not in self._attempts:
                self._attempts[key] = []
            self._attempts[key].append(now)

    def clear(self, key: Optional[str] = None) -> None:
        """
        Reset attempt history for a specific key, or all keys if key is None.
        """
        with self._lock:
            if key is None:
                self._attempts.clear()
            elif key in self._attempts:
                del self._attempts[key]

    def reset(self) -> None:
        """
        Reset all recorded attempts across all keys.
        Convenience method for test suites to prevent test pollution.
        """
        self.clear()


# Global in-memory rate limiter instance
rate_limiter = RateLimiter()
