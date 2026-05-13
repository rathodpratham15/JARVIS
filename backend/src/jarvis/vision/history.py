"""Persisted scene-analysis history for the VisualAnalysisDashboard."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS scene_history (
    id            TEXT PRIMARY KEY,
    timestamp     TEXT NOT NULL,
    image_url     TEXT,
    description   TEXT,
    objects       TEXT,           -- JSON array
    confidence    REAL,
    model_used    TEXT,
    raw_results   TEXT             -- full JSON snapshot
);
CREATE INDEX IF NOT EXISTS idx_scene_ts ON scene_history(timestamp);
"""


class SceneHistoryStore:
    def __init__(self, db_path: str | Path = "data/vision_history.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
            conn.commit()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def record(self, results: dict, image_url: Optional[str] = None) -> str:
        entry_id = str(uuid.uuid4())
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO scene_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    entry_id,
                    datetime.now(timezone.utc).isoformat(),
                    image_url,
                    results.get("description", ""),
                    json.dumps(results.get("objects", []) or results.get("objects_detected", [])),
                    float(results.get("confidence", 0.0)),
                    results.get("model_used", "unknown"),
                    json.dumps(results),
                ),
            )
            conn.commit()
        return entry_id

    def recent(self, limit: int = 50) -> list[dict]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scene_history ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [_row_to_history_item(r) for r in rows]

    def stats(self) -> dict:
        with self._lock, self._connect() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS total,
                       AVG(confidence) AS avg_confidence
                FROM scene_history
                """
            ).fetchone()
        total = row["total"] or 0
        return {
            "total_analyses": total,
            "scene_analyses": total,         # all our analyses are scene-type
            "object_detections": total,      # objects come from the same call
            "text_recognitions": 0,          # we don't OCR
            "average_confidence": float(row["avg_confidence"] or 0.0),
        }


def _row_to_history_item(r: sqlite3.Row) -> dict:
    """Match the shape the React `VisualAnalysisDashboard` expects."""
    return {
        "id": r["id"],
        "timestamp": r["timestamp"],
        "type": "scene",
        "image_url": r["image_url"],
        "results": {
            "scene_description": r["description"],
            "description": r["description"],
            "confidence": r["confidence"],
            "objects": json.loads(r["objects"] or "[]"),
            "objects_detected": json.loads(r["objects"] or "[]"),
            "model_used": r["model_used"],
        },
    }
