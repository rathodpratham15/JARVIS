"""Gemini Vision face matching — zero-dependency fallback when dlib is unavailable.

Identifies people by sending labeled reference images + the query image to
Gemini Vision and asking it to find a match. Works on Railway and any cloud
deployment where GEMINI_API_KEY is set.

Interface is compatible with FaceRecognitionEngine so app.py can swap engines
without touching any endpoint logic.
"""

from __future__ import annotations

import base64
import glob
import json
import logging
import os
import shutil
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
_IMAGE_GLOBS = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp")
_MAX_REFS_PER_PERSON = 2   # reference images per person sent to Gemini
_MAX_TOTAL_REFS = 20        # hard cap on total reference images per request


class GeminiFaceEngine:
    """Identifies faces via Gemini Vision few-shot image matching.

    Scans ``data_dir/images/{name}/`` for reference images at startup.
    Each ``recognize_face()`` call encodes the target + reference images
    as base64 and asks Gemini Vision to identify the person.

    Drop-in replacement for FaceRecognitionEngine — exposes the same
    ``recognize_face()``, ``add_person()``, ``load_from_excel()``,
    ``get_statistics()``, ``known_faces``, and ``tolerance`` attributes.
    """

    def __init__(
        self,
        data_dir: str | Path = "data/faces",
        model: str = "gemini-2.0-flash",
        tolerance: float = 0.5,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.images_root = self.data_dir / "images"
        self.model = os.getenv("JARVIS_FACE_MODEL", model)
        self.tolerance = tolerance
        self.known_faces: list = []
        self._client = None
        self._stats: dict = {
            "successful_matches": 0,
            "failed_matches": 0,
            "processing_times": [],
        }
        self.images_root.mkdir(parents=True, exist_ok=True)
        self._setup_client()
        self._load_known_faces()

    # ── setup ─────────────────────────────────────────────────────────

    def _setup_client(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("GeminiFaceEngine: no GEMINI_API_KEY — face matching disabled")
            return
        try:
            from openai import OpenAI
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                max_retries=1,
                timeout=60.0,
            )
        except ImportError:
            logger.warning("GeminiFaceEngine: openai package not installed")

    def _load_known_faces(self) -> None:
        from jarvis.vision.faces import PersonData

        self.known_faces = []
        if not self.images_root.exists():
            return

        for person_dir in sorted(self.images_root.iterdir()):
            if not person_dir.is_dir():
                continue
            name = person_dir.name
            img_paths: list[str] = []
            for pattern in _IMAGE_GLOBS:
                img_paths.extend(glob.glob(str(person_dir / pattern)))
            if not img_paths:
                continue
            person = PersonData(
                name=name,
                image_paths=sorted(img_paths),
                face_encodings=[],
            )
            self.known_faces.append(person)

        logger.info(
            "GeminiFaceEngine: %d people loaded from %s",
            len(self.known_faces),
            self.images_root,
        )

    # ── recognition ───────────────────────────────────────────────────

    def recognize_face(self, image_path: str | Path) -> object:
        from jarvis.vision.faces import RecognitionResult

        start = time.monotonic()
        image_path = str(image_path)

        if self._client is None:
            return RecognitionResult(None, 0.0, False, 0.0, "Gemini API not configured")
        if not self.known_faces:
            return RecognitionResult(
                None, 0.0, False, 0.0,
                "No known faces — upload via /api/face/process-excel",
            )
        if not os.path.exists(image_path):
            return RecognitionResult(None, 0.0, False, 0.0, "Image file not found")

        try:
            parsed = self._call_gemini(image_path)
        except Exception as exc:
            logger.exception("GeminiFaceEngine: Gemini call failed")
            elapsed = time.monotonic() - start
            self._stats["failed_matches"] += 1
            self._stats["processing_times"].append(elapsed)
            return RecognitionResult(None, 0.0, False, elapsed, f"Gemini error: {exc}")

        elapsed = time.monotonic() - start
        self._stats["processing_times"].append(elapsed)

        matched = parsed.get("matched", False)
        name = (parsed.get("name") or "").strip()
        confidence = float(parsed.get("confidence", 0.0))

        if matched and name and confidence >= self.tolerance:
            person = next(
                (p for p in self.known_faces if p.name.lower() == name.lower()),
                None,
            )
            if person:
                self._stats["successful_matches"] += 1
                return RecognitionResult(person, confidence, True, elapsed)

        self._stats["failed_matches"] += 1
        reason = parsed.get("reasoning") or "No matching face found"
        return RecognitionResult(None, confidence, False, elapsed, reason)

    def _call_gemini(self, image_path: str) -> dict:
        content: list[dict] = []
        refs_added = 0

        for person in self.known_faces:
            refs = person.image_paths[:_MAX_REFS_PER_PERSON]
            for ref_path in refs:
                if refs_added >= _MAX_TOTAL_REFS:
                    break
                b64 = _b64_image(ref_path)
                if b64 is None:
                    continue
                content += [
                    {"type": "text", "text": f"REFERENCE — {person.name}:"},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ]
                refs_added += 1
            if refs_added >= _MAX_TOTAL_REFS:
                break

        target_b64 = _b64_image(image_path)
        if target_b64 is None:
            raise ValueError("Could not read target image")

        content += [
            {"type": "text", "text": "TARGET (identify this person):"},
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{target_b64}"},
            },
        ]

        names = ", ".join(p.name for p in self.known_faces)
        content.append({
            "type": "text",
            "text": (
                f"You have reference photos of: {names}. "
                "Does the TARGET image show one of these people? "
                "Reply ONLY with JSON (no markdown): "
                "{\"matched\": true/false, \"name\": \"<name or null>\", "
                "\"confidence\": <0.0-1.0>, \"reasoning\": \"<one sentence>\"}"
            ),
        })

        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": content}],
            max_tokens=200,
        )
        raw = (resp.choices[0].message.content or "").strip()
        logger.debug("GeminiFaceEngine raw: %s", raw)
        return _parse_json(raw)

    # ── management ────────────────────────────────────────────────────

    def add_person(
        self,
        name: str,
        image_paths: list,
        metadata: Optional[dict] = None,
    ) -> Optional[object]:
        """Copy images into images_root/{name}/ and register the person."""
        from jarvis.vision.faces import PersonData

        dest = self.images_root / name
        dest.mkdir(parents=True, exist_ok=True)
        saved: list[str] = []
        for src in image_paths:
            src_path = Path(src)
            if not src_path.exists():
                continue
            dst = dest / src_path.name
            shutil.copy2(src_path, dst)
            saved.append(str(dst))

        if not saved:
            logger.warning("GeminiFaceEngine.add_person: no valid images for %s", name)
            return None

        metadata = metadata or {}
        person = PersonData(
            name=name,
            age=metadata.get("age"),
            gender=metadata.get("gender"),
            profession=metadata.get("profession"),
            image_paths=saved,
            face_encodings=[],
            additional_data=metadata,
        )
        idx = next((i for i, p in enumerate(self.known_faces) if p.name == name), None)
        if idx is not None:
            self.known_faces[idx] = person
        else:
            self.known_faces.append(person)
        return person

    def load_from_excel(self, excel_file, images_folder=None) -> int:
        """Register people from an Excel sheet with Name + Image columns."""
        import pandas as pd

        df = pd.read_excel(excel_file)
        missing = {"Name", "Image"} - set(df.columns)
        if missing:
            raise ValueError(f"Excel missing required columns: {missing}")

        added = 0
        for _, row in df.iterrows():
            name = str(row["Name"]).strip()
            if not name or name.lower() in {"nan", "none"}:
                continue
            image_ref = str(row["Image"]).strip()
            if not image_ref or image_ref.lower() in {"nan", "none"}:
                continue
            if images_folder and not os.path.isabs(image_ref):
                image_ref = os.path.join(str(images_folder), image_ref)

            if os.path.isdir(image_ref):
                image_files: list[str] = []
                for pattern in _IMAGE_GLOBS:
                    image_files.extend(glob.glob(os.path.join(image_ref, pattern)))
            elif os.path.exists(image_ref):
                image_files = [image_ref]
            else:
                logger.warning("GeminiFaceEngine: image not found: %s", image_ref)
                continue

            extras = {
                col: row[col]
                for col in row.index
                if col not in {"Name", "Image"} and pd.notna(row[col])
            }
            if self.add_person(name, image_files, metadata=extras):
                added += 1

        return added

    def get_statistics(self) -> dict:
        times = self._stats["processing_times"]
        return {
            "total_people": len(self.known_faces),
            "successful_matches": self._stats["successful_matches"],
            "failed_matches": self._stats["failed_matches"],
            "average_processing_time": (sum(times) / len(times)) if times else 0.0,
        }


# ── helpers ───────────────────────────────────────────────────────────

def _b64_image(path: str) -> Optional[str]:
    try:
        with open(path, "rb") as fh:
            return base64.b64encode(fh.read()).decode()
    except OSError:
        return None


def _parse_json(text: str) -> dict:
    import re
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'"matched"\s*:\s*(true|false)', text)
        if m:
            matched = m.group(1) == "true"
            name_m = re.search(r'"name"\s*:\s*"([^"]+)"', text)
            conf_m = re.search(r'"confidence"\s*:\s*([\d.]+)', text)
            return {
                "matched": matched,
                "name": name_m.group(1) if name_m else None,
                "confidence": float(conf_m.group(1)) if conf_m else 0.5,
            }
        return {"matched": False, "name": None, "confidence": 0.0}
