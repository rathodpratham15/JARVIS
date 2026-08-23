"""Reverse image search via Google Vision API Web Detection.

Requires GOOGLE_VISION_API_KEY env var (Cloud Vision API key, not OAuth).
Returns candidate person names extracted from web entities.
"""
from __future__ import annotations
import base64, logging, os
import httpx

logger = logging.getLogger(__name__)
_VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"


def reverse_search_image(image_bytes: bytes) -> dict:
    """Send image bytes to Google Vision Web Detection.
    Returns {available, candidates: [{name, score, source}], error?}
    """
    api_key = os.getenv("GOOGLE_VISION_API_KEY")
    if not api_key:
        return {"available": False, "candidates": [], "error": "GOOGLE_VISION_API_KEY not set"}

    b64 = base64.b64encode(image_bytes).decode()
    payload = {"requests": [{"image": {"content": b64}, "features": [{"type": "WEB_DETECTION", "maxResults": 10}]}]}

    try:
        resp = httpx.post(f"{_VISION_API_URL}?key={api_key}", json=payload, timeout=15)
        resp.raise_for_status()
        web = resp.json().get("responses", [{}])[0].get("webDetection", {})

        candidates, seen = [], set()

        for entity in web.get("webEntities", []):
            name = entity.get("description", "").strip()
            score = entity.get("score", 0.0)
            if not name or name.lower() in seen or score < 0.3:
                continue
            words = name.split()
            # Simple heuristic: person names have 2+ title-case words
            if len(words) >= 2 and all(w[0].isupper() for w in words if w):
                seen.add(name.lower())
                candidates.append({"name": name, "score": round(score, 2), "source": "web_entity"})

        for label in web.get("bestGuessLabels", []):
            text = label.get("label", "").strip()
            if text and text.lower() not in seen and len(text.split()) >= 2:
                seen.add(text.lower())
                candidates.append({"name": text, "score": 0.5, "source": "best_guess"})

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return {"available": True, "candidates": candidates[:5]}

    except Exception as exc:
        logger.warning("Google Vision reverse search failed: %s", exc)
        return {"available": True, "candidates": [], "error": str(exc)}
