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
- For actions that require external systems, use the available tools to do it directly — do not describe what you would do
- When a user's request requires multiple actions, call each tool in sequence — do not stop after the first action or save remaining steps as a reminder
- Maintain context from previous conversations
- Prioritize user safety and privacy

LANGUAGE:
- Detect the language the user is writing in and respond in that same language.
- If the user writes in Hindi, respond in Hindi. Spanish → Spanish. French → French. Etc.
- Default to English only when the language cannot be determined.
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

    def query_llm(
        self,
        prompt: str,
        memory: Optional[str] = None,
        system_prompt_override: Optional[str] = None,
        max_tokens_override: Optional[int] = None,
        record: bool = True,
    ) -> str:
        """Call the LLM and return its reply.

        Set ``record=False`` for internal/utility calls (e.g. memory extraction)
        that must not pollute the shared conversation history.
        """
        if not self.client:
            return self._simulate_response(prompt)

        sys = system_prompt_override or self.system_prompt
        messages: list[dict] = [{"role": "system", "content": sys}]
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
                max_tokens=max_tokens_override or self.max_tokens,
            )
        except Exception as exc:
            logger.error("LLM query failed (%s): %s", self.provider.name, exc)
            return "I'm having trouble reaching the language model right now. Please try again."

        reply = response.choices[0].message.content or ""
        if record:
            self._record("user", prompt)
            self._record("assistant", reply)
        return reply

    def stream_llm(self, prompt: str, memory: Optional[str] = None, system_prompt_override: Optional[str] = None) -> Iterator[str]:
        """Yield response tokens one by one. Falls back to yielding the full
        simulated response as a single chunk when no client is available."""
        if not self.client:
            yield self._simulate_response(prompt)
            return

        sys = system_prompt_override or self.system_prompt
        messages: list[dict] = [{"role": "system", "content": sys}]
        if memory:
            messages.append({"role": "system", "content": f"Context from memory: {memory}"})
        for m in self.conversation_history[-_CONTEXT_WINDOW:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        full_reply: list[str] = []
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True,
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    full_reply.append(token)
                    yield token
        except Exception as exc:
            logger.error("LLM stream failed (%s): %s", self.provider.name, exc)
            yield "I'm having trouble reaching the language model right now. Please try again."
            return

        reply = "".join(full_reply)
        self._record("user", prompt)
        self._record("assistant", reply)

    def query_with_tools(
        self,
        prompt: str,
        tools: list[dict],
        memory: Optional[str] = None,
        system_prompt_override: Optional[str] = None,
        max_tokens_override: Optional[int] = None,
    ) -> tuple[str | None, str | None, dict | None]:
        """Call the LLM with a tool schema.

        Returns a 3-tuple:
        - ``(text, None, None)``           — LLM answered directly
        - ``(None, tool_name, tool_args)`` — LLM wants to call a tool
        Falls back to a simulated response if no client is available.
        """
        if not self.client:
            return self._simulate_response(prompt), None, None

        sys = system_prompt_override or self.system_prompt
        messages: list[dict] = [{"role": "system", "content": sys}]
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
                max_tokens=max_tokens_override or self.max_tokens,
            )
        except Exception as exc:
            logger.error("LLM tool call failed (%s): %s", self.provider.name, exc)
            return "I'm having trouble reaching the language model right now. Please try again.", None, None

        choice = response.choices[0]

        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            tc = choice.message.tool_calls[0]
            try:
                args = json.loads(tc.function.arguments)
            except (json.JSONDecodeError, AttributeError):
                args = {}
            return None, tc.function.name, args

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
        system_prompt_override: Optional[str] = None,
        max_tokens_override: Optional[int] = None,
    ) -> str:
        """Feed tool result back to the LLM for a natural-language reply."""
        if not self.client:
            return tool_result

        sys = system_prompt_override or self.system_prompt
        messages: list[dict] = [{"role": "system", "content": sys}]
        if memory:
            messages.append({"role": "system", "content": f"Context from memory: {memory}"})
        for m in self.conversation_history[-_CONTEXT_WINDOW:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})
        messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [{"id": "call_0", "type": "function", "function": {"name": tool_name, "arguments": "{}"}}],
        })
        messages.append({"role": "tool", "tool_call_id": "call_0", "content": tool_result})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=max_tokens_override or self.max_tokens,
            )
            choice = response.choices[0]
            # Some providers (Groq) may still emit a tool_call even with no
            # tools in the payload.  Fall back to the raw tool result.
            if choice.finish_reason == "tool_calls":
                reply = tool_result
            else:
                reply = choice.message.content or tool_result
        except Exception as exc:
            logger.error("LLM finish_after_tool failed: %s", exc)
            reply = tool_result

        self._record("user", prompt)
        self._record("assistant", reply)
        return reply

    def run_tool_loop(
        self,
        prompt: str,
        tools: list[dict],
        execute_tool,
        memory: Optional[str] = None,
        system_prompt_override: Optional[str] = None,
        max_tokens_override: Optional[int] = None,
        max_steps: int = 5,
        first_tool_name: Optional[str] = None,
        first_tool_args: Optional[dict] = None,
    ) -> tuple[str, str | None]:
        """Run a multi-step tool-calling loop.

        Calls the LLM repeatedly until it produces a text reply (not a tool
        call), executing each requested tool via ``execute_tool(name, args) ->
        str`` along the way.  Returns ``(reply_text, last_tool_name)`` where
        ``last_tool_name`` is the last tool that was called (or ``None`` if the
        LLM answered directly without any tool).

        When ``first_tool_name`` and ``first_tool_args`` are provided the
        initial LLM call is skipped — the given tool is executed directly and
        the loop continues from that result.  This lets callers that already
        ran ``query_with_tools`` avoid a redundant round-trip.
        """
        if not self.client:
            return self._simulate_response(prompt), None

        sys = system_prompt_override or self.system_prompt
        messages: list[dict] = [{"role": "system", "content": sys}]
        if memory:
            messages.append({"role": "system", "content": f"Context from memory: {memory}"})
        for m in self.conversation_history[-_CONTEXT_WINDOW:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        last_tool: str | None = None

        # If the caller already has the first tool call, inject it directly.
        if first_tool_name is not None:
            tool_call_id = "call_0"
            last_tool = first_tool_name
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": tool_call_id,
                    "type": "function",
                    "function": {
                        "name": first_tool_name,
                        "arguments": json.dumps(first_tool_args or {}),
                    },
                }],
            })
            tool_result = execute_tool(first_tool_name, first_tool_args or {})
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": tool_result,
            })
            # Start loop from step 1 (we already consumed one step)
            steps = range(max_steps - 1)
        else:
            steps = range(max_steps)

        for step in steps:
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    temperature=self.temperature,
                    max_tokens=max_tokens_override or self.max_tokens,
                )
            except Exception as exc:
                logger.error("LLM run_tool_loop step %d failed: %s", step, exc)
                reply = "I'm having trouble reaching the language model right now. Please try again."
                self._record("user", prompt)
                self._record("assistant", reply)
                return reply, last_tool

            choice = response.choices[0]

            if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                tc = choice.message.tool_calls[0]
                try:
                    args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, AttributeError):
                    args = {}

                tool_call_id = tc.id
                tool_name = tc.function.name
                last_tool = tool_name

                # Append assistant tool-call turn
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": tool_call_id,
                        "type": "function",
                        "function": {"name": tool_name, "arguments": tc.function.arguments},
                    }],
                })

                # Execute the tool
                tool_result = execute_tool(tool_name, args)

                # Append tool result turn
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": tool_result,
                })
                continue

            # LLM returned a text answer
            reply = choice.message.content or ""
            self._record("user", prompt)
            self._record("assistant", reply)
            return reply, last_tool

        # Exhausted steps — ask LLM to summarise without further tool calls
        try:
            messages.append({"role": "user", "content": "Please summarise what you found."})
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=max_tokens_override or self.max_tokens,
            )
            reply = response.choices[0].message.content or "Done."
        except Exception as exc:
            logger.error("LLM run_tool_loop final step failed: %s", exc)
            reply = "Done."
        self._record("user", prompt)
        self._record("assistant", reply)
        return reply, last_tool

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
