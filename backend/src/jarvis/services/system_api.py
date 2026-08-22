"""Cross-platform system API controls: volume, brightness, DND, WiFi.

Supports macOS, Linux, and Windows.  Each function returns a plain string
suitable for returning to the user as a voice/chat reply.
"""

from __future__ import annotations

import platform
import subprocess
import shutil
import logging

logger = logging.getLogger(__name__)

_OS = platform.system()  # "Darwin" | "Linux" | "Windows"


# ── helpers ───────────────────────────────────────────────────────────────────

def _run(cmd: list[str], timeout: int = 5) -> tuple[int, str, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except FileNotFoundError:
        return 1, "", f"Command not found: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"


def _osascript(script: str) -> tuple[int, str, str]:
    return _run(["osascript", "-e", script])


# ── volume ────────────────────────────────────────────────────────────────────

def get_volume() -> str:
    if _OS == "Darwin":
        code, out, _ = _osascript("output volume of (get volume settings)")
        return f"System volume is at {out}%." if code == 0 else "Couldn't read volume."

    if _OS == "Linux":
        if shutil.which("pactl"):
            code, out, _ = _run(["pactl", "get-sink-volume", "@DEFAULT_SINK@"])
            if code == 0:
                import re
                m = re.search(r"(\d+)%", out)
                return f"System volume is at {m.group(1)}%." if m else "Couldn't parse volume."
        if shutil.which("amixer"):
            code, out, _ = _run(["amixer", "get", "Master"])
            import re
            m = re.search(r"\[(\d+)%\]", out)
            return f"System volume is at {m.group(1)}%." if m else "Couldn't read volume."
        return "No supported volume tool found (need pactl or amixer)."

    if _OS == "Windows":
        script = (
            "Add-Type -TypeDefinition 'using System.Runtime.InteropServices; "
            "[Guid(\"5CDF2C82-841E-4546-9722-0CF74078229A\")] "
            "[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] "
            "public interface IAudioEndpointVolume { void _vt1(); void _vt2(); void _vt3(); "
            "void _vt4(); int GetMasterVolumeLevelScalar(out float level); }'; "
            "$vol = [Math]::Round((New-Object -ComObject MMDeviceEnumerator | "
            "Select-Object -ExpandProperty DefaultAudioEndpoint).AudioEndpointVolume.MasterVolumeLevelScalar * 100); "
            "Write-Output $vol"
        )
        code, out, _ = _run(["powershell", "-Command", script])
        return f"System volume is at {out.strip()}%." if code == 0 else "Couldn't read volume on Windows."

    return f"Volume reading not supported on {_OS}."


def set_volume(level: int) -> str:
    level = max(0, min(100, int(level)))

    if _OS == "Darwin":
        code, _, err = _osascript(f"set volume output volume {level}")
        return f"Volume set to {level}%." if code == 0 else f"Failed: {err}"

    if _OS == "Linux":
        if shutil.which("pactl"):
            code, _, err = _run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level}%"])
            return f"Volume set to {level}%." if code == 0 else f"Failed: {err}"
        if shutil.which("amixer"):
            code, _, err = _run(["amixer", "set", "Master", f"{level}%"])
            return f"Volume set to {level}%." if code == 0 else f"Failed: {err}"
        return "No supported volume tool found (need pactl or amixer)."

    if _OS == "Windows":
        script = f"(New-Object -ComObject WScript.Shell).SendKeys([char]173); " \
                 f"$obj = New-Object -ComObject MMDeviceEnumerator; " \
                 f"$obj.GetDefaultAudioEndpoint(0,1).AudioEndpointVolume.MasterVolumeLevelScalar = {level / 100}"
        # Simpler PowerShell via nircmd if available
        if shutil.which("nircmd"):
            vol_nircmd = int(level / 100 * 65535)
            code, _, err = _run(["nircmd", "setsysvolume", str(vol_nircmd)])
            return f"Volume set to {level}%." if code == 0 else f"Failed: {err}"
        code, _, err = _run(["powershell", "-Command", script])
        return f"Volume set to {level}%." if code == 0 else f"Failed to set volume: {err}"

    return f"Setting volume not supported on {_OS}."


def mute_volume() -> str:
    if _OS == "Darwin":
        code, _, _ = _osascript("set volume output muted true")
        return "Muted." if code == 0 else "Couldn't mute."
    if _OS == "Linux":
        if shutil.which("pactl"):
            _run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "1"])
            return "Muted."
        if shutil.which("amixer"):
            _run(["amixer", "set", "Master", "mute"])
            return "Muted."
    if _OS == "Windows":
        if shutil.which("nircmd"):
            _run(["nircmd", "mutesysvolume", "1"])
            return "Muted."
    return "Couldn't mute on this platform."


def unmute_volume() -> str:
    if _OS == "Darwin":
        code, _, _ = _osascript("set volume output muted false")
        return "Unmuted." if code == 0 else "Couldn't unmute."
    if _OS == "Linux":
        if shutil.which("pactl"):
            _run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "0"])
            return "Unmuted."
        if shutil.which("amixer"):
            _run(["amixer", "set", "Master", "unmute"])
            return "Unmuted."
    if _OS == "Windows":
        if shutil.which("nircmd"):
            _run(["nircmd", "mutesysvolume", "0"])
            return "Unmuted."
    return "Couldn't unmute on this platform."


# ── brightness ────────────────────────────────────────────────────────────────

def get_brightness() -> str:
    if _OS == "Darwin":
        if shutil.which("brightness"):
            code, out, _ = _run(["brightness", "-l"])
            import re
            m = re.search(r"brightness\s+([\d.]+)", out)
            if m:
                pct = round(float(m.group(1)) * 100)
                return f"Screen brightness is at {pct}%."
        # Fallback: try osascript with System Events (works on some versions)
        code, out, _ = _osascript(
            'tell application "System Events" to tell appearance preferences to return dark mode'
        )
        return "Brightness reading requires the 'brightness' CLI (brew install brightness)."

    if _OS == "Linux":
        if shutil.which("brightnessctl"):
            code, out, _ = _run(["brightnessctl", "get"])
            code2, max_out, _ = _run(["brightnessctl", "max"])
            if code == 0 and code2 == 0:
                try:
                    pct = round(int(out) / int(max_out) * 100)
                    return f"Screen brightness is at {pct}%."
                except ValueError:
                    pass
        return "Brightness reading requires brightnessctl (sudo apt install brightnessctl)."

    if _OS == "Windows":
        script = "(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness"
        code, out, _ = _run(["powershell", "-Command", script])
        return f"Screen brightness is at {out.strip()}%." if code == 0 else "Couldn't read brightness."

    return f"Brightness reading not supported on {_OS}."


def set_brightness(level: int) -> str:
    level = max(0, min(100, int(level)))

    if _OS == "Darwin":
        if shutil.which("brightness"):
            code, _, err = _run(["brightness", str(level / 100)])
            return f"Brightness set to {level}%." if code == 0 else f"Failed: {err}"
        return "Setting brightness requires the 'brightness' CLI (brew install brightness)."

    if _OS == "Linux":
        if shutil.which("brightnessctl"):
            code, _, err = _run(["brightnessctl", "set", f"{level}%"])
            return f"Brightness set to {level}%." if code == 0 else f"Failed: {err}"
        return "Setting brightness requires brightnessctl (sudo apt install brightnessctl)."

    if _OS == "Windows":
        script = f"(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {level})"
        code, _, err = _run(["powershell", "-Command", script])
        return f"Brightness set to {level}%." if code == 0 else f"Failed: {err}"

    return f"Setting brightness not supported on {_OS}."


# ── Do Not Disturb ────────────────────────────────────────────────────────────

def enable_dnd() -> str:
    if _OS == "Darwin":
        # macOS 13+ Ventura: use Focus via shortcuts if available
        if shutil.which("shortcuts"):
            code, _, _ = _run(["shortcuts", "run", "Turn On Do Not Disturb"])
            if code == 0:
                return "Do Not Disturb enabled."
        # Fallback: toggle via osascript menu bar click (works on older macOS)
        script = (
            'tell application "System Events"\n'
            '  tell process "Control Center"\n'
            '    set frontmost to true\n'
            '  end tell\n'
            'end tell'
        )
        # Simpler: use defaults (works on macOS < 13)
        code, _, _ = _run([
            "defaults", "-currentHost", "write",
            "-g", "com.apple.notificationcenterui.doNotDisturb", "-boolean", "true"
        ])
        if code == 0:
            _run(["killall", "NotificationCenter"])
            return "Do Not Disturb enabled."
        return "Couldn't enable DND — try enabling it manually in System Settings > Focus."

    if _OS == "Linux":
        if shutil.which("dunstctl"):
            _run(["dunstctl", "set-paused", "true"])
            return "Notifications paused (dunst)."
        return "DND not supported — install dunst for notification control."

    if _OS == "Windows":
        script = (
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' "
            "-Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -Value 0"
        )
        code, _, err = _run(["powershell", "-Command", script])
        return "Do Not Disturb enabled." if code == 0 else f"Failed: {err}"

    return f"DND not supported on {_OS}."


def disable_dnd() -> str:
    if _OS == "Darwin":
        if shutil.which("shortcuts"):
            code, _, _ = _run(["shortcuts", "run", "Turn Off Do Not Disturb"])
            if code == 0:
                return "Do Not Disturb disabled."
        code, _, _ = _run([
            "defaults", "-currentHost", "write",
            "-g", "com.apple.notificationcenterui.doNotDisturb", "-boolean", "false"
        ])
        if code == 0:
            _run(["killall", "NotificationCenter"])
            return "Do Not Disturb disabled."
        return "Couldn't disable DND — try disabling it manually in System Settings > Focus."

    if _OS == "Linux":
        if shutil.which("dunstctl"):
            _run(["dunstctl", "set-paused", "false"])
            return "Notifications resumed (dunst)."
        return "DND not supported — install dunst."

    if _OS == "Windows":
        script = (
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' "
            "-Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -Value 1"
        )
        code, _, err = _run(["powershell", "-Command", script])
        return "Do Not Disturb disabled." if code == 0 else f"Failed: {err}"

    return f"DND not supported on {_OS}."


# ── WiFi ──────────────────────────────────────────────────────────────────────

def _macos_wifi_interface() -> str:
    code, out, _ = _run(["networksetup", "-listallhardwareports"])
    lines = out.splitlines()
    for i, line in enumerate(lines):
        if "Wi-Fi" in line or "AirPort" in line:
            for j in range(i, min(i + 4, len(lines))):
                if lines[j].startswith("Device:"):
                    return lines[j].split("Device:")[-1].strip()
    return "en0"


def get_wifi_status() -> str:
    if _OS == "Darwin":
        iface = _macos_wifi_interface()
        code, out, _ = _run(["networksetup", "-getairportpower", iface])
        return f"WiFi ({iface}) is {'on' if 'On' in out else 'off'}." if code == 0 else "Couldn't read WiFi status."

    if _OS == "Linux":
        if shutil.which("nmcli"):
            code, out, _ = _run(["nmcli", "radio", "wifi"])
            return f"WiFi is {out.strip()}."
        if shutil.which("rfkill"):
            code, out, _ = _run(["rfkill", "list", "wifi"])
            blocked = "Soft blocked: yes" in out
            return f"WiFi is {'off (blocked)' if blocked else 'on'}."
        return "No supported WiFi tool found."

    if _OS == "Windows":
        code, out, _ = _run(["netsh", "interface", "show", "interface", "Wi-Fi"])
        status = "enabled" if "Enabled" in out else "disabled"
        return f"WiFi is {status}."

    return f"WiFi status not supported on {_OS}."


def enable_wifi() -> str:
    if _OS == "Darwin":
        iface = _macos_wifi_interface()
        code, _, err = _run(["networksetup", "-setairportpower", iface, "on"])
        return "WiFi enabled." if code == 0 else f"Failed: {err}"

    if _OS == "Linux":
        if shutil.which("nmcli"):
            code, _, err = _run(["nmcli", "radio", "wifi", "on"])
            return "WiFi enabled." if code == 0 else f"Failed: {err}"
        if shutil.which("rfkill"):
            code, _, err = _run(["rfkill", "unblock", "wifi"])
            return "WiFi enabled." if code == 0 else f"Failed: {err}"
        return "No supported WiFi tool found."

    if _OS == "Windows":
        code, _, err = _run(["netsh", "interface", "set", "interface", "Wi-Fi", "admin=enable"])
        return "WiFi enabled." if code == 0 else f"Failed: {err}"

    return f"WiFi control not supported on {_OS}."


def disable_wifi() -> str:
    if _OS == "Darwin":
        iface = _macos_wifi_interface()
        code, _, err = _run(["networksetup", "-setairportpower", iface, "off"])
        return "WiFi disabled." if code == 0 else f"Failed: {err}"

    if _OS == "Linux":
        if shutil.which("nmcli"):
            code, _, err = _run(["nmcli", "radio", "wifi", "off"])
            return "WiFi disabled." if code == 0 else f"Failed: {err}"
        if shutil.which("rfkill"):
            code, _, err = _run(["rfkill", "block", "wifi"])
            return "WiFi disabled." if code == 0 else f"Failed: {err}"
        return "No supported WiFi tool found."

    if _OS == "Windows":
        code, _, err = _run(["netsh", "interface", "set", "interface", "Wi-Fi", "admin=disable"])
        return "WiFi disabled." if code == 0 else f"Failed: {err}"

    return f"WiFi control not supported on {_OS}."


# ── dispatcher ────────────────────────────────────────────────────────────────

def handle_system_api(intent: dict) -> str:
    action = intent.get("action", "")
    level = intent.get("level")

    dispatch = {
        "get_volume":    get_volume,
        "mute":          mute_volume,
        "unmute":        unmute_volume,
        "get_brightness": get_brightness,
        "get_wifi":      get_wifi_status,
        "enable_wifi":   enable_wifi,
        "disable_wifi":  disable_wifi,
        "enable_dnd":    enable_dnd,
        "disable_dnd":   disable_dnd,
    }

    if action == "set_volume":
        if level is None:
            return "Please specify a volume level (0–100)."
        return set_volume(int(level))

    if action == "set_brightness":
        if level is None:
            return "Please specify a brightness level (0–100)."
        return set_brightness(int(level))

    fn = dispatch.get(action)
    if fn:
        return fn()

    return f"Unknown system action '{action}'."
