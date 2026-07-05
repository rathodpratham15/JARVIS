"""People and company research pipeline.

Aggregates publicly available information about a person, company, or topic
by running multiple targeted web searches in parallel and synthesising the
results into a structured profile via the LLM.

Serves J.A.R.V.I.S Objective 2: real-time research assistant for discovering
public information — the conference networking use case.

Usage::

    from jarvis.services.research import ResearchPipeline
    pipeline = ResearchPipeline(llm)
    profile = pipeline.research_person("Jensen Huang", hints={"company": "NVIDIA"})
    print(profile.summary)
    print(profile.sections)
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

from jarvis.services.web_search import search

if TYPE_CHECKING:
    from jarvis.core.llm_core import LLMCore

logger = logging.getLogger(__name__)


# ── result types ───────────────────────────────────────────────────────────

@dataclass
class ResearchProfile:
    subject: str
    kind: str                          # "person" | "company" | "topic"
    summary: str                       # 2-3 sentence executive summary
    sections: dict[str, str]           # e.g. {"Background": "...", "Role": "..."}
    sources: list[dict]                # raw search result dicts used
    raw_snippets: str                  # concatenated snippets passed to LLM

    def to_dict(self) -> dict:
        return {
            "subject": self.subject,
            "kind": self.kind,
            "summary": self.summary,
            "sections": self.sections,
            "sources": self.sources,
        }


# ── query templates ────────────────────────────────────────────────────────

_PERSON_QUERIES = [
    "{name}",
    "{name} professional background career",
    "{name} {company} role",
    "{name} LinkedIn biography",
    "{name} publications research work",
]

_COMPANY_QUERIES = [
    "{name}",
    "{name} company overview founding",
    "{name} products services business",
    "{name} leadership team CEO",
    "{name} recent news funding",
]

_TOPIC_QUERIES = [
    "{name}",
    "{name} overview explained",
    "{name} latest developments 2025 2026",
    "{name} key facts summary",
]

_PERSON_SYNTHESIS_PROMPT = """You are J.A.R.V.I.S, a research assistant. A user wants to learn about the person "{subject}".

Using ONLY the web search snippets below, create a concise professional profile. Focus on publicly available information.
Do NOT invent details not supported by the snippets. If information is unavailable, say so briefly.

Respond in this exact JSON format (no markdown, no code fences):
{{
  "summary": "2-3 sentence executive summary of who this person is",
  "sections": {{
    "Current Role": "...",
    "Background": "...",
    "Education": "...",
    "Notable Work": "...",
    "Online Presence": "..."
  }}
}}

SEARCH SNIPPETS:
{snippets}"""

_COMPANY_SYNTHESIS_PROMPT = """You are J.A.R.V.I.S, a research assistant. A user wants to learn about "{subject}".

Using ONLY the web search snippets below, create a concise company profile. Focus on publicly available information.
Do NOT invent details. If information is unavailable, say so briefly.

Respond in this exact JSON format (no markdown, no code fences):
{{
  "summary": "2-3 sentence executive summary of what this company is",
  "sections": {{
    "Overview": "...",
    "Products / Services": "...",
    "Leadership": "...",
    "Recent News": "...",
    "Key Facts": "..."
  }}
}}

SEARCH SNIPPETS:
{snippets}"""

_TOPIC_SYNTHESIS_PROMPT = """You are J.A.R.V.I.S, a research assistant. A user wants to learn about "{subject}".

Using ONLY the web search snippets below, create a concise summary. Focus on publicly available information.

Respond in this exact JSON format (no markdown, no code fences):
{{
  "summary": "2-3 sentence overview of this topic",
  "sections": {{
    "What it is": "...",
    "Key Facts": "...",
    "Recent Developments": "...",
    "Why it matters": "..."
  }}
}}

SEARCH SNIPPETS:
{snippets}"""


# ── pipeline ───────────────────────────────────────────────────────────────

class ResearchPipeline:
    def __init__(self, llm: "Optional[LLMCore]" = None) -> None:
        self.llm = llm

    def research_person(
        self,
        name: str,
        hints: Optional[dict] = None,
        results_per_query: int = 3,
    ) -> ResearchProfile:
        """Aggregate public information about a person."""
        company = (hints or {}).get("company", "")
        queries = [
            q.format(name=name, company=company)
            for q in _PERSON_QUERIES
        ]
        return self._run(name, "person", queries, _PERSON_SYNTHESIS_PROMPT, results_per_query)

    def research_company(
        self,
        name: str,
        results_per_query: int = 3,
    ) -> ResearchProfile:
        """Aggregate public information about a company or organisation."""
        queries = [q.format(name=name) for q in _COMPANY_QUERIES]
        return self._run(name, "company", queries, _COMPANY_SYNTHESIS_PROMPT, results_per_query)

    def research_topic(
        self,
        topic: str,
        results_per_query: int = 3,
    ) -> ResearchProfile:
        """Aggregate public information about any topic."""
        queries = [q.format(name=topic) for q in _TOPIC_QUERIES]
        return self._run(topic, "topic", queries, _TOPIC_SYNTHESIS_PROMPT, results_per_query)

    # ── internal ───────────────────────────────────────────────────────────

    def _run(
        self,
        subject: str,
        kind: str,
        queries: list[str],
        prompt_template: str,
        results_per_query: int,
    ) -> ResearchProfile:
        # Fan out searches in parallel threads
        all_results: list[dict] = []
        lock = threading.Lock()

        def _fetch(q: str) -> None:
            try:
                results = search(q, limit=results_per_query)
                with lock:
                    all_results.extend(results)
            except Exception as exc:
                logger.debug("Research query %r failed: %s", q, exc)

        threads = [threading.Thread(target=_fetch, args=(q,), daemon=True) for q in queries]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        # Deduplicate by URL
        seen_urls: set[str] = set()
        unique: list[dict] = []
        for r in all_results:
            url = r.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique.append(r)

        if not unique:
            return ResearchProfile(
                subject=subject,
                kind=kind,
                summary=f"I couldn't find any public information about '{subject}'.",
                sections={},
                sources=[],
                raw_snippets="",
            )

        # Build snippet block for the LLM
        snippets = "\n\n".join(
            f"[{i+1}] {r.get('title', '')}\n{r.get('snippet', '')}\nURL: {r.get('url', '')}"
            for i, r in enumerate(unique[:15])  # cap at 15 snippets to stay within context
        )

        summary, sections = self._synthesise(subject, snippets, prompt_template)

        return ResearchProfile(
            subject=subject,
            kind=kind,
            summary=summary,
            sections=sections,
            sources=unique[:15],
            raw_snippets=snippets,
        )

    def _synthesise(
        self,
        subject: str,
        snippets: str,
        prompt_template: str,
    ) -> tuple[str, dict]:
        """Ask the LLM to synthesise snippets into a structured profile."""
        if not self.llm or not self.llm.client:
            # No LLM — return the top snippet as a plain summary
            first_snippet = snippets.split("\n\n")[0] if snippets else ""
            return first_snippet or f"No summary available for '{subject}'.", {}

        prompt = prompt_template.format(subject=subject, snippets=snippets)
        try:
            raw = self.llm.query_llm(prompt)
            # Strip any markdown fences the model might add
            raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            import json
            data = json.loads(raw)
            return data.get("summary", ""), data.get("sections", {})
        except Exception as exc:
            logger.warning("Research synthesis failed: %s", exc)
            # Fall back to raw snippet summary
            lines = [s.split("\n")[0] for s in snippets.split("\n\n")[:3]]
            return " ".join(lines), {}
