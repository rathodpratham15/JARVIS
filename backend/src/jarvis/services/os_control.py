"""OS-level desktop automation via pyautogui.

Provides mouse, keyboard, and screenshot control. All operations are
no-ops when pyautogui is not installed, returning a descriptive string
instead of raising.

pyautogui on macOS requires Accessibility permissions for mouse/keyboard
control (System Settings → Privacy & Security → Accessibility). Screenshots
work without that permission.

Usage::

    from jarvis.services.os_control import screenshot_b64, perform_action
    img = screenshot_b64()              # {"image": "<base64>", "width": 1440, "height": 900}
    perform_action("click", x=100, y=200)
    perform_action("type", text="hello world")
    perform_action("hotkey", keys=["command", "c"])
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    import pyautogui

    pyautogui.FAILSAFE = False  # don't abort when mouse hits top-left corner
    _AVAILABLE = True
except ImportError:
    pyautogui = None  # type: ignore[assignment]
    _AVAILABLE = False
    logger.warning("pyautogui not installed — OS control features will be unavailable")


def available() -> bool:
    return _AVAILABLE


def screenshot_b64() -> dict:
    """Capture the full screen and return it as a base64-encoded PNG dict."""
    if not _AVAILABLE:
        return {"error": "pyautogui not installed. Run: pip install pyautogui pillow"}

    try:
        img = pyautogui.screenshot()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode()
        width, height = img.size
        return {"image": encoded, "width": width, "height": height}
    except Exception as exc:
        logger.exception("Screenshot failed")
        return {"error": str(exc)}


def get_screen_size() -> dict:
    if not _AVAILABLE:
        return {"error": "pyautogui not installed"}
    try:
        w, h = pyautogui.size()
        return {"width": w, "height": h}
    except Exception as exc:
        return {"error": str(exc)}


# ── action dispatcher ──────────────────────────────────────────────────────

_ALLOWED_KEYS = {
    "enter", "return", "escape", "esc", "tab", "space", "backspace", "delete",
    "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
    "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
    "command", "ctrl", "control", "alt", "option", "shift", "win",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
}


def _validate_keys(keys: list[str]) -> list[str] | None:
    """Return lowercased keys if all valid, else None."""
    lowered = [k.lower() for k in keys]
    invalid = [k for k in lowered if k not in _ALLOWED_KEYS]
    if invalid:
        return None
    return lowered


def perform_action(action: str, **kwargs: Any) -> str:
    """Execute a desktop action. Returns a human-readable result string.

    Supported actions:
        click       — left/right/middle click at (x, y)
        double_click — double-click at (x, y)
        move        — move mouse to (x, y)
        scroll      — scroll at (x, y) by `clicks` ticks
        type        — type `text` with natural key intervals
        press       — press a single named `key`
        hotkey      — press a chord of `keys` (list of key names)
        screenshot  — capture screen (returns dict via screenshot_b64)
    """
    if not _AVAILABLE:
        return "OS control unavailable: install pyautogui and pillow, then restart."

    try:
        if action == "click":
            x, y = int(kwargs.get("x", 0)), int(kwargs.get("y", 0))
            button = kwargs.get("button", "left")
            if button not in ("left", "right", "middle"):
                return f"Unknown button '{button}'. Use left, right, or middle."
            pyautogui.click(x, y, button=button)
            return f"Clicked {button} at ({x}, {y})."

        if action == "double_click":
            x, y = int(kwargs.get("x", 0)), int(kwargs.get("y", 0))
            pyautogui.doubleClick(x, y)
            return f"Double-clicked at ({x}, {y})."

        if action == "move":
            x, y = int(kwargs.get("x", 0)), int(kwargs.get("y", 0))
            pyautogui.moveTo(x, y, duration=0.15)
            return f"Mouse moved to ({x}, {y})."

        if action == "scroll":
            x, y = int(kwargs.get("x", 0)), int(kwargs.get("y", 0))
            clicks = int(kwargs.get("clicks", 3))
            pyautogui.scroll(clicks, x=x, y=y)
            direction = "up" if clicks > 0 else "down"
            return f"Scrolled {direction} {abs(clicks)} ticks at ({x}, {y})."

        if action == "type":
            text = str(kwargs.get("text", ""))
            if not text:
                return "No text provided."
            pyautogui.write(text, interval=0.04)
            return f"Typed: {text!r}"

        if action == "press":
            key = str(kwargs.get("key", "")).lower()
            if key not in _ALLOWED_KEYS:
                return f"Unknown key '{key}'."
            pyautogui.press(key)
            return f"Pressed key: {key}."

        if action == "hotkey":
            raw_keys = kwargs.get("keys") or []
            if isinstance(raw_keys, str):
                raw_keys = [k.strip() for k in raw_keys.split("+")]
            keys = _validate_keys(raw_keys)
            if keys is None:
                return f"Invalid keys in hotkey: {raw_keys}."
            pyautogui.hotkey(*keys)
            return f"Hotkey: {'+'.join(keys)}."

        return f"Unknown action '{action}'."

    except Exception as exc:
        logger.exception("OS action %r failed", action)
        return f"Action failed: {exc}"
