"""LLM/STT provider configuration.

The OpenAI Python client supports any OpenAI-compatible endpoint via the
`base_url` parameter, so providers like Groq slot in with no extra
dependency. Pick a provider with `JARVIS_LLM_PROVIDER` (or
`JARVIS_STT_PROVIDER`) and an optional `JARVIS_LLM_MODEL` override.

vLLM support
------------
vLLM serves an OpenAI-compatible REST API, so it slots in as a provider
with zero extra dependencies. Point `VLLM_BASE_URL` at your vLLM server
(e.g. http://gpu-host:8000/v1) and set JARVIS_LLM_PROVIDER=vllm.

  # Start vLLM (on a CUDA GPU host):
  #   pip install vllm
  #   vllm serve meta-llama/Llama-3.1-8B-Instruct --port 8000
  #
  # Then in JARVIS .env:
  #   JARVIS_LLM_PROVIDER=vllm
  #   VLLM_BASE_URL=http://<gpu-host>:8000/v1
  #   VLLM_MODEL=meta-llama/Llama-3.1-8B-Instruct   # optional override
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key_env: tuple[str, ...]
    base_url: Optional[str]
    default_chat_model: str
    default_stt_model: str
    # If set, this env var overrides base_url at runtime (used by vLLM so the
    # server address can be changed without touching code).
    base_url_env: Optional[str] = None


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
        default_chat_model="openai/gpt-oss-120b",
        default_stt_model="whisper-large-v3",
    ),
    "gemini": ProviderConfig(
        name="gemini",
        api_key_env=("GEMINI_API_KEY",),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        default_chat_model="models/gemini-3.6-flash",
        default_stt_model="",
    ),
    "meta": ProviderConfig(
        name="meta",
        api_key_env=("META_LLAMA_API_KEY",),
        base_url="https://api.llamameta.net/v1",
        default_chat_model="Llama-3.3-70B-Instruct",
        default_stt_model="",
    ),
    # ── Self-hosted vLLM ──────────────────────────────────────────────────
    # vLLM exposes an OpenAI-compatible API so the existing OpenAI client
    # works unchanged. Set VLLM_BASE_URL to your server address and
    # optionally VLLM_MODEL to override the default model name.
    # Hardware: requires NVIDIA GPU (Ampere+ recommended for FP16/Flash-Attn).
    # Throughput advantage over HF generate(): PagedAttention + continuous
    # batching → typically 10-20× higher req/s at the same latency budget.
    "vllm": ProviderConfig(
        name="vllm",
        api_key_env=("VLLM_API_KEY",),          # vLLM can run with no auth; set "EMPTY" if needed
        base_url="http://localhost:8000/v1",     # overridden by VLLM_BASE_URL at runtime
        base_url_env="VLLM_BASE_URL",
        default_chat_model="meta-llama/Llama-3.1-8B-Instruct",
        default_stt_model="",
    ),
}


def resolve_api_key(provider: ProviderConfig) -> Optional[str]:
    for env in provider.api_key_env:
        value = os.getenv(env)
        if value:
            return value
    return None


def resolve_base_url(provider: ProviderConfig) -> Optional[str]:
    """Return the effective base URL, respecting runtime env-var overrides."""
    if provider.base_url_env:
        override = os.getenv(provider.base_url_env)
        if override:
            return override.rstrip("/")
    return provider.base_url


def select_provider(env_var: str = "JARVIS_LLM_PROVIDER") -> ProviderConfig:
    """Return the requested provider, or auto-detect if unset.

    Auto-detection prefers an explicit `JARVIS_LLM_PROVIDER` env var,
    then `OPENAI_API_KEY`, then `GROQ_API_KEY`. Falls back to OpenAI
    (which will run in demo mode if its key is also unset).
    """
    explicit = (os.getenv(env_var) or "").strip().lower()
    if explicit and explicit in PROVIDERS:
        return PROVIDERS[explicit]
    # For the main chat LLM, prefer OpenAI then Groq.
    # For agent tasks (JARVIS_AGENT_PROVIDER), prefer Gemini (free) over OpenAI (paid).
    if env_var == "JARVIS_AGENT_PROVIDER":
        if os.getenv("GEMINI_API_KEY"):
            return PROVIDERS["gemini"]
        if os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY_JARVIS"):
            return PROVIDERS["openai"]
    else:
        if os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY_JARVIS"):
            return PROVIDERS["openai"]
    if os.getenv("GROQ_API_KEY"):
        return PROVIDERS["groq"]
    if os.getenv("META_LLAMA_API_KEY"):
        return PROVIDERS["meta"]
    if os.getenv("VLLM_BASE_URL"):
        return PROVIDERS["vllm"]
    return PROVIDERS["openai"]
