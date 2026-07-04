"""User-facing settings: a flat key/value store in JSON."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

_DEFAULTS: dict[str, Any] = {
    "theme": "dark",
    "voice_enabled": False,
    "auto_speak_responses": False,
    "default_language": "en",
    "ha_url": "",
    "ha_token": "",
}


class SettingsStore:
    def __init__(self, path: str | Path = "data/settings.json") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        if not self.path.exists():
            self._write(_DEFAULTS)

    def _write(self, data: dict) -> None:
        with self.path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)

    def get_all(self) -> dict:
        with self._lock:
            try:
                return json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, FileNotFoundError):
                return dict(_DEFAULTS)

    def get(self, key: str, default=None):
        return self.get_all().get(key, default)

    def update(self, **values) -> dict:
        with self._lock:
            current = self.get_all()
            current.update(values)
            self._write(current)
            return current
