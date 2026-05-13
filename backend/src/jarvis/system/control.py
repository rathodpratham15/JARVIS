"""OS-level action controller with explicit approval flow.

Replaces the legacy 3,064 lines across 5 system files with ~330 lines.
Only `system_controller.py` was wired in legacy; the other four
(`security_guard.py`, `self_repair.py`, `task_agent.py`,
`health_monitor.py`) were imported nowhere or stubbed and are dropped.

Design:
- Every requested action becomes a `SystemAction` and goes onto a
  pending dict.
- The frontend polls `get_pending()`, then calls `confirm()` with
  approve/deny.
- Approved actions execute on a background thread; results land in
  `history` and are persisted to `logs/system_actions.jsonl`.

Safety hardening over legacy:
- No more `subprocess.Popen(shell=True, args=user_input)` (legacy line
  432 was a shell-injection bug).
- File ops are whitelisted to the user's home tree by default; system
  paths (/, /etc, /System, C:\\Windows, etc.) are rejected.
- Args containing shell metacharacters are rejected outright.
"""

from __future__ import annotations

import json
import logging
import os
import platform
import queue
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psutil

logger = logging.getLogger(__name__)

_SHELL_METACHARS = set("|;&$`<>(){}[]\\\"'\n\r")

_BLOCKED_PREFIXES = (
    "/",
    "/etc",
    "/usr",
    "/System",
    "/Library/System",
    "/private",
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\System",
)

_FILE_OPS = {"copy", "move", "delete", "rename"}


@dataclass
class SystemAction:
    action_id: str
    action_type: str
    target: str
    parameters: dict[str, Any]
    timestamp: str
    user_id: str = "default"
    session_id: str = "default"
    status: str = "pending"  # pending → executing → completed/failed/cancelled
    result: Optional[dict] = None
    error: Optional[str] = None
    backup_path: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class ActionController:
    """Holds pending/historical actions and runs approved ones."""

    def __init__(
        self,
        log_path: str | Path = "logs/system_actions.jsonl",
        history_limit: int = 1000,
        allowed_roots: Optional[list[str]] = None,
    ) -> None:
        self.log_path = Path(log_path)
        self.history_limit = history_limit
        self.allowed_roots = [
            str(Path(p).resolve()) for p in (allowed_roots or [str(Path.home())])
        ]
        self.pending: dict[str, SystemAction] = {}
        self.history: list[SystemAction] = []
        self._queue: queue.Queue[tuple[str, bool]] = queue.Queue()
        self._lock = threading.RLock()
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._load_history_from_disk()
        threading.Thread(target=self._confirmation_loop, daemon=True).start()

    # ── public API ──────────────────────────────────────────────────────

    def open_application(
        self, name: str, args: Optional[list[str]] = None, user_id: str = "default"
    ) -> str:
        for arg in args or []:
            self._reject_unsafe_arg(arg)
        action = SystemAction(
            action_id=_new_id("app"),
            action_type="open_application",
            target=name,
            parameters={"name": name, "args": list(args or [])},
            timestamp=_now_iso(),
            user_id=user_id,
        )
        return self._enqueue_for_confirmation(action)

    def control_files(
        self,
        op: str,
        path: str,
        target_path: Optional[str] = None,
        user_id: str = "default",
    ) -> str:
        if op not in _FILE_OPS:
            raise ValueError(f"Unsupported file op: {op!r}")
        self._reject_blocked_path(path)
        if target_path is not None:
            self._reject_blocked_path(target_path)
        action = SystemAction(
            action_id=_new_id("file"),
            action_type="control_files",
            target=path,
            parameters={"op": op, "path": path, "target_path": target_path},
            timestamp=_now_iso(),
            user_id=user_id,
        )
        return self._enqueue_for_confirmation(action)

    def send_message(
        self,
        platform_name: str,
        to: str,
        message: str,
        user_id: str = "default",
    ) -> str:
        action = SystemAction(
            action_id=_new_id("msg"),
            action_type="send_message",
            target=to,
            parameters={"platform": platform_name, "to": to, "message": message},
            timestamp=_now_iso(),
            user_id=user_id,
        )
        return self._enqueue_for_confirmation(action)

    def confirm(self, action_id: str, approved: bool) -> bool:
        with self._lock:
            if action_id not in self.pending:
                return False
        self._queue.put((action_id, approved))
        return True

    def get_pending(self) -> list[dict]:
        with self._lock:
            return [asdict(a) for a in self.pending.values()]

    def get_history(self, limit: int = 50, offset: int = 0) -> tuple[list[dict], int]:
        with self._lock:
            ordered = list(reversed(self.history))
            total = len(ordered)
            page = ordered[offset : offset + limit]
            return [asdict(a) for a in page], total

    def delete_history_entry(self, action_id: str) -> bool:
        with self._lock:
            for i, action in enumerate(self.history):
                if action.action_id == action_id:
                    del self.history[i]
                    self._rewrite_log()
                    return True
        return False

    def bulk_delete_history(self, action_ids: list[str]) -> int:
        ids = set(action_ids)
        with self._lock:
            before = len(self.history)
            self.history = [a for a in self.history if a.action_id not in ids]
            removed = before - len(self.history)
            if removed:
                self._rewrite_log()
        return removed

    @staticmethod
    def get_system_info() -> dict:
        uname = platform.uname()
        try:
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            cpu_percent = psutil.cpu_percent(interval=None)
        except Exception:
            mem = disk = None
            cpu_percent = 0.0
        return {
            "system": uname.system,
            "release": uname.release,
            "version": uname.version,
            "machine": uname.machine,
            "processor": uname.processor,
            "python": platform.python_version(),
            "hostname": uname.node,
            "cpu_count": os.cpu_count(),
            "cpu_percent": cpu_percent,
            "memory_total": getattr(mem, "total", None),
            "memory_available": getattr(mem, "available", None),
            "disk_total": getattr(disk, "total", None),
            "disk_free": getattr(disk, "free", None),
        }

    @staticmethod
    def get_available_applications() -> list[str]:
        """Best-effort list of installed apps. macOS-aware; otherwise limited."""
        if platform.system() == "Darwin":
            apps_dir = Path("/Applications")
            if apps_dir.exists():
                return sorted(p.stem for p in apps_dir.glob("*.app"))
        return []

    # ── internals ───────────────────────────────────────────────────────

    def _enqueue_for_confirmation(self, action: SystemAction) -> str:
        with self._lock:
            self.pending[action.action_id] = action
        self._append_log(action)
        return action.action_id

    def _confirmation_loop(self) -> None:
        while True:
            try:
                action_id, approved = self._queue.get(timeout=1)
            except queue.Empty:
                continue
            with self._lock:
                action = self.pending.pop(action_id, None)
            if action is None:
                continue
            if approved:
                self._execute(action)
            else:
                action.status = "cancelled"
            self._record(action)

    def _execute(self, action: SystemAction) -> None:
        action.status = "executing"
        try:
            if action.action_type == "open_application":
                action.result = self._exec_open(action)
            elif action.action_type == "control_files":
                action.result = self._exec_file(action)
            elif action.action_type == "send_message":
                action.result = self._exec_message(action)
            else:
                raise ValueError(f"Unknown action type: {action.action_type}")
            action.status = "completed"
        except Exception as exc:
            logger.exception("Action %s failed", action.action_id)
            action.status = "failed"
            action.error = str(exc)

    @staticmethod
    def _exec_open(action: SystemAction) -> dict:
        name = action.parameters["name"]
        args = list(action.parameters.get("args", []))
        system = platform.system()
        if system == "Darwin":
            cmd = ["open", "-a", name, *(["--args", *args] if args else [])]
        elif system == "Windows":
            cmd = ["cmd", "/c", "start", "", name, *args]  # no shell=True
        else:
            from shutil import which

            executable = which(name)
            if not executable:
                raise FileNotFoundError(f"{name!r} not on PATH")
            cmd = [executable, *args]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return {"launched": name, "return_code": result.returncode}

    def _exec_file(self, action: SystemAction) -> dict:
        op = action.parameters["op"]
        path = Path(action.parameters["path"])
        target = action.parameters.get("target_path")
        target_path = Path(target) if target else None

        self._assert_within_allowed(path)
        if target_path:
            self._assert_within_allowed(target_path)

        if op == "copy":
            shutil.copy2(path, target_path)
            return {"copied": str(path), "to": str(target_path)}
        if op == "move":
            shutil.move(str(path), str(target_path))
            return {"moved": str(path), "to": str(target_path)}
        if op == "rename":
            path.rename(target_path)
            return {"renamed": str(path), "to": str(target_path)}
        if op == "delete":
            backup = self._backup_to(path, self.log_path.parent / "backups")
            action.backup_path = str(backup) if backup else None
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            return {"deleted": str(path), "backup": action.backup_path}
        raise ValueError(f"Unsupported op: {op}")

    @staticmethod
    def _exec_message(action: SystemAction) -> dict:
        # WhatsApp/Slack integration was a stub in legacy. Honest no-op for v2.
        return {
            "platform": action.parameters["platform"],
            "to": action.parameters["to"],
            "delivered": False,
            "note": "Messaging integration is not configured.",
        }

    @staticmethod
    def _backup_to(path: Path, backup_dir: Path) -> Optional[Path]:
        if not path.exists() or path.is_dir():
            return None
        backup_dir.mkdir(parents=True, exist_ok=True)
        dest = backup_dir / f"{int(time.time())}_{path.name}"
        try:
            shutil.copy2(path, dest)
            return dest
        except Exception as exc:
            logger.warning("Backup failed for %s: %s", path, exc)
            return None

    @staticmethod
    def _reject_unsafe_arg(arg: str) -> None:
        if any(c in _SHELL_METACHARS for c in arg):
            raise ValueError(f"Argument contains unsafe characters: {arg!r}")

    def _reject_blocked_path(self, path: str) -> None:
        resolved = Path(path).resolve()
        for prefix in _BLOCKED_PREFIXES:
            if str(resolved).startswith(prefix) and not any(
                str(resolved).startswith(root) for root in self.allowed_roots
            ):
                raise PermissionError(f"Path is in a blocked system location: {path}")

    def _assert_within_allowed(self, path: Path) -> None:
        resolved = path.resolve()
        if not any(str(resolved).startswith(root) for root in self.allowed_roots):
            raise PermissionError(
                f"Path {path} is outside the allowed roots {self.allowed_roots}"
            )

    def _record(self, action: SystemAction) -> None:
        with self._lock:
            self.history.append(action)
            if len(self.history) > self.history_limit:
                self.history = self.history[-self.history_limit :]
            self._append_log(action)

    def _append_log(self, action: SystemAction) -> None:
        with self.log_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(asdict(action), default=str) + "\n")

    def _rewrite_log(self) -> None:
        with self.log_path.open("w", encoding="utf-8") as fh:
            for action in self.history:
                fh.write(json.dumps(asdict(action), default=str) + "\n")

    def _load_history_from_disk(self) -> None:
        if not self.log_path.exists():
            return
        try:
            with self.log_path.open("r", encoding="utf-8") as fh:
                rows = [json.loads(line) for line in fh if line.strip()]
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read action log: %s", exc)
            return
        # Only keep terminal-state rows in history (not pending residue).
        terminal = {"completed", "failed", "cancelled"}
        for row in rows:
            if row.get("status") in terminal:
                self.history.append(SystemAction(**row))
        if len(self.history) > self.history_limit:
            self.history = self.history[-self.history_limit :]
