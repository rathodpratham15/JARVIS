"""Multi-step ReAct agent loop for J.A.R.V.I.S.

Implements a Reason → Act → Observe cycle on top of the existing LLMCore
and ActionEngine. The LLM decides at each step whether to call another
tool or produce a final answer.

Typical flow for "what's the weather in the city where Northeastern University is?":
  Step 1 — tool: search_web("Northeastern University location")
           observe: "Boston, Massachusetts"
  Step 2 — tool: get_weather(location="Boston")
           observe: "Currently 68°F and partly cloudy in Boston."
  Step 3 — answer: "Northeastern University is in Boston. It's currently
                    68°F and partly cloudy there."

Usage::

    agent = ReActAgent(llm, actions)
    result = agent.run("book research on quantum computing and save a note")
    print(result.final_answer)
    print(result.steps)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from jarvis.core.action_engine import ActionEngine
    from jarvis.core.llm_core import LLMCore
    from jarvis.core.tool_definitions import TOOLS

logger = logging.getLogger(__name__)

_MAX_STEPS = 8          # hard cap — prevents runaway loops
_TOOL_CALL_ID = "call_{i}"


@dataclass
class AgentStep:
    step: int
    tool_name: str
    tool_args: dict
    tool_result: str


@dataclass
class AgentResult:
    final_answer: str
    steps: list[AgentStep] = field(default_factory=list)
    stopped_early: bool = False     # True if we hit _MAX_STEPS

    def to_dict(self) -> dict:
        return {
            "final_answer": self.final_answer,
            "steps": [
                {
                    "step": s.step,
                    "tool": s.tool_name,
                    "args": s.tool_args,
                    "result": s.tool_result,
                }
                for s in self.steps
            ],
            "stopped_early": self.stopped_early,
        }


class ReActAgent:
    """Stateless agent — creates a fresh message thread per `run()` call."""

    def __init__(
        self,
        llm: "LLMCore",
        actions: "ActionEngine",
        tools: "list[dict] | None" = None,
        max_steps: int = _MAX_STEPS,
    ) -> None:
        self.llm = llm
        self.actions = actions
        self.max_steps = max_steps
        if tools is None:
            from jarvis.core.tool_definitions import TOOLS
            tools = TOOLS
        self.tools = tools

    def run(self, goal: str, memory_context: Optional[str] = None) -> AgentResult:
        """Execute the agent loop for `goal` and return a structured result."""
        if not self.llm.client:
            # No LLM available — fall back to single-turn tool dispatch
            return self._no_llm_fallback(goal)

        steps: list[AgentStep] = []
        messages = self._initial_messages(goal, memory_context)

        for i in range(self.max_steps):
            try:
                response = self.llm.client.chat.completions.create(
                    model=self.llm.model,
                    messages=messages,
                    tools=self.tools,
                    tool_choice="auto",
                    temperature=self.llm.temperature,
                    max_tokens=self.llm.max_tokens,
                )
            except Exception as exc:
                logger.error("AgentLoop step %d failed: %s", i, exc)
                return AgentResult(
                    final_answer=f"I ran into an error on step {i + 1}: {exc}",
                    steps=steps,
                    stopped_early=True,
                )

            choice = response.choices[0]

            # ── LLM decided to call a tool ─────────────────────────────────
            if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                tc = choice.message.tool_calls[0]
                tool_name = tc.function.name
                call_id = tc.id or _TOOL_CALL_ID.format(i=i)

                try:
                    tool_args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, AttributeError):
                    tool_args = {}

                logger.info("AgentLoop step %d: tool=%s args=%s", i + 1, tool_name, tool_args)

                # Execute via ActionEngine
                from jarvis.core.tool_definitions import tool_call_to_intent
                tool_intent = tool_call_to_intent(tool_name, tool_args)
                tool_result = self.actions.execute_action(tool_intent)

                steps.append(AgentStep(
                    step=i + 1,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    tool_result=tool_result,
                ))

                # Append the assistant tool-call + tool result to the thread
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": call_id,
                        "type": "function",
                        "function": {
                            "name": tool_name,
                            "arguments": tc.function.arguments or "{}",
                        },
                    }],
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": tool_result,
                })
                continue

            # ── LLM produced a final answer ────────────────────────────────
            final = choice.message.content or ""
            self.llm._record("user", goal)
            self.llm._record("assistant", final)
            return AgentResult(final_answer=final, steps=steps)

        # Hit max steps — ask the LLM to summarise what it found
        logger.warning("AgentLoop hit max_steps=%d for goal=%r", self.max_steps, goal)
        messages.append({
            "role": "user",
            "content": (
                "You have reached the maximum number of steps. "
                "Summarise what you have found so far and give the best answer you can."
            ),
        })
        try:
            resp = self.llm.client.chat.completions.create(
                model=self.llm.model,
                messages=messages,
                temperature=self.llm.temperature,
                max_tokens=self.llm.max_tokens,
            )
            final = resp.choices[0].message.content or "I completed the steps but couldn't form a final answer."
        except Exception:
            final = "I completed several steps but hit the step limit before finishing."

        self.llm._record("user", goal)
        self.llm._record("assistant", final)
        return AgentResult(final_answer=final, steps=steps, stopped_early=True)

    # ── helpers ────────────────────────────────────────────────────────────

    def _initial_messages(self, goal: str, memory_context: Optional[str]) -> list[dict]:
        messages: list[dict] = [{"role": "system", "content": self.llm.system_prompt}]
        if memory_context:
            messages.append({"role": "system", "content": f"Context from memory: {memory_context}"})
        # Strip non-standard fields so Groq doesn't reject them
        for m in self.llm.conversation_history[-6:]:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": goal})
        return messages

    def _no_llm_fallback(self, goal: str) -> AgentResult:
        """Single-turn fallback when no LLM client is available."""
        from jarvis.core.intent_parser import IntentParser
        intent = IntentParser().parse_intent(goal)
        if intent.get("action_required"):
            result = self.actions.execute_action(intent)
        else:
            result = "I'm in demo mode — set OPENAI_API_KEY or GROQ_API_KEY for full agent capabilities."
        return AgentResult(final_answer=result, steps=[])
