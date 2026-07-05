"""People and company research pipeline.

Aggregates publicly available information from the web into a structured
profile. Designed for the conference networking use case: given a name
(and optionally a company or role), quickly surface professional background,
contributions, and public presence.

All data sourced from public web results — no scraping of private profiles,
no authentication required. Respects platform terms of service.

Usage::

    from jarvis.services.people_research import research_person, research_company
    profile = research_person("Jensen Huang", company="NVIDIA", llm=llm)
    print(profile.summary)
    print(profile.sources)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from jarvis.core.llm_core import LLMCore

from jarvis.services.web_search import search

logger = logging.getLogger(__name__)


@dataclass
class PersonProfile:
    name: str
    summary: str                          # LLM-synthesised paragraph
    current_role: str = ""
    company: str = ""
    education: list[str] = field(default_factory=list)
    notable_work: list[str] = field(default_factory=list)
    public_links: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    raw_snippets: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "summary": self.summary,
            "current_role": self.current_role,
            "company": self.company,
            "education": self.education,
            "notable_work": self.notable_work,
            "public_links": self.public_links,
            "sources": self.sources,
        }


@dataclass
class CompanyProfile:
    name: str
    summary: str
    industry: str = ""
    founded: str = ""
    headquarters: str = ""
    key_people: list[str] = field(default_factory=list)
    notable_products: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "summary": self.summary,
            "industry": self.industry,
            "founded": self.founded,
            "headquarters": self.headquarters,
            "key_people": self.key_people,
            "notable_products": self.notable_products,
            "sources": self.sources,
        }


# ── search query builders ──────────────────────────────────────────────────

def _person_queries(name: str, company: str = "", role: str = "") -> list[str]:
    """Generate targeted search queries to maximise coverage."""
    context = f" {company}" if company else ""
    context += f" {role}" if role else ""
    return [
        f"{name}{context} professional background",
        f"{name}{context} LinkedIn",
        f"{name}{context} GitHub",
        f'"{name}"{context} work experience education',
        f"{name}{context} recent news interview",
    ]


def _company_queries(name: str) -> list[str]:
    return [
        f"{name} company overview",
        f"{name} founded CEO products",
        f"{name} recent news funding",
        f"{name} headquarters employees industry",
    ]


# ── synthesis ──────────────────────────────────────────────────────────────

def _synthesise_person(
    name: str,
    company: str,
    role: str,
    snippets: list[dict],
    llm: "Optional[LLMCore]",
) -> str:
    """Ask the LLM to synthesise snippets into a concise professional profile."""
    if not snippets:
        return f"I couldn't find public information about {name}."

    if llm is None or not llm.client:
        # No LLM — return structured list
        lines = [f"Public information found for {name}:"]
        for i, s in enumerate(snippets[:5], 1):
            lines.append(f"{i}. {s['title']}: {s['snippet']}")
        return "\n".join(lines)

    context = f" at {company}" if company else ""
    context += f" ({role})" if role else ""
    snippet_text = "\n\n".join(
        f"[{i+1}] {s['title']}\n{s['snippet']}\nSource: {s['url']}"
        for i, s in enumerate(snippets)
    )
    prompt = f"""Based on the following public web search results, create a concise professional profile for {name}{context}.

Focus on:
- Current role and company
- Professional background and career history
- Education
- Notable work, projects, or contributions
- Any relevant public presence (GitHub, publications, talks)

Keep it factual, concise (3–5 sentences), and only include information that appears in the sources.
Do not speculate or include private information.

Search results:
{snippet_text}

Professional profile:"""

    try:
        return llm.query_llm(prompt)
    except Exception as exc:
        logger.warning("People research synthesis failed: %s", exc)
        return snippets[0]["snippet"] if snippets else f"No public information found for {name}."


def _synthesise_company(
    name: str,
    snippets: list[dict],
    llm: "Optional[LLMCore]",
) -> str:
    if not snippets:
        return f"I couldn't find public information about {name}."

    if llm is None or not llm.client:
        lines = [f"Public information found for {name}:"]
        for i, s in enumerate(snippets[:5], 1):
            lines.append(f"{i}. {s['title']}: {s['snippet']}")
        return "\n".join(lines)

    snippet_text = "\n\n".join(
        f"[{i+1}] {s['title']}\n{s['snippet']}\nSource: {s['url']}"
        for i, s in enumerate(snippets)
    )
    prompt = f"""Based on the following public web search results, create a concise company profile for {name}.

Focus on: industry, founding year, headquarters, key people, main products/services, recent news.
Keep it factual and concise (3–5 sentences).

Search results:
{snippet_text}

Company profile:"""

    try:
        return llm.query_llm(prompt)
    except Exception as exc:
        logger.warning("Company research synthesis failed: %s", exc)
        return snippets[0]["snippet"] if snippets else f"No public information found for {name}."


# ── public API ─────────────────────────────────────────────────────────────

def research_person(
    name: str,
    company: str = "",
    role: str = "",
    llm: "Optional[LLMCore]" = None,
    results_per_query: int = 3,
) -> PersonProfile:
    """Aggregate public web information about a person into a profile.

    Args:
        name: Full name of the person.
        company: Optional company/organisation hint for disambiguation.
        role: Optional job title hint.
        llm: LLMCore instance for synthesis. Falls back to raw snippets if None.
        results_per_query: Web results to fetch per search query.

    Returns:
        PersonProfile with synthesised summary and source links.
    """
    queries = _person_queries(name, company, role)
    all_results: list[dict] = []
    seen_urls: set[str] = set()

    for q in queries:
        for r in search(q, limit=results_per_query):
            if r["url"] not in seen_urls and r["snippet"]:
                all_results.append(r)
                seen_urls.add(r["url"])
        if len(all_results) >= 15:
            break

    summary = _synthesise_person(name, company, role, all_results[:10], llm)

    # Extract unique source URLs
    sources = [r["url"] for r in all_results if r["url"]][:8]

    # Heuristically pick likely profile links
    public_links = [
        r["url"] for r in all_results
        if any(domain in r["url"] for domain in ("linkedin.com", "github.com", "twitter.com", "x.com", "scholar.google"))
    ][:5]

    return PersonProfile(
        name=name,
        summary=summary,
        company=company,
        sources=sources,
        public_links=public_links,
        raw_snippets=all_results[:10],
    )


def research_company(
    name: str,
    llm: "Optional[LLMCore]" = None,
    results_per_query: int = 3,
) -> CompanyProfile:
    """Aggregate public web information about a company into a profile."""
    queries = _company_queries(name)
    all_results: list[dict] = []
    seen_urls: set[str] = set()

    for q in queries:
        for r in search(q, limit=results_per_query):
            if r["url"] not in seen_urls and r["snippet"]:
                all_results.append(r)
                seen_urls.add(r["url"])

    summary = _synthesise_company(name, all_results[:10], llm)
    sources = [r["url"] for r in all_results if r["url"]][:8]

    return CompanyProfile(
        name=name,
        summary=summary,
        sources=sources,
    )
