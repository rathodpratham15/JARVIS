"""Multi-provider vision chain with automatic fallback.

Configure provider order via JARVIS_VISION_PROVIDER (comma-separated):
    JARVIS_VISION_PROVIDER=gemini,openai,anthropic

On any API error (429, 400, 404, …) the chain transparently tries the next
provider. If the env var is not set, providers are ordered by key availability:
gemini → openai → anthropic.

Per-provider model overrides:
    JARVIS_VISION_MODEL_GEMINI=models/gemini-3.6-flash
    JARVIS_VISION_MODEL_OPENAI=gpt-4o-mini
    JARVIS_VISION_MODEL_ANTHROPIC=claude-haiku-4-5-20251001
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_DEFAULT_MODELS: dict[str, str] = {
    "gemini": "models/gemini-3.6-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
}


class VisionProviderChain:
    """Ordered list of vision providers with automatic error-based fallback.

    Drop-in for any code that needs to send images + a text prompt to a
    vision LLM and get a text response back.
    """

    def __init__(
        self,
        providers: list[str],
        clients: dict,
        models: dict,
    ) -> None:
        self.providers = providers
        self._clients = clients
        self._models = models

    # ------------------------------------------------------------------
    @classmethod
    def from_env(cls, gemini_pool=None) -> Optional["VisionProviderChain"]:
        """Build chain from env + an already-created GeminiKeyPool."""
        clients: dict = {}
        models: dict = {}

        if gemini_pool is not None:
            clients["gemini"] = gemini_pool
            models["gemini"] = os.getenv("JARVIS_VISION_MODEL_GEMINI", _DEFAULT_MODELS["gemini"])

        oai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY_JARVIS")
        if oai_key:
            try:
                from openai import OpenAI
                clients["openai"] = OpenAI(api_key=oai_key, max_retries=0, timeout=60.0)
                models["openai"] = os.getenv("JARVIS_VISION_MODEL_OPENAI", _DEFAULT_MODELS["openai"])
            except ImportError:
                pass

        anth_key = os.getenv("ANTHROPIC_API_KEY")
        if anth_key:
            try:
                import anthropic
                clients["anthropic"] = anthropic.Anthropic(api_key=anth_key)
                models["anthropic"] = os.getenv("JARVIS_VISION_MODEL_ANTHROPIC", _DEFAULT_MODELS["anthropic"])
            except ImportError:
                logger.warning("anthropic package not installed — pip install anthropic to enable")

        if not clients:
            return None

        explicit = [
            p.strip().lower()
            for p in os.getenv("JARVIS_VISION_PROVIDER", "").split(",")
            if p.strip()
        ]
        if explicit:
            providers = [p for p in explicit if p in clients]
        else:
            providers = [p for p in ["gemini", "openai", "anthropic"] if p in clients]

        if not providers:
            return None

        logger.info("VisionProviderChain ready: %s", " → ".join(providers))
        return cls(providers=providers, clients=clients, models=models)

    # ------------------------------------------------------------------
    def call(self, image_paths: list[str], text_prompt: str, max_tokens: int = 1024) -> str:
        """Send image(s) + prompt through the chain; return text on first success."""
        images_b64 = []
        for p in image_paths:
            with open(p, "rb") as fh:
                images_b64.append(base64.b64encode(fh.read()).decode())

        last_exc: Exception | None = None
        for provider in self.providers:
            try:
                result = (
                    self._call_anthropic(images_b64, text_prompt, max_tokens)
                    if provider == "anthropic"
                    else self._call_oai(provider, images_b64, text_prompt, max_tokens)
                )
                if provider != self.providers[0]:
                    logger.info("Vision: using fallback provider %s", provider)
                return result
            except Exception as exc:
                logger.warning("Vision provider %s failed (%s) — trying next", provider, exc)
                last_exc = exc

        raise last_exc or RuntimeError("All vision providers failed")

    def call_content(self, content_oai: list, content_anthropic: list, max_tokens: int = 200) -> str:
        """Low-level call accepting pre-built content blocks (for face engine)."""
        last_exc: Exception | None = None
        for provider in self.providers:
            try:
                if provider == "anthropic":
                    result = self._call_anthropic_content(content_anthropic, max_tokens)
                else:
                    result = self._call_oai_content(provider, content_oai, max_tokens)
                if provider != self.providers[0]:
                    logger.info("Vision: using fallback provider %s", provider)
                return result
            except Exception as exc:
                logger.warning("Vision provider %s failed (%s) — trying next", provider, exc)
                last_exc = exc

        raise last_exc or RuntimeError("All vision providers failed")

    # ------------------------------------------------------------------
    def _call_oai(self, provider: str, images_b64: list[str], text: str, max_tokens: int) -> str:
        content: list = [{"type": "text", "text": text}]
        for b64 in images_b64:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
        return self._call_oai_content(provider, content, max_tokens)

    def _call_oai_content(self, provider: str, content: list, max_tokens: int) -> str:
        resp = self._clients[provider].chat.completions.create(
            model=self._models[provider],
            messages=[{"role": "user", "content": content}],
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()

    def _call_anthropic(self, images_b64: list[str], text: str, max_tokens: int) -> str:
        content: list = []
        for b64 in images_b64:
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}})
        content.append({"type": "text", "text": text})
        return self._call_anthropic_content(content, max_tokens)

    def _call_anthropic_content(self, content: list, max_tokens: int) -> str:
        resp = self._clients["anthropic"].messages.create(
            model=self._models["anthropic"],
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": content}],
        )
        return resp.content[0].text.strip()
