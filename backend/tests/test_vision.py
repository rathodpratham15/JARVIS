"""Vision tests run without dlib/face_recognition installed.

The engine's `_face_recognition` attribute is a lazy import that we
replace with a fake module. This isolates the test from the heavy
binary dependency while still exercising the matching/threshold logic.
"""

from __future__ import annotations

import pickle
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pytest

from jarvis.vision import (
    FaceRecognitionEngine,
    PersonData,
    SceneAnalyzer,
    format_recognition_result,
)


class _FakeFaceRecognition:
    """Minimal stand-in for the dlib-backed `face_recognition` library."""

    def __init__(self, encoding_for_path: dict[str, np.ndarray]):
        self._encoding_for_path = encoding_for_path

    def load_image_file(self, path):
        return f"<image:{path}>"

    def face_encodings(self, image):
        path = image.replace("<image:", "").rstrip(">")
        encoding = self._encoding_for_path.get(path)
        return [encoding] if encoding is not None else []

    def face_distance(self, known_encodings, unknown):
        return np.array([np.linalg.norm(known - unknown) for known in known_encodings])


def _engine_with_known(tmp_path, known: dict[str, np.ndarray]) -> FaceRecognitionEngine:
    e = FaceRecognitionEngine(data_dir=tmp_path, tolerance=0.5)
    fake = _FakeFaceRecognition({})
    e._face_recognition = fake
    for name, vec in known.items():
        person_path = str(tmp_path / f"{name}.jpg")
        fake._encoding_for_path[person_path] = vec
        e.known_faces.append(PersonData(name=name, image_paths=[person_path], face_encodings=[vec]))
    return e


def test_recognize_match_above_threshold(tmp_path):
    alice_vec = np.zeros(128)
    e = _engine_with_known(tmp_path, {"Alice": alice_vec})
    test_image = str(tmp_path / "test.jpg")
    e._face_recognition._encoding_for_path[test_image] = alice_vec.copy()  # identical → distance 0
    result = e.recognize_face(test_image)
    assert result.matched is True
    assert result.person.name == "Alice"
    assert result.confidence >= 0.99


def test_recognize_below_threshold_returns_no_match(tmp_path):
    alice_vec = np.zeros(128)
    e = _engine_with_known(tmp_path, {"Alice": alice_vec})
    test_image = str(tmp_path / "test.jpg")
    far_vec = np.ones(128) * 0.6  # distance ~6.78, confidence < 0
    e._face_recognition._encoding_for_path[test_image] = far_vec
    result = e.recognize_face(test_image)
    assert result.matched is False
    assert result.person is None


def test_recognize_no_face_in_image(tmp_path):
    e = _engine_with_known(tmp_path, {"Alice": np.zeros(128)})
    test_image = str(tmp_path / "blank.jpg")
    # No encoding registered → empty face_encodings result.
    result = e.recognize_face(test_image)
    assert result.matched is False
    assert "No face" in result.error_message


def test_picks_closest_match_when_multiple_above_threshold(tmp_path):
    alice = np.zeros(128)
    bob = np.zeros(128)
    bob[0] = 0.1  # slight perturbation
    e = _engine_with_known(tmp_path, {"Alice": alice, "Bob": bob})
    probe = np.zeros(128)
    probe[0] = 0.05  # closer to Alice
    test_image = str(tmp_path / "probe.jpg")
    e._face_recognition._encoding_for_path[test_image] = probe
    result = e.recognize_face(test_image)
    assert result.matched is True
    assert result.person.name == "Alice"


def test_save_and_reload_round_trip(tmp_path):
    e1 = FaceRecognitionEngine(data_dir=tmp_path, tolerance=0.5)
    e1.known_faces.append(PersonData(name="X", face_encodings=[np.zeros(128)]))
    e1.save()

    e2 = FaceRecognitionEngine(data_dir=tmp_path, tolerance=0.5)
    assert len(e2.known_faces) == 1
    assert e2.known_faces[0].name == "X"


def test_legacy_dict_format_migrates(tmp_path):
    legacy = {"Alice": np.zeros(128), "Bob": np.ones(128)}
    encodings_path = tmp_path / "known_faces.pkl"
    with encodings_path.open("wb") as fh:
        pickle.dump(legacy, fh)

    e = FaceRecognitionEngine(data_dir=tmp_path, tolerance=0.5)
    names = sorted(p.name for p in e.known_faces)
    assert names == ["Alice", "Bob"]


def test_get_statistics(tmp_path):
    e = _engine_with_known(tmp_path, {"Alice": np.zeros(128)})
    stats = e.get_statistics()
    assert stats["total_people"] == 1
    assert stats["successful_matches"] == 0


def test_format_recognition_result_match():
    person = PersonData(name="Alice", profession="engineer", age=30)
    from jarvis.vision import RecognitionResult

    result = RecognitionResult(person, 0.85, True, 0.1)
    out = format_recognition_result(result)
    assert "Alice" in out and "engineer" in out and "85%" in out


def test_scene_analyzer_no_provider_returns_stub(tmp_path):
    image_file = tmp_path / "img.jpg"
    image_file.write_bytes(b"\xff\xd8")  # not a real JPEG, but path exists
    with patch.dict("os.environ", {}, clear=True):
        analyzer = SceneAnalyzer()
        result = analyzer.describe_scene(str(image_file))
    assert "not configured" in result.description.lower()
    assert result.model_used == "none"


def test_scene_analyzer_missing_file_returns_error(tmp_path):
    analyzer = SceneAnalyzer()
    result = analyzer.describe_scene(str(tmp_path / "does_not_exist.jpg"))
    assert "not found" in result.description.lower()
