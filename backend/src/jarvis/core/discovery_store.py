"""Per-user discovery store: faces saved during events, grouped by event name.

Each authenticated user gets their own SQLite file at
  data/discoveries/<user_id>.db

A "discovery" is a person found via face scan that the user chose to save —
separate from the face recognition DB (which is organizer-managed).
"""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class DiscoveryStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS discoveries (
                    id               TEXT PRIMARY KEY,
                    name             TEXT NOT NULL,
                    profession       TEXT,
                    photo_url        TEXT,
                    event_name       TEXT NOT NULL DEFAULT 'General',
                    scanned_at       TEXT NOT NULL,
                    notes            TEXT,
                    source_namespace TEXT
                )
            """)
            # Index for fast per-event queries
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event ON discoveries (event_name)"
            )

    # ── writes ─────────────────────────────────────────────────────────────

    def save(
        self,
        name: str,
        profession: Optional[str] = None,
        photo_url: Optional[str] = None,
        event_name: str = "General",
        notes: Optional[str] = None,
        source_namespace: Optional[str] = None,
    ) -> dict:
        discovery_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO discoveries
                   (id, name, profession, photo_url, event_name, scanned_at, notes, source_namespace)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (discovery_id, name, profession, photo_url, event_name, now, notes, source_namespace),
            )
        return self.get(discovery_id)  # type: ignore[return-value]

    def update_notes(self, discovery_id: str, notes: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE discoveries SET notes=? WHERE id=?", (notes, discovery_id)
            )
            return cur.rowcount > 0

    def delete(self, discovery_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM discoveries WHERE id=?", (discovery_id,))
            return cur.rowcount > 0

    # ── reads ──────────────────────────────────────────────────────────────

    def get(self, discovery_id: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM discoveries WHERE id=?", (discovery_id,)
            ).fetchone()
        return dict(row) if row else None

    def list_all(self, event_name: Optional[str] = None) -> list[dict]:
        with self._connect() as conn:
            if event_name:
                rows = conn.execute(
                    "SELECT * FROM discoveries WHERE event_name=? ORDER BY scanned_at DESC",
                    (event_name,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM discoveries ORDER BY scanned_at DESC"
                ).fetchall()
        return [dict(r) for r in rows]

    def list_events(self) -> list[dict]:
        """Return event names with counts, newest-scanned first."""
        with self._connect() as conn:
            rows = conn.execute("""
                SELECT event_name,
                       COUNT(*) as count,
                       MAX(scanned_at) as last_scanned
                FROM discoveries
                GROUP BY event_name
                ORDER BY last_scanned DESC
            """).fetchall()
        return [dict(r) for r in rows]

    def grouped_by_event(self) -> dict[str, list[dict]]:
        """Return {event_name: [discoveries]} ordered by most-recent event first."""
        events = self.list_events()
        result: dict[str, list[dict]] = {}
        for ev in events:
            result[ev["event_name"]] = self.list_all(ev["event_name"])
        return result
