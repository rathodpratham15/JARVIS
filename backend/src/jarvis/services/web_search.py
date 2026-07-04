"""Web search service with provider fallback chain.

Provider priority:
  1. Brave Search API  (BRAVE_API_KEY)   — 2k free queries/month
  2. Serper.dev        (SERPER_API_KEY)  — 2.5k free queries/month
  3. DuckDuckGo        (no key)          — HTML scrape, always available

Each provider returns a list of SearchResult dicts:
    {"title": str, "url": str, "snippet": str}

The public entry point is `search(query, limit)` which tries providers
in order and returns results as soon as one succeeds.
`search_and_summarize(query, llm, limit)` additionally asks the LLM to
synthesize the snippets into a concise answer.
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING, Optional

import requests

if TYPE_CHECKING:
    from jarvis.core.llm_core import LLMCore

logger = logging.getLogger(__name__)

_TIMEOUT = 8  # seconds per request


# ── result type ────────────────────────────────────────────────────────────

class SearchResult:
    __slots__ = ("title", "url", "snippet")

    def __init__(self, title: str, url: str, snippet: str) -> None:
        self.title = title
        self.url = url
        self.snippet = snippet

    def to_dict(self) -> dict:
        return {"title": self.title, "url": self.url, "snippet": self.snippet}


# ── providers ──────────────────────────────────────────────────────────────

def _brave(query: str, limit: int) -> list[SearchResult]:
    api_key = os.getenv("BRAVE_API_KEY", "")
    if not api_key:
        raise ValueError("BRAVE_API_KEY not set")
    resp = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers={"Accept": "application/json", "X-Subscription-Token": api_key},
        params={"q": query, "count": min(limit, 20)},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    results = []
    for item in data.get("web", {}).get("results", [])[:limit]:
        results.append(SearchResult(
            title=item.get("title", ""),
            url=item.get("url", ""),
            snippet=item.get("description", ""),
        ))
    return results


def _serper(query: str, limit: int) -> list[SearchResult]:
    api_key = os.getenv("SERPER_API_KEY", "")
    if not api_key:
        raise ValueError("SERPER_API_KEY not set")
    resp = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
        json={"q": query, "num": min(limit, 10)},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    results = []
    for item in data.get("organic", [])[:limit]:
        results.append(SearchResult(
            title=item.get("title", ""),
            url=item.get("link", ""),
            snippet=item.get("snippet", ""),
        ))
    return results


def _duckduckgo(query: str, limit: int) -> list[SearchResult]:
    """DuckDuckGo Instant Answer API — no key, limited but always available."""
    resp = requests.get(
        "https://api.duckduckgo.com/",
        params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    results: list[SearchResult] = []

    # Abstract (Wikipedia-style summary)
    if data.get("AbstractText"):
        results.append(SearchResult(
            title=data.get("Heading", query),
            url=data.get("AbstractURL", ""),
            snippet=data["AbstractText"],
        ))

    # Related topics
    for topic in data.get("RelatedTopics", [])[:limit]:
        if isinstance(topic, dict) and topic.get("Text"):
            results.append(SearchResult(
                title=topic.get("Text", "")[:80],
                url=topic.get("FirstURL", ""),
                snippet=topic.get("Text", ""),
            ))
        if len(results) >= limit:
            break

    return results


_PROVIDERS = [
    ("brave", _brave),
    ("serper", _serper),
    ("duckduckgo", _duckduckgo),
]


# ── public API ─────────────────────────────────────────────────────────────

def search(query: str, limit: int = 5) -> list[dict]:
    """Try providers in order; return results from the first that succeeds."""
    for name, fn in _PROVIDERS:
        try:
            results = fn(query, limit)
            if results:
                logger.info("web_search: provider=%s query=%r results=%d", name, query, len(results))
                return [r.to_dict() for r in results]
        except Exception as exc:
            logger.debug("web_search: provider=%s failed: %s", name, exc)
    logger.warning("web_search: all providers failed for %r", query)
    return []


def search_and_summarize(
    query: str,
    llm: "Optional[LLMCore]" = None,
    limit: int = 5,
) -> str:
    """Search the web and return a summarized answer.

    If an LLM is provided the snippets are synthesized into a concise reply.
    Otherwise the top snippet is returned verbatim.
    """
    results = search(query, limit=limit)
    if not results:
        return f"I couldn't find any web results for '{query}'."

    if llm is None or not llm.client:
        # No LLM — return structured list of top results
        lines = [f"Here's what I found for '{query}':"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. **{r['title']}** — {r['snippet']}")
        return "\n".join(lines)

    # Build a summarization prompt from the snippets
    snippets = "\n\n".join(
        f"[{i+1}] {r['title']}\n{r['snippet']}\nSource: {r['url']}"
        for i, r in enumerate(results)
    )
    prompt = (
        f"Based on the following web search results for the query '{query}', "
        f"provide a concise, accurate answer. Cite sources where relevant.\n\n"
        f"{snippets}"
    )
    try:
        return llm.query_llm(prompt)
    except Exception as exc:
        logger.warning("web_search summarization failed: %s", exc)
        return results[0]["snippet"] if results else f"No results found for '{query}'."
