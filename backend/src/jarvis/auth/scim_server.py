"""SCIM 2.0 server utilities (RFC 7643 + RFC 7644).

Provides:
  - check_scim_auth()         — Bearer-token auth guard
  - scim_error()              — RFC 7644-compliant error response
  - SERVICE_PROVIDER_CONFIG   — /ServiceProviderConfig response
  - SCHEMA_USER               — /Schemas/urn:ietf:params:scim:schemas:core:2.0:User
  - RESOURCE_TYPES            — /ResourceTypes response

The actual endpoint handlers live in web/app.py; these are shared constants
and helpers used by those handlers.
"""

from __future__ import annotations

import logging
import os

from flask import request

logger = logging.getLogger(__name__)

SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
SCIM_SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
SCIM_SCHEMA_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error"

# ── auth ──────────────────────────────────────────────────────────────────────


def check_scim_auth() -> bool:
    """Return True if the SCIM Bearer token is valid.

    Token is set via SCIM_BEARER_TOKEN env var.  If the env var is unset,
    SCIM access is denied by default (fail-secure).
    """
    expected = os.getenv("SCIM_BEARER_TOKEN", "").strip()
    if not expected:
        logger.warning("SCIM_BEARER_TOKEN is not set — SCIM access denied")
        return False
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    return auth[7:].strip() == expected


# ── error helper ──────────────────────────────────────────────────────────────


def scim_error(detail: str, status: int = 400, scim_type: str = "") -> tuple[dict, int]:
    """Return a SCIM 2.0 error response tuple."""
    body: dict = {
        "schemas": [SCIM_SCHEMA_ERROR],
        "detail": detail,
        "status": str(status),
    }
    if scim_type:
        body["scimType"] = scim_type
    return body, status


# ── ServiceProviderConfig (GET /scim/v2/ServiceProviderConfig) ────────────────

SERVICE_PROVIDER_CONFIG = {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    "documentationUri": "https://github.com/rathodpratham15/JARVIS",
    "patch": {"supported": True},
    "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
    "filter": {"supported": True, "maxResults": 200},
    "changePassword": {"supported": False},
    "sort": {"supported": False},
    "etag": {"supported": False},
    "authenticationSchemes": [
        {
            "type": "oauthbearertoken",
            "name": "OAuth Bearer Token",
            "description": "Authentication scheme using the OAuth Bearer Token Standard",
            "specUri": "http://www.rfc-editor.org/info/rfc6750",
            "primary": True,
        }
    ],
    "meta": {
        "resourceType": "ServiceProviderConfig",
        "location": "/scim/v2/ServiceProviderConfig",
    },
}


# ── ResourceTypes (GET /scim/v2/ResourceTypes) ────────────────────────────────

RESOURCE_TYPES = {
    "schemas": [SCIM_SCHEMA_LIST],
    "totalResults": 1,
    "Resources": [
        {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
            "id": "User",
            "name": "User",
            "endpoint": "/scim/v2/Users",
            "description": "User Account",
            "schema": SCIM_SCHEMA_USER,
            "schemaExtensions": [],
            "meta": {
                "location": "/scim/v2/ResourceTypes/User",
                "resourceType": "ResourceType",
            },
        }
    ],
}


# ── Schemas (GET /scim/v2/Schemas) ───────────────────────────────────────────

SCHEMA_USER = {
    "schemas": [SCIM_SCHEMA_LIST],
    "totalResults": 1,
    "Resources": [
        {
            "id": SCIM_SCHEMA_USER,
            "name": "User",
            "description": "User Account",
            "attributes": [
                {
                    "name": "userName",
                    "type": "string",
                    "multiValued": False,
                    "required": True,
                    "caseExact": False,
                    "mutability": "readWrite",
                    "returned": "default",
                    "uniqueness": "server",
                },
                {
                    "name": "displayName",
                    "type": "string",
                    "multiValued": False,
                    "required": False,
                    "mutability": "readWrite",
                    "returned": "default",
                },
                {
                    "name": "emails",
                    "type": "complex",
                    "multiValued": True,
                    "required": False,
                    "mutability": "readWrite",
                    "returned": "default",
                    "subAttributes": [
                        {"name": "value", "type": "string", "multiValued": False},
                        {"name": "type", "type": "string", "multiValued": False},
                        {"name": "primary", "type": "boolean", "multiValued": False},
                    ],
                },
                {
                    "name": "active",
                    "type": "boolean",
                    "multiValued": False,
                    "required": False,
                    "mutability": "readWrite",
                    "returned": "default",
                },
                {
                    "name": "externalId",
                    "type": "string",
                    "multiValued": False,
                    "required": False,
                    "mutability": "readWrite",
                    "returned": "default",
                },
            ],
            "meta": {
                "resourceType": "Schema",
                "location": f"/scim/v2/Schemas/{SCIM_SCHEMA_USER}",
            },
        }
    ],
}


# ── filter parser (RFC 7644 §3.4.2.2) ────────────────────────────────────────


def parse_filter(filter_str: str) -> dict[str, str]:
    """Parse a simple SCIM filter expression into a dict.

    Supports only ``attr eq "value"`` form (covers 95 % of provisioner usage).
    Returns {} if the expression cannot be parsed (caller should ignore filter).

    Examples::

        parse_filter('userName eq "jdoe"')      → {"userName": "jdoe"}
        parse_filter('emails.value eq "a@b.c"') → {"emails.value": "a@b.c"}
    """
    import re
    m = re.match(r'^(\S+)\s+eq\s+"([^"]*)"$', filter_str.strip(), re.IGNORECASE)
    if not m:
        return {}
    return {m.group(1): m.group(2)}
