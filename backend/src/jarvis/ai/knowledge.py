"""SQLite-backed knowledge base with substring search."""

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
CREATE TABLE IF NOT EXISTS knowledge (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT,         -- JSON array
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kb_title ON knowledge(title);
"""


class KnowledgeBase:
    def __init__(self, db_path: str | Path = "data/knowledge.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
            try:
                conn.execute("ALTER TABLE knowledge ADD COLUMN user_id TEXT")
            except Exception:
                pass
            conn.commit()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def add(self, title: str, content: str, tags: Optional[list[str]] = None,
            user_id: Optional[str] = None) -> dict:
        entry_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO knowledge VALUES (?, ?, ?, ?, ?, ?)",
                (entry_id, title, content, json.dumps(tags or []), now, user_id),
            )
            conn.commit()
        return {"id": entry_id, "title": title, "content": content,
                "tags": tags or [], "created_at": now, "user_id": user_id}

    def search(self, query: str, limit: int = 20, user_id: Optional[str] = None) -> list[dict]:
        like = f"%{query}%"
        with self._lock, self._connect() as conn:
            if user_id is not None:
                rows = conn.execute(
                    """
                    SELECT * FROM knowledge
                    WHERE user_id = ? AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
                    ORDER BY created_at DESC LIMIT ?
                    """,
                    (user_id, like, like, like, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM knowledge
                    WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
                    ORDER BY created_at DESC LIMIT ?
                    """,
                    (like, like, like, limit),
                ).fetchall()
        return [_row(r) for r in rows]

    def list_all(self, limit: int = 100, user_id: Optional[str] = None) -> list[dict]:
        with self._lock, self._connect() as conn:
            if user_id is not None:
                rows = conn.execute(
                    "SELECT * FROM knowledge WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                    (user_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM knowledge ORDER BY created_at DESC LIMIT ?", (limit,)
                ).fetchall()
        return [_row(r) for r in rows]


def _row(r) -> dict:
    data = dict(r)
    data["tags"] = json.loads(data.get("tags") or "[]")
    return data
