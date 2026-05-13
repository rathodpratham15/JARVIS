"""Tests for the scene history store + the routes that use it."""

from __future__ import annotations

import io

import pytest

from jarvis.vision import SceneHistoryStore


def test_record_and_recent(tmp_path):
    s = SceneHistoryStore(db_path=tmp_path / "h.db")
    s.record({"description": "a kitchen", "objects": ["fridge"], "confidence": 0.8}, image_url="/c/1.jpg")
    s.record({"description": "a beach", "objects": ["sand", "wave"], "confidence": 0.9})
    history = s.recent(limit=5)
    assert len(history) == 2
    assert history[0]["results"]["scene_description"] == "a beach"
    assert history[0]["results"]["objects"] == ["sand", "wave"]
    assert history[1]["image_url"] == "/c/1.jpg"


def test_stats_shape(tmp_path):
    s = SceneHistoryStore(db_path=tmp_path / "h.db")
    s.record({"description": "x", "objects": [], "confidence": 0.5})
    s.record({"description": "y", "objects": [], "confidence": 0.7})
    stats = s.stats()
    assert stats["total_analyses"] == 2
    assert stats["scene_analyses"] == 2
    assert stats["text_recognitions"] == 0
    assert 0.55 < stats["average_confidence"] < 0.65


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    from jarvis.web.app import create_app

    return create_app().test_client()


def test_route_vision_history_empty(client):
    r = client.get("/api/vision/history")
    assert r.status_code == 200
    assert r.get_json()["history"] == []


def test_route_vision_stats_zero(client):
    r = client.get("/api/vision/stats")
    body = r.get_json()
    assert body["stats"]["total_analyses"] == 0


def test_route_face_export(client):
    r = client.post("/api/face/export")
    body = r.get_json()
    assert r.status_code == 200
    assert body["success"] is True
    assert body["people"] == 0  # empty face DB


def test_route_vision_analyze_with_no_provider_still_persists_history(client):
    """Even in stub mode (no API key), the analysis should record history so the dashboard isn't empty."""
    fake_image = io.BytesIO(b"\xff\xd8\xff\xe0fake-jpeg-bytes")
    fake_image.name = "test.jpg"
    r = client.post(
        "/api/vision/analyze",
        data={"image": (fake_image, "test.jpg")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    body = r.get_json()
    assert "id" in body and "image_url" in body
    history = client.get("/api/vision/history").get_json()["history"]
    assert len(history) == 1
    assert history[0]["id"] == body["id"]
