"""JWT-based authentication for JARVIS.

Primary flow  — Google OAuth 2.0 (recommended):
    Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env.
    Frontend sends a Google ID token to POST /api/auth/google.
    Backend verifies it, creates/finds the user, returns a JWT.

Fallback flow — username/password (local/offline use):
    Bootstrap admin once from JARVIS_ADMIN_PASSWORD env var.
    POST /api/auth/login with {username, password}.

Access control:
    JARVIS_ALLOWED_EMAILS  comma-separated list of Google emails that may
                           log in. If unset, any verified Google account is
                           accepted (not recommended for public deployments).

Secret management:
    JARVIS_AUTH_SECRET     optional; auto-generated and persisted to
                           data/auth_secret.key on first run if not provided.
                           Users never need to set this manually.
"""

from __future__ import annotations

import contextlib
import logging
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    email       TEXT,
    password    TEXT,
    role        TEXT NOT NULL DEFAULT 'user',
    google_sub  TEXT,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);
"""

_ACCESS_EXPIRE_MINUTES = 60
_REFRESH_EXPIRE_DAYS   = 30

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthManager:
    def __init__(
        self,
        db_path: str = "data/auth.db",
        secret: str = "",
        secret_file: str = "data/auth_secret.key",
    ) -> None:
        self._db_path = db_path
        self._secret = self._load_or_create_secret(secret, secret_file)
        self._init_db()

    # ── public API ─────────────────────────────────────────────────────────

    def ensure_admin(self, username: str = "admin", password: str = "") -> None:
        """Create the admin user if no users exist yet (password login bootstrap)."""
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            if not password:
                password = secrets.token_urlsafe(12)
                logger.warning("No admin password set — generated one-time password: %s", password)
            self.create_user(username, password, role="admin")
            logger.info("Admin user %r bootstrapped", username)

    def create_user(self, username: str, password: str, role: str = "user", email: str = "") -> dict:
        uid = str(uuid.uuid4())
        hashed = _pwd.hash(password) if password else None
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO users (id, username, email, password, role, created_at) VALUES (?,?,?,?,?,?)",
                (uid, username, email or None, hashed, role, now),
            )
        return {"id": uid, "username": username, "email": email or None, "role": role}

    def create_or_get_google_user(self, email: str, name: str, google_sub: str) -> dict:
        """Find existing user by Google sub or email; create one if new."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, username, email, role FROM users WHERE google_sub = ? OR email = ?",
                (google_sub, email),
            ).fetchone()
        if row:
            # Update google_sub if it wasn't stored yet (email-matched existing user)
            with self._connect() as conn:
                conn.execute(
                    "UPDATE users SET google_sub = ? WHERE id = ?",
                    (google_sub, row["id"]),
                )
            return {"id": row["id"], "username": row["username"], "email": row["email"], "role": row["role"]}

        uid = str(uuid.uuid4())
        username = email.split("@")[0]
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO users (id, username, email, role, google_sub, created_at) VALUES (?,?,?,?,?,?)",
                (uid, username, email, "user", google_sub, now),
            )
        logger.info("New user created via Google OAuth: %s", email)
        return {"id": uid, "username": username, "email": email, "role": "user"}

    def verify_password(self, username: str, password: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, username, email, password, role FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        if row is None or not row["password"]:
            return None
        if not _pwd.verify(password, row["password"]):
            return None
        return {"id": row["id"], "username": row["username"], "email": row["email"], "role": row["role"]}

    def create_tokens(self, user: dict) -> dict:
        now = datetime.now(timezone.utc)
        access_payload = {
            "sub": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "role": user["role"],
            "exp": now + timedelta(minutes=_ACCESS_EXPIRE_MINUTES),
            "type": "access",
        }
        access_token = jwt.encode(access_payload, self._secret, algorithm="HS256")

        refresh_token = secrets.token_urlsafe(48)
        expires_at = (now + timedelta(days=_REFRESH_EXPIRE_DAYS)).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?,?,?)",
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
                "SELECT id, username, email, role FROM users WHERE id = ?",
                (row["user_id"],),
            ).fetchone()
        if user_row is None:
            return None
        user = {"id": user_row["id"], "username": user_row["username"],
                "email": user_row["email"], "role": user_row["role"]}
        return self.create_tokens(user)

    def revoke_refresh_token(self, refresh_token: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (refresh_token,))

    # ── internal ───────────────────────────────────────────────────────────

    @staticmethod
    def _load_or_create_secret(provided: str, secret_file: str) -> str:
        if provided:
            return provided
        path = Path(secret_file)
        if path.exists():
            return path.read_text().strip()
        secret = secrets.token_hex(32)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(secret)
        logger.info("Auth secret auto-generated and saved to %s", path)
        return secret

    def _init_db(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
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
