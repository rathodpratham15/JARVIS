"""Microsoft OIDC / Azure AD SSO (authorization-code flow).

Supports:
  - Personal Microsoft accounts  (tenant = "consumers")
  - Organizational accounts      (tenant = specific tenant ID)
  - Both ("common" tenant)
  - Northeastern University / any university using Microsoft 365

Required env vars:
    MICROSOFT_CLIENT_ID       Azure app registration Application (client) ID
    MICROSOFT_CLIENT_SECRET   Client secret value
    MICROSOFT_TENANT          Tenant ID, "common", "organizations", or "consumers"
                              (default: "common")

The redirect URI registered in Azure must match:
    {BACKEND_URL}/auth/microsoft/callback
"""

from __future__ import annotations

import logging
import os
import secrets

import requests

logger = logging.getLogger(__name__)

_AUTHORITY_BASE = "https://login.microsoftonline.com"
_GRAPH_ME = "https://graph.microsoft.com/v1.0/me"


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


class MicrosoftOIDC:
    """Stateless Microsoft OIDC helper — no session state stored in this class."""

    def __init__(self) -> None:
        self.client_id = _env("MICROSOFT_CLIENT_ID")
        self.client_secret = _env("MICROSOFT_CLIENT_SECRET")
        self.tenant = _env("MICROSOFT_TENANT", "common")

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_login_url(self, redirect_uri: str, state: str = "") -> str:
        """Return the Azure authorization URL for the login redirect."""
        if not self.configured:
            raise RuntimeError("Microsoft OIDC is not configured (missing CLIENT_ID / CLIENT_SECRET)")
        state = state or secrets.token_urlsafe(16)
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": "openid profile email User.Read",
            "state": state,
            "prompt": "select_account",
        }
        from urllib.parse import urlencode
        return f"{_AUTHORITY_BASE}/{self.tenant}/oauth2/v2.0/authorize?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> dict[str, str]:
        """Exchange an authorization code for user identity.

        Returns ``{"email": ..., "name": ..., "sub": ..., "preferred_username": ...}``.
        Raises ``ValueError`` on failure.
        """
        if not self.configured:
            raise RuntimeError("Microsoft OIDC is not configured")

        token_url = f"{_AUTHORITY_BASE}/{self.tenant}/oauth2/v2.0/token"
        resp = requests.post(
            token_url,
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "scope": "openid profile email User.Read",
            },
            timeout=15,
        )
        if not resp.ok:
            err = resp.json().get("error_description", resp.text)
            logger.warning("Microsoft token exchange failed: %s", err)
            raise ValueError(f"Token exchange failed: {err}")

        token_data = resp.json()
        access_token = token_data.get("access_token", "")

        # Fetch profile from Microsoft Graph (covers both personal and work accounts)
        me_resp = requests.get(
            _GRAPH_ME,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if not me_resp.ok:
            raise ValueError(f"Graph /me failed: {me_resp.text}")

        me = me_resp.json()
        email = (
            me.get("mail")
            or me.get("userPrincipalName")
            or me.get("email")
            or ""
        ).lower()
        name = me.get("displayName") or email.split("@")[0]
        sub = me.get("id") or ""  # Azure AD object ID — stable, unique per tenant

        return {
            "email": email,
            "name": name,
            "sub": sub,
            "preferred_username": me.get("userPrincipalName", email),
        }
