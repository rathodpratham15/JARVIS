"""Home Assistant REST API client for smart home control.

Configure via environment variables:
    HA_URL    — Home Assistant base URL, e.g. http://homeassistant.local:8123
    HA_TOKEN  — Long-lived access token (Profile → Long-Lived Access Tokens)
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_SERVICE_MAP = {
    "turn_on":  ("homeassistant", "turn_on"),
    "turn_off": ("homeassistant", "turn_off"),
    "toggle":   ("homeassistant", "toggle"),
    "dim":      ("light", "turn_on"),
    "set_temp": ("climate", "set_temperature"),
}

_ACTION_VERBS = {
    "turn_on": "on", "turn_off": "off", "toggle": "toggled",
    "dim": "dimmed", "set_temp": "set",
}


def control_device(device: str, action: str, extra: Optional[dict] = None, ha_url: str = "", ha_token: str = "") -> str:
    """Execute a smart home command. Returns a human-readable result string."""
    url = (ha_url or os.getenv("HA_URL", "")).rstrip("/")
    token = ha_token or os.getenv("HA_TOKEN", "")
    if not url or not token:
        return (
            "Smart home isn't configured. Add HA_URL and HA_TOKEN to your .env "
            "(Home Assistant base URL + a long-lived access token from your profile), "
            "then restart."
        )

    try:
        import requests
    except ImportError:
        return "The 'requests' library is required for smart home control."

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    entity_id = _resolve_entity(url, headers, device, action)
    domain, service = _SERVICE_MAP.get(action, ("homeassistant", "toggle"))

    payload: dict = {"entity_id": entity_id}
    if action == "dim":
        payload["brightness_pct"] = (extra or {}).get("brightness", 50)
    elif action == "set_temp" and extra and "temperature" in extra:
        payload["temperature"] = extra["temperature"]

    try:
        resp = requests.post(
            f"{url}/api/services/{domain}/{service}",
            json=payload,
            headers=headers,
            timeout=5,
        )
        if resp.status_code == 401:
            return "Smart home request denied — check your HA_TOKEN."
        if resp.status_code == 404:
            return f"Device '{device}' not found in Home Assistant (tried entity '{entity_id}')."
        resp.raise_for_status()
        verb = _ACTION_VERBS.get(action, "updated")
        return f"{device.capitalize()} {verb}."
    except requests.Timeout:
        return "Smart home request timed out — is Home Assistant reachable?"
    except requests.RequestException as exc:
        logger.warning("Smart home error: %s", exc)
        return f"Smart home error: {exc}"


def _resolve_entity(url: str, headers: dict, device: str, action: str) -> str:
    """Match friendly name against HA states; fall back to constructed entity_id."""
    import requests

    domain = _guess_domain(device, action)
    slug = device.lower().strip().replace(" ", "_")
    fallback = f"{domain}.{slug}"

    try:
        resp = requests.get(f"{url}/api/states", headers=headers, timeout=5)
        if not resp.ok:
            return fallback
        for state in resp.json():
            eid: str = state["entity_id"]
            friendly: str = state.get("attributes", {}).get("friendly_name", "").lower()
            if eid.split(".")[-1] == slug or device.lower() in friendly:
                return eid
    except Exception:
        pass

    return fallback


def _guess_domain(device: str, action: str) -> str:
    d = device.lower()
    if any(k in d for k in ("light", "lamp", "bulb")):
        return "light"
    if any(k in d for k in ("thermostat", "climate", "ac", "heater", "heat")):
        return "climate"
    if any(k in d for k in ("fan",)):
        return "fan"
    if any(k in d for k in ("switch", "plug", "outlet")):
        return "switch"
    if action == "dim":
        return "light"
    if action == "set_temp":
        return "climate"
    return "switch"
