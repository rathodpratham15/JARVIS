"""Simple SQLite-backed notes store for the NotesManager frontend."""

from __future__ import annotations

import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    content     TEXT NOT NULL,
    title       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);
"""


class NotesStore:
    def __init__(self, db_path: str | Path = "data/notes.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
            try:
                conn.execute("ALTER TABLE notes ADD COLUMN user_id TEXT")
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

    def add(self, content: str, title: Optional[str] = None, user_id: Optional[str] = None) -> dict:
        note_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)",
                (note_id, content, title, now, now, user_id),
            )
            conn.commit()
        return {"id": note_id, "content": content, "title": title,
                "created_at": now, "updated_at": now, "user_id": user_id}

    def list(self, user_id: Optional[str] = None) -> list[dict]:
        with self._lock, self._connect() as conn:
            if user_id is not None:
                rows = conn.execute(
                    "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC",
                    (user_id,),
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM notes ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def update(self, note_id: str, title: Optional[str] = None,
               content: Optional[str] = None, user_id: Optional[str] = None) -> Optional[dict]:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            if user_id is not None:
                row = conn.execute(
                    "SELECT * FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id)
                ).fetchone()
            else:
                row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
            if row is None:
                return None
            new_title = title if title is not None else row["title"]
            new_content = content if content is not None else row["content"]
            conn.execute(
                "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
                (new_title, new_content, now, note_id),
            )
            conn.commit()
        return {"id": note_id, "title": new_title, "content": new_content,
                "created_at": row["created_at"], "updated_at": now}

    def delete(self, note_id: str, user_id: Optional[str] = None) -> bool:
        with self._lock, self._connect() as conn:
            if user_id is not None:
                cursor = conn.execute(
                    "DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id)
                )
            else:
                cursor = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            conn.commit()
            return cursor.rowcount > 0

    def count(self, user_id: Optional[str] = None) -> int:
        with self._lock, self._connect() as conn:
            if user_id is not None:
                return conn.execute(
                    "SELECT COUNT(*) FROM notes WHERE user_id = ?", (user_id,)
                ).fetchone()[0]
            return conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
