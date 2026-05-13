"""Tests for notes/settings/knowledge/emotion stores + their HTTP routes."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from jarvis.ai import EmotionAnalyzer, KnowledgeBase
from jarvis.dashboard import NotesStore, SettingsStore


# ── notes ───────────────────────────────────────────────────────────


def test_notes_add_list_delete(tmp_path):
    store = NotesStore(db_path=tmp_path / "n.db")
    note = store.add("first note", title="t1")
    assert note["id"] and note["content"] == "first note"
    store.add("second note")
    listed = store.list()
    assert len(listed) == 2
    assert store.delete(note["id"]) is True
    assert store.delete("nonexistent") is False
    assert store.count() == 1


# ── settings ────────────────────────────────────────────────────────


def test_settings_defaults_then_update(tmp_path):
    s = SettingsStore(path=tmp_path / "settings.json")
    initial = s.get_all()
    assert initial["theme"] == "dark"
    s.update(theme="light", custom_key=42)
    after = s.get_all()
    assert after["theme"] == "light"
    assert after["custom_key"] == 42
    # Defaults preserved for unset keys.
    assert after["voice_enabled"] is False


# ── knowledge base ──────────────────────────────────────────────────


def test_kb_add_and_search(tmp_path):
    kb = KnowledgeBase(db_path=tmp_path / "kb.db")
    kb.add(title="python tips", content="use list comprehensions", tags=["python"])
    kb.add(title="rust tips", content="prefer match over if let chains")
    results = kb.search("python")
    assert len(results) == 1
    assert "python" in results[0]["title"]


def test_kb_list_all_orders_newest_first(tmp_path):
    kb = KnowledgeBase(db_path=tmp_path / "kb.db")
    kb.add(title="oldest", content="x")
    kb.add(title="middle", content="y")
    kb.add(title="newest", content="z")
    results = kb.list_all()
    assert [r["title"] for r in results] == ["newest", "middle", "oldest"]


# ── emotion (lexicon path; LLM is monkey-patched off) ─────────────


def test_emotion_lexicon_positive():
    with patch.dict("os.environ", {}, clear=True):
        a = EmotionAnalyzer()
        result = a.analyze("I am so happy and amazing things happened")
    assert result.sentiment == "positive"
    assert result.method == "lexicon"


def test_emotion_lexicon_negative():
    with patch.dict("os.environ", {}, clear=True):
        a = EmotionAnalyzer()
        result = a.analyze("everything is terrible and awful")
    assert result.sentiment == "negative"


def test_emotion_empty_text_returns_neutral():
    a = EmotionAnalyzer()
    a._client = None
    assert a.analyze("")  # neutral
    assert a.analyze("   ").sentiment == "neutral"


# ── HTTP integration ────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)  # so default data/ paths land in tmp
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    from jarvis.web.app import create_app

    return create_app().test_client()


def test_route_notes_crud(client):
    r = client.post("/api/dashboard/notes", json={"content": "hello"})
    assert r.status_code == 201
    note_id = r.get_json()["note"]["id"]

    listed = client.get("/api/dashboard/notes").get_json()
    assert any(n["id"] == note_id for n in listed["notes"])

    r = client.delete(f"/api/dashboard/notes?id={note_id}")
    assert r.status_code == 200


def test_route_settings_get_post(client):
    initial = client.get("/api/dashboard/settings").get_json()
    assert initial["settings"]["theme"] == "dark"
    r = client.post("/api/dashboard/settings", json={"theme": "light"})
    assert r.get_json()["settings"]["theme"] == "light"


def test_route_dashboard_stats(client):
    r = client.get("/api/dashboard/stats")
    body = r.get_json()
    assert {"interactions", "notes", "plugins", "people"} == set(body.keys())


def test_route_knowledge_add_then_search(client):
    r = client.post("/api/knowledge/add", json={"title": "k1", "content": "alpha bravo"})
    assert r.status_code == 201
    r = client.get("/api/knowledge/search?q=bravo")
    assert any(item["title"] == "k1" for item in r.get_json()["results"])


def test_route_analyze_emotion(client):
    r = client.post("/api/analyze-emotion", json={"text": "I love this so much"})
    body = r.get_json()
    assert body["sentiment"] == "positive"
    assert "confidence" in body
