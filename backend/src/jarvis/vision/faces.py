"""Face recognition: encode known faces, identify unknown faces.

Uses InsightFace (ONNX backend) instead of dlib/face_recognition.
InsightFace ships pre-compiled ONNX wheels → works on Railway (Linux)
without any C++ compilation. dlib could not compile on Railway at all.

Persistence format is unchanged: pickled `list[PersonData]` at
`data_dir/encodings_file`. Existing dlib (128-dim) encodings are skipped
with a warning — those people need to be re-registered once.

Encodings are 512-dim L2-normalised vectors (InsightFace normed_embedding).
Matching uses dot-product cosine similarity (equivalent because normalised).
Tolerance meaning: minimum cosine similarity to accept a match (0–1).
Typical good range: 0.35 (permissive) – 0.55 (strict). Default: 0.40.
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
_INSIGHTFACE_EMBEDDING_DIM = 512


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
    """Stateful face DB + matcher backed by InsightFace.

    `tolerance` is the minimum cosine similarity (0–1) required to accept
    a match. 0.40 is a reasonable default — raise it to reduce false positives.
    """

    def __init__(
        self,
        data_dir: str | Path = "data/faces",
        encodings_file: str = "known_faces.pkl",
        tolerance: float = 0.40,
    ):
        self.data_dir = Path(data_dir)
        self.encodings_path = self.data_dir / encodings_file
        self.tolerance = tolerance
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.known_faces: list[PersonData] = []
        self.stats = {"successful_matches": 0, "failed_matches": 0, "processing_times": []}
        self._app = _init_insightface()
        self.load()

    # ── persistence ────────────────────────────────────────────────────────

    def load(self) -> None:
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
            self.known_faces = [
                PersonData(name=name, face_encodings=[encoding])
                for name, encoding in data.items()
            ]
        else:
            self.known_faces = list(data)

        # Drop dlib 128-dim encodings — incompatible with InsightFace 512-dim
        stale = []
        for person in self.known_faces:
            valid = [e for e in person.face_encodings if e.shape == (_INSIGHTFACE_EMBEDDING_DIM,)]
            if len(valid) < len(person.face_encodings):
                stale.append(person.name)
            person.face_encodings = valid
        if stale:
            logger.warning(
                "Dropped legacy dlib encodings for: %s — please re-register these people.",
                ", ".join(stale),
            )
        logger.info("Loaded %d people from %s", len(self.known_faces), self.encodings_path)

    def save(self) -> None:
        with self.encodings_path.open("wb") as fh:
            pickle.dump(self.known_faces, fh)

    # ── encoding ───────────────────────────────────────────────────────────

    def encode(self, image_path: str | Path) -> Optional[np.ndarray]:
        """Return the first face embedding in `image_path`, or None."""
        if self._app is None:
            return None
        try:
            import cv2
            img = cv2.imread(str(image_path))
            if img is None:
                logger.warning("cv2 could not read image: %s", image_path)
                return None
            faces = self._app.get(img)
            if not faces:
                return None
            return faces[0].normed_embedding.astype(np.float32)
        except Exception as exc:
            logger.warning("Failed to encode %s: %s", image_path, exc)
            return None

    # ── recognition ────────────────────────────────────────────────────────

    def recognize_face(self, image_path: str | Path) -> RecognitionResult:
        start = time.monotonic()
        if self._app is None:
            return RecognitionResult(None, 0.0, False, 0.0, "InsightFace not available")

        unknown_emb = self.encode(image_path)
        if unknown_emb is None:
            return RecognitionResult(None, 0.0, False, time.monotonic() - start, "No face found in image")

        best_match: Optional[PersonData] = None
        best_confidence = 0.0
        for person in self.known_faces:
            valid = [e for e in person.face_encodings if e.shape == (_INSIGHTFACE_EMBEDDING_DIM,)]
            if not valid:
                continue
            # Embeddings are L2-normalised → dot product = cosine similarity
            sims = [float(np.dot(unknown_emb, enc)) for enc in valid]
            confidence = max(sims)
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

    # ── management ─────────────────────────────────────────────────────────

    def add_person(
        self,
        name: str,
        image_paths: list[str | Path],
        metadata: Optional[dict] = None,
    ) -> Optional[PersonData]:
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

    def remove_person(self, name: str) -> bool:
        idx = next(
            (i for i, p in enumerate(self.known_faces) if p.name.lower() == name.lower()),
            None,
        )
        if idx is None:
            return False
        self.known_faces.pop(idx)
        self.save()
        logger.info("FaceRecognitionEngine: removed person %s", name)
        return True

    def load_from_excel(self, excel_file: str | Path, images_folder: Optional[str | Path] = None) -> int:
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

        import pandas as pd
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


# ── legacy pickle compat ───────────────────────────────────────────────────

class _LegacyCompatUnpickler(pickle.Unpickler):
    _LEGACY_PREFIXES = ("modules.vision",)

    def find_class(self, module: str, name: str):
        if name == "PersonData" and any(module.startswith(p) for p in self._LEGACY_PREFIXES):
            return PersonData
        return super().find_class(module, name)


# ── InsightFace init ───────────────────────────────────────────────────────

def _init_insightface():
    """Initialise InsightFace FaceAnalysis app. Returns None if unavailable."""
    try:
        from insightface.app import FaceAnalysis  # type: ignore

        # Store models inside the project data dir so Railway's ephemeral FS
        # doesn't re-download on every cold start (mount a volume at data/).
        model_root = os.getenv("INSIGHTFACE_HOME", "data/.insightface")
        os.makedirs(model_root, exist_ok=True)
        os.environ.setdefault("INSIGHTFACE_HOME", model_root)

        model_name = os.getenv("INSIGHTFACE_MODEL", "buffalo_sc")
        app = FaceAnalysis(name=model_name, providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace initialised (model=%s)", model_name)
        return app
    except ImportError:
        logger.warning("insightface not installed — face matching disabled")
        return None
    except Exception as exc:
        logger.warning("InsightFace init failed: %s", exc)
        return None


# ── helpers ────────────────────────────────────────────────────────────────

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
