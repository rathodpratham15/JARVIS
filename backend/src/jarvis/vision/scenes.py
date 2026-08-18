"""Scene analysis via any OpenAI-compatible vision API.

Supports Groq (llama-4-scout), Gemini (OAI-compat endpoint), and OpenAI.
Provider is auto-detected from env vars, or forced via JARVIS_VISION_PROVIDER.
Model is overridable via JARVIS_VISION_MODEL.
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

_DEFAULT_MODELS = {
    "gemini": "gemini-3.6-flash",
    "groq": "llama-4-scout-17b-16e-instruct",
    "openai": "gpt-4o-mini",
}

_BASE_URLS = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "groq": "https://api.groq.com/openai/v1",
}


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
    """Calls a vision LLM to describe an image via an OAI-compatible API.

    Provider auto-detection order: JARVIS_VISION_PROVIDER env var →
    GEMINI_API_KEY → GROQ_API_KEY → OPENAI_API_KEY → disabled.
    """

    def __init__(self, provider: Optional[str] = None) -> None:
        self.provider = (
            provider
            or os.getenv("JARVIS_VISION_PROVIDER")
            or self._auto_provider()
        )
        self._client = self._make_client()

    @staticmethod
    def _auto_provider() -> Optional[str]:
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            return "gemini"
        if os.getenv("GROQ_API_KEY"):
            return "groq"
        if os.getenv("OPENAI_API_KEY"):
            return "openai"
        return None

    def _make_client(self):
        if not self.provider:
            return None
        try:
            from openai import OpenAI  # type: ignore
        except ImportError:
            logger.warning("openai package not installed; scene analysis disabled")
            return None

        if self.provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        elif self.provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
        else:
            api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            logger.warning("No API key found for vision provider %r", self.provider)
            return None

        kwargs: dict = {"api_key": api_key, "max_retries": 1, "timeout": 30.0}
        if self.provider in _BASE_URLS:
            kwargs["base_url"] = _BASE_URLS[self.provider]
        return OpenAI(**kwargs)

    def _effective_model(self) -> str:
        return os.getenv("JARVIS_VISION_MODEL") or _DEFAULT_MODELS.get(self.provider or "", "gemini-2.0-flash")

    def describe_scene(self, image_path: str) -> SceneDescription:
        start = time.monotonic()
        if not os.path.exists(image_path):
            return SceneDescription(description="Image file not found", processing_time=0.0)
        if self._client is None:
            return SceneDescription(
                description="Scene analysis not configured (set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY).",
                model_used="none",
                processing_time=time.monotonic() - start,
            )

        model = self._effective_model()
        try:
            payload = self._oai_describe(image_path, model)
        except Exception as exc:
            logger.exception("Scene analysis failed")
            return SceneDescription(
                description=f"Scene analysis failed: {exc}",
                model_used=model,
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
            model_used=model,
        )

    def _oai_describe(self, image_path: str, model: str) -> dict:
        with open(image_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode()
        response = self._client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": DEFAULT_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            }],
            max_tokens=600,
        )
        return _coerce_json(response.choices[0].message.content or "")


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
