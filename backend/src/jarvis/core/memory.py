"""SQLite-backed conversation memory."""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

logger = logging.getLogger(__name__)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS interactions (
    id            TEXT PRIMARY KEY,
    timestamp     TEXT NOT NULL,
    user_input    TEXT NOT NULL,
    response      TEXT NOT NULL,
    intent_type   TEXT,
    tags          TEXT,        -- JSON array
    metadata      TEXT         -- JSON object
);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_interactions_intent ON interactions(intent_type);
"""


class Memory:
    """Thread-safe SQLite-backed conversation log."""

    def __init__(self, db_path: str | Path = "data/memory.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
            try:
                conn.execute("ALTER TABLE interactions ADD COLUMN user_id TEXT")
            except Exception:
                pass
            conn.commit()
        logger.info("Memory initialized at %s", self.db_path)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def store_interaction(
        self,
        user_input: str,
        response: str,
        intent_type: Optional[str] = None,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Persist a single interaction and return its id."""
        interaction_id = str(uuid.uuid4())
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO interactions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    interaction_id,
                    datetime.now(timezone.utc).isoformat(),
                    user_input,
                    response,
                    intent_type,
                    json.dumps(tags or []),
                    json.dumps(metadata or {}),
                    user_id,
                ),
            )
            conn.commit()
        return interaction_id

    def recent(self, limit: int = 20, user_id: Optional[str] = None) -> list[dict]:
        """Return the `limit` most recent interactions, oldest-first."""
        with self._lock, self._connect() as conn:
            if user_id is not None:
                rows = conn.execute(
                    "SELECT * FROM interactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
                    (user_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM interactions ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [_row_to_dict(r) for r in reversed(rows)]

    def search(self, query: str, limit: int = 10, user_id: Optional[str] = None) -> list[dict]:
        """Substring-match against user input or response, newest-first."""
        like = f"%{query}%"
        with self._lock, self._connect() as conn:
            if user_id is not None:
                rows = conn.execute(
                    """
                    SELECT * FROM interactions
                    WHERE user_id = ? AND (user_input LIKE ? OR response LIKE ?)
                    ORDER BY timestamp DESC LIMIT ?
                    """,
                    (user_id, like, like, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM interactions
                    WHERE user_input LIKE ? OR response LIKE ?
                    ORDER BY timestamp DESC LIMIT ?
                    """,
                    (like, like, limit),
                ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def count(self, user_id: Optional[str] = None) -> int:
        with self._lock, self._connect() as conn:
            if user_id is not None:
                return conn.execute(
                    "SELECT COUNT(*) FROM interactions WHERE user_id = ?", (user_id,)
                ).fetchone()[0]
            return conn.execute("SELECT COUNT(*) FROM interactions").fetchone()[0]

    def clear(self) -> None:
        """Wipe all interactions. Primarily for tests."""
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM interactions")
            conn.commit()


def _row_to_dict(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["tags"] = json.loads(data.get("tags") or "[]")
    data["metadata"] = json.loads(data.get("metadata") or "{}")
    return data
