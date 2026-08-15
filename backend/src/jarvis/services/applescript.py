"""AppleScript / osascript helpers for macOS app control.

Use `run_script()` for arbitrary scripts. The pre-built helpers cover the
most common use cases (media control, volume, app activation/quit).
"""

from __future__ import annotations

import logging
import platform
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

_IS_MACOS = platform.system() == "Darwin"


def run_script(script: str, timeout: int = 10) -> dict:
    """Execute an AppleScript snippet via osascript.

    Returns a dict with keys:
      ok (bool), output (str), error (str)
    """
    if not _IS_MACOS:
        return {"ok": False, "output": "", "error": "AppleScript is only available on macOS."}

    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout.strip()
        error = result.stderr.strip()
        ok = result.returncode == 0
        if not ok:
            logger.warning("osascript error (rc=%d): %s", result.returncode, error)
        return {"ok": ok, "output": output, "error": error}
    except subprocess.TimeoutExpired:
        logger.error("osascript timed out after %ds", timeout)
        return {"ok": False, "output": "", "error": f"Script timed out after {timeout}s."}
    except Exception as exc:
        logger.exception("osascript failed: %s", exc)
        return {"ok": False, "output": "", "error": str(exc)}


# ── Media control ─────────────────────────────────────────────────────────────

def _media_script(app: str, command: str) -> str:
    """Build a tell-block for a music/media app."""
    return f'tell application "{app}" to {command}'


def media_play_pause(app: str = "Spotify") -> dict:
    return run_script(_media_script(app, "playpause"))


def media_next(app: str = "Spotify") -> dict:
    return run_script(_media_script(app, "next track"))


def media_previous(app: str = "Spotify") -> dict:
    return run_script(_media_script(app, "previous track"))


def media_play(app: str = "Spotify") -> dict:
    return run_script(_media_script(app, "play"))


def media_pause(app: str = "Spotify") -> dict:
    return run_script(_media_script(app, "pause"))


def media_set_volume(volume: int, app: str = "Spotify") -> dict:
    """Set the in-app volume (0–100). Works for Spotify and Music."""
    vol = max(0, min(100, int(volume)))
    return run_script(_media_script(app, f"set sound volume to {vol}"))


def media_get_track(app: str = "Spotify") -> dict:
    """Return the current track name and artist."""
    script = (
        f'tell application "{app}"\n'
        f'  set t to name of current track\n'
        f'  set a to artist of current track\n'
        f'  return t & " by " & a\n'
        f'end tell'
    )
    return run_script(script)


# ── System volume ─────────────────────────────────────────────────────────────

def system_set_volume(volume: int) -> dict:
    """Set macOS system output volume (0–100)."""
    vol = max(0, min(100, int(volume)))
    return run_script(f"set volume output volume {vol}")


def system_get_volume() -> dict:
    return run_script("output volume of (get volume settings)")


def system_mute(mute: bool = True) -> dict:
    val = "true" if mute else "false"
    return run_script(f"set volume output muted {val}")


# ── App control ───────────────────────────────────────────────────────────────

def app_activate(app_name: str) -> dict:
    return run_script(f'tell application "{app_name}" to activate')


def app_quit(app_name: str) -> dict:
    return run_script(f'tell application "{app_name}" to quit')


def app_is_running(app_name: str) -> dict:
    script = f'application "{app_name}" is running'
    return run_script(script)


def get_frontmost_app() -> dict:
    script = 'tell application "System Events" to name of first application process whose frontmost is true'
    return run_script(script)


# ── Notifications ─────────────────────────────────────────────────────────────

def show_notification(title: str, message: str, subtitle: str = "") -> dict:
    sub = f' subtitle "{subtitle}"' if subtitle else ""
    script = f'display notification "{message}" with title "{title}"{sub}'
    return run_script(script)


# ── Dispatch helper ───────────────────────────────────────────────────────────

def handle_control_app(intent: dict) -> str:
    """Dispatch a control_app intent to the right helper. Returns a spoken reply."""
    action = (intent.get("app_action") or "").strip().lower()
    app = (intent.get("app") or "Spotify").strip()
    volume = intent.get("volume")
    script = (intent.get("script") or "").strip()

    if action == "run_script":
        if not script:
            return "Please provide an AppleScript to run."
        result = run_script(script)
        if result["ok"]:
            return result["output"] or "Script ran successfully."
        return f"Script failed: {result['error']}"

    if action == "play":
        result = media_play(app)
    elif action == "pause":
        result = media_pause(app)
    elif action == "play_pause":
        result = media_play_pause(app)
    elif action in ("next", "next_track"):
        result = media_next(app)
    elif action in ("previous", "prev_track", "previous_track"):
        result = media_previous(app)
    elif action == "set_volume" and volume is not None:
        result = media_set_volume(int(volume), app)
    elif action == "system_volume" and volume is not None:
        result = system_set_volume(int(volume))
    elif action == "mute":
        result = system_mute(True)
    elif action == "unmute":
        result = system_mute(False)
    elif action == "activate":
        result = app_activate(app)
    elif action == "quit":
        result = app_quit(app)
    elif action == "get_track":
        result = media_get_track(app)
        if result["ok"]:
            return f"Now playing: {result['output']}."
        return f"Couldn't get track from {app}: {result['error']}"
    elif action == "frontmost":
        result = get_frontmost_app()
        if result["ok"]:
            return f"The frontmost app is {result['output']}."
        return f"Couldn't determine frontmost app: {result['error']}"
    elif action == "notify":
        title = intent.get("title", "JARVIS")
        message = intent.get("message", "")
        result = show_notification(title, message)
    else:
        return f"Unknown app action '{action}'. Try: play, pause, next, previous, set_volume, activate, quit, mute, unmute, get_track, notify."

    if result["ok"]:
        labels = {
            "play": f"Playing {app}.",
            "pause": f"Paused {app}.",
            "play_pause": f"Toggled play/pause on {app}.",
            "next": f"Skipped to next track on {app}.",
            "next_track": f"Skipped to next track on {app}.",
            "previous": f"Went back to previous track on {app}.",
            "prev_track": f"Went back to previous track on {app}.",
            "previous_track": f"Went back to previous track on {app}.",
            "set_volume": f"Set {app} volume to {volume}.",
            "system_volume": f"System volume set to {volume}.",
            "mute": "System muted.",
            "unmute": "System unmuted.",
            "activate": f"Switched to {app}.",
            "quit": f"Quit {app}.",
            "notify": "Notification sent.",
        }
        return labels.get(action, result["output"] or "Done.")
    return f"Couldn't {action} {app}: {result['error'] or 'unknown error'}."
