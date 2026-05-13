"""Local microphone capture + speaker playback for the CLI voice mode.

Web mode (the React frontend) does its own capture/playback in the
browser — this module is only used when `jarvis --voice` is invoked
from a terminal on the same machine as the backend.
"""

from __future__ import annotations

import logging
import os
import platform
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class Microphone:
    """Push-to-talk recorder. Captures `duration` seconds and saves WAV."""

    def __init__(self, sample_rate: int = 16000, channels: int = 1) -> None:
        self.sample_rate = sample_rate
        self.channels = channels
        self._recognizer = self._make_recognizer()

    @staticmethod
    def _make_recognizer():
        try:
            import speech_recognition as sr  # type: ignore

            return sr.Recognizer()
        except ImportError:
            logger.warning("speech_recognition not installed — voice input disabled")
            return None

    def is_available(self) -> bool:
        return self._recognizer is not None

    def record(self, duration: float = 5.0) -> Optional[Path]:
        """Record from default mic, return path to a temp WAV file."""
        if self._recognizer is None:
            return None
        try:
            import speech_recognition as sr  # type: ignore

            with sr.Microphone(sample_rate=self.sample_rate) as source:
                self._recognizer.adjust_for_ambient_noise(source, duration=0.3)
                audio = self._recognizer.record(source, duration=duration)
        except Exception as exc:
            logger.exception("Microphone capture failed: %s", exc)
            return None

        fd, path = tempfile.mkstemp(suffix=".wav", prefix="jarvis_mic_")
        os.close(fd)
        Path(path).write_bytes(audio.get_wav_data())
        return Path(path)


class Speaker:
    """Plays text via ElevenLabs (cloud) or pyttsx3 (offline) fallback."""

    def __init__(self, transcriber=None, synthesizer=None) -> None:
        self.synthesizer = synthesizer  # jarvis.speech.Synthesizer
        self._pyttsx3_engine = self._init_pyttsx3() if synthesizer is None or not synthesizer._client else None

    @staticmethod
    def _init_pyttsx3():
        try:
            import pyttsx3  # type: ignore

            engine = pyttsx3.init()
            engine.setProperty("rate", 175)
            return engine
        except Exception as exc:
            logger.warning("pyttsx3 unavailable: %s", exc)
            return None

    def speak(self, text: str) -> None:
        """Speak `text` aloud. Tries ElevenLabs first, then pyttsx3."""
        if not text or not text.strip():
            return
        if self.synthesizer is not None and self.synthesizer._client is not None:
            audio_bytes = self.synthesizer.synthesize(text)
            if audio_bytes:
                _play_mp3(audio_bytes)
                return
        if self._pyttsx3_engine is not None:
            try:
                self._pyttsx3_engine.say(text)
                self._pyttsx3_engine.runAndWait()
            except Exception as exc:
                logger.warning("pyttsx3 playback failed: %s", exc)


def _play_mp3(audio_bytes: bytes) -> None:
    """Write MP3 bytes to a temp file and play via the OS's audio command."""
    fd, path = tempfile.mkstemp(suffix=".mp3", prefix="jarvis_tts_")
    os.close(fd)
    try:
        Path(path).write_bytes(audio_bytes)
        system = platform.system()
        if system == "Darwin":
            subprocess.run(["afplay", path], check=False)
        elif system == "Linux":
            for cmd in (["mpg123", "-q", path], ["ffplay", "-nodisp", "-autoexit", path], ["paplay", path]):
                try:
                    subprocess.run(cmd, check=False)
                    break
                except FileNotFoundError:
                    continue
        elif system == "Windows":
            os.startfile(path)  # type: ignore[attr-defined]
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
