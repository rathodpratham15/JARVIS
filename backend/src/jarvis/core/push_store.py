"""SQLite store for push notification tokens (FCM and Web Push subscriptions)."""

from __future__ import annotations

import contextlib
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional


_SCHEMA = """
CREATE TABLE IF NOT EXISTS push_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    platform    TEXT NOT NULL,
    subscription TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_tokens(user_id);
"""


class PushTokenStore:
    def __init__(self, db_path: str = "data/push_tokens.db") -> None:
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

    def _row_to_dict(self, row) -> dict:
        return dict(row)

    def register(self, user_id: str, token: str, platform: str, subscription: Optional[str] = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        row_id = str(uuid.uuid4())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO push_tokens (id, user_id, token, platform, subscription, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(token) DO UPDATE SET
                    user_id=excluded.user_id,
                    platform=excluded.platform,
                    subscription=excluded.subscription,
                    updated_at=excluded.updated_at
                """,
                (row_id, user_id, token, platform, subscription, now, now),
            )
            row = conn.execute("SELECT * FROM push_tokens WHERE token=?", (token,)).fetchone()
        return self._row_to_dict(row)

    def unregister(self, token: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM push_tokens WHERE token=?", (token,))
        return cur.rowcount > 0

    def get_tokens_for_user(self, user_id: str) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM push_tokens WHERE user_id=? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]
