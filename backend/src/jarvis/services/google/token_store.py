"""SQLite-backed store for Google OAuth tokens (one row per JARVIS user)."""
from __future__ import annotations
import contextlib, json, logging, sqlite3
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS google_tokens (
    user_id      TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT NOT NULL,
    token_expiry TEXT,
    scopes       TEXT,
    updated_at   TEXT NOT NULL
);
"""


class GoogleTokenStore:
    def __init__(self, db_path: str = "data/auth.db") -> None:
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

    def save(self, user_id: str, access_token: str, refresh_token: str,
             token_expiry: Optional[str], scopes: list[str]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO google_tokens
                   (user_id, access_token, refresh_token, token_expiry, scopes, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, access_token, refresh_token, token_expiry,
                 json.dumps(scopes), now),
            )

    def get_credentials(self, user_id: str, client_id: str, client_secret: str):
        """Return a refreshed google.oauth2.credentials.Credentials or None."""
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM google_tokens WHERE user_id = ?", (user_id,)
            ).fetchone()
        if row is None:
            return None

        scopes = json.loads(row["scopes"] or "[]")
        creds = Credentials(
            token=row["access_token"],
            refresh_token=row["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes,
        )
        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                expiry_iso = creds.expiry.isoformat() if creds.expiry else None
                self.save(user_id, creds.token, creds.refresh_token, expiry_iso, scopes)
            except Exception as exc:
                logger.warning("Token refresh failed for user %s: %s", user_id, exc)
                return None
        return creds

    def has_tokens(self, user_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM google_tokens WHERE user_id = ?", (user_id,)
            ).fetchone()
        return row is not None

    def delete(self, user_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM google_tokens WHERE user_id = ?", (user_id,))
