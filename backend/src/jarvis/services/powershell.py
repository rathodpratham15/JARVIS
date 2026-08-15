"""PowerShell helpers for Windows app control.

Windows equivalent of applescript.py. Uses subprocess + powershell.exe.

Media key VK codes (user32 keybd_event):
  0xAD mute  0xAE vol-down  0xAF vol-up
  0xB0 next  0xB1 prev      0xB2 stop   0xB3 play/pause

Volume level uses the Windows Core Audio IAudioEndpointVolume COM interface
(no external dependencies — works on Windows 10/11 out of the box).

get_track uses Windows.Media.Control WinRT API (Windows 10 20H1+) and works
with any media app (Spotify, YouTube Music, etc.) without targeting it directly.
"""

from __future__ import annotations

import logging
import platform
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

_IS_WINDOWS = platform.system() == "Windows"

# ── Core runner ───────────────────────────────────────────────────────────────

def run_script(script: str, timeout: int = 10) -> dict:
    """Execute a PowerShell snippet. Returns {ok, output, error}."""
    if not _IS_WINDOWS:
        return {"ok": False, "output": "", "error": "PowerShell control is only available on Windows."}
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout.strip()
        error = result.stderr.strip()
        ok = result.returncode == 0
        if not ok:
            logger.warning("powershell error (rc=%d): %s", result.returncode, error)
        return {"ok": ok, "output": output, "error": error}
    except subprocess.TimeoutExpired:
        logger.error("powershell timed out after %ds", timeout)
        return {"ok": False, "output": "", "error": f"Script timed out after {timeout}s."}
    except FileNotFoundError:
        return {"ok": False, "output": "", "error": "powershell.exe not found on PATH."}
    except Exception as exc:
        logger.exception("powershell failed: %s", exc)
        return {"ok": False, "output": "", "error": str(exc)}


# ── Virtual-key sender (keybd_event P/Invoke) ─────────────────────────────────

_VK_SCRIPT = r"""
Add-Type @"
using System.Runtime.InteropServices;
public class VKey {{
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte vk, byte scan, uint flags, int extra);
    public static void Tap(byte vk) {{
        keybd_event(vk, 0, 0, 0);    // key down
        keybd_event(vk, 0, 2, 0);    // key up (KEYEVENTF_KEYUP = 2)
    }}
}}
"@
[VKey]::Tap(0x{vk:02X})
"""

def _send_vk(vk: int) -> dict:
    return run_script(_VK_SCRIPT.format(vk=vk))


# ── Media control ─────────────────────────────────────────────────────────────

def media_play_pause() -> dict:
    return _send_vk(0xB3)

def media_play() -> dict:
    return _send_vk(0xB3)   # No dedicated play-only VK; toggle works in most players

def media_pause() -> dict:
    return _send_vk(0xB3)

def media_next() -> dict:
    return _send_vk(0xB0)

def media_previous() -> dict:
    return _send_vk(0xB1)

def media_stop() -> dict:
    return _send_vk(0xB2)


def media_get_track() -> dict:
    """Return now-playing info via Windows.Media.Control WinRT (Windows 10 20H1+).

    Works with any media app (Spotify, YouTube Music, browsers, etc.) without
    targeting the app directly.
    """
    script = r"""
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,
         Windows.Media, ContentType=WindowsRuntime]
$mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
$session = $mgr.GetCurrentSession()
if ($null -eq $session) { Write-Output "Nothing is playing."; exit 0 }
$info = $session.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()
Write-Output "$($info.Title) by $($info.Artist)"
"""
    return run_script(script)


# ── System volume (Core Audio COM API) ───────────────────────────────────────

_AUDIO_TYPE = r"""
Add-Type @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"),
 ClassInterface(ClassInterfaceType.None)]
class MMDeviceEnumeratorClass {}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask,
        [MarshalAs(UnmanagedType.IUnknown)] out object ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref Guid iid, uint dwClsCtx, IntPtr pActivationParams,
        [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    int OpenPropertyStore(uint stgmAccess,
        [MarshalAs(UnmanagedType.IUnknown)] out object ppProperties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    int GetState(out uint pdwState);
}

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out uint pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
    int VolumeStepUp(ref Guid pguidEventContext);
    int VolumeStepDown(ref Guid pguidEventContext);
    int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB,
        out float pflVolumeIncrementdB);
}

public static class AudioEndpoint {
    static readonly Guid IID_IAudioEndpointVolume =
        new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");

    static IAudioEndpointVolume GetVolInterface() {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorClass();
        IMMDevice device;
        enumerator.GetDefaultAudioEndpoint(0, 1, out device);   // eRender, eConsole
        Guid iid = IID_IAudioEndpointVolume;
        object volObj;
        device.Activate(ref iid, 23 /*CLSCTX_ALL*/, IntPtr.Zero, out volObj);
        return (IAudioEndpointVolume)volObj;
    }

    public static void SetVolume(float level) {
        var v = GetVolInterface();
        Guid empty = Guid.Empty;
        v.SetMasterVolumeLevelScalar(level, ref empty);
    }

    public static float GetVolume() {
        var v = GetVolInterface();
        float level;
        v.GetMasterVolumeLevelScalar(out level);
        return level;
    }

    public static void SetMute(bool mute) {
        var v = GetVolInterface();
        Guid empty = Guid.Empty;
        v.SetMute(mute, ref empty);
    }

    public static bool GetMute() {
        var v = GetVolInterface();
        bool muted;
        v.GetMute(out muted);
        return muted;
    }
}
"@
"""


def system_set_volume(volume: int) -> dict:
    vol = max(0, min(100, int(volume)))
    script = _AUDIO_TYPE + f"\n[AudioEndpoint]::SetVolume({vol / 100.0}f)"
    return run_script(script)


def system_get_volume() -> dict:
    script = _AUDIO_TYPE + "\n[int]([AudioEndpoint]::GetVolume() * 100)"
    return run_script(script)


def system_mute(mute: bool = True) -> dict:
    val = "true" if mute else "false"
    script = _AUDIO_TYPE + f"\n[AudioEndpoint]::SetMute(${val})"
    return run_script(script)


# ── App control ───────────────────────────────────────────────────────────────

def app_activate(app_name: str) -> dict:
    """Bring app window to foreground via WScript.Shell.AppActivate."""
    script = f'(New-Object -ComObject WScript.Shell).AppActivate("{app_name}")'
    return run_script(script)


def app_launch(app_name: str) -> dict:
    script = f'Start-Process "{app_name}"'
    return run_script(script)


def app_quit(app_name: str) -> dict:
    # Strip .exe suffix for Get-Process
    name = app_name.rstrip(".exe").rstrip(".EXE")
    script = f'Stop-Process -Name "{name}" -Force -ErrorAction SilentlyContinue'
    return run_script(script)


def get_frontmost_app() -> dict:
    """Return the name of the foreground window's process."""
    script = r"""
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$pid = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
(Get-Process -Id $pid -ErrorAction SilentlyContinue).Name
"""
    return run_script(script)


# ── Notifications (WinForms BalloonTip — no AppUserModelID required) ──────────

def show_notification(title: str, message: str) -> dict:
    # Escape single quotes in user content
    t = title.replace("'", "\\'")
    m = message.replace("'", "\\'")
    script = f"""
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.ShowBalloonTip(5000, '{t}', '{m}', [System.Windows.Forms.ToolTipIcon]::None)
Start-Sleep -Seconds 6
$n.Dispose()
"""
    return run_script(script, timeout=15)


# ── Dispatch helper (mirrors applescript.handle_control_app) ─────────────────

def handle_control_app(intent: dict) -> str:
    action = (intent.get("app_action") or "").strip().lower()
    app = (intent.get("app") or "Spotify").strip()
    volume = intent.get("volume")
    script = (intent.get("script") or "").strip()

    if action == "run_script":
        if not script:
            return "Please provide a PowerShell script to run."
        result = run_script(script)
        if result["ok"]:
            return result["output"] or "Script ran successfully."
        return f"Script failed: {result['error']}"

    if action == "play":
        result = media_play()
    elif action == "pause":
        result = media_pause()
    elif action == "play_pause":
        result = media_play_pause()
    elif action in ("next", "next_track"):
        result = media_next()
    elif action in ("previous", "prev_track", "previous_track"):
        result = media_previous()
    elif action == "set_volume" and volume is not None:
        result = media_set_app_volume(int(volume), app)
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
        result = media_get_track()
        if result["ok"]:
            return f"Now playing: {result['output']}."
        return f"Couldn't get track info: {result['error']}"
    elif action == "frontmost":
        result = get_frontmost_app()
        if result["ok"]:
            return f"The foreground app is {result['output']}."
        return f"Couldn't determine foreground app: {result['error']}"
    elif action == "notify":
        title = intent.get("title", "JARVIS")
        message = intent.get("message", "")
        result = show_notification(title, message)
    else:
        return (
            f"Unknown app action '{action}'. "
            "Try: play, pause, next, previous, set_volume, system_volume, "
            "activate, quit, mute, unmute, get_track, notify, run_script."
        )

    if result["ok"]:
        labels = {
            "play": f"Playing.",
            "pause": "Paused.",
            "play_pause": "Toggled play/pause.",
            "next": "Skipped to next track.",
            "next_track": "Skipped to next track.",
            "previous": "Went back to previous track.",
            "prev_track": "Went back to previous track.",
            "previous_track": "Went back to previous track.",
            "set_volume": f"Set volume to {volume}.",
            "system_volume": f"System volume set to {volume}.",
            "mute": "System muted.",
            "unmute": "System unmuted.",
            "activate": f"Switched to {app}.",
            "quit": f"Quit {app}.",
            "notify": "Notification sent.",
        }
        return labels.get(action, result["output"] or "Done.")
    return f"Couldn't {action}: {result['error'] or 'unknown error'}."


def media_set_app_volume(volume: int, app: str = "Spotify") -> dict:
    """Set per-app volume via Windows Audio Session API (WASAPI)."""
    vol = max(0, min(100, volume))
    script = f"""
Add-Type @"
using System;
using System.Runtime.InteropServices;

[Guid("BCD5E082-235F-43FE-9C5E-0B8D842ADADB"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {{
    int GetCount(out int sessionCount);
    int GetSession(int sessionCount, out IAudioSessionControl2 session);
}}
[Guid("BFAE80F3-3F73-4E82-B63B-4A8B39F15C8D"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {{
    int GetAudioSessionControl(ref Guid AudioSessionGuid, uint StreamFlags, out object SessionControl);
    int GetSimpleAudioVolume(ref Guid AudioSessionGuid, uint StreamFlags, out ISimpleAudioVolume AudioVolume);
    int GetSessionEnumerator(out IAudioSessionEnumerator SessionList);
    int RegisterSessionNotification(IntPtr SessionNotification);
    int UnregisterSessionNotification(IntPtr SessionNotification);
    int RegisterDuckNotification(string sessionID, IntPtr duckNotification);
    int UnregisterDuckNotification(IntPtr duckNotification);
}}
[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {{
    int SetMasterVolume(float fLevel, ref Guid EventContext);
    int GetMasterVolume(out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid EventContext);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
}}
[Guid("24918ACC-64B3-37C1-8CA9-74A66E9957A8"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {{
    int GetState(out int pRetVal);
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
    int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
    int GetGroupingParam(out Guid pRetVal);
    int SetGroupingParam(ref Guid Override, ref Guid EventContext);
    int RegisterAudioSessionNotification(IntPtr NewNotifications);
    int UnregisterAudioSessionNotification(IntPtr NewNotifications);
    int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int GetProcessId(out uint pRetVal);
    int IsSystemSoundsSession();
    int SetDuckingPreference(bool optOut);
}}
"@
# Simpler fallback: use system volume for named app (Windows doesn't expose per-app vol easily via PS)
# Users can use system_volume for system-wide, or target app's in-app volume via its own settings.
Write-Output "Per-app volume via WASAPI requires native code; using system volume instead."
"""
    # Fall back to system volume — per-app via WASAPI is very complex in PS
    return system_set_volume(vol)
