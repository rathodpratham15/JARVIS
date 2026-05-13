"""LLM/STT provider configuration.

The OpenAI Python client supports any OpenAI-compatible endpoint via the
`base_url` parameter, so providers like Groq slot in with no extra
dependency. Pick a provider with `JARVIS_LLM_PROVIDER` (or
`JARVIS_STT_PROVIDER`) and an optional `JARVIS_LLM_MODEL` override.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key_env: tuple[str, ...]
    base_url: Optional[str]
    default_chat_model: str
    default_stt_model: str


PROVIDERS: dict[str, ProviderConfig] = {
    "openai": ProviderConfig(
        name="openai",
        api_key_env=("OPENAI_API_KEY", "OPENAI_API_KEY_JARVIS", "OPENAI_KEY"),
        base_url=None,
        default_chat_model="gpt-4",
        default_stt_model="whisper-1",
    ),
    "groq": ProviderConfig(
        name="groq",
        api_key_env=("GROQ_API_KEY",),
        base_url="https://api.groq.com/openai/v1",
        default_chat_model="llama-3.3-70b-versatile",
        default_stt_model="whisper-large-v3",
    ),
}


def resolve_api_key(provider: ProviderConfig) -> Optional[str]:
    for env in provider.api_key_env:
        value = os.getenv(env)
        if value:
            return value
    return None


def select_provider(env_var: str = "JARVIS_LLM_PROVIDER") -> ProviderConfig:
    """Return the requested provider, or auto-detect if unset.

    Auto-detection prefers an explicit `JARVIS_LLM_PROVIDER` env var,
    then `OPENAI_API_KEY`, then `GROQ_API_KEY`. Falls back to OpenAI
    (which will run in demo mode if its key is also unset).
    """
    explicit = (os.getenv(env_var) or "").strip().lower()
    if explicit and explicit in PROVIDERS:
        return PROVIDERS[explicit]
    if os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY_JARVIS"):
        return PROVIDERS["openai"]
    if os.getenv("GROQ_API_KEY"):
        return PROVIDERS["groq"]
    return PROVIDERS["openai"]
