"""SQLite-backed contact store for JARVIS.

Contacts let the agent resolve names like "mom" to phone numbers when
sending SMS or WhatsApp messages.
"""

from __future__ import annotations

import contextlib
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional


_SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT,
    name       TEXT NOT NULL,
    phone      TEXT,
    whatsapp   TEXT,
    email      TEXT,
    notes      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
"""


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ContactStore:
    """SQLite-backed store for user contacts."""

    def __init__(self, db_path: str = "data/contacts.db") -> None:
        self._db_path = db_path
        self._init_db()

    @contextlib.contextmanager
    def _connect(self):
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    def add(
        self,
        name: str,
        user_id: Optional[str] = None,
        phone: Optional[str] = None,
        whatsapp: Optional[str] = None,
        email: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> dict:
        now = _now()
        contact_id = str(uuid.uuid4())
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO contacts
                   (id, user_id, name, phone, whatsapp, email, notes, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (contact_id, user_id, name, phone, whatsapp, email, notes, now, now),
            )
        return self.get(contact_id) or {}

    def get(self, contact_id: str, user_id: Optional[str] = None) -> Optional[dict]:
        with self._connect() as conn:
            if user_id:
                row = conn.execute(
                    "SELECT * FROM contacts WHERE id=? AND user_id=?", (contact_id, user_id)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM contacts WHERE id=?", (contact_id,)
                ).fetchone()
        return _row_to_dict(row) if row else None

    def find_by_name(self, query: str, user_id: Optional[str] = None) -> list[dict]:
        """Case-insensitive LIKE search on name field."""
        pattern = f"%{query}%"
        with self._connect() as conn:
            if user_id:
                rows = conn.execute(
                    "SELECT * FROM contacts WHERE user_id=? AND name LIKE ? COLLATE NOCASE ORDER BY name",
                    (user_id, pattern),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM contacts WHERE name LIKE ? COLLATE NOCASE ORDER BY name",
                    (pattern,),
                ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def list_all(self, user_id: Optional[str] = None) -> list[dict]:
        with self._connect() as conn:
            if user_id:
                rows = conn.execute(
                    "SELECT * FROM contacts WHERE user_id=? ORDER BY name COLLATE NOCASE",
                    (user_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM contacts ORDER BY name COLLATE NOCASE"
                ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def update(self, contact_id: str, user_id: Optional[str] = None, **fields) -> Optional[dict]:
        allowed = {"name", "phone", "whatsapp", "email", "notes"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return self.get(contact_id, user_id)
        updates["updated_at"] = _now()
        set_clause = ", ".join(f"{k}=?" for k in updates)
        values = list(updates.values()) + [contact_id]
        where = "id=?"
        if user_id:
            where += " AND user_id=?"
            values.append(user_id)
        with self._connect() as conn:
            conn.execute(f"UPDATE contacts SET {set_clause} WHERE {where}", values)
        return self.get(contact_id, user_id)

    def delete(self, contact_id: str, user_id: Optional[str] = None) -> bool:
        where = "id=?"
        values: list = [contact_id]
        if user_id:
            where += " AND user_id=?"
            values.append(user_id)
        with self._connect() as conn:
            cur = conn.execute(f"DELETE FROM contacts WHERE {where}", values)
        return cur.rowcount > 0
