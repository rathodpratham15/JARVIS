"""JWT-based authentication for JARVIS.

Usage::

    auth = AuthManager(db_path="data/auth.db", secret="change-me")
    # First run: bootstrap admin
    auth.ensure_admin(username="admin", password="changeme")

    # Login
    user = auth.verify_password("admin", "changeme")
    tokens = auth.create_tokens(user)

    # Verify access token
    payload = auth.decode_access_token(tokens["access_token"])

Set JARVIS_AUTH_ENABLED=true and JARVIS_AUTH_SECRET=<random> in .env to
activate. JARVIS_ADMIN_PASSWORD bootstraps the admin user on first run.
"""

from __future__ import annotations

import contextlib
import logging
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user',
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);
"""

_ACCESS_EXPIRE_MINUTES = 60
_REFRESH_EXPIRE_DAYS = 30

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthManager:
    def __init__(self, db_path: str = "data/auth.db", secret: str = "") -> None:
        self._db_path = db_path
        self._secret = secret or secrets.token_hex(32)
        self._init_db()

    # ── public API ─────────────────────────────────────────────────────────

    def ensure_admin(self, username: str = "admin", password: str = "") -> None:
        """Create the admin user if no users exist yet."""
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            if not password:
                password = secrets.token_urlsafe(12)
                logger.warning("No admin password set — generated: %s", password)
            self.create_user(username, password, role="admin")
            logger.info("Admin user %r created", username)

    def create_user(self, username: str, password: str, role: str = "user") -> dict:
        uid = str(uuid.uuid4())
        hashed = _pwd.hash(password)
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
                (uid, username, hashed, role, now),
            )
        return {"id": uid, "username": username, "role": role}

    def verify_password(self, username: str, password: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, username, password, role FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        if row is None:
            return None
        if not _pwd.verify(password, row["password"]):
            return None
        return {"id": row["id"], "username": row["username"], "role": row["role"]}

    def create_tokens(self, user: dict) -> dict:
        now = datetime.now(timezone.utc)
        access_payload = {
            "sub": user["id"],
            "username": user["username"],
            "role": user["role"],
            "exp": now + timedelta(minutes=_ACCESS_EXPIRE_MINUTES),
            "type": "access",
        }
        access_token = jwt.encode(access_payload, self._secret, algorithm="HS256")

        refresh_token = secrets.token_urlsafe(48)
        expires_at = (now + timedelta(days=_REFRESH_EXPIRE_DAYS)).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                (refresh_token, user["id"], expires_at),
            )
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": _ACCESS_EXPIRE_MINUTES * 60,
        }

    def decode_access_token(self, token: str) -> Optional[dict]:
        try:
            return jwt.decode(token, self._secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def refresh_access_token(self, refresh_token: str) -> Optional[dict]:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?",
                (refresh_token,),
            ).fetchone()
        if row is None or row["expires_at"] < now:
            return None
        with self._connect() as conn:
            user_row = conn.execute(
                "SELECT id, username, role FROM users WHERE id = ?",
                (row["user_id"],),
            ).fetchone()
        if user_row is None:
            return None
        user = {"id": user_row["id"], "username": user_row["username"], "role": user_row["role"]}
        return self.create_tokens(user)

    def revoke_refresh_token(self, refresh_token: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (refresh_token,))

    def list_users(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, username, role, created_at FROM users ORDER BY created_at"
            ).fetchall()
        return [{"id": r["id"], "username": r["username"], "role": r["role"], "created_at": r["created_at"]} for r in rows]

    # ── internal ───────────────────────────────────────────────────────────

    def _init_db(self) -> None:
        import os as _os
        _os.makedirs(_os.path.dirname(self._db_path) or ".", exist_ok=True)
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
