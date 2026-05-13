"""Face recognition: encode known faces, identify unknown faces.

Replaces the legacy `face_recognition_system.py` (634 lines) +
`person_identifier.py` (963 lines, never wired) +
`scalable_face_recognition.py` (822 lines, never wired) +
`face_encoding_pipeline.py` (586 lines, never wired) +
`face_recognition_manager.py` (452 lines, CLI-only). Net: ~3,400 lines
of duplication and unused scaffolding collapsed into ~220 lines.

Persistence format is unchanged from legacy: pickled `list[PersonData]`
at `data_dir/encodings_file`. Existing `data/faces/known_faces.pkl`
files load directly.
"""

from __future__ import annotations

import glob
import logging
import os
import pickle
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

_IMAGE_GLOBS = ("*.jpg", "*.jpeg", "*.png", "*.bmp")


@dataclass
class PersonData:
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    profession: Optional[str] = None
    image_paths: list[str] = field(default_factory=list)
    face_encodings: list[np.ndarray] = field(default_factory=list)
    additional_data: dict[str, Any] = field(default_factory=dict)

    @property
    def primary_image_path(self) -> Optional[str]:
        return self.image_paths[0] if self.image_paths else None


@dataclass
class RecognitionResult:
    person: Optional[PersonData]
    confidence: float
    matched: bool
    processing_time: float
    error_message: Optional[str] = None


class FaceRecognitionEngine:
    """Stateful face DB + matcher.

    `tolerance` is a *confidence floor* (0–1). A match is accepted only
    when `1 - face_distance >= tolerance`. Legacy default was 0.6;
    web server lowered it to 0.5 for more permissive matching.
    """

    def __init__(
        self,
        data_dir: str | Path = "data/faces",
        encodings_file: str = "known_faces.pkl",
        tolerance: float = 0.5,
    ):
        self.data_dir = Path(data_dir)
        self.encodings_path = self.data_dir / encodings_file
        self.tolerance = tolerance
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.known_faces: list[PersonData] = []
        self.stats = {"successful_matches": 0, "failed_matches": 0, "processing_times": []}
        self._face_recognition = _import_face_recognition()
        self.load()

    def load(self) -> None:
        """Load `known_faces` from pickle.

        Handles three formats:
          - v2 native (`list[PersonData]` from jarvis.vision.faces)
          - v1 dataclass (`PersonData` defined under the legacy
            `modules.vision.*` module path) — remapped at unpickle time
          - legacy dict format (`{name: encoding}`) — migrated to PersonData
        """
        if not self.encodings_path.exists():
            logger.info("No existing face DB at %s", self.encodings_path)
            return
        try:
            with self.encodings_path.open("rb") as fh:
                data = _LegacyCompatUnpickler(fh).load()
        except Exception as exc:
            logger.exception("Failed to load %s: %s", self.encodings_path, exc)
            return
        if isinstance(data, dict):
            # Earliest legacy format: {name: encoding}.
            self.known_faces = [
                PersonData(name=name, face_encodings=[encoding])
                for name, encoding in data.items()
            ]
        else:
            self.known_faces = list(data)
        logger.info("Loaded %d people from %s", len(self.known_faces), self.encodings_path)

    def save(self) -> None:
        with self.encodings_path.open("wb") as fh:
            pickle.dump(self.known_faces, fh)

    def encode(self, image_path: str | Path) -> Optional[np.ndarray]:
        """Return the first face encoding in `image_path`, or None if no face found."""
        if self._face_recognition is None:
            return None
        try:
            image = self._face_recognition.load_image_file(str(image_path))
            encodings = self._face_recognition.face_encodings(image)
            return encodings[0] if encodings else None
        except Exception as exc:
            logger.warning("Failed to encode %s: %s", image_path, exc)
            return None

    def recognize_face(self, image_path: str | Path) -> RecognitionResult:
        """Match the face in `image_path` against the known DB."""
        start = time.monotonic()
        if self._face_recognition is None:
            return RecognitionResult(None, 0.0, False, 0.0, "face_recognition library unavailable")

        unknown_encoding = self.encode(image_path)
        if unknown_encoding is None:
            return RecognitionResult(None, 0.0, False, time.monotonic() - start, "No face found in image")

        best_match: Optional[PersonData] = None
        best_confidence = 0.0
        for person in self.known_faces:
            if not person.face_encodings:
                continue
            distances = self._face_recognition.face_distance(person.face_encodings, unknown_encoding)
            confidence = 1.0 - float(distances.min())
            if confidence > best_confidence and confidence >= self.tolerance:
                best_confidence = confidence
                best_match = person

        elapsed = time.monotonic() - start
        self.stats["processing_times"].append(elapsed)
        if best_match:
            self.stats["successful_matches"] += 1
            return RecognitionResult(best_match, best_confidence, True, elapsed)
        self.stats["failed_matches"] += 1
        return RecognitionResult(None, best_confidence, False, elapsed, "No matching face found")

    def add_person(
        self,
        name: str,
        image_paths: list[str | Path],
        metadata: Optional[dict] = None,
    ) -> Optional[PersonData]:
        """Register a person from one or more image paths. Saves to disk."""
        encodings = [enc for path in image_paths if (enc := self.encode(path)) is not None]
        if not encodings:
            logger.warning("No face encodings extracted for %s", name)
            return None
        metadata = metadata or {}
        person = PersonData(
            name=name,
            age=metadata.get("age"),
            gender=metadata.get("gender"),
            profession=metadata.get("profession"),
            image_paths=[str(p) for p in image_paths],
            face_encodings=encodings,
            additional_data=metadata,
        )
        self.known_faces.append(person)
        self.save()
        return person

    def load_from_excel(self, excel_file: str | Path, images_folder: Optional[str | Path] = None) -> int:
        """Bulk-ingest from an Excel sheet with `Name` + `Image` columns.

        `Image` may be a single file path or a folder containing many images
        for the same person. Returns the count of people added.
        """
        import pandas as pd

        df = pd.read_excel(excel_file)
        missing = {"Name", "Image"} - set(df.columns)
        if missing:
            raise ValueError(f"Excel missing required columns: {missing}")

        added = 0
        for _, row in df.iterrows():
            person = self._person_from_row(row, images_folder)
            if person is not None:
                self.known_faces.append(person)
                added += 1
        if added:
            self.save()
        return added

    def _person_from_row(self, row, images_folder) -> Optional[PersonData]:
        name = str(row["Name"]).strip()
        if not name or name.lower() in {"nan", "none"}:
            return None
        image_ref = str(row["Image"]).strip()
        if not image_ref or image_ref.lower() in {"nan", "none"}:
            return None
        if images_folder and not os.path.isabs(image_ref):
            image_ref = os.path.join(str(images_folder), image_ref)

        if os.path.isdir(image_ref):
            image_files: list[str] = []
            for pattern in _IMAGE_GLOBS:
                image_files.extend(glob.glob(os.path.join(image_ref, pattern)))
        elif os.path.exists(image_ref):
            image_files = [image_ref]
        else:
            logger.warning("Image not found: %s", image_ref)
            return None

        encodings = [enc for f in image_files if (enc := self.encode(f)) is not None]
        if not encodings:
            return None

        import pandas as pd  # local import to avoid mandatory dep at import time

        extras = {col: row[col] for col in row.index if col not in {"Name", "Image"} and pd.notna(row[col])}
        return PersonData(
            name=name,
            age=extras.get("Age"),
            gender=extras.get("Gender"),
            profession=extras.get("Profession"),
            image_paths=image_files,
            face_encodings=encodings,
            additional_data=extras,
        )

    def get_statistics(self) -> dict:
        times = self.stats["processing_times"]
        return {
            "total_people": len(self.known_faces),
            "successful_matches": self.stats["successful_matches"],
            "failed_matches": self.stats["failed_matches"],
            "average_processing_time": (sum(times) / len(times)) if times else 0.0,
        }


class _LegacyCompatUnpickler(pickle.Unpickler):
    """Map legacy `modules.vision.*.PersonData` references onto v2.

    The original J.A.R.V.I.S kept its `PersonData` dataclass under
    `modules.vision.face_recognition_system`. Pickles produced by that
    code carry the old qualified class name; loading them in v2 raises
    `ModuleNotFoundError: No module named 'modules'`. This subclass
    intercepts the class lookup and substitutes our v2 `PersonData`.
    Field shape is identical, so the unpickled instances are valid.
    """

    _LEGACY_PREFIXES = ("modules.vision",)

    def find_class(self, module: str, name: str):
        if name == "PersonData" and any(module.startswith(p) for p in self._LEGACY_PREFIXES):
            return PersonData
        return super().find_class(module, name)


def _import_face_recognition():
    """Import dlib-based `face_recognition` lazily; return None if unavailable.

    Tests don't require dlib — they monkey-patch the engine's
    `_face_recognition` attribute with a mock module.
    """
    try:
        import face_recognition  # type: ignore

        return face_recognition
    except ImportError:
        logger.warning("face_recognition library not installed — face matching disabled")
        return None


def format_recognition_result(result: RecognitionResult) -> str:
    if not result.matched or result.person is None:
        return result.error_message or "I couldn't recognize this person."
    person = result.person
    parts = [f"This is {person.name}"]
    if person.profession:
        parts.append(f", a {person.profession}")
    if person.age:
        parts.append(f", age {person.age}")
    parts.append(f". Confidence: {result.confidence * 100:.0f}%.")
    return "".join(parts)
