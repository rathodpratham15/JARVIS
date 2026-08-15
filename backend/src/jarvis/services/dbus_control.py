"""D-Bus / CLI helpers for Linux app control.

Linux equivalent of applescript.py (macOS) and powershell.py (Windows).

Media: MPRIS2 via dbus-send — works with Spotify, VLC, Rhythmbox,
       Firefox, Chromium, and any other MPRIS2-compliant player.
Volume: pactl (PulseAudio) or wpctl (PipeWire) — auto-detected.
Apps:   xdg-open to launch, wmctrl/xdotool to focus, SIGTERM to quit.
Notifications: notify-send (libnotify).

All tools used (dbus-send, pactl/wpctl, notify-send) ship with most
desktop Linux distributions. xdotool/wmctrl need to be installed
separately but are optional — we fall back gracefully.
"""

from __future__ import annotations

import logging
import platform
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

_IS_LINUX = platform.system() == "Linux"

# ── Core runner ───────────────────────────────────────────────────────────────

def run_command(cmd: list[str], timeout: int = 10) -> dict:
    """Run a shell command. Returns {ok, output, error}."""
    if not _IS_LINUX:
        return {"ok": False, "output": "", "error": "D-Bus control is only available on Linux."}
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout.strip()
        error = result.stderr.strip()
        ok = result.returncode == 0
        if not ok:
            logger.warning("Command %s failed (rc=%d): %s", cmd[0], result.returncode, error)
        return {"ok": ok, "output": output, "error": error}
    except FileNotFoundError:
        return {"ok": False, "output": "", "error": f"Command not found: {cmd[0]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "output": "", "error": f"Command timed out after {timeout}s."}
    except Exception as exc:
        logger.exception("Command failed: %s", exc)
        return {"ok": False, "output": "", "error": str(exc)}


# ── MPRIS2 media control (D-Bus) ──────────────────────────────────────────────

_MPRIS_PREFIX = "org.mpris.MediaPlayer2"
_MPRIS_PATH   = "/org/mpris/MediaPlayer2"
_MPRIS_IFACE  = "org.mpris.MediaPlayer2.Player"


def _find_mpris_player(preferred: str = "spotify") -> Optional[str]:
    """Return the D-Bus name of a running MPRIS2 player.

    Prefers `preferred` (case-insensitive match). Falls back to the first
    active MPRIS2 player found on the session bus.
    """
    result = run_command(
        ["dbus-send", "--session", "--print-reply",
         "--dest=org.freedesktop.DBus",
         "/org/freedesktop/DBus",
         "org.freedesktop.DBus.ListNames"]
    )
    if not result["ok"]:
        return None

    names = [
        line.strip().strip('"')
        for line in result["output"].splitlines()
        if _MPRIS_PREFIX in line
    ]
    if not names:
        return None

    preferred_lower = preferred.lower()
    for name in names:
        if preferred_lower in name.lower():
            return name
    return names[0]


def _mpris_call(method: str, player: str = "spotify") -> dict:
    dest = _find_mpris_player(player)
    if not dest:
        return {"ok": False, "output": "", "error": f"No MPRIS2 player found (looking for '{player}')."}
    return run_command([
        "dbus-send", "--session", "--print-reply",
        f"--dest={dest}",
        _MPRIS_PATH,
        f"{_MPRIS_IFACE}.{method}",
    ])


def media_play_pause(player: str = "spotify") -> dict:
    return _mpris_call("PlayPause", player)

def media_play(player: str = "spotify") -> dict:
    return _mpris_call("Play", player)

def media_pause(player: str = "spotify") -> dict:
    return _mpris_call("Pause", player)

def media_next(player: str = "spotify") -> dict:
    return _mpris_call("Next", player)

def media_previous(player: str = "spotify") -> dict:
    return _mpris_call("Previous", player)

def media_stop(player: str = "spotify") -> dict:
    return _mpris_call("Stop", player)


def media_get_track(player: str = "spotify") -> dict:
    """Return 'Title by Artist' from MPRIS2 Metadata property."""
    dest = _find_mpris_player(player)
    if not dest:
        return {"ok": False, "output": "", "error": f"No MPRIS2 player found for '{player}'."}

    result = run_command([
        "dbus-send", "--session", "--print-reply",
        f"--dest={dest}",
        _MPRIS_PATH,
        "org.freedesktop.DBus.Properties.Get",
        "string:org.mpris.MediaPlayer2.Player",
        "string:Metadata",
    ])
    if not result["ok"]:
        return result

    # Parse title and artist from dbus-send output
    lines = result["output"].splitlines()
    title, artist = "", ""
    for i, line in enumerate(lines):
        if "xesam:title" in line and i + 1 < len(lines):
            title = lines[i + 1].strip().strip('"')
        if "xesam:artist" in line and i + 2 < len(lines):
            artist = lines[i + 2].strip().strip('"')
    if title:
        return {"ok": True, "output": f"{title} by {artist}".strip(" by"), "error": ""}
    return {"ok": True, "output": result["output"], "error": ""}


# ── Volume control (pactl / wpctl) ────────────────────────────────────────────

def _volume_backend() -> str:
    """Return 'wpctl' if PipeWire is running, else 'pactl'."""
    r = run_command(["which", "wpctl"])
    if r["ok"] and r["output"]:
        # Check PipeWire is actually active
        p = run_command(["wpctl", "status"])
        if p["ok"]:
            return "wpctl"
    return "pactl"


def system_set_volume(volume: int) -> dict:
    vol = max(0, min(100, int(volume)))
    backend = _volume_backend()
    if backend == "wpctl":
        return run_command(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{vol}%"])
    return run_command(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{vol}%"])


def system_get_volume() -> dict:
    backend = _volume_backend()
    if backend == "wpctl":
        r = run_command(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
        # output like "Volume: 0.50"
        if r["ok"]:
            try:
                val = float(r["output"].split()[-1])
                r["output"] = str(int(val * 100))
            except (ValueError, IndexError):
                pass
        return r
    # pactl: parse from sink info
    r = run_command(["pactl", "get-sink-volume", "@DEFAULT_SINK@"])
    if r["ok"]:
        import re
        m = re.search(r"(\d+)%", r["output"])
        if m:
            r["output"] = m.group(1)
    return r


def system_mute(mute: bool = True) -> dict:
    val = "1" if mute else "0"
    backend = _volume_backend()
    if backend == "wpctl":
        return run_command(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", val])
    return run_command(["pactl", "set-sink-mute", "@DEFAULT_SINK@", val])


# ── App control ───────────────────────────────────────────────────────────────

def app_launch(app_name: str) -> dict:
    """Launch an app via xdg-open or directly."""
    result = run_command(["which", app_name.lower()])
    if result["ok"] and result["output"]:
        try:
            subprocess.Popen([app_name.lower()], start_new_session=True)
            return {"ok": True, "output": f"Launched {app_name}.", "error": ""}
        except Exception as exc:
            return {"ok": False, "output": "", "error": str(exc)}
    return run_command(["xdg-open", app_name])


def app_quit(app_name: str) -> dict:
    """Terminate a process by name."""
    return run_command(["pkill", "-x", app_name.lower()])


def app_activate(app_name: str) -> dict:
    """Raise an app window to the foreground via wmctrl (if installed)."""
    result = run_command(["wmctrl", "-a", app_name])
    if result["ok"]:
        return result
    # Fall back to xdotool
    r2 = run_command(["xdotool", "search", "--name", app_name, "windowactivate"])
    if r2["ok"]:
        return r2
    return {"ok": False, "output": "",
            "error": "Neither wmctrl nor xdotool found. Install one: apt install wmctrl"}


def get_frontmost_app() -> dict:
    """Return the name of the focused window's process via xdotool."""
    r = run_command(["xdotool", "getactivewindow", "getwindowname"])
    if r["ok"]:
        return r
    # Fallback: read _NET_ACTIVE_WINDOW via xprop
    r2 = run_command(["xprop", "-root", "_NET_ACTIVE_WINDOW"])
    return r2


# ── Notifications ─────────────────────────────────────────────────────────────

def show_notification(title: str, message: str) -> dict:
    return run_command(["notify-send", title, message])


# ── Dispatch helper (mirrors applescript.handle_control_app) ─────────────────

def handle_control_app(intent: dict) -> str:
    action = (intent.get("app_action") or "").strip().lower()
    app = (intent.get("app") or "spotify").strip()
    volume = intent.get("volume")
    script = (intent.get("script") or "").strip()

    if action == "run_script":
        if not script:
            return "Please provide a shell command to run."
        result = run_command(script.split())
        if result["ok"]:
            return result["output"] or "Command ran successfully."
        return f"Command failed: {result['error']}"

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
        result = system_set_volume(int(volume))
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
        return f"Couldn't get track info: {result['error']}"
    elif action == "frontmost":
        result = get_frontmost_app()
        if result["ok"]:
            return f"The focused window is: {result['output']}."
        return f"Couldn't determine focused window: {result['error']}"
    elif action == "notify":
        title = intent.get("title", "JARVIS")
        message = intent.get("message", "")
        result = show_notification(title, message)
    else:
        return (
            f"Unknown app action '{action}'. "
            "Try: play, pause, next, previous, set_volume, activate, quit, "
            "mute, unmute, get_track, notify, run_script."
        )

    if result["ok"]:
        labels = {
            "play": f"Playing {app}.",
            "pause": f"Paused {app}.",
            "play_pause": f"Toggled play/pause on {app}.",
            "next": "Skipped to next track.",
            "next_track": "Skipped to next track.",
            "previous": "Went back to previous track.",
            "prev_track": "Went back to previous track.",
            "previous_track": "Went back to previous track.",
            "set_volume": f"Volume set to {volume}.",
            "system_volume": f"System volume set to {volume}.",
            "mute": "System muted.",
            "unmute": "System unmuted.",
            "activate": f"Switched to {app}.",
            "quit": f"Quit {app}.",
            "notify": "Notification sent.",
        }
        return labels.get(action, result["output"] or "Done.")
    return f"Couldn't {action}: {result['error'] or 'unknown error'}."
