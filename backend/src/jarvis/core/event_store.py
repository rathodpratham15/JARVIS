"""Event management store: events, access codes, and member tracking.

Events are the central concept connecting organizers, face DBs, and attendees.
Each event gets a unique access_code (shared on the day) and a face_namespace
(used as the InsightFace DB key so all attendees scan the same enrolled faces).
"""

from __future__ import annotations

import random
import sqlite3
import string
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _generate_code(length: int = 8) -> str:
    """Return a random uppercase alphanumeric access code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class EventStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id              TEXT PRIMARY KEY,
                    name            TEXT NOT NULL,
                    organizer_id    TEXT NOT NULL,
                    organizer_name  TEXT,
                    access_code     TEXT UNIQUE NOT NULL,
                    face_namespace  TEXT NOT NULL,
                    created_at      TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS event_members (
                    event_id    TEXT NOT NULL,
                    user_id     TEXT NOT NULL,
                    user_email  TEXT,
                    joined_at   TEXT NOT NULL,
                    PRIMARY KEY (event_id, user_id),
                    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_ev_organizer ON events (organizer_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_em_user ON event_members (user_id)"
            )

    # ── event CRUD ─────────────────────────────────────────────────────────

    def create_event(
        self,
        name: str,
        organizer_id: str,
        organizer_name: str = "",
    ) -> dict:
        event_id = str(uuid.uuid4())
        # Retry until access code is unique (collision probability is negligible)
        while True:
            code = _generate_code()
            existing = self.get_by_code(code)
            if not existing:
                break
        namespace = f"event_{event_id}"
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO events
                   (id, name, organizer_id, organizer_name, access_code, face_namespace, created_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (event_id, name, organizer_id, organizer_name or None, code, namespace, now),
            )
        return self.get(event_id)  # type: ignore[return-value]

    def get(self, event_id: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM events WHERE id=?", (event_id,)
            ).fetchone()
        return dict(row) if row else None

    def get_by_code(self, code: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM events WHERE access_code=?", (code.upper().strip(),)
            ).fetchone()
        return dict(row) if row else None

    def list_all(self) -> list[dict]:
        """All events (admin view)."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def list_by_organizer(self, organizer_id: str) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events WHERE organizer_id=? ORDER BY created_at DESC",
                (organizer_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete(self, event_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM events WHERE id=?", (event_id,))
            return cur.rowcount > 0

    # ── member management ──────────────────────────────────────────────────

    def join_event(self, event_id: str, user_id: str, user_email: str = "") -> bool:
        """Add user as event member. Returns True if newly joined, False if already a member."""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT 1 FROM event_members WHERE event_id=? AND user_id=?",
                (event_id, user_id),
            ).fetchone()
            if existing:
                return False
            conn.execute(
                "INSERT INTO event_members (event_id, user_id, user_email, joined_at) VALUES (?,?,?,?)",
                (event_id, user_id, user_email or None, now),
            )
            return True

    def get_members(self, event_id: str) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM event_members WHERE event_id=? ORDER BY joined_at",
                (event_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_member_events(self, user_id: str) -> list[dict]:
        """Events a user has joined (with event metadata)."""
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT e.*, em.joined_at as member_joined_at
                   FROM events e
                   JOIN event_members em ON e.id = em.event_id
                   WHERE em.user_id = ?
                   ORDER BY em.joined_at DESC""",
                (user_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def member_count(self, event_id: str) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM event_members WHERE event_id=?", (event_id,)
            ).fetchone()
        return row[0] if row else 0
