"""Background task manager for long-running agent goals.

Submitting a goal returns a task_id immediately. The agent loop runs on a
worker thread and updates the task record as it progresses. Callers poll
GET /api/tasks/{id} to check status and retrieve the result.

Task lifecycle:
  pending  → running  → done
                      ↘ failed
                      ↘ cancelled

Usage::

    tm = TaskManager(agent, memory, sem_memory)
    task_id = tm.submit("research quantum computing and save a summary note")
    # ... later ...
    task = tm.get(task_id)
    print(task.status, task.result.final_answer)
"""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from jarvis.core.agent import AgentResult, ReActAgent
    from jarvis.core.memory import Memory
    from jarvis.core.semantic_memory import SemanticMemory

logger = logging.getLogger(__name__)

_MAX_WORKERS = 4


class TaskStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    DONE      = "done"
    FAILED    = "failed"
    CANCELLED = "cancelled"


@dataclass
class Task:
    id: str
    goal: str
    status: TaskStatus
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    result: "Optional[AgentResult]" = None
    error: Optional[str] = None
    _cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)

    def to_dict(self) -> dict:
        d: dict = {
            "id": self.id,
            "goal": self.goal,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error": self.error,
        }
        if self.result is not None:
            d["final_answer"] = self.result.final_answer
            d["steps"] = [
                {"step": s.step, "tool": s.tool_name, "args": s.tool_args, "result": s.tool_result}
                for s in self.result.steps
            ]
            d["stopped_early"] = self.result.stopped_early
        else:
            d["final_answer"] = None
            d["steps"] = []
            d["stopped_early"] = False
        return d

    def cancel(self) -> None:
        self._cancel_event.set()


class TaskManager:
    """Thread-safe registry + executor for background agent tasks."""

    def __init__(
        self,
        agent: "ReActAgent",
        memory: "Memory",
        sem_memory: "SemanticMemory",
        max_workers: int = _MAX_WORKERS,
    ) -> None:
        self._agent = agent
        self._memory = memory
        self._sem = sem_memory
        self._tasks: dict[str, Task] = {}
        self._lock = threading.RLock()
        self._semaphore = threading.Semaphore(max_workers)

    # ── public API ─────────────────────────────────────────────────────────

    def submit(self, goal: str, max_steps: int = 8) -> str:
        """Enqueue a goal and return its task_id immediately."""
        task_id = str(uuid.uuid4())
        task = Task(
            id=task_id,
            goal=goal,
            status=TaskStatus.PENDING,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        with self._lock:
            self._tasks[task_id] = task

        thread = threading.Thread(
            target=self._run,
            args=(task, max_steps),
            daemon=True,
            name=f"agent-task-{task_id[:8]}",
        )
        thread.start()
        logger.info("Task %s submitted: %r", task_id, goal[:60])
        return task_id

    def get(self, task_id: str) -> Optional[Task]:
        with self._lock:
            return self._tasks.get(task_id)

    def list_all(self) -> list[dict]:
        with self._lock:
            return [t.to_dict() for t in sorted(self._tasks.values(), key=lambda t: t.created_at, reverse=True)]

    def cancel(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
        if task is None:
            return False
        task.cancel()
        if task.status == TaskStatus.PENDING:
            with self._lock:
                task.status = TaskStatus.CANCELLED
                task.finished_at = datetime.now(timezone.utc).isoformat()
        return True

    def delete(self, task_id: str) -> bool:
        with self._lock:
            if task_id not in self._tasks:
                return False
            self._tasks[task_id].cancel()
            del self._tasks[task_id]
        return True

    # ── internal ───────────────────────────────────────────────────────────

    def _run(self, task: Task, max_steps: int) -> None:
        with self._semaphore:
            if task._cancel_event.is_set():
                with self._lock:
                    task.status = TaskStatus.CANCELLED
                    task.finished_at = datetime.now(timezone.utc).isoformat()
                return

            with self._lock:
                task.status = TaskStatus.RUNNING
                task.started_at = datetime.now(timezone.utc).isoformat()

            logger.info("Task %s starting", task.id)
            try:
                from jarvis.core.agent import ReActAgent
                # Create a fresh agent with the same LLM/actions but its own step cap
                local_agent = ReActAgent(
                    llm=self._agent.llm,
                    actions=self._agent.actions,
                    tools=self._agent.tools,
                    max_steps=min(max(1, max_steps), 15),
                )

                # Check for cancellation between steps by monkey-patching the run
                result = self._run_with_cancel_check(local_agent, task)

                if task._cancel_event.is_set():
                    with self._lock:
                        task.status = TaskStatus.CANCELLED
                        task.finished_at = datetime.now(timezone.utc).isoformat()
                    return

                task.result = result

                # Persist to memory
                interaction_id = self._memory.store_interaction(
                    user_input=task.goal,
                    response=result.final_answer,
                    intent_type="background_agent",
                    metadata={
                        "task_id": task.id,
                        "steps": len(result.steps),
                        "stopped_early": result.stopped_early,
                    },
                )
                self._sem.index_interaction(interaction_id, task.goal)

                with self._lock:
                    task.status = TaskStatus.DONE
                    task.finished_at = datetime.now(timezone.utc).isoformat()
                logger.info("Task %s done in %d steps", task.id, len(result.steps))

            except Exception as exc:
                logger.exception("Task %s failed: %s", task.id, exc)
                with self._lock:
                    task.status = TaskStatus.FAILED
                    task.error = str(exc)
                    task.finished_at = datetime.now(timezone.utc).isoformat()

    def _run_with_cancel_check(self, agent: "ReActAgent", task: Task) -> "AgentResult":
        """Run the agent loop, honouring cancel requests between steps."""
        import json as _json
        from jarvis.core.agent import AgentResult, AgentStep
        from jarvis.core.tool_definitions import tool_call_to_intent

        steps: list[AgentStep] = []
        messages = agent._initial_messages(task.goal, memory_context=None)

        for i in range(agent.max_steps):
            if task._cancel_event.is_set():
                return AgentResult(
                    final_answer="Task was cancelled.",
                    steps=steps,
                    stopped_early=True,
                )

            try:
                response = agent.llm.client.chat.completions.create(
                    model=agent.llm.model,
                    messages=messages,
                    tools=agent.tools,
                    tool_choice="auto",
                    temperature=agent.llm.temperature,
                    max_tokens=agent.llm.max_tokens,
                ) if agent.llm.client else None
            except Exception as exc:
                return AgentResult(
                    final_answer=f"Task failed on step {i + 1}: {exc}",
                    steps=steps,
                    stopped_early=True,
                )

            # No LLM — fall back to single-turn
            if response is None:
                from jarvis.core.intent_parser import IntentParser
                intent = IntentParser().parse_intent(task.goal)
                answer = agent.actions.execute_action(intent) if intent.get("action_required") else "Demo mode — set an API key for full agent capabilities."
                return AgentResult(final_answer=answer, steps=steps)

            choice = response.choices[0]

            if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                tc = choice.message.tool_calls[0]
                tool_name = tc.function.name
                call_id = tc.id or f"call_{i}"
                try:
                    tool_args = _json.loads(tc.function.arguments)
                except Exception:
                    tool_args = {}

                tool_intent = tool_call_to_intent(tool_name, tool_args)
                tool_result = agent.actions.execute_action(tool_intent)

                steps.append(AgentStep(step=i + 1, tool_name=tool_name, tool_args=tool_args, tool_result=tool_result))
                messages.append({
                    "role": "assistant", "content": None,
                    "tool_calls": [{"id": call_id, "type": "function", "function": {"name": tool_name, "arguments": tc.function.arguments or "{}"}}],
                })
                messages.append({"role": "tool", "tool_call_id": call_id, "content": tool_result})
                continue

            final = choice.message.content or ""
            agent.llm._record("user", task.goal)
            agent.llm._record("assistant", final)
            return AgentResult(final_answer=final, steps=steps)

        # Hit step limit
        messages.append({"role": "user", "content": "Summarise what you have found so far."})
        try:
            resp = agent.llm.client.chat.completions.create(
                model=agent.llm.model, messages=messages,
                temperature=agent.llm.temperature, max_tokens=agent.llm.max_tokens,
            )
            final = resp.choices[0].message.content or "Step limit reached."
        except Exception:
            final = "Step limit reached before finishing."
        return AgentResult(final_answer=final, steps=steps, stopped_early=True)
