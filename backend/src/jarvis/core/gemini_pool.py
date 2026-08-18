"""Gemini API key pool with automatic 429 rotation.

Set multiple keys in GEMINI_API_KEY as a semicolon-separated list:
    GEMINI_API_KEY=key1;key2;key3

Additional keys can also be set as GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
When one key hits the free-tier daily quota (429), the pool transparently
retries with the next available key. Exhausted keys recover after 24 h.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_EXHAUSTED_TTL = 86_400  # seconds — Gemini free tier resets daily


class _CompletionsProxy:
    def __init__(self, pool: "GeminiKeyPool") -> None:
        self._pool = pool

    def create(self, **kwargs):
        return self._pool._create(**kwargs)


class _ChatProxy:
    def __init__(self, pool: "GeminiKeyPool") -> None:
        self.completions = _CompletionsProxy(pool)


class GeminiKeyPool:
    """Drop-in replacement for an OpenAI client at the chat.completions.create() level.

    Usage (anywhere an OpenAI Gemini client is used):
        pool = GeminiKeyPool.from_env()
        response = pool.chat.completions.create(model=..., messages=...)
    """

    def __init__(self, keys: list[str]) -> None:
        from openai import OpenAI

        self._keys = keys
        self._clients = {
            k: OpenAI(api_key=k, base_url=GEMINI_BASE_URL, max_retries=0, timeout=60.0)
            for k in keys
        }
        self._exhausted: dict[str, float] = {}
        self.chat = _ChatProxy(self)

    # ------------------------------------------------------------------
    @classmethod
    def from_env(cls) -> Optional["GeminiKeyPool"]:
        """Build a pool from env vars; return None if no keys found."""
        keys: list[str] = []

        # Primary var — may be semicolon-separated
        for raw in os.getenv("GEMINI_API_KEY", "").split(";"):
            k = raw.strip()
            if k and k not in keys:
                keys.append(k)

        # Also accept GOOGLE_API_KEY as an alias for a single key
        for raw in os.getenv("GOOGLE_API_KEY", "").split(";"):
            k = raw.strip()
            if k and k not in keys:
                keys.append(k)

        # Numbered extras: GEMINI_API_KEY_1, GEMINI_API_KEY_2, …
        i = 1
        while True:
            k = os.getenv(f"GEMINI_API_KEY_{i}", "").strip()
            if not k:
                break
            if k not in keys:
                keys.append(k)
            i += 1

        if not keys:
            return None

        pool = cls(keys)
        logger.info("GeminiKeyPool: %d key(s) loaded", len(keys))
        return pool

    # ------------------------------------------------------------------
    @property
    def n_available(self) -> int:
        now = time.time()
        return sum(1 for k in self._keys if self._exhausted.get(k, 0) < now)

    def _next_client(self):
        now = time.time()
        for key in self._keys:
            if self._exhausted.get(key, 0) < now:
                return key, self._clients[key]
        raise RuntimeError(
            f"All {len(self._keys)} Gemini key(s) quota-exhausted for today. "
            "Add more keys to GEMINI_API_KEY (semicolon-separated) or wait for reset."
        )

    def _create(self, **kwargs):
        from openai import BadRequestError, RateLimitError

        last_exc: Exception | None = None
        tried: set[str] = set()

        while True:
            try:
                active_key, client = self._next_client()
            except RuntimeError as err:
                raise last_exc or err

            if active_key in tried:
                raise last_exc or RuntimeError("All keys exhausted")
            tried.add(active_key)

            try:
                return client.chat.completions.create(**kwargs)
            except RateLimitError as exc:
                logger.warning(
                    "Gemini key …%s quota exhausted (429) — rotating to next key",
                    active_key[-6:],
                )
                self._exhausted[active_key] = time.time() + _EXHAUSTED_TTL
                last_exc = exc
            except BadRequestError as exc:
                if "valid API key" in str(exc) or "INVALID_ARGUMENT" in str(exc):
                    logger.warning(
                        "Gemini key …%s is invalid (400) — skipping permanently",
                        active_key[-6:],
                    )
                    self._exhausted[active_key] = time.time() + 365 * 86_400
                    last_exc = exc
                else:
                    raise
