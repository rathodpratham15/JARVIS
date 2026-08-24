"""Reverse image search: Google Vision Web Detection + Bing Visual Search.

Runs both APIs in parallel and merges candidates. Falls back gracefully if
either key is missing. Bing is significantly better at identifying private
individuals (LinkedIn, GitHub, news); Google Vision is better for celebrities
with many indexed images.

Required env vars (set whichever you have):
  GOOGLE_VISION_API_KEY  — Cloud Vision API key
  BING_SEARCH_API_KEY    — Azure Cognitive Services key (free tier: 1k/month)
"""
from __future__ import annotations

import base64
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

logger = logging.getLogger(__name__)

_VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"
_BING_VISUAL_URL = "https://api.bing.microsoft.com/v7.0/images/visualsearch"


def _is_person_name(text: str) -> bool:
    """Heuristic: 2+ title-case words, no purely numeric tokens."""
    words = [w for w in text.split() if w]
    return (
        len(words) >= 2
        and all(w[0].isupper() for w in words)
        and not any(w.isdigit() for w in words)
    )


def _extract_name_from_page_title(title: str) -> str | None:
    """Extract a person name from a page title like 'John Smith | LinkedIn'."""
    import re
    # Strip common suffixes after separators
    clean = re.split(r"[|\-–—•@]", title)[0].strip()
    # Remove parenthetical qualifiers like "(CEO)" or "(He/Him)"
    clean = re.sub(r"\(.*?\)", "", clean).strip()
    # Must look like a name: 2–4 words, title case, no numbers
    words = clean.split()
    if 2 <= len(words) <= 4 and _is_person_name(clean):
        return clean
    return None


def _google_vision(image_bytes: bytes) -> list[dict]:
    api_key = os.getenv("GOOGLE_VISION_API_KEY")
    if not api_key:
        return []
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "requests": [{
            "image": {"content": b64},
            "features": [{"type": "WEB_DETECTION", "maxResults": 20}],
        }]
    }
    try:
        resp = httpx.post(f"{_VISION_API_URL}?key={api_key}", json=payload, timeout=15)
        resp.raise_for_status()
        web = resp.json().get("responses", [{}])[0].get("webDetection", {})
        results = []

        # 1. Web entities (works well for celebrities)
        for entity in web.get("webEntities", []):
            name = entity.get("description", "").strip()
            score = entity.get("score", 0.0)
            if name and score >= 0.3 and _is_person_name(name):
                results.append({"name": name, "score": round(score, 2), "source": "google_entity"})

        # 2. Page titles — "John Smith | LinkedIn", "John Smith - Portfolio"
        #    This is the key signal for semi-public people with LinkedIn/GitHub profiles
        for page in web.get("pagesWithMatchingImages", []):
            title = page.get("pageTitle", "").strip()
            if not title:
                continue
            name = _extract_name_from_page_title(title)
            if name:
                # Boost score if the page is LinkedIn/GitHub/Twitter (high signal)
                url = page.get("url", "")
                boost = 0.15 if any(s in url for s in ("linkedin.com", "github.com", "twitter.com", "instagram.com")) else 0.0
                results.append({"name": name, "score": round(0.65 + boost, 2), "source": "google_page_title"})

        # 3. Best-guess labels (last resort)
        for label in web.get("bestGuessLabels", []):
            text = label.get("label", "").strip()
            if text and _is_person_name(text):
                results.append({"name": text, "score": 0.50, "source": "google_best_guess"})

        return results
    except Exception as exc:
        logger.warning("Google Vision reverse search failed: %s", exc)
        return []


def _bing_visual(image_bytes: bytes) -> list[dict]:
    api_key = os.getenv("BING_SEARCH_API_KEY")
    if not api_key:
        return []
    try:
        resp = httpx.post(
            _BING_VISUAL_URL,
            headers={"Ocp-Apim-Subscription-Key": api_key},
            files={"image": ("face.jpg", image_bytes, "image/jpeg")},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for tag in data.get("tags", []):
            for action in tag.get("actions", []):
                # Entity recognition — highest confidence person match
                if action.get("actionType") == "Entity":
                    entity_data = action.get("data", {})
                    name = entity_data.get("name", "").strip()
                    if name and _is_person_name(name):
                        results.append({"name": name, "score": 0.90, "source": "bing_entity"})
                # Pages including the image — extract names from titles
                elif action.get("actionType") == "PagesIncluding":
                    for item in action.get("data", {}).get("value", [])[:5]:
                        title = item.get("name", "").strip()
                        # Try first 2-3 words if they look like a name
                        words = title.split()[:3]
                        candidate = " ".join(words)
                        if _is_person_name(candidate) and len(words) >= 2:
                            results.append({"name": candidate, "score": 0.60, "source": "bing_pages"})
                # Related searches often contain person's name
                elif action.get("actionType") == "RelatedSearches":
                    for item in action.get("data", {}).get("value", [])[:3]:
                        text = item.get("text", "").strip()
                        if text and _is_person_name(text):
                            results.append({"name": text, "score": 0.55, "source": "bing_related"})
        return results
    except Exception as exc:
        logger.warning("Bing Visual Search failed: %s", exc)
        return []


def reverse_search_image(image_bytes: bytes) -> dict:
    """Run Google Vision + Bing Visual Search in parallel, merge candidates.

    Returns {available, candidates: [{name, score, source}], error?}
    """
    has_google = bool(os.getenv("GOOGLE_VISION_API_KEY"))
    has_bing = bool(os.getenv("BING_SEARCH_API_KEY"))

    if not has_google and not has_bing:
        return {"available": False, "candidates": [], "error": "No reverse search API key configured"}

    all_results: list[dict] = []

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {}
        if has_google:
            futures[pool.submit(_google_vision, image_bytes)] = "google"
        if has_bing:
            futures[pool.submit(_bing_visual, image_bytes)] = "bing"

        for future in as_completed(futures):
            try:
                all_results.extend(future.result())
            except Exception as exc:
                logger.warning("Reverse search worker failed: %s", exc)

    # Deduplicate by name (case-insensitive), keeping highest score
    merged: dict[str, dict] = {}
    for r in all_results:
        key = r["name"].lower()
        if key not in merged or r["score"] > merged[key]["score"]:
            merged[key] = r

    candidates = sorted(merged.values(), key=lambda x: x["score"], reverse=True)[:5]

    return {
        "available": True,
        "candidates": candidates,
        "sources_used": (["google"] if has_google else []) + (["bing"] if has_bing else []),
    }
