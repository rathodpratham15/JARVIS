"""Spotify Web API integration for JARVIS.

Env vars:
    SPOTIFY_CLIENT_ID     — Spotify app client ID
    SPOTIFY_CLIENT_SECRET — Spotify app client secret

Tokens are persisted to data/spotify_tokens.json (single-user design).
"""
from __future__ import annotations

import base64
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_API = "https://api.spotify.com/v1"
_AUTH_URL = "https://accounts.spotify.com/authorize"
_TOKEN_URL = "https://accounts.spotify.com/api/token"
_SCOPES = " ".join([
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
])


class SpotifyService:
    """Wraps the Spotify Web API with OAuth Authorization Code Flow."""

    def __init__(self, token_path: str = "data/spotify_tokens.json") -> None:
        self._client_id = os.getenv("SPOTIFY_CLIENT_ID", "")
        self._client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
        self._token_path = Path(token_path)
        self._tokens: dict = self._load_tokens()

    @property
    def configured(self) -> bool:
        return bool(self._client_id and self._client_secret)

    @property
    def connected(self) -> bool:
        return self.configured and bool(self._tokens.get("access_token"))

    def _load_tokens(self) -> dict:
        try:
            return json.loads(self._token_path.read_text()) if self._token_path.exists() else {}
        except Exception:
            return {}

    def _save_tokens(self) -> None:
        try:
            self._token_path.parent.mkdir(parents=True, exist_ok=True)
            self._token_path.write_text(json.dumps(self._tokens))
        except Exception as exc:
            logger.warning("Could not save Spotify tokens: %s", exc)

    def _not_configured(self) -> str:
        return (
            "Spotify not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET "
            "to your Railway environment variables."
        )

    def _not_connected(self) -> str:
        return "Spotify not connected. Go to Settings → Integrations and connect Spotify."

    def get_auth_url(self, redirect_uri: str, state: str = "") -> str:
        if not self.configured:
            raise RuntimeError(self._not_configured())
        params = {
            "client_id": self._client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": _SCOPES,
            "state": state,
        }
        from urllib.parse import urlencode
        return f"{_AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> bool:
        creds = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
        try:
            r = requests.post(
                _TOKEN_URL,
                data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri},
                headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            self._tokens = {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token", ""),
                "expires_at": time.time() + data.get("expires_in", 3600),
            }
            self._save_tokens()
            return True
        except Exception as exc:
            logger.error("Spotify token exchange failed: %s", exc)
            return False

    def _refresh(self) -> bool:
        refresh_token = self._tokens.get("refresh_token", "")
        if not refresh_token:
            return False
        creds = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
        try:
            r = requests.post(
                _TOKEN_URL,
                data={"grant_type": "refresh_token", "refresh_token": refresh_token},
                headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            self._tokens["access_token"] = data["access_token"]
            self._tokens["expires_at"] = time.time() + data.get("expires_in", 3600)
            if data.get("refresh_token"):
                self._tokens["refresh_token"] = data["refresh_token"]
            self._save_tokens()
            return True
        except Exception as exc:
            logger.warning("Spotify token refresh failed: %s", exc)
            return False

    def _headers(self) -> Optional[dict]:
        if not self.connected:
            return None
        if time.time() > self._tokens.get("expires_at", 0) - 60:
            if not self._refresh():
                return None
        return {"Authorization": f"Bearer {self._tokens['access_token']}"}

    def _api(self, method: str, path: str, **kwargs) -> Optional[requests.Response]:
        headers = self._headers()
        if headers is None:
            return None
        try:
            r = requests.request(method, f"{_API}{path}", headers=headers, timeout=5, **kwargs)
            return r
        except Exception as exc:
            logger.warning("Spotify API error: %s", exc)
            return None

    def current_track(self) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        r = self._api("GET", "/me/player/currently-playing")
        if r is None:
            return "Could not reach Spotify."
        if r.status_code == 204:
            return "Nothing is playing on Spotify right now."
        if r.status_code != 200:
            return "Could not get current track."
        data = r.json()
        item = data.get("item") or {}
        name = item.get("name", "Unknown")
        artists = ", ".join(a["name"] for a in item.get("artists", []))
        is_playing = data.get("is_playing", False)
        state = "Playing" if is_playing else "Paused"
        return f"{state}: {name} by {artists}."

    def play(self, uri: Optional[str] = None) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        body = {}
        if uri:
            if uri.startswith("spotify:track:"):
                body = {"uris": [uri]}
            elif uri.startswith("spotify:"):
                body = {"context_uri": uri}
        r = self._api("PUT", "/me/player/play", json=body if body else None)
        if r is None:
            return "Could not connect to Spotify."
        if r.status_code in (200, 204):
            return "Resuming playback."
        if r.status_code == 403:
            return "Playback control requires Spotify Premium."
        if r.status_code == 404:
            return "No active Spotify device found. Open Spotify on any device first."
        return f"Spotify error {r.status_code}."

    def pause(self) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        r = self._api("PUT", "/me/player/pause")
        if r is None:
            return "Could not connect to Spotify."
        if r.status_code in (200, 204):
            return "Playback paused."
        if r.status_code == 403:
            return "Playback control requires Spotify Premium."
        return f"Spotify error {r.status_code}."

    def skip_next(self) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        r = self._api("POST", "/me/player/next")
        if r and r.status_code in (200, 204):
            return "Skipped to next track."
        return "Could not skip track."

    def skip_prev(self) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        r = self._api("POST", "/me/player/previous")
        if r and r.status_code in (200, 204):
            return "Went back to previous track."
        return "Could not go back."

    def set_volume(self, percent: int) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        vol = max(0, min(100, int(percent)))
        r = self._api("PUT", f"/me/player/volume?volume_percent={vol}")
        if r and r.status_code in (200, 204):
            return f"Spotify volume set to {vol}%."
        if r and r.status_code == 403:
            return "Volume control requires Spotify Premium."
        return "Could not set volume."

    def search_and_play(self, query: str) -> str:
        if not self.configured:
            return self._not_configured()
        if not self.connected:
            return self._not_connected()
        r = self._api("GET", f"/search?q={query}&type=track&limit=1")
        if r is None or r.status_code != 200:
            return "Search failed."
        items = r.json().get("tracks", {}).get("items", [])
        if not items:
            return f"No Spotify tracks found for '{query}'."
        track = items[0]
        name = track["name"]
        artist = track["artists"][0]["name"] if track["artists"] else ""
        uri = track["uri"]
        result = self.play(uri=uri)
        if "error" in result.lower() or "failed" in result.lower():
            return result
        return f"Playing '{name}' by {artist}."

    def disconnect(self) -> None:
        self._tokens = {}
        try:
            self._token_path.unlink(missing_ok=True)
        except Exception:
            pass

    def status(self) -> dict:
        return {
            "configured": self.configured,
            "connected": self.connected,
        }
