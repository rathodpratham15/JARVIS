"""Web search service with provider fallback chain.

Provider priority:
  1. Tavily      (TAVILY_API_KEY)  — 1k free queries/month, AI-native, returns clean answer
  2. Brave       (BRAVE_API_KEY)   — 2k free queries/month
  3. Serper      (SERPER_API_KEY)  — 2.5k free queries/month
  4. DuckDuckGo  (no key)          — Instant Answer API, always available

Tavily is the preferred provider: it returns a pre-synthesized `answer` field
alongside individual results, so the LLM summarization step is optional.
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING, Optional

import requests

if TYPE_CHECKING:
    from jarvis.core.llm_core import LLMCore

logger = logging.getLogger(__name__)

_TIMEOUT = 8


# ── result type ───────────────────────────────────────────────────────────────

class SearchResult:
    __slots__ = ("title", "url", "snippet")

    def __init__(self, title: str, url: str, snippet: str) -> None:
        self.title = title
        self.url = url
        self.snippet = snippet

    def to_dict(self) -> dict:
        return {"title": self.title, "url": self.url, "snippet": self.snippet}


# ── providers ─────────────────────────────────────────────────────────────────

def _tavily(query: str, limit: int) -> tuple[list[SearchResult], str]:
    """Tavily Search — returns (results, direct_answer).

    direct_answer is a pre-synthesized one-paragraph answer from Tavily;
    it's non-empty when Tavily is confident enough to answer directly.
    """
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key:
        raise ValueError("TAVILY_API_KEY not set")
    resp = requests.post(
        "https://api.tavily.com/search",
        json={
            "api_key": api_key,
            "query": query,
            "max_results": min(limit, 10),
            "search_depth": "basic",
            "include_answer": True,
        },
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    direct_answer = data.get("answer") or ""
    results = []
    for item in data.get("results", [])[:limit]:
        results.append(SearchResult(
            title=item.get("title", ""),
            url=item.get("url", ""),
            snippet=item.get("content", ""),
        ))
    return results, direct_answer


def _brave(query: str, limit: int) -> tuple[list[SearchResult], str]:
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
    return results, ""


def _serper(query: str, limit: int) -> tuple[list[SearchResult], str]:
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
    return results, ""


def _duckduckgo(query: str, limit: int) -> tuple[list[SearchResult], str]:
    resp = requests.get(
        "https://api.duckduckgo.com/",
        params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    results: list[SearchResult] = []

    if data.get("AbstractText"):
        results.append(SearchResult(
            title=data.get("Heading", query),
            url=data.get("AbstractURL", ""),
            snippet=data["AbstractText"],
        ))

    for topic in data.get("RelatedTopics", [])[:limit]:
        if isinstance(topic, dict) and topic.get("Text"):
            results.append(SearchResult(
                title=topic.get("Text", "")[:80],
                url=topic.get("FirstURL", ""),
                snippet=topic.get("Text", ""),
            ))
        if len(results) >= limit:
            break

    return results, ""


_PROVIDERS = [
    ("tavily",     _tavily),
    ("brave",      _brave),
    ("serper",     _serper),
    ("duckduckgo", _duckduckgo),
]


# ── public API ────────────────────────────────────────────────────────────────

def search(query: str, limit: int = 5) -> list[dict]:
    """Try providers in order; return results from the first that succeeds."""
    for name, fn in _PROVIDERS:
        try:
            results, _ = fn(query, limit)
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
    """Search and return a summarized answer.

    When Tavily is the active provider its pre-synthesized `answer` is used
    directly, skipping the LLM summarization step entirely for faster responses.
    For other providers the LLM synthesizes the snippets, or the top snippet
    is returned verbatim if no LLM is available.
    """
    direct_answer = ""
    results: list[dict] = []

    for name, fn in _PROVIDERS:
        try:
            raw, direct_answer = fn(query, limit)
            if raw:
                results = [r.to_dict() for r in raw]
                logger.info("web_search: provider=%s query=%r results=%d", name, query, len(results))
                break
        except Exception as exc:
            logger.debug("web_search: provider=%s failed: %s", name, exc)

    if not results:
        return f"I couldn't find any web results for '{query}'."

    # Tavily gives us a ready-made answer — use it directly
    if direct_answer:
        sources = "  \n".join(f"• [{r['title']}]({r['url']})" for r in results[:3])
        return f"{direct_answer}\n\n{sources}"

    if llm is None or not llm.client:
        lines = [f"Here's what I found for '{query}':"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. **{r['title']}** — {r['snippet']}")
        return "\n".join(lines)

    snippets = "\n\n".join(
        f"[{i+1}] {r['title']}\n{r['snippet']}\nSource: {r['url']}"
        for i, r in enumerate(results)
    )
    prompt = (
        f"Based on the following web search results for '{query}', "
        f"provide a concise, accurate answer. Cite sources where relevant.\n\n"
        f"{snippets}"
    )
    try:
        return llm.query_llm(prompt)
    except Exception as exc:
        logger.warning("web_search summarization failed: %s", exc)
        return results[0]["snippet"] if results else f"No results found for '{query}'."
