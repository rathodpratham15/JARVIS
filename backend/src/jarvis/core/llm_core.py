"""Provider-agnostic LLM client (OpenAI, Groq, or any OpenAI-compatible API).

Switch providers via `JARVIS_LLM_PROVIDER=openai|groq` in your `.env`.
Override the model with `JARVIS_LLM_MODEL=…`. With no key set the client
runs in demo mode (canned replies for the most common intents).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Iterator, Optional

from openai import OpenAI

from jarvis.core.providers import resolve_api_key, select_provider

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """You are Jarvis, an intelligent AI voice assistant inspired by Tony Stark's AI companion.

PERSONALITY:
- Professional yet approachable
- Concise and clear in communication
- Helpful and proactive
- Slightly witty when appropriate
- Always respectful and patient

COMMUNICATION STYLE:
- Keep responses conversational since they will be spoken aloud
- Use clear, natural language
- Avoid overly technical jargon unless requested
- Be concise but thorough
- Ask clarifying questions when needed

GUIDELINES:
- Always be helpful and constructive
- If you don't know something, say so clearly
- For actions that require external systems, explain what you would do
- Maintain context from previous conversations
- Prioritize user safety and privacy
"""

_DEMO_RESPONSES = {
    "hello": "Hello! I'm Jarvis, your AI assistant. How can I help you today?",
    "hi": "Hi there! I'm ready to assist you.",
    "how are you": "I'm doing well, thank you for asking! How can I help you?",
    "weather": "I'd be happy to help with weather information, but I need my API connection to get current data.",
    "calculate": "I can help with calculations! What would you like me to compute?",
    "reminder": "I can help you set reminders. What would you like to remember?",
    "goodbye": "Goodbye! It was nice talking with you.",
}

_HISTORY_LIMIT = 20
_CONTEXT_WINDOW = 6


class LLMCore:
    """Stateful chat client. Holds conversation history and a system prompt.

    Provider chosen by `JARVIS_LLM_PROVIDER` (default: auto-detect from
    available API keys). Model chosen by `JARVIS_LLM_MODEL`, the
    constructor's `model=` kwarg, or the provider's default.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        system_prompt: Optional[str] = None,
    ):
        self.provider = select_provider()
        self.model = (
            model
            or os.getenv("JARVIS_LLM_MODEL")
            or self.provider.default_chat_model
        )
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.conversation_history: list[dict] = []
        self.client = self._initialize_client()

    def _initialize_client(self) -> Optional[OpenAI]:
        api_key = resolve_api_key(self.provider)
        if not api_key:
            logger.warning(
                "No API key found for provider %r — LLM responses will be simulated.",
                self.provider.name,
            )
            return None
        kwargs: dict = {"api_key": api_key}
        if self.provider.base_url:
            kwargs["base_url"] = self.provider.base_url
        logger.info("LLMCore using provider=%s model=%s", self.provider.name, self.model)
        return OpenAI(**kwargs)

    def query_llm(self, prompt: str, memory: Optional[str] = None) -> str:
        if not self.client:
            return self._simulate_response(prompt)

        messages: list[dict] = [{"role": "system", "content": self.system_prompt}]
        if memory:
            messages.append({"role": "system", "content": f"Context from memory: {memory}"})
        # Strip non-standard fields like `timestamp`. OpenAI tolerates them
        # but Groq rejects with a 400 ("property 'timestamp' is unsupported").
        for m in self.conversation_history[-_CONTEXT_WINDOW:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
        except Exception as exc:
            logger.error("LLM query failed (%s): %s", self.provider.name, exc)
            return f"I'm having trouble reaching the language model right now. ({exc})"

        reply = response.choices[0].message.content or ""
        self._record("user", prompt)
        self._record("assistant", reply)
        return reply

    def query_with_tools(
        self,
        prompt: str,
        tools: list[dict],
        memory: Optional[str] = None,
    ) -> tuple[str | None, str | None, dict | None]:
        """Call the LLM with a tool schema.

        Returns a 3-tuple:
        - ``(text, None, None)``         — LLM answered directly (no tool call)
        - ``(None, tool_name, tool_args)`` — LLM wants to call a tool
        Falls back to ``query_llm`` if no client is available.
        """
        if not self.client:
            return self._simulate_response(prompt), None, None

        messages: list[dict] = [{"role": "system", "content": self.system_prompt}]
        if memory:
            messages.append({"role": "system", "content": f"Context from memory: {memory}"})
        for m in self.conversation_history[-_CONTEXT_WINDOW:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
        except Exception as exc:
            logger.error("LLM tool call failed (%s): %s", self.provider.name, exc)
            return f"I'm having trouble reaching the language model right now. ({exc})", None, None

        choice = response.choices[0]

        # LLM wants to call a tool
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            tc = choice.message.tool_calls[0]
            try:
                args = json.loads(tc.function.arguments)
            except (json.JSONDecodeError, AttributeError):
                args = {}
            return None, tc.function.name, args

        # LLM answered directly
        reply = choice.message.content or ""
        self._record("user", prompt)
        self._record("assistant", reply)
        return reply, None, None

    def finish_after_tool(
        self,
        prompt: str,
        tool_name: str,
        tool_result: str,
        memory: Optional[str] = None,
    ) -> str:
        """Send the tool result back to the LLM and get a final natural-language reply."""
        if not self.client:
            return tool_result

        messages: list[dict] = [{"role": "system", "content": self.system_prompt}]
        if memory:
            messages.append({"role": "system", "content": f"Context from memory: {memory}"})
        for m in self.conversation_history[-_CONTEXT_WINDOW:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})
        # Provide a stub assistant message indicating a tool was called
        messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [{"id": "call_0", "type": "function", "function": {"name": tool_name, "arguments": "{}"}}],
        })
        messages.append({
            "role": "tool",
            "tool_call_id": "call_0",
            "content": tool_result,
        })

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
            reply = response.choices[0].message.content or tool_result
        except Exception as exc:
            logger.error("LLM finish_after_tool failed: %s", exc)
            reply = tool_result

        self._record("user", prompt)
        self._record("assistant", reply)
        return reply

    def _record(self, role: str, content: str) -> None:
        self.conversation_history.append(
            {"role": role, "content": content, "timestamp": datetime.now().isoformat()}
        )
        if len(self.conversation_history) > _HISTORY_LIMIT:
            self.conversation_history = self.conversation_history[-_HISTORY_LIMIT:]

    def clear_history(self) -> None:
        self.conversation_history = []

    @staticmethod
    def _simulate_response(prompt: str) -> str:
        lowered = prompt.lower()
        for key, reply in _DEMO_RESPONSES.items():
            if key in lowered:
                return reply
        return (
            "I'm in demo mode. Set OPENAI_API_KEY or GROQ_API_KEY (and "
            "optionally JARVIS_LLM_PROVIDER) for full chat."
        )
