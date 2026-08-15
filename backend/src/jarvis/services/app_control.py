"""Platform-aware app control dispatcher.

Routes control_app intents to the right OS-specific backend:
  macOS   → applescript.py   (osascript)
  Windows → powershell.py    (PowerShell + Win32 APIs)
  Linux   → dbus_control.py  (D-Bus MPRIS2, pactl/wpctl, notify-send)
  Other   → friendly error
"""

from __future__ import annotations

import platform

_SYSTEM = platform.system()


def handle_control_app(intent: dict) -> str:
    if _SYSTEM == "Darwin":
        from jarvis.services.applescript import handle_control_app as _handle
    elif _SYSTEM == "Windows":
        from jarvis.services.powershell import handle_control_app as _handle
    elif _SYSTEM == "Linux":
        from jarvis.services.dbus_control import handle_control_app as _handle
    else:
        action = intent.get("app_action", "")
        app = intent.get("app", "")
        return (
            f"App control ('{action}' on '{app}') is not supported on {_SYSTEM}. "
            "Supported platforms: macOS, Windows, Linux."
        )
    return _handle(intent)
