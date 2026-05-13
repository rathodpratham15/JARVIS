"""SQLite-backed conversation memory.

Slim replacement for the legacy 857-line `MemoryManager`. Keeps the parts
the chat MVP actually uses: store an interaction, fetch recent interactions
for LLM context, search by substring, clear (for tests). Drops the
production features that were unwired anywhere — tags table, user sessions,
embeddings, GDPR export, pickle preferences cache. If those return as
real product requirements later, add them back here behind explicit calls.
"""

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
    ) -> str:
        """Persist a single interaction and return its id."""
        interaction_id = str(uuid.uuid4())
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO interactions VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    interaction_id,
                    datetime.now(timezone.utc).isoformat(),
                    user_input,
                    response,
                    intent_type,
                    json.dumps(tags or []),
                    json.dumps(metadata or {}),
                ),
            )
            conn.commit()
        return interaction_id

    def recent(self, limit: int = 20) -> list[dict]:
        """Return the `limit` most recent interactions, oldest-first."""
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM interactions ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [_row_to_dict(r) for r in reversed(rows)]

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """Substring-match against user input or response, newest-first."""
        like = f"%{query}%"
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM interactions
                WHERE user_input LIKE ? OR response LIKE ?
                ORDER BY timestamp DESC LIMIT ?
                """,
                (like, like, limit),
            ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def count(self) -> int:
        with self._lock, self._connect() as conn:
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
