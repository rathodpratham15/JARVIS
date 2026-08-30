"""SQLite store for Vision OSINT dossiers — caches research results keyed by face name."""

from __future__ import annotations

import contextlib
import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS vision_osint (
    face_id    TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    dossier    TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class VisionOsintStore:
    def __init__(self, db_path: str = "data/vision_osint.db") -> None:
        self._db_path = db_path
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    @contextlib.contextmanager
    def _connect(self):
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def get(self, face_id: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM vision_osint WHERE face_id=?", (face_id,)
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        if result.get("dossier"):
            try:
                result["dossier"] = json.loads(result["dossier"])
            except Exception:
                pass
        return result

    def set_pending(self, face_id: str, name: str) -> None:
        now = _now()
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO vision_osint (face_id, name, status, created_at, updated_at)
                   VALUES (?, ?, 'pending', ?, ?)
                   ON CONFLICT(face_id) DO UPDATE SET status='pending', updated_at=?""",
                (face_id, name, now, now, now),
            )

    def set_done(self, face_id: str, dossier: dict) -> None:
        now = _now()
        with self._connect() as conn:
            conn.execute(
                """UPDATE vision_osint SET status='done', dossier=?, updated_at=?
                   WHERE face_id=?""",
                (json.dumps(dossier), now, face_id),
            )

    def set_error(self, face_id: str, error: str) -> None:
        now = _now()
        with self._connect() as conn:
            conn.execute(
                "UPDATE vision_osint SET status='error', dossier=?, updated_at=? WHERE face_id=?",
                (json.dumps({"error": error}), now, face_id),
            )
