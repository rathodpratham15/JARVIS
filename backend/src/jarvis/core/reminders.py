"""SQLite-backed reminders store with due-time scheduling support."""

from __future__ import annotations

import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS reminders (
    id         TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    due_at     TEXT,
    created_at TEXT NOT NULL,
    fired      INTEGER NOT NULL DEFAULT 0,
    fired_at   TEXT
);
"""

_CREATE_INDICES = """
CREATE INDEX IF NOT EXISTS idx_reminders_due   ON reminders(due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_fired ON reminders(fired);
CREATE INDEX IF NOT EXISTS idx_reminders_kind  ON reminders(kind);
"""


class RemindersStore:
    def __init__(self, db_path: str | Path = "data/reminders.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as conn:
            conn.executescript(_CREATE_TABLE)
            # Add kind column if this is an existing DB (idempotent).
            try:
                conn.execute("ALTER TABLE reminders ADD COLUMN kind TEXT NOT NULL DEFAULT 'reminder'")
                conn.commit()
            except Exception:
                pass
            conn.executescript(_CREATE_INDICES)
            conn.commit()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def add(self, text: str, due_at: Optional[datetime] = None, kind: str = "reminder") -> dict:
        reminder_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        due_str = due_at.astimezone(timezone.utc).isoformat() if due_at else None
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO reminders (id, text, due_at, created_at, fired, kind) VALUES (?, ?, ?, ?, 0, ?)",
                (reminder_id, text, due_str, now, kind),
            )
            conn.commit()
        return {"id": reminder_id, "text": text, "due_at": due_str, "created_at": now, "fired": False, "kind": kind}

    def list_all(self) -> list[dict]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM reminders ORDER BY created_at DESC").fetchall()
        return [self._to_dict(r) for r in rows]

    def list_pending(self) -> list[dict]:
        """All reminders that haven't fired yet."""
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM reminders WHERE fired=0 ORDER BY due_at ASC NULLS LAST",
            ).fetchall()
        return [self._to_dict(r) for r in rows]

    def list_due(self) -> list[dict]:
        """Reminders whose due_at has passed and haven't fired yet."""
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM reminders WHERE fired=0 AND due_at IS NOT NULL AND due_at <= ?",
                (now,),
            ).fetchall()
        return [self._to_dict(r) for r in rows]

    def mark_fired(self, reminder_id: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            cursor = conn.execute(
                "UPDATE reminders SET fired=1, fired_at=? WHERE id=?",
                (now, reminder_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, reminder_id: str) -> bool:
        with self._lock, self._connect() as conn:
            cursor = conn.execute("DELETE FROM reminders WHERE id=?", (reminder_id,))
            conn.commit()
            return cursor.rowcount > 0

    def count_pending(self) -> int:
        with self._lock, self._connect() as conn:
            return conn.execute("SELECT COUNT(*) FROM reminders WHERE fired=0").fetchone()[0]

    @staticmethod
    def _to_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        d["fired"] = bool(d["fired"])
        return d
