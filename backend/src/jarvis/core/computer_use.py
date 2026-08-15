"""Computer Use agent — sees the screen and controls the desktop.

The agent loop:
  1. Take a screenshot
  2. Send screenshot + goal + action history to a vision LLM
  3. LLM returns the next action as JSON
  4. Execute the action via os_control.perform_action
  5. Wait briefly for the UI to settle
  6. Repeat until the LLM says "done" or max_steps is reached

Vision model: Groq llama-3.2-11b-vision-preview (works with existing GROQ_API_KEY).
Falls back to any configured vision-capable provider.

Usage::

    agent = ComputerUseAgent(llm_client, vision_model="llama-3.2-11b-vision-preview")
    task_id = manager.submit("Switch YouTube Music to Playlist 2")
    # poll manager.get(task_id) for status + steps
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are JARVIS, an AI assistant that controls a computer screen on behalf of the user.

You will see a screenshot of the current screen and a task to complete. Analyse the screenshot carefully, then respond with EXACTLY ONE action in JSON — nothing else before or after the JSON.

Available actions:
  {"action": "click",  "x": <int>, "y": <int>, "reason": "<why>"}
  {"action": "double_click", "x": <int>, "y": <int>, "reason": "<why>"}
  {"action": "type",   "text": "<text to type>", "reason": "<why>"}
  {"action": "key",    "key": "<key name e.g. enter/escape/tab>", "reason": "<why>"}
  {"action": "hotkey", "keys": ["<key1>", "<key2>"], "reason": "<why>"}
  {"action": "scroll", "x": <int>, "y": <int>, "direction": "up|down", "clicks": <int>, "reason": "<why>"}
  {"action": "screenshot", "reason": "need to see current state"}
  {"action": "done",   "result": "<what was accomplished>"}
  {"action": "fail",   "reason": "<why the task cannot be completed>"}

Rules:
- Respond with only the JSON object, no markdown, no explanation.
- Be precise with x/y coordinates — examine the screenshot carefully.
- Prefer small, targeted actions over large jumps.
- If the task is already complete, immediately respond with done.
- If you cannot find what you need after looking carefully, respond with fail."""


@dataclass
class ComputerUseStep:
    step: int
    screenshot_b64: str
    action: dict
    result: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "screenshot": self.screenshot_b64,
            "action": self.action,
            "result": self.result,
            "timestamp": self.timestamp,
        }


@dataclass
class ComputerUseTask:
    id: str
    goal: str
    status: str  # pending | running | done | failed
    created_at: str
    steps: list[ComputerUseStep] = field(default_factory=list)
    final_result: Optional[str] = None
    error: Optional[str] = None
    finished_at: Optional[str] = None
    _cancel: threading.Event = field(default_factory=threading.Event, repr=False)

    def to_dict(self, include_screenshots: bool = True) -> dict:
        steps = []
        for s in self.steps:
            d = s.to_dict()
            if not include_screenshots:
                d.pop("screenshot", None)
            steps.append(d)
        return {
            "id": self.id,
            "goal": self.goal,
            "status": self.status,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "steps": steps,
            "final_result": self.final_result,
            "error": self.error,
        }


def _parse_action(text: str) -> Optional[dict]:
    """Extract JSON action from LLM response — handles markdown fences."""
    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Find outermost JSON object by tracking brace depth
    start = text.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break
    return None


class ComputerUseManager:
    """Thread-safe registry + executor for computer use tasks."""

    def __init__(self, llm_client, vision_model: str = "llama-3.2-11b-vision-preview", max_steps: int = 20):
        self._client = llm_client
        self._vision_model = vision_model
        self._max_steps = max_steps
        self._tasks: dict[str, ComputerUseTask] = {}
        self._lock = threading.RLock()

    def submit(self, goal: str) -> str:
        task_id = str(uuid.uuid4())
        task = ComputerUseTask(
            id=task_id,
            goal=goal,
            status="pending",
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        with self._lock:
            self._tasks[task_id] = task

        thread = threading.Thread(
            target=self._run,
            args=(task,),
            daemon=True,
            name=f"cu-{task_id[:8]}",
        )
        thread.start()
        logger.info("ComputerUse task %s submitted: %r", task_id, goal[:60])
        return task_id

    def get(self, task_id: str) -> Optional[ComputerUseTask]:
        with self._lock:
            return self._tasks.get(task_id)

    def list_all(self) -> list[dict]:
        with self._lock:
            return [t.to_dict(include_screenshots=False)
                    for t in sorted(self._tasks.values(), key=lambda t: t.created_at, reverse=True)]

    def cancel(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
        if task:
            task._cancel.set()
            return True
        return False

    def _run(self, task: ComputerUseTask) -> None:
        from jarvis.services.os_control import screenshot_b64, perform_action

        with self._lock:
            task.status = "running"

        history: list[str] = []

        try:
            for step_num in range(1, self._max_steps + 1):
                if task._cancel.is_set():
                    with self._lock:
                        task.status = "failed"
                        task.error = "Cancelled by user."
                        task.finished_at = datetime.now(timezone.utc).isoformat()
                    return

                # 1. Capture screen
                shot = screenshot_b64()
                if "error" in shot:
                    raise RuntimeError(f"Screenshot failed: {shot['error']}")

                b64 = shot["image"]
                w, h = shot["width"], shot["height"]

                # 2. Build history summary (last 5 actions)
                history_text = "\n".join(history[-5:]) if history else "None yet."

                # 3. Call vision LLM
                action_dict = self._ask_vision(task.goal, b64, w, h, history_text, step_num)

                if action_dict is None:
                    raise RuntimeError("Vision LLM returned no parseable action. Check backend logs for the raw response.")

                action_type = action_dict.get("action", "")
                reason = action_dict.get("reason", action_dict.get("result", ""))

                # 4. Handle terminal actions
                if action_type == "done":
                    result_text = action_dict.get("result", "Task completed.")
                    step = ComputerUseStep(step=step_num, screenshot_b64=b64, action=action_dict, result=result_text)
                    with self._lock:
                        task.steps.append(step)
                        task.status = "done"
                        task.final_result = result_text
                        task.finished_at = datetime.now(timezone.utc).isoformat()
                    logger.info("ComputerUse task %s done in %d steps", task.id, step_num)
                    return

                if action_type == "fail":
                    raise RuntimeError(action_dict.get("reason", "Task failed."))

                # 5. Execute action
                result = self._execute(action_dict, perform_action)
                history.append(f"Step {step_num}: {action_type} → {result}")
                logger.debug("CU step %d: %s → %s", step_num, action_type, result)

                step = ComputerUseStep(step=step_num, screenshot_b64=b64, action=action_dict, result=result)
                with self._lock:
                    task.steps.append(step)

                # 6. Small pause for UI to settle
                time.sleep(0.8)

            # Hit step limit
            with self._lock:
                task.status = "failed"
                task.error = f"Reached step limit ({self._max_steps}) without completing the task."
                task.finished_at = datetime.now(timezone.utc).isoformat()

        except Exception as exc:
            logger.exception("ComputerUse task %s failed: %s", task.id, exc)
            with self._lock:
                task.status = "failed"
                task.error = str(exc)
                task.finished_at = datetime.now(timezone.utc).isoformat()

    def _ask_vision(self, goal: str, b64: str, w: int, h: int,
                    history: str, step: int) -> Optional[dict]:
        if not self._client:
            return {"action": "fail", "reason": "No LLM client available."}

        user_text = (
            f"Goal: {goal}\n\n"
            f"Screen resolution: {w}×{h}\n"
            f"Step: {step}\n"
            f"Actions taken so far:\n{history}\n\n"
            "What is the next action?"
        )

        for attempt in range(3):
            try:
                response = self._client.chat.completions.create(
                    model=self._vision_model,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": [
                            {"type": "text", "text": user_text},
                            {"type": "image_url", "image_url": {
                                "url": f"data:image/png;base64,{b64}"
                            }},
                        ]},
                    ],
                    max_tokens=1024,
                    temperature=0.1,
                )
                raw = response.choices[0].message.content or ""
                parsed = _parse_action(raw)
                if parsed is None:
                    logger.warning("Vision LLM response unparseable (step %d): %s", step, raw[:300])
                return parsed
            except Exception as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                if status == 503 and attempt < 2:
                    logger.warning("Vision LLM 503, retrying in %ds (attempt %d/3)", 3 * (attempt + 1), attempt + 1)
                    time.sleep(3 * (attempt + 1))
                    continue
                logger.error("Vision LLM call failed: %s", exc)
                return None
        return None

    @staticmethod
    def _execute(action: dict, perform_action) -> str:
        a = action.get("action", "")
        if a == "click":
            return perform_action("click", x=action.get("x", 0), y=action.get("y", 0),
                                  button=action.get("button", "left"))
        if a == "double_click":
            return perform_action("double_click", x=action.get("x", 0), y=action.get("y", 0))
        if a == "type":
            return perform_action("type", text=action.get("text", ""))
        if a == "key":
            return perform_action("press", key=action.get("key", ""))
        if a == "hotkey":
            return perform_action("hotkey", keys=action.get("keys", []))
        if a == "scroll":
            direction = action.get("direction", "down")
            clicks = int(action.get("clicks", 3))
            if direction == "up":
                clicks = abs(clicks)
            else:
                clicks = -abs(clicks)
            return perform_action("scroll", x=action.get("x", 0), y=action.get("y", 0), clicks=clicks)
        if a == "screenshot":
            return "Screenshot taken."
        return f"Unknown action: {a}"
