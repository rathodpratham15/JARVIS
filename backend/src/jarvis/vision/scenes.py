"""Scene analysis via Gemini Vision or GPT-4 Vision.

Replaces the legacy `visual_recognition.py` (941 lines) with ~150 lines.
Drops the OpenCV Haar-cascade face detector duplication, the dominant-color
fallback, and the unused `capture_image_from_camera` helper (the camera
route in `web_server.py` does its own cv2 capture and never called this).
"""

from __future__ import annotations

import base64
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_PROMPT = (
    "Describe the scene in this image. Respond with JSON: "
    "{\"description\": str, \"confidence\": 0..1, "
    "\"objects_detected\": [str], \"scene_type\": str, "
    "\"colors\": [str], \"mood\": str}."
)


@dataclass
class SceneDescription:
    description: str
    confidence: float = 0.0
    objects_detected: list[str] = field(default_factory=list)
    scene_type: str = "general"
    colors: list[str] = field(default_factory=list)
    mood: str = "neutral"
    processing_time: float = 0.0
    model_used: str = "none"


class SceneAnalyzer:
    """Calls a vision LLM to describe an image. Lazily initializes a client.

    Provider precedence: explicit `provider` kwarg → `GEMINI_API_KEY` →
    `OPENAI_API_KEY` → fallback (returns a stub description).
    """

    def __init__(self, provider: Optional[str] = None) -> None:
        self.provider = provider or self._auto_provider()
        self._client = self._make_client()

    @staticmethod
    def _auto_provider() -> Optional[str]:
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            return "gemini"
        if os.getenv("OPENAI_API_KEY"):
            return "openai"
        return None

    def _make_client(self):
        if self.provider == "gemini":
            try:
                import google.generativeai as genai  # type: ignore
            except ImportError:
                logger.warning("google-generativeai not installed; scene analysis disabled")
                return None
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            genai.configure(api_key=api_key)
            return genai.GenerativeModel("gemini-1.5-flash")
        if self.provider == "openai":
            try:
                from openai import OpenAI  # type: ignore
            except ImportError:
                return None
            return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        return None

    def describe_scene(self, image_path: str) -> SceneDescription:
        start = time.monotonic()
        if not os.path.exists(image_path):
            return SceneDescription(description="Image file not found", processing_time=0.0)
        if self._client is None:
            return SceneDescription(
                description="Scene analysis is not configured (set GEMINI_API_KEY or OPENAI_API_KEY).",
                model_used="none",
                processing_time=time.monotonic() - start,
            )

        try:
            if self.provider == "gemini":
                payload = self._gemini_describe(image_path)
            else:
                payload = self._openai_describe(image_path)
        except Exception as exc:
            logger.exception("Scene analysis failed")
            return SceneDescription(
                description=f"Scene analysis failed: {exc}",
                model_used=self.provider or "none",
                processing_time=time.monotonic() - start,
            )

        return SceneDescription(
            description=payload.get("description", ""),
            confidence=float(payload.get("confidence", 0.7)),
            objects_detected=list(payload.get("objects_detected", [])),
            scene_type=payload.get("scene_type", "general"),
            colors=list(payload.get("colors", [])),
            mood=payload.get("mood", "neutral"),
            processing_time=time.monotonic() - start,
            model_used="gemini-1.5-flash" if self.provider == "gemini" else "gpt-4o-mini",
        )

    def _gemini_describe(self, image_path: str) -> dict:
        with open(image_path, "rb") as fh:
            image_bytes = fh.read()
        response = self._client.generate_content(
            [DEFAULT_PROMPT, {"mime_type": "image/jpeg", "data": image_bytes}]
        )
        text = (response.text or "").strip()
        return _coerce_json(text)

    def _openai_describe(self, image_path: str) -> dict:
        with open(image_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode()
        response = self._client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": DEFAULT_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    ],
                }
            ],
            max_tokens=600,
        )
        text = response.choices[0].message.content or ""
        return _coerce_json(text)


def _coerce_json(text: str) -> dict:
    """Vision models often wrap JSON in markdown fences. Be tolerant."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"description": text, "confidence": 0.5}
