"""JARVIS capability permissions.

Persists to data/settings.json under the "permissions" key.
Provides is_granted() checks used by ActionEngine and exposed via API.
"""
from __future__ import annotations

import json
import threading
from enum import Enum
from pathlib import Path


class Permission(str, Enum):
    SYSTEM_CONTROL = "system_control"   # app control, volume, brightness, notifications
    FILE_ACCESS    = "file_access"      # notes, memory, documents
    WEB_ACCESS     = "web_access"       # web search, research, URL fetching
    CAMERA_VISION  = "camera_vision"    # webcam, face recognition, scene analysis
    SCHEDULER      = "scheduler"        # create/manage autonomous scheduled tasks
    COMPUTER_USE   = "computer_use"     # mouse/keyboard automation, screen capture
    REMINDERS      = "reminders"        # reminders and calendar events


_DEFAULTS: dict[Permission, bool] = {
    Permission.SYSTEM_CONTROL: True,
    Permission.FILE_ACCESS:    True,
    Permission.WEB_ACCESS:     True,
    Permission.CAMERA_VISION:  False,
    Permission.SCHEDULER:      True,
    Permission.COMPUTER_USE:   False,
    Permission.REMINDERS:      True,
}

PERMISSION_META: dict[Permission, dict] = {
    Permission.SYSTEM_CONTROL: {
        "label": "System Control",
        "desc":  "Control apps, volume, brightness, media playback, and system notifications.",
        "risk":  "medium",
    },
    Permission.FILE_ACCESS: {
        "label": "File & Data Access",
        "desc":  "Read and write notes, memory, and documents on your device.",
        "risk":  "low",
    },
    Permission.WEB_ACCESS: {
        "label": "Web & Research",
        "desc":  "Search the web, fetch URLs, and perform research tasks.",
        "risk":  "low",
    },
    Permission.CAMERA_VISION: {
        "label": "Camera & Vision",
        "desc":  "Access webcam for face recognition, emotion analysis, and scene description.",
        "risk":  "high",
    },
    Permission.SCHEDULER: {
        "label": "Autonomous Scheduler",
        "desc":  "Create and manage recurring background tasks that run without interaction.",
        "risk":  "medium",
    },
    Permission.COMPUTER_USE: {
        "label": "Computer Use",
        "desc":  "Control mouse, keyboard, and automate screen interactions.",
        "risk":  "high",
    },
    Permission.REMINDERS: {
        "label": "Reminders & Calendar",
        "desc":  "Set, read, and delete reminders and calendar events.",
        "risk":  "low",
    },
}


class PermissionsManager:
    """Thread-safe permission registry backed by data/settings.json."""

    def __init__(self, settings_path: str = "data/settings.json") -> None:
        self._path = Path(settings_path)
        self._lock = threading.RLock()
        self._perms: dict[Permission, bool] = {}
        self._load()

    # ── public API ──────────────────────────────────────────────────────

    def is_granted(self, perm: Permission) -> bool:
        with self._lock:
            return bool(self._perms.get(perm, False))

    def set(self, perm: Permission, granted: bool) -> None:
        with self._lock:
            self._perms[perm] = granted
        self._save()

    def grant_all(self) -> None:
        with self._lock:
            self._perms = {p: True for p in Permission}
        self._save()

    def revoke_all(self) -> None:
        with self._lock:
            self._perms = {p: False for p in Permission}
        self._save()

    def to_dict(self) -> dict:
        with self._lock:
            return {p.value: v for p, v in self._perms.items()}

    def to_api(self) -> list[dict]:
        """Full metadata list for the frontend."""
        with self._lock:
            return [
                {
                    "id":      p.value,
                    "label":   PERMISSION_META[p]["label"],
                    "desc":    PERMISSION_META[p]["desc"],
                    "risk":    PERMISSION_META[p]["risk"],
                    "granted": self._perms.get(p, False),
                }
                for p in Permission
            ]

    def capability_summary(self) -> str:
        """Compact summary injected into the agent system prompt."""
        granted = [PERMISSION_META[p]["label"] for p in Permission if self.is_granted(p)]
        denied  = [PERMISSION_META[p]["label"] for p in Permission if not self.is_granted(p)]
        lines = ["## Your active capabilities"]
        if granted:
            lines.append("Granted: " + ", ".join(granted))
        if denied:
            lines.append("Denied (do not attempt): " + ", ".join(denied))
        return "\n".join(lines)

    # ── internal ────────────────────────────────────────────────────────

    def _load(self) -> None:
        with self._lock:
            try:
                raw = json.loads(self._path.read_text()) if self._path.exists() else {}
                stored = raw.get("permissions", {})
                self._perms = {
                    p: stored.get(p.value, default)
                    for p, default in _DEFAULTS.items()
                }
            except Exception:
                self._perms = dict(_DEFAULTS)

    def _save(self) -> None:
        with self._lock:
            try:
                raw: dict = {}
                if self._path.exists():
                    raw = json.loads(self._path.read_text())
                raw["permissions"] = {p.value: v for p, v in self._perms.items()}
                self._path.parent.mkdir(parents=True, exist_ok=True)
                self._path.write_text(json.dumps(raw, indent=2))
            except Exception:
                pass
