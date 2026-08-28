"""SAML 2.0 Service Provider (SP) implementation using python3-saml.

Usage:
  - Set SAML_IDP_ENTITY_ID, SAML_IDP_SSO_URL, SAML_IDP_CERT in env vars.
  - Optionally set SAML_SP_PRIVATE_KEY / SAML_SP_CERT for signed assertions.

The IdP can be any SAML 2.0-compliant identity provider (Okta, Azure AD,
Google Workspace, etc.).  For Okta dev accounts, download the metadata XML
and extract the values below.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


class SAMLProvider:
    """Thin wrapper around python3-saml that reads config from env vars."""

    # ── public methods ────────────────────────────────────────────────────

    def get_settings(self, base_url: str) -> dict[str, Any]:
        """Return the python3-saml settings dict for this SP.

        ``base_url`` is the public URL of this backend, e.g.
        ``https://api.jarvis.pratham.click``.
        """
        sp_entity_id = _env("SAML_SP_ENTITY_ID") or f"{base_url}/auth/saml/metadata"
        acs_url = f"{base_url}/auth/saml/acs"
        slo_url = f"{base_url}/auth/saml/slo"

        idp_entity_id = _env("SAML_IDP_ENTITY_ID")
        idp_sso_url = _env("SAML_IDP_SSO_URL")
        idp_slo_url = _env("SAML_IDP_SLO_URL", idp_sso_url)  # fall back to SSO URL
        idp_cert = _env("SAML_IDP_CERT")

        sp_cert = _env("SAML_SP_CERT")
        sp_key = _env("SAML_SP_PRIVATE_KEY")

        settings: dict[str, Any] = {
            "strict": True,
            "debug": os.getenv("SAML_DEBUG", "false").lower() in ("1", "true", "yes"),
            "sp": {
                "entityId": sp_entity_id,
                "assertionConsumerService": {
                    "url": acs_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                },
                "singleLogoutService": {
                    "url": slo_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                "x509cert": sp_cert,
                "privateKey": sp_key,
            },
            "idp": {
                "entityId": idp_entity_id,
                "singleSignOnService": {
                    "url": idp_sso_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "singleLogoutService": {
                    "url": idp_slo_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "x509cert": idp_cert,
            },
            "security": {
                # Require signed assertions from IdP
                "wantAssertionsSigned": True,
                "wantMessagesSigned": False,
                "authnRequestsSigned": bool(sp_key),
                "signatureAlgorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
                "digestAlgorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
            },
        }
        return settings

    def build_login_redirect(self, base_url: str, relay_state: str = "") -> str:
        """Return the SP-initiated SSO redirect URL.

        Raises ``RuntimeError`` if python3-saml is not installed or IdP is
        not configured.
        """
        from onelogin.saml2.auth import OneLogin_Saml2_Auth  # type: ignore[import-untyped]

        if not _env("SAML_IDP_SSO_URL"):
            raise RuntimeError("SAML_IDP_SSO_URL is not configured")

        req = self._fake_request(base_url)
        auth = OneLogin_Saml2_Auth(req, self.get_settings(base_url))
        return auth.login(return_to=relay_state or None)

    def process_response(self, base_url: str, request_data: dict[str, Any]) -> dict[str, str]:
        """Validate a SAMLResponse POST and return user attributes.

        ``request_data`` must contain::

            {
                "SAMLResponse": "<base64-encoded assertion>",
                "RelayState": "...",   # optional
                "http_host": "api.jarvis.pratham.click",
                "server_port": "443",
                "https": "on",
                "script_name": "/auth/saml/acs",
                "request_uri": "/auth/saml/acs",
            }

        Returns ``{"email": ..., "name": ..., "name_id": ..., "idp_entity_id": ...}``.
        Raises ``ValueError`` on validation failure.
        """
        from onelogin.saml2.auth import OneLogin_Saml2_Auth  # type: ignore[import-untyped]

        auth = OneLogin_Saml2_Auth(request_data, self.get_settings(base_url))
        auth.process_response()
        errors = auth.get_errors()
        if errors:
            reason = auth.get_last_error_reason() or str(errors)
            logger.warning("SAML validation errors: %s — %s", errors, reason)
            raise ValueError(f"SAML assertion invalid: {reason}")

        if not auth.is_authenticated():
            raise ValueError("SAML assertion not authenticated")

        name_id = auth.get_nameid() or ""
        attrs = auth.get_attributes()

        # Attribute names vary by IdP; try common variants
        def _attr(*keys: str) -> str:
            for k in keys:
                v = attrs.get(k)
                if v:
                    return v[0] if isinstance(v, list) else v
            return ""

        email = _attr(
            "email",
            "emailAddress",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
            "urn:oid:0.9.2342.19200300.100.1.3",
        ) or name_id

        name = _attr(
            "displayName",
            "name",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
            "urn:oid:2.16.840.1.113730.3.1.241",
        ) or email.split("@")[0]

        issuer = _env("SAML_IDP_ENTITY_ID")

        return {"email": email, "name": name, "name_id": name_id, "idp_entity_id": issuer}

    def get_metadata(self, base_url: str) -> str:
        """Return SP metadata XML (expose at GET /auth/saml/metadata)."""
        from onelogin.saml2.metadata import OneLogin_Saml2_Metadata  # type: ignore[import-untyped]
        from onelogin.saml2.settings import OneLogin_Saml2_Settings  # type: ignore[import-untyped]

        settings_obj = OneLogin_Saml2_Settings(settings=self.get_settings(base_url), sp_validation_only=True)
        metadata = settings_obj.get_sp_metadata()
        errors = settings_obj.validate_metadata(metadata)
        if errors:
            logger.warning("SP metadata validation warnings: %s", errors)
        return metadata

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _fake_request(base_url: str) -> dict[str, Any]:
        """Build the minimal request dict python3-saml needs for login()."""
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        return {
            "https": "on" if parsed.scheme == "https" else "off",
            "http_host": parsed.netloc,
            "server_port": str(parsed.port or (443 if parsed.scheme == "https" else 80)),
            "script_name": "/auth/saml/acs",
            "request_uri": "/auth/saml/acs",
            "get_data": {},
            "post_data": {},
        }
