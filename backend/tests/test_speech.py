"""Speech tests use mocked network clients."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from jarvis.speech import Synthesizer, Transcriber


def test_transcriber_no_provider_returns_none(tmp_path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"\x00")
    with patch.dict("os.environ", {}, clear=True):
        t = Transcriber()
        assert t.transcribe(audio) is None


def test_transcriber_missing_file_returns_none():
    with patch.dict("os.environ", {"OPENAI_API_KEY": "fake"}, clear=False):
        t = Transcriber()
        assert t.transcribe("/nonexistent/path.wav") is None


def test_transcriber_calls_openai(tmp_path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"\x00")
    fake_response = SimpleNamespace(text="hello world")
    fake_client = MagicMock()
    fake_client.audio.transcriptions.create.return_value = fake_response

    with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-fake"}, clear=False):
        t = Transcriber()
        t._cloud_clients = [("openai", fake_client, "whisper-1")]
        result = t.transcribe(audio)
    assert result == "hello world"
    fake_client.audio.transcriptions.create.assert_called_once()


def test_transcriber_falls_back_when_first_provider_429s(tmp_path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"\x00")
    failing = MagicMock()
    failing.audio.transcriptions.create.side_effect = RuntimeError("429 quota exceeded")
    succeeding = MagicMock()
    succeeding.audio.transcriptions.create.return_value = SimpleNamespace(text="from groq")

    with patch.dict("os.environ", {"OPENAI_API_KEY": "x", "GROQ_API_KEY": "y"}, clear=False):
        t = Transcriber()
        t._cloud_clients = [
            ("openai", failing, "whisper-1"),
            ("groq", succeeding, "whisper-large-v3"),
        ]
        result = t.transcribe(audio)
    assert result == "from groq"
    failing.audio.transcriptions.create.assert_called_once()
    succeeding.audio.transcriptions.create.assert_called_once()


def test_provider_selection_groq_via_env():
    """If JARVIS_LLM_PROVIDER=groq, LLMCore wires up the Groq base URL."""
    from jarvis.core.providers import select_provider

    with patch.dict("os.environ", {"JARVIS_LLM_PROVIDER": "groq", "GROQ_API_KEY": "gsk-fake"}, clear=False):
        provider = select_provider()
    assert provider.name == "groq"
    assert provider.base_url == "https://api.groq.com/openai/v1"
    assert provider.default_chat_model.startswith("llama")


def test_synthesizer_no_key_returns_none():
    with patch.dict("os.environ", {}, clear=True):
        s = Synthesizer()
        assert s.synthesize("hello") is None


def test_synthesizer_empty_text_returns_none():
    s = Synthesizer(api_key="fake")
    assert s.synthesize("") is None
    assert s.synthesize("   ") is None


def test_synthesizer_calls_elevenlabs():
    s = Synthesizer(api_key="fake")
    fake_client = MagicMock()
    fake_client.text_to_speech.convert.return_value = iter([b"\xff\xfb", b"\x90\x44"])
    s._client = fake_client
    result = s.synthesize("hi there")
    assert result == b"\xff\xfb\x90\x44"
    fake_client.text_to_speech.convert.assert_called_once()
