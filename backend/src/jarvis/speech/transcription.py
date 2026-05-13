"""Speech-to-text with an automatic fallback chain across providers.

Order of preference (each step skipped if its credentials are missing):
  1. Whichever cloud provider `JARVIS_STT_PROVIDER` selects, or both
     OpenAI and Groq tried in turn if both keys are set. (Groq is
     compelling: free tier, very fast `whisper-large-v3`.)
  2. Local `openai-whisper` model — runs offline, ~150 MB on first use.
     Force this step first with `JARVIS_WHISPER_LOCAL=1`.
  3. Google Web Speech (free, no key) via `speech_recognition`.

If a step raises (rate limit, network, auth, model load), the next step
is tried automatically. The chain only returns `None` when every
configured step has failed.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable, Optional

from openai import OpenAI

from jarvis.core.providers import PROVIDERS, resolve_api_key

logger = logging.getLogger(__name__)


def _flag(name: str) -> bool:
    return os.getenv(name, "").lower() in {"1", "true", "yes"}


def _short(exc: BaseException) -> str:
    msg = str(exc)
    return msg[:120] + ("..." if len(msg) > 120 else "")


class Transcriber:
    def __init__(self, prefer_local: Optional[bool] = None) -> None:
        self.prefer_local = _flag("JARVIS_WHISPER_LOCAL") if prefer_local is None else prefer_local
        self._cloud_clients = self._make_cloud_clients()
        self._local_model = None

    def _make_cloud_clients(self) -> list[tuple[str, OpenAI, str]]:
        """Return [(label, client, model), ...] in preferred order.

        Honors `JARVIS_STT_PROVIDER=openai|groq` if set; otherwise tries
        every provider whose API key is present, OpenAI first.
        """
        if self.prefer_local:
            return []
        explicit = (os.getenv("JARVIS_STT_PROVIDER") or "").strip().lower()
        order = [explicit] if explicit in PROVIDERS else ["openai", "groq"]
        clients: list[tuple[str, OpenAI, str]] = []
        for name in order:
            provider = PROVIDERS[name]
            api_key = resolve_api_key(provider)
            if not api_key:
                continue
            kwargs: dict = {"api_key": api_key}
            if provider.base_url:
                kwargs["base_url"] = provider.base_url
            model = os.getenv("JARVIS_STT_MODEL") or provider.default_stt_model
            clients.append((name, OpenAI(**kwargs), model))
        return clients

    def transcribe(self, audio_path: str | Path) -> Optional[str]:
        path = Path(audio_path)
        if not path.exists():
            logger.warning("Audio file not found: %s", path)
            return None

        steps: list[tuple[str, Callable[[Path], Optional[str]]]] = []
        for label, client, model in self._cloud_clients:
            steps.append((f"{label} ({model})", lambda p, c=client, m=model: self._cloud(p, c, m)))
        steps.append(("local Whisper", self._local))
        steps.append(("Google Speech", self._google))

        last_error: Optional[str] = None
        for label, fn in steps:
            try:
                text = fn(path)
            except Exception as exc:
                logger.warning("%s raised: %s — trying next provider", label, _short(exc))
                last_error = str(exc)
                continue
            if text:
                return text
        if last_error:
            logger.warning("All transcription providers failed (last: %s)", _short(Exception(last_error)))
        return None

    # ── providers ──────────────────────────────────────────────────────

    @staticmethod
    def _cloud(path: Path, client: OpenAI, model: str) -> Optional[str]:
        try:
            with path.open("rb") as fh:
                response = client.audio.transcriptions.create(model=model, file=fh)
            return (response.text or "").strip()
        except Exception as exc:
            logger.warning("Cloud transcription failed (%s); falling back", _short(exc))
            return None

    def _local(self, path: Path) -> Optional[str]:
        model = self._load_local()
        if model is None:
            return None
        try:
            result = model.transcribe(str(path))
            return (result.get("text") or "").strip()
        except Exception as exc:
            logger.warning("Local Whisper failed (%s); falling back", _short(exc))
            return None

    def _load_local(self):
        if self._local_model is not None:
            return self._local_model
        try:
            import whisper  # `openai-whisper`
        except ImportError:
            logger.info("openai-whisper not installed — skipping local transcription")
            return None
        model_name = os.getenv("JARVIS_WHISPER_MODEL", "base")
        logger.info("Loading local Whisper model %r (first call may download ~150 MB)", model_name)
        self._local_model = whisper.load_model(model_name)
        return self._local_model

    @staticmethod
    def _google(path: Path) -> Optional[str]:
        try:
            import speech_recognition as sr  # type: ignore
        except ImportError:
            return None
        recognizer = sr.Recognizer()
        with sr.AudioFile(str(path)) as source:
            audio = recognizer.record(source)
        try:
            return recognizer.recognize_google(audio).strip()
        except sr.UnknownValueError:
            logger.info("Google Speech could not understand audio")
            return None
        except sr.RequestError as exc:
            logger.warning("Google Speech request failed: %s", exc)
            return None
