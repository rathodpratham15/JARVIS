"""Home Assistant REST API service for JARVIS.

Env vars:
    HOMEASSISTANT_URL   — e.g. http://homeassistant.local:8123
    HOMEASSISTANT_TOKEN — Long-lived access token from HA Profile page
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_SERVICE_MAP = {
    "turn_on":  ("homeassistant", "turn_on"),
    "turn_off": ("homeassistant", "turn_off"),
    "toggle":   ("homeassistant", "toggle"),
    "dim":      ("light", "turn_on"),
    "set_temp": ("climate", "set_temperature"),
}

_DOMAIN_HINTS = {
    "light": ["light", "lamp", "bulb"],
    "climate": ["thermostat", "climate", "ac", "heater", "heat"],
    "fan": ["fan"],
    "switch": ["switch", "plug", "outlet"],
    "lock": ["lock", "door"],
    "cover": ["blind", "curtain", "shutter", "garage"],
    "media_player": ["tv", "speaker", "cast", "sonos"],
}


class HomeAssistantService:
    """Wraps the Home Assistant REST API."""

    def __init__(self) -> None:
        self._url = os.getenv("HOMEASSISTANT_URL", os.getenv("HA_URL", "")).rstrip("/")
        self._token = os.getenv("HOMEASSISTANT_TOKEN", os.getenv("HA_TOKEN", ""))

    @property
    def available(self) -> bool:
        return bool(self._url and self._token)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}

    def _not_configured(self) -> str:
        return (
            "Home Assistant not configured. Add HOMEASSISTANT_URL and HOMEASSISTANT_TOKEN "
            "to your Railway environment variables."
        )

    def get_states(self, domain: Optional[str] = None) -> list[dict]:
        if not self.available:
            return []
        try:
            r = requests.get(f"{self._url}/api/states", headers=self._headers(), timeout=5)
            r.raise_for_status()
            states = r.json()
            if domain:
                states = [s for s in states if s["entity_id"].startswith(f"{domain}.")]
            return states
        except Exception as exc:
            logger.warning("HA get_states error: %s", exc)
            return []

    def get_state(self, entity_id: str) -> Optional[dict]:
        if not self.available:
            return None
        try:
            r = requests.get(f"{self._url}/api/states/{entity_id}", headers=self._headers(), timeout=5)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            logger.warning("HA get_state error: %s", exc)
            return None

    def call_service(self, domain: str, service: str, entity_id: str, **kwargs) -> bool:
        if not self.available:
            return False
        payload = {"entity_id": entity_id, **kwargs}
        try:
            r = requests.post(
                f"{self._url}/api/services/{domain}/{service}",
                json=payload,
                headers=self._headers(),
                timeout=5,
            )
            r.raise_for_status()
            return True
        except Exception as exc:
            logger.warning("HA call_service error: %s", exc)
            return False

    def resolve_entity(self, device: str, action: str) -> str:
        """Fuzzy-match a device name to an entity_id."""
        domain = self._guess_domain(device, action)
        slug = device.lower().strip().replace(" ", "_")
        fallback = f"{domain}.{slug}"
        states = self.get_states()
        for state in states:
            eid: str = state["entity_id"]
            friendly: str = state.get("attributes", {}).get("friendly_name", "").lower()
            if eid.split(".")[-1] == slug or device.lower() in friendly:
                return eid
        return fallback

    def _guess_domain(self, device: str, action: str) -> str:
        d = device.lower()
        for domain, hints in _DOMAIN_HINTS.items():
            if any(h in d for h in hints):
                return domain
        if action == "dim":
            return "light"
        if action == "set_temp":
            return "climate"
        return "switch"

    def control(self, device: str, action: str, temperature: Optional[float] = None) -> str:
        if not self.available:
            return self._not_configured()
        entity_id = self.resolve_entity(device, action)
        domain, service = _SERVICE_MAP.get(action, ("homeassistant", "toggle"))
        kwargs: dict = {}
        if action == "dim":
            kwargs["brightness_pct"] = 50
        elif action == "set_temp" and temperature is not None:
            kwargs["temperature"] = temperature
        ok = self.call_service(domain, service, entity_id, **kwargs)
        if not ok:
            return f"Failed to control '{device}'. Check Home Assistant is reachable."
        verbs = {"turn_on": "on", "turn_off": "off", "toggle": "toggled", "dim": "dimmed", "set_temp": "set"}
        verb = verbs.get(action, "updated")
        return f"{device.capitalize()} {verb}."

    def list_devices(self, domain: Optional[str] = None) -> str:
        if not self.available:
            return self._not_configured()
        states = self.get_states(domain)
        if not states:
            return "No devices found in Home Assistant."
        lines = []
        for s in sorted(states, key=lambda x: x["entity_id"])[:50]:
            name = s.get("attributes", {}).get("friendly_name") or s["entity_id"]
            state_val = s.get("state", "unknown")
            lines.append(f"• {name} ({s['entity_id']}) — {state_val}")
        return "\n".join(lines)

    def status(self) -> dict:
        if not self.available:
            return {"available": False, "entities_count": 0}
        states = self.get_states()
        domains = sorted({s["entity_id"].split(".")[0] for s in states})
        return {"available": True, "entities_count": len(states), "domains": domains}
