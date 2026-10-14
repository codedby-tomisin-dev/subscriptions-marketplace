"""Parallel.ai Search API: an AI-agent web search, POST https://api.parallel.ai/v1/search.

Same shape as coinspring's client. Degradation contract: no key, a timeout, a
rate limit that outlasts its retries or a response we don't recognise all log
and return no results. Research must never be able to fail the caller.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://api.parallel.ai/v1/search"
TIMEOUT_SECONDS = 15.0
# `fast` (~700ms) costs the same as `turbo` with better excerpts; `advanced` is 5× the price.
MODE = "fast"
MAX_RETRIES = 2
BACKOFF_SECONDS = 1.1


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    excerpts: list[str] = field(default_factory=list)


class ParallelSearchClient:
    """`post` is the test seam; nothing here touches the network under test."""

    def __init__(self, api_key: str, *, mode: str = MODE, timeout: float = TIMEOUT_SECONDS, post: Callable[..., Any] | None = None) -> None:
        self._api_key = api_key
        self._mode = mode
        self._timeout = timeout
        self._post = post or requests.post

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def search(self, query: str, *, count: int = 6) -> list[SearchResult]:
        """Up to `count` results for one plain-language question, or none."""
        query = query.strip()
        if not query or not self.available:
            return []
        response = self._call({"objective": query, "search_queries": [query], "mode": self._mode})
        results = (response or {}).get("results") or []
        return [_result(raw) for raw in results if isinstance(raw, dict)][:count]

    def _call(self, body: dict) -> dict | None:
        headers = {"x-api-key": self._api_key, "Content-Type": "application/json"}
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = self._post(BASE_URL, headers=headers, json=body, timeout=self._timeout)
            except Exception as error:  # noqa: BLE001 — a search must never fail its caller
                logger.warning("parallel search failed: %s", error)
                return None
            if getattr(response, "status_code", None) == 429 and attempt < MAX_RETRIES:
                time.sleep(BACKOFF_SECONDS * (attempt + 1))
                continue
            try:
                response.raise_for_status()
                return response.json()
            except Exception as error:  # noqa: BLE001
                logger.warning("parallel search returned an unusable response: %s", error)
                return None
        return None


def _result(raw: dict) -> SearchResult:
    return SearchResult(
        title=str(raw.get("title") or ""),
        url=str(raw.get("url") or ""),
        excerpts=[str(excerpt) for excerpt in raw.get("excerpts") or [] if excerpt],
    )


def digest(results: list[SearchResult], *, excerpts_per_result: int = 2) -> str:
    """Compact numbered text for a model to read; JSON would spend tokens on punctuation."""
    if not results:
        return "No results."
    lines: list[str] = []
    for number, result in enumerate(results, 1):
        lines.append(f"{number}. {result.title}".rstrip())
        if result.url:
            lines.append(f"   {result.url}")
        lines.extend(f"   - {excerpt}" for excerpt in result.excerpts[:excerpts_per_result])
    return "\n".join(lines)
