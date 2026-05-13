"""Sentiment / emotion analysis.

Replaces legacy `emotion.py` (818 lines) which loaded HuggingFace
transformers into memory and ran `pipeline('sentiment-analysis')` per
request. v2 either:

  1. Uses OpenAI to classify into an explicit emotion + score (preferred,
     no GPU/model download required), or
  2. Falls back to a small lexicon-based score so the endpoint still
     returns *something* without an API key.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

_POSITIVE_WORDS = {
    "happy", "love", "great", "wonderful", "excited", "amazing", "good",
    "joy", "pleased", "thankful", "fantastic", "awesome", "delighted",
}
_NEGATIVE_WORDS = {
    "sad", "angry", "hate", "terrible", "awful", "bad", "frustrated",
    "annoyed", "disappointed", "miserable", "depressed", "upset", "horrible",
}


@dataclass
class EmotionResult:
    emotion: str          # one of: happy, sad, angry, neutral, etc.
    sentiment: str        # positive | negative | neutral
    confidence: float
    method: str           # llm | lexicon


class EmotionAnalyzer:
    """Classify text into a coarse emotion + sentiment label."""

    def __init__(self) -> None:
        self._client = self._make_client()

    def _make_client(self):
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY_JARVIS")
        if not api_key:
            return None
        try:
            from openai import OpenAI

            return OpenAI(api_key=api_key)
        except ImportError:
            return None

    def analyze(self, text: str) -> EmotionResult:
        if not text or not text.strip():
            return EmotionResult("neutral", "neutral", 0.0, "lexicon")
        if self._client is not None:
            llm_result = self._llm_analyze(text)
            if llm_result is not None:
                return llm_result
        return self._lexicon_analyze(text)

    def _llm_analyze(self, text: str) -> Optional[EmotionResult]:
        prompt = (
            "Classify the emotion of the user's text. Respond with JSON only: "
            '{"emotion": "happy|sad|angry|fearful|surprised|disgusted|neutral", '
            '"sentiment": "positive|negative|neutral", '
            '"confidence": <0..1>}.\n\n'
            f"Text: {text}"
        )
        try:
            response = self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=120,
            )
            import json

            payload = json.loads(response.choices[0].message.content or "{}")
            return EmotionResult(
                emotion=payload.get("emotion", "neutral"),
                sentiment=payload.get("sentiment", "neutral"),
                confidence=float(payload.get("confidence", 0.7)),
                method="llm",
            )
        except Exception as exc:
            logger.warning("LLM emotion analysis failed: %s", exc)
            return None

    @staticmethod
    def _lexicon_analyze(text: str) -> EmotionResult:
        words = text.lower().split()
        positive = sum(1 for w in words if w in _POSITIVE_WORDS)
        negative = sum(1 for w in words if w in _NEGATIVE_WORDS)
        if positive > negative:
            return EmotionResult("happy", "positive", 0.6, "lexicon")
        if negative > positive:
            return EmotionResult("sad", "negative", 0.6, "lexicon")
        return EmotionResult("neutral", "neutral", 0.5, "lexicon")
