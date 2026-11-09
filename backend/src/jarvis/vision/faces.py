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
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Embedding encode cache: avoids re-running ONNX inference on the same image.
# Key: (absolute_path, mtime_ns)  →  Value: 512-dim float32 embedding
# Bounded to 512 entries; oldest entry dropped when full.
# ---------------------------------------------------------------------------
_ENCODE_CACHE: dict[tuple[str, int], np.ndarray] = {}
_ENCODE_CACHE_MAX = 512

# ---------------------------------------------------------------------------
# Recognition cache: skips the linear cosine-sim scan when the same face
# appears in back-to-back frames (e.g. live camera feed).
# Key: rounded embedding fingerprint  →  (RecognitionResult, expiry_monotonic)
# TTL defaults to 4 s; tune with JARVIS_RECOG_CACHE_TTL env var.
# ---------------------------------------------------------------------------
_RECOG_CACHE: dict[tuple, tuple] = {}
_RECOG_CACHE_TTL = float(os.getenv("JARVIS_RECOG_CACHE_TTL", "4"))

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


# Module-level InsightFace singleton — models are loaded once and shared
# across all per-user FaceRecognitionEngine instances.  Loading the ONNX
# models is expensive (~1-2 s); running inference on them is cheap.
_SHARED_INSIGHT_APP = None
_SHARED_INSIGHT_LOCK = None

def _get_shared_app():
    """Return the module-level InsightFace app, initialising it on first call."""
    global _SHARED_INSIGHT_APP, _SHARED_INSIGHT_LOCK
    import threading
    if _SHARED_INSIGHT_LOCK is None:
        _SHARED_INSIGHT_LOCK = threading.Lock()
    with _SHARED_INSIGHT_LOCK:
        if _SHARED_INSIGHT_APP is None:
            _SHARED_INSIGHT_APP = _init_insightface()
    return _SHARED_INSIGHT_APP


class FaceRecognitionEngine:
    """Per-user face DB + matcher backed by a shared InsightFace model.

    Each user/organizer gets their own isolated data_dir containing
    known_faces.pkl.  The InsightFace ONNX models are loaded once globally
    and shared — only the face embedding data is per-user.

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
        self._app = _get_shared_app()  # shared singleton — no model reload
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
        """Return the first face embedding in `image_path`, or None.

        Results are cached by (absolute_path, mtime_ns) so repeated calls on
        the same unchanged file skip ONNX inference entirely.
        """
        if self._app is None:
            return None

        abs_path = str(Path(image_path).resolve())
        try:
            mtime_ns = Path(abs_path).stat().st_mtime_ns
        except OSError:
            mtime_ns = 0

        cache_key = (abs_path, mtime_ns)
        if cache_key in _ENCODE_CACHE:
            return _ENCODE_CACHE[cache_key]

        try:
            import cv2
            img = cv2.imread(abs_path)
            if img is None:
                logger.warning("cv2 could not read image: %s", abs_path)
                return None
            faces = self._app.get(img)
            if not faces:
                return None
            embedding = faces[0].normed_embedding.astype(np.float32)
        except Exception as exc:
            logger.warning("Failed to encode %s: %s", abs_path, exc)
            return None

        if len(_ENCODE_CACHE) >= _ENCODE_CACHE_MAX:
            _ENCODE_CACHE.pop(next(iter(_ENCODE_CACHE)))
        _ENCODE_CACHE[cache_key] = embedding
        return embedding

    # ── recognition ────────────────────────────────────────────────────────

    def recognize_face(self, image_path: str | Path) -> RecognitionResult:
        start = time.monotonic()
        if self._app is None:
            return RecognitionResult(None, 0.0, False, 0.0, "InsightFace not available")

        unknown_emb = self.encode(image_path)
        if unknown_emb is None:
            return RecognitionResult(None, 0.0, False, time.monotonic() - start, "No face found in image")

        # Recognition cache: consecutive frames of the same person skip the
        # O(n) cosine-sim scan. Fingerprint = top-8 dims rounded to 1 dp.
        recog_key = tuple(np.round(unknown_emb[:8], 1).tolist())
        now = time.monotonic()
        if recog_key in _RECOG_CACHE:
            cached_result, expiry = _RECOG_CACHE[recog_key]
            if now < expiry:
                return cached_result

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
            result = RecognitionResult(best_match, best_confidence, True, elapsed)
        else:
            self.stats["failed_matches"] += 1
            result = RecognitionResult(None, best_confidence, False, elapsed, "No matching face found")

        _RECOG_CACHE[recog_key] = (result, now + _RECOG_CACHE_TTL)
        return result

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

def _build_ort_providers() -> list:
    """Return the best available ONNX Runtime execution providers.

    Priority (highest-performance first):
      1. TensorrtExecutionProvider  — NVIDIA GPU + TensorRT installed
         Engines are cached to disk so the first run compiles once;
         subsequent runs load the cached engine in milliseconds.
      2. CUDAExecutionProvider      — NVIDIA GPU, no TensorRT required
      3. CoreMLExecutionProvider    — Apple Silicon (Neural Engine / GPU)
      4. CPUExecutionProvider       — universal fallback

    The list is built by checking what ORT actually has available, so it
    degrades gracefully on any hardware without raising errors.
    """
    try:
        import onnxruntime as ort
        available = set(ort.get_available_providers())
    except Exception:
        return ["CPUExecutionProvider"]

    providers: list = []

    if "TensorrtExecutionProvider" in available:
        engine_cache = os.getenv("TRT_ENGINE_CACHE_PATH", "data/.trt_engines")
        os.makedirs(engine_cache, exist_ok=True)
        providers.append((
            "TensorrtExecutionProvider",
            {
                "trt_fp16_enable": True,
                "trt_engine_cache_enable": True,
                "trt_engine_cache_path": engine_cache,
                # Reduce TRT build time by limiting workspace (256 MB)
                "trt_max_workspace_size": 256 * 1024 * 1024,
            },
        ))
        logger.info("ORT provider: TensorRT (FP16, engine cache=%s)", engine_cache)

    if "CUDAExecutionProvider" in available:
        providers.append((
            "CUDAExecutionProvider",
            {"device_id": int(os.getenv("CUDA_DEVICE_ID", "0"))},
        ))
        logger.info("ORT provider: CUDA (device %s)", os.getenv("CUDA_DEVICE_ID", "0"))

    if "CoreMLExecutionProvider" in available and sys.platform == "darwin":
        providers.append("CoreMLExecutionProvider")
        logger.info("ORT provider: CoreML (Apple Neural Engine)")

    providers.append("CPUExecutionProvider")

    if len(providers) == 1:
        logger.info("ORT provider: CPU only (no GPU acceleration available)")

    return providers


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
        providers = _build_ort_providers()
        app = FaceAnalysis(name=model_name, providers=providers)
        app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace initialised (model=%s, providers=%s)", model_name, providers)
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
