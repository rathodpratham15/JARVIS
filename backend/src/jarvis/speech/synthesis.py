"""Text-to-speech via the ElevenLabs API.

`ELEVENLABS_VOICE_ID` accepts either a real 20-character voice ID OR a
common voice name like "Rachel" / "Adam" — names are resolved against a
built-in table first (ElevenLabs' premade voice IDs are stable), then
against the user's voice library via the API. Falls back to Rachel if
the name can't be resolved.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ElevenLabs' premade voice IDs are public + stable. Saves an API call
# for the common case where users type "Adam" expecting it to just work.
_PREMADE_VOICES: dict[str, str] = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "adam": "pNInz6obpgDQGcFmaJgB",
    "antoni": "ErXwobaYiN019PkySvjV",
    "arnold": "VR6AewLTigWG4xSOukaG",
    "bella": "EXAVITQu4vr4xnSDxMAL",
    "callum": "N2lVS1w4EtoT3dr4eOWO",
    "charlie": "IKne3meq5aSn9XLyUdCD",
    "charlotte": "XB0fDUnXU5powFXDhCwa",
    "clyde": "2EiwWnXFnvU5JabPnv8n",
    "daniel": "onwK4e9ZLuTAKqWW03F9",
    "domi": "AZnzlk1XvdvUeBnXmlld",
    "dorothy": "ThT5KcBeYPX3keUQqHPh",
    "elli": "MF3mGyEYCl7XYWbV9V6O",
    "emily": "LcfcDJNUP1GQjkzn1xUU",
    "ethan": "g5CIjZEefAph4nQFvHAz",
    "fin": "D38z5RcWu1voky8WS1ja",
    "freya": "jsCqWAovK2LkecY7zXl4",
    "george": "JBFqnCBsd6RMkjVDRZzb",
    "gigi": "jBpfuIE2acCO8z3wKNLl",
    "giovanni": "zcAOhNBS3c14rBihAFp1",
    "glinda": "z9fAnlkpzviPz146aGWa",
    "grace": "oWAxZDx7w5VEj9dCyTzz",
    "harry": "SOYHLrjzK2X1ezoPC6cr",
    "james": "ZQe5CZNOzWyzPSCn5a3c",
    "jeremy": "bVMeCyTHy58xNoL34h3p",
    "jessie": "t0jbNlBVZ17f02VDIeMI",
    "joseph": "Zlb1dXrM653N07WRdFW3",
    "josh": "TxGEqnHWrfWFTfGW9XjX",
    "liam": "TX3LPaxmHKxFdv7VOQHJ",
    "lily": "pFZP5JQG7iQjIQuC4Bku",
    "matilda": "XrExE9yKIg1WjnnlVkGX",
    "michael": "flq6f7yk4E4fJM5XTYuZ",
    "mimi": "zrHiDhphv9ZnVXBqCLjz",
    "nicole": "piTKgcLEGmPE4e6mEKli",
    "patrick": "ODq5zmih8GrVes37Dizd",
    "paul": "5Q0t7uMcjvnagumLfvZi",
    "sam": "yoZ06aMxZJJ28mfd3POQ",
    "sarah": "EXAVITQu4vr4xnSDxMAL",
    "serena": "pMsXgVXv3BLzUgSXRplE",
    "thomas": "GBv7mTt0atIp3Br8iCZE",
}

_DEFAULT_VOICE_ID = _PREMADE_VOICES["rachel"]


def _looks_like_voice_id(value: str) -> bool:
    """ElevenLabs voice IDs are exactly 20 alphanumeric characters."""
    return len(value) == 20 and value.isalnum()


class Synthesizer:
    """Generate spoken audio bytes from text. Returns MP3 bytes or None."""

    def __init__(self, api_key: Optional[str] = None, voice_id: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        raw_voice = voice_id or os.getenv("ELEVENLABS_VOICE_ID") or _DEFAULT_VOICE_ID
        self._client = self._make_client()
        self.voice_id = self._resolve_voice(raw_voice)

    def _make_client(self):
        if not self.api_key:
            return None
        try:
            from elevenlabs.client import ElevenLabs

            return ElevenLabs(api_key=self.api_key)
        except ImportError:
            logger.warning("elevenlabs package not installed; TTS disabled")
            return None

    def _resolve_voice(self, value: str) -> str:
        """Turn a user-friendly voice name into a real voice_id."""
        if _looks_like_voice_id(value):
            return value
        lowered = value.strip().lower()
        if lowered in _PREMADE_VOICES:
            return _PREMADE_VOICES[lowered]
        # Last-ditch: ask the API for a custom voice in the user's library.
        if self._client is not None:
            try:
                voices = self._client.voices.get_all()
                for v in getattr(voices, "voices", []) or []:
                    if (getattr(v, "name", "") or "").lower() == lowered:
                        return getattr(v, "voice_id", _DEFAULT_VOICE_ID)
            except Exception as exc:
                logger.warning("Voice library lookup failed: %s", exc)
        logger.warning(
            "ElevenLabs voice %r is not a 20-char voice_id and not in the "
            "premade list. Falling back to Rachel.",
            value,
        )
        return _DEFAULT_VOICE_ID

    def synthesize(self, text: str) -> Optional[bytes]:
        if not text or not text.strip():
            return None
        if self._client is None:
            return None
        try:
            stream = self._client.text_to_speech.convert(
                voice_id=self.voice_id,
                output_format="mp3_44100_128",
                text=text,
                model_id="eleven_turbo_v2_5",
            )
            return b"".join(stream)
        except Exception as exc:
            # If somehow the resolved ID is still rejected, fall back to
            # the default once before giving up.
            if self.voice_id != _DEFAULT_VOICE_ID:
                logger.warning("TTS with voice %r failed (%s); retrying with default", self.voice_id, exc)
                self.voice_id = _DEFAULT_VOICE_ID
                try:
                    stream = self._client.text_to_speech.convert(
                        voice_id=self.voice_id,
                        output_format="mp3_44100_128",
                        text=text,
                        model_id="eleven_turbo_v2_5",
                    )
                    return b"".join(stream)
                except Exception as exc2:
                    logger.error("ElevenLabs TTS retry failed: %s", exc2)
                    return None
            logger.error("ElevenLabs TTS failed: %s", exc)
            return None
