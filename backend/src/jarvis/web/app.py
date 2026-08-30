"""Flask app exposing the chat pipeline + face/scene analysis over HTTP.

Replaces the legacy 1743-line `web_server.py`. Voice/system endpoints are
intentionally not ported here yet — voice depends on local hardware and
system control will follow in its own phase.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
import urllib.parse

from flask import Flask, request, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

from jarvis.ai import EmotionAnalyzer, KnowledgeBase
from jarvis.services.google import GoogleServiceBundle
from jarvis.core.action_engine import ActionEngine
from jarvis.core.auth import AuthManager
from jarvis.core.contacts import ContactStore
from jarvis.core.intent_parser import IntentParser
from jarvis.core.llm_core import LLMCore
from jarvis.core.tool_definitions import TOOLS, tool_call_to_intent
from jarvis.core.agent import ReActAgent
from jarvis.core.task_manager import TaskManager
from jarvis.core.memory import Memory
from jarvis.core.reminders import RemindersStore
from jarvis.core.contacts import ContactStore
from jarvis.core.semantic_memory import SemanticMemory
from jarvis.dashboard import NotesStore, SettingsStore
from jarvis.core.permissions import Permission, PermissionsManager
from jarvis.plugins import PluginManager

# Hardware/platform-dependent — may not be available in cloud deployments
try:
    from jarvis.speech import Synthesizer, Transcriber
    _speech_available = True
except Exception:
    Synthesizer = None  # type: ignore[assignment,misc]
    Transcriber = None  # type: ignore[assignment,misc]
    _speech_available = False

try:
    from jarvis.system import ActionController
    _system_available = True
except Exception:
    ActionController = None  # type: ignore[assignment,misc]
    _system_available = False

try:
    from jarvis.vision.faces import FaceRecognitionEngine, format_recognition_result
    _face_available = True
except Exception:
    FaceRecognitionEngine = None  # type: ignore[assignment,misc]
    format_recognition_result = None  # type: ignore[assignment]
    _face_available = False

try:
    from jarvis.vision.scenes import SceneAnalyzer
    from jarvis.vision.history import SceneHistoryStore
    _scene_available = True
except Exception:
    SceneAnalyzer = None  # type: ignore[assignment,misc]
    SceneHistoryStore = None  # type: ignore[assignment,misc]
    _scene_available = False

_vision_available = _face_available or _scene_available

logger = logging.getLogger(__name__)


def _build_context(memory: Memory, n: int = 5, query: str = "",
                   sem: "SemanticMemory | None" = None,
                   user_id: "str | None" = None) -> "str | None":
    if query and sem and sem.available:
        relevant = sem.search(query, limit=n)
        if relevant:
            return " || ".join(f"User: {r['user_input']} | Assistant: {r['response']}" for r in relevant)
    recent = memory.recent(limit=n, user_id=user_id)
    if not recent:
        return None
    return " || ".join(f"User: {r['user_input']} | Assistant: {r['response']}" for r in recent)


def create_app() -> Flask:
    app = Flask(__name__)
    _default_origins = (
        "http://localhost:5173,http://localhost:3000,"
        "https://jarvis.pratham.click,"
        "capacitor://localhost,https://localhost,http://localhost"
    )
    _allowed_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]
    CORS(app, resources={
        r"/api/*":   {"origins": _allowed_origins},
        r"/auth/*":  {"origins": _allowed_origins},
        r"/scim/*":  {"origins": _allowed_origins},
    }, supports_credentials=True)

    # ── Auth (opt-in via JARVIS_AUTH_ENABLED=true) ────────────────────────
    _auth_enabled = os.getenv("JARVIS_AUTH_ENABLED", "false").lower() in ("1", "true", "yes")
    _auth_mgr = AuthManager(
        db_path=os.getenv("JARVIS_AUTH_DB", "data/auth.db"),
        secret=os.getenv("JARVIS_AUTH_SECRET", ""),
    )
    _google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    _allowed_emails_raw = os.getenv("JARVIS_ALLOWED_EMAILS", "")
    _allowed_emails: set[str] = {
        e.strip().lower() for e in _allowed_emails_raw.split(",") if e.strip()
    }

    if _auth_enabled:
        _admin_pass = os.getenv("JARVIS_ADMIN_PASSWORD", "")
        _auth_mgr.ensure_admin(username="admin", password=_admin_pass)
        logger.info(
            "Auth enabled — Google OAuth: %s, allowed emails: %s",
            "yes" if _google_client_id else "no",
            _allowed_emails or "any",
        )
    else:
        logger.info("Auth disabled (set JARVIS_AUTH_ENABLED=true to enable)")

    def _uid() -> "str | None":
        """Return the current request's user ID, or None when auth is disabled."""
        return getattr(request, "current_user", {}).get("sub") if _auth_enabled else None

    # ── Google OAuth integration ──────────────────────────────────────────
    _google_client_id_oauth = os.getenv("GOOGLE_CLIENT_ID", "")
    _google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    _frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    _backend_url = os.getenv("BACKEND_URL", "http://localhost:5050")

    _google_svc: "GoogleServiceBundle | None" = None
    if _google_client_id_oauth and _google_client_secret:
        try:
            _google_svc = GoogleServiceBundle(
                db_path=os.getenv("JARVIS_AUTH_DB", "data/auth.db"),
                client_id=_google_client_id_oauth,
                client_secret=_google_client_secret,
            )
            logger.info("Google integration enabled (Gmail + Calendar + Drive)")
        except Exception as _ge:
            logger.warning("Google integration unavailable: %s", _ge)

    import secrets as _secrets_mod
    import time as _time_mod
    _oauth_states: dict[str, tuple[str, float]] = {}  # state → (user_id, expiry)
    _spotify_oauth_states: dict[str, float] = {}  # state → expiry

    _GOOGLE_SCOPES = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive",
    ]

    _PUBLIC_ROUTES = {
        "/api/auth/login", "/api/auth/signup", "/api/auth/refresh",
        "/api/auth/google", "/api/auth/config", "/api/health",
        "/api/google/callback", "/api/face/image", "/api/spotify/callback",
        # SSO / SAML / Microsoft OIDC — must be public (browser redirect flows)
        "/auth/saml/metadata", "/auth/saml/login", "/auth/saml/acs", "/auth/saml/slo",
        "/auth/microsoft/login", "/auth/microsoft/callback",
    }

    # SCIM endpoints use their own Bearer-token auth, not the JARVIS JWT
    def _is_scim(path: str) -> bool:
        return path.startswith("/scim/")

    # Apply auth globally via before_request
    @app.before_request
    def _check_auth():
        if not _auth_enabled:
            return
        if request.method == "OPTIONS":
            return
        if request.path in _PUBLIC_ROUTES:
            return
        if _is_scim(request.path):
            return  # SCIM routes enforce their own Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return {"error": "unauthorized"}, 401
        token = auth_header[7:]
        payload = _auth_mgr.decode_access_token(token)
        if payload is None:
            return {"error": "token expired or invalid"}, 401
        request.current_user = payload  # type: ignore[attr-defined]

    from jarvis.core.push_store import PushTokenStore
    from jarvis.services.push_service import PushService
    push_store = PushTokenStore(db_path=os.getenv("JARVIS_PUSH_DB", "data/push_tokens.db"))
    push_service = PushService(token_store=push_store)

    notes = NotesStore(db_path=os.getenv("JARVIS_NOTES_DB", "data/notes.db"))
    reminders = RemindersStore(db_path=os.getenv("JARVIS_REMINDERS_DB", "data/reminders.db"))
    contacts = ContactStore(db_path=os.getenv("JARVIS_CONTACTS_DB", "data/contacts.db"))
    settings = SettingsStore(path=os.getenv("JARVIS_SETTINGS", "data/settings.json"))
    knowledge = KnowledgeBase(db_path=os.getenv("JARVIS_KNOWLEDGE_DB", "data/knowledge.db"))
    emotion = EmotionAnalyzer()

    memory = Memory(db_path=os.getenv("JARVIS_DB", "data/memory.db"))
    sem_memory = SemanticMemory(db_path=os.getenv("JARVIS_DB", "data/memory.db"))

    parser = IntentParser()
    llm = LLMCore()
    # Override model from persisted user settings (takes precedence over env default,
    # but not over JARVIS_LLM_MODEL env var which LLMCore already applied).
    _saved_model = settings.get("llm_model", "")
    if _saved_model and not os.getenv("JARVIS_LLM_MODEL"):
        llm.model = _saved_model
    permissions = PermissionsManager(settings_path=os.getenv("JARVIS_SETTINGS", "data/settings.json"))
    contacts = ContactStore(db_path=os.getenv("JARVIS_CONTACTS_DB", "data/contacts.db"))

    from jarvis.services.spotify import SpotifyService
    from jarvis.services.home_assistant import HomeAssistantService
    _spotify_svc = SpotifyService(token_path=os.getenv("SPOTIFY_TOKEN_PATH", "data/spotify_tokens.json"))
    _ha_svc = HomeAssistantService()

    actions = ActionEngine(
        notes_store=notes,
        reminders_store=reminders,
        contacts_store=contacts,
        settings_store=settings,
        llm=llm,
        permissions=permissions,
        google_service=_google_svc,
        spotify_service=_spotify_svc,
        ha_service=_ha_svc,
    )
    from jarvis.core.gemini_pool import GeminiKeyPool
    from jarvis.core.vision_provider import VisionProviderChain
    _gemini_pool = GeminiKeyPool.from_env()
    _vision_chain = VisionProviderChain.from_env(gemini_pool=_gemini_pool)

    # Agent/background-task tool calls need reliable JSON function calling.
    # Groq's llama models emit bare <function=name> XML with no args for long-text
    # tools (save_note, search), so we prefer OpenAI or Gemini for agent tasks.
    # JARVIS_AGENT_PROVIDER overrides; without it, auto-detect picks OpenAI first.
    from jarvis.core.providers import select_provider as _sel, resolve_api_key as _res
    _agent_prov = _sel("JARVIS_AGENT_PROVIDER")
    _agent_key = _res(_agent_prov)
    if _agent_key and _agent_prov.name != llm.provider.name:
        _agent_tool_model = os.getenv("JARVIS_AGENT_MODEL") or _agent_prov.default_chat_model
        if _agent_prov.name == "gemini" and _gemini_pool is not None:
            # Reuse the rotating key pool so 429s auto-rotate to the next key
            _agent_tool_client = _gemini_pool
        else:
            from openai import OpenAI as _OAI
            _akw: dict = {"api_key": _agent_key}
            if _agent_prov.base_url:
                _akw["base_url"] = _agent_prov.base_url
            _agent_tool_client = _OAI(**_akw)
        logger.info("Agent tool calls: provider=%s model=%s", _agent_prov.name, _agent_tool_model)
    else:
        _agent_tool_client = llm.client
        _agent_tool_model = llm.model

    agent = ReActAgent(
        llm=llm,
        actions=actions,
        tool_client=_agent_tool_client,
        tool_model=_agent_tool_model,
    )
    task_mgr = TaskManager(agent=agent, memory=memory, sem_memory=sem_memory)

    from jarvis.core.computer_use import ComputerUseManager
    _cu_client = _gemini_pool or llm.client
    vision_model = os.getenv("JARVIS_VISION_MODEL", "models/gemini-3.6-flash" if _gemini_pool else "openai/gpt-oss-120b")
    cu_mgr = ComputerUseManager(llm_client=_cu_client, vision_model=vision_model)

    from jarvis.core.scheduler import Scheduler
    sched = Scheduler(
        task_manager=task_mgr,
        db_path=os.getenv("JARVIS_SCHEDULER_DB", "data/scheduler.db"),
        push_service=push_service,
    )
    sched.start()
    # Wire scheduler into action engine now that it exists
    actions._scheduler = sched

    # Append permissions summary to system prompt so JARVIS knows its capabilities
    llm.system_prompt = llm.system_prompt + "\n\n" + permissions.capability_summary()

    plugins = PluginManager(plugins_dir=os.getenv("JARVIS_PLUGINS_DIR", "plugins"))
    plugins.discover()

    face_engine = FaceRecognitionEngine(
        data_dir=os.getenv("JARVIS_FACE_DIR", "data/faces"),
        tolerance=float(os.getenv("JARVIS_FACE_TOLERANCE", "0.5")),
    ) if _face_available else None

    # InsightFace works on Railway (ONNX, no C++ compilation needed).
    # If it failed to init (missing package), face_engine._app will be None.
    if face_engine is not None and getattr(face_engine, "_app", None) is None:
        logger.warning("InsightFace unavailable — face recognition disabled")

    scene_analyzer = SceneAnalyzer(vision_chain=_vision_chain) if _scene_available and _vision_chain else (SceneAnalyzer() if _scene_available else None)
    scene_history = SceneHistoryStore(
        db_path=os.getenv("JARVIS_VISION_HISTORY_DB", "data/vision_history.db"),
    ) if _scene_available else None
    captures_dir = Path(os.getenv("JARVIS_CAPTURES_DIR", "data/captures"))
    captures_dir.mkdir(parents=True, exist_ok=True)

    from jarvis.core.vision_osint_store import VisionOsintStore
    vision_osint_store = VisionOsintStore(db_path=os.getenv("JARVIS_VISION_OSINT_DB", "data/vision_osint.db"))
    system_controller = ActionController(
        log_path=os.getenv("JARVIS_SYSTEM_LOG", "logs/system_actions.jsonl"),
    ) if _system_available else None
    transcriber = Transcriber() if _speech_available else None
    synthesizer = Synthesizer() if _speech_available else None

    _start_reminder_poller(reminders, push_service=push_service)

    # ── auth endpoints ────────────────────────────────────────────────────

    @app.post("/api/auth/login")
    def auth_login() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        username = (payload.get("username") or "").strip()
        password = payload.get("password") or ""
        if not username or not password:
            return {"error": "username and password are required"}, 400
        user = _auth_mgr.verify_password(username, password)
        if user is None:
            return {"error": "invalid credentials"}, 401
        tokens = _auth_mgr.create_tokens(user)
        return {**tokens, "user": user}, 200

    @app.post("/api/auth/signup")
    def auth_signup() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        username = (payload.get("username") or "").strip()
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""
        if not username or not password:
            return {"error": "username and password are required"}, 400
        if len(password) < 6:
            return {"error": "password must be at least 6 characters"}, 400
        try:
            user = _auth_mgr.create_user(username, password, role="user", email=email)
        except Exception:
            return {"error": "username already taken"}, 409
        tokens = _auth_mgr.create_tokens(user)
        logger.info("New user signed up: %s", username)
        return {**tokens, "user": user}, 201

    @app.post("/api/auth/google")
    def auth_google() -> tuple[dict, int]:
        """Exchange a Google ID token for JARVIS JWT tokens.

        Body: { "token": "<Google ID token from frontend>" }
        """
        if not _google_client_id:
            return {"error": "Google OAuth is not configured on this server"}, 501

        payload = request.get_json(silent=True) or {}
        id_token_str = (payload.get("token") or "").strip()
        if not id_token_str:
            return {"error": "token is required"}, 400

        try:
            from google.oauth2 import id_token as _id_token
            from google.auth.transport import requests as _grequests
            idinfo = _id_token.verify_oauth2_token(
                id_token_str, _grequests.Request(), _google_client_id
            )
        except ValueError as exc:
            logger.warning("Google token verification failed: %s", exc)
            return {"error": "invalid Google token"}, 401

        email = idinfo.get("email", "").lower()
        if not email or not idinfo.get("email_verified"):
            return {"error": "Google account email not verified"}, 401

        if _allowed_emails and email not in _allowed_emails:
            logger.warning("Login attempt from non-allowed email: %s", email)
            return {"error": "this Google account is not authorised to access JARVIS"}, 403

        user = _auth_mgr.create_or_get_google_user(
            email=email,
            name=idinfo.get("name", email.split("@")[0]),
            google_sub=idinfo["sub"],
        )
        tokens = _auth_mgr.create_tokens(user)
        return {**tokens, "user": user}, 200

    @app.post("/api/auth/refresh")
    def auth_refresh() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        refresh_token = (payload.get("refresh_token") or "").strip()
        if not refresh_token:
            return {"error": "refresh_token is required"}, 400
        tokens = _auth_mgr.refresh_access_token(refresh_token)
        if tokens is None:
            return {"error": "invalid or expired refresh token"}, 401
        return tokens, 200

    @app.post("/api/auth/logout")
    def auth_logout() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        refresh_token = payload.get("refresh_token") or ""
        if refresh_token:
            _auth_mgr.revoke_refresh_token(refresh_token)
        return {"ok": True}, 200

    @app.get("/api/auth/me")
    def auth_me() -> tuple[dict, int]:
        user = getattr(request, "current_user", None)
        if user is None:
            return {"error": "not authenticated"}, 401
        return {"user": user}, 200

    @app.get("/api/auth/config")
    def auth_config() -> tuple[dict, int]:
        """Tell the frontend which login methods are available."""
        from jarvis.auth.microsoft_oidc import MicrosoftOIDC as _MSOIDC
        _ms = _MSOIDC()
        return {
            "auth_enabled": _auth_enabled,
            "google_enabled": bool(_google_client_id),
            "google_client_id": _google_client_id,
            "password_enabled": True,
            "microsoft_enabled": _ms.configured,
            "saml_enabled": bool(os.getenv("SAML_IDP_SSO_URL", "")),
            "tts_backend_enabled": bool(os.getenv("ELEVENLABS_API_KEY", "")),
        }, 200

    # ── SAML 2.0 SP routes ────────────────────────────────────────────────

    @app.get("/auth/saml/metadata")
    def saml_metadata():
        """SP metadata XML — register this URL in your IdP (Okta, Azure, etc.)."""
        try:
            from jarvis.auth.saml_provider import SAMLProvider as _SP
            xml = _SP().get_metadata(_backend_url)
            from flask import Response
            return Response(xml, mimetype="application/xml")
        except ImportError:
            return {"error": "python3-saml not installed"}, 501
        except Exception as exc:
            logger.exception("saml_metadata error: %s", exc)
            return {"error": str(exc)}, 500

    @app.get("/auth/saml/login")
    def saml_login():
        """Redirect browser to IdP SSO URL (SP-initiated login)."""
        try:
            from jarvis.auth.saml_provider import SAMLProvider as _SP
            relay = request.args.get("relay_state", "")
            redirect_url = _SP().build_login_redirect(_backend_url, relay_state=relay)
            from flask import redirect as _redirect
            return _redirect(redirect_url)
        except ImportError:
            return {"error": "python3-saml not installed"}, 501
        except RuntimeError as exc:
            return {"error": str(exc)}, 501
        except Exception as exc:
            logger.exception("saml_login error: %s", exc)
            return {"error": str(exc)}, 500

    @app.post("/auth/saml/acs")
    def saml_acs():
        """Assertion Consumer Service — IdP POSTs the SAMLResponse here."""
        try:
            from jarvis.auth.saml_provider import SAMLProvider as _SP
            from urllib.parse import urlparse as _up
            parsed = _up(_backend_url)

            request_data = {
                "https": "on" if parsed.scheme == "https" else "off",
                "http_host": parsed.netloc,
                "server_port": str(parsed.port or (443 if parsed.scheme == "https" else 80)),
                "script_name": "/auth/saml/acs",
                "request_uri": "/auth/saml/acs",
                "get_data": {},
                "post_data": {
                    "SAMLResponse": request.form.get("SAMLResponse", ""),
                    "RelayState": request.form.get("RelayState", ""),
                },
            }
            attrs = _SP().process_response(_backend_url, request_data)
        except ImportError:
            return {"error": "python3-saml not installed"}, 501
        except ValueError as exc:
            return {"error": str(exc)}, 401
        except Exception as exc:
            logger.exception("saml_acs error: %s", exc)
            return {"error": str(exc)}, 500

        user = _auth_mgr.create_or_get_saml_user(
            email=attrs["email"],
            name=attrs["name"],
            name_id=attrs["name_id"],
            idp=attrs["idp_entity_id"],
        )
        tokens = _auth_mgr.create_tokens(user)
        # Redirect to frontend with tokens in query string
        # (SPA reads them via useEffect on /auth/callback)
        from flask import redirect as _redirect
        from urllib.parse import urlencode as _ue
        params = _ue({
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
        })
        return _redirect(f"{_frontend_url}/auth/callback?{params}")

    @app.post("/auth/saml/slo")
    def saml_slo():
        """Single Logout — IdP-initiated SLO (best-effort)."""
        refresh_token = request.form.get("refresh_token") or request.args.get("refresh_token", "")
        if refresh_token:
            _auth_mgr.revoke_refresh_token(refresh_token)
        from flask import redirect as _redirect
        return _redirect(f"{_frontend_url}?slo=1")

    # ── Microsoft OIDC routes ─────────────────────────────────────────────

    @app.get("/auth/microsoft/login")
    def microsoft_login():
        """Redirect to Microsoft authorization endpoint."""
        try:
            from jarvis.auth.microsoft_oidc import MicrosoftOIDC as _MSOIDC
            ms = _MSOIDC()
            if not ms.configured:
                return {"error": "Microsoft OIDC not configured"}, 501
            redirect_uri = f"{_backend_url}/auth/microsoft/callback"
            state = request.args.get("state", "")
            url = ms.get_login_url(redirect_uri=redirect_uri, state=state)
            from flask import redirect as _redirect
            return _redirect(url)
        except Exception as exc:
            logger.exception("microsoft_login error: %s", exc)
            return {"error": str(exc)}, 500

    @app.get("/auth/microsoft/callback")
    def microsoft_callback():
        """Exchange authorization code, create/find user, redirect to frontend."""
        code = request.args.get("code", "")
        error = request.args.get("error", "")
        if error or not code:
            desc = request.args.get("error_description", error or "no code")
            from flask import redirect as _redirect
            from urllib.parse import urlencode as _ue
            return _redirect(f"{_frontend_url}/login?error={_ue({'e': desc})}")
        try:
            from jarvis.auth.microsoft_oidc import MicrosoftOIDC as _MSOIDC
            ms = _MSOIDC()
            redirect_uri = f"{_backend_url}/auth/microsoft/callback"
            identity = ms.exchange_code(code=code, redirect_uri=redirect_uri)
        except Exception as exc:
            logger.exception("microsoft_callback error: %s", exc)
            from flask import redirect as _redirect
            return _redirect(f"{_frontend_url}/login?error=microsoft_failed")

        email = identity["email"]
        if _allowed_emails and email not in _allowed_emails:
            logger.warning("Microsoft login from non-allowed email: %s", email)
            from flask import redirect as _redirect
            return _redirect(f"{_frontend_url}/login?error=not_allowed")

        user = _auth_mgr.create_or_get_microsoft_user(
            email=email, name=identity["name"], microsoft_sub=identity["sub"]
        )
        tokens = _auth_mgr.create_tokens(user)
        from flask import redirect as _redirect
        from urllib.parse import urlencode as _ue
        params = _ue({
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
        })
        return _redirect(f"{_frontend_url}/auth/callback?{params}")

    # ── SCIM 2.0 endpoints ────────────────────────────────────────────────

    from jarvis.auth.scim_server import (
        check_scim_auth as _scim_auth,
        scim_error as _scim_err,
        SERVICE_PROVIDER_CONFIG as _SPC,
        RESOURCE_TYPES as _RTS,
        SCHEMA_USER as _SCHEMA_USER,
        parse_filter as _parse_filter,
        SCIM_SCHEMA_LIST,
    )

    @app.get("/scim/v2/ServiceProviderConfig")
    def scim_service_provider_config():
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        return _SPC, 200

    @app.get("/scim/v2/ResourceTypes")
    def scim_resource_types():
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        return _RTS, 200

    @app.get("/scim/v2/Schemas")
    def scim_schemas():
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        return _SCHEMA_USER, 200

    @app.get("/scim/v2/Users")
    def scim_list_users():
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        start_index = int(request.args.get("startIndex", 1))
        count = int(request.args.get("count", 100))
        filter_str = request.args.get("filter", "")
        f = _parse_filter(filter_str)
        attr, val = (list(f.items())[0] if f else ("", ""))
        resources, total = _auth_mgr.scim_list_users(start_index, count, attr, val)
        return {
            "schemas": [SCIM_SCHEMA_LIST],
            "totalResults": total,
            "startIndex": start_index,
            "itemsPerPage": len(resources),
            "Resources": resources,
        }, 200

    @app.post("/scim/v2/Users")
    def scim_create_user():
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        payload = request.get_json(silent=True) or {}
        try:
            user = _auth_mgr.scim_provision_user(payload)
        except ValueError as exc:
            return _scim_err(str(exc), 409, "uniqueness")
        return user, 201

    @app.get("/scim/v2/Users/<user_id>")
    def scim_get_user(user_id: str):
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        user = _auth_mgr.scim_get_user(user_id)
        if not user:
            return _scim_err("User not found", 404)
        return user, 200

    @app.put("/scim/v2/Users/<user_id>")
    def scim_replace_user(user_id: str):
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        payload = request.get_json(silent=True) or {}
        user = _auth_mgr.scim_replace_user(user_id, payload)
        if not user:
            return _scim_err("User not found", 404)
        return user, 200

    @app.patch("/scim/v2/Users/<user_id>")
    def scim_patch_user(user_id: str):
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        payload = request.get_json(silent=True) or {}
        operations = payload.get("Operations", [])
        user = _auth_mgr.scim_patch_user(user_id, operations)
        if not user:
            return _scim_err("User not found", 404)
        return user, 200

    @app.delete("/scim/v2/Users/<user_id>")
    def scim_delete_user(user_id: str):
        if not _scim_auth():
            return _scim_err("Unauthorized", 401)
        ok = _auth_mgr.scim_deprovision_user(user_id)
        if not ok:
            return _scim_err("User not found", 404)
        return "", 204

    @app.get("/api/permissions")
    def get_permissions() -> tuple[dict, int]:
        return {"permissions": permissions.to_api()}, 200

    @app.patch("/api/permissions")
    def update_permission() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        perm_id = (payload.get("id") or "").strip()
        granted = payload.get("granted")
        if not perm_id or granted is None:
            return {"error": "id and granted are required"}, 400
        try:
            perm = Permission(perm_id)
        except ValueError:
            return {"error": f"Unknown permission: {perm_id}"}, 400
        permissions.set(perm, bool(granted))
        # Refresh capability summary in system prompt
        llm.system_prompt = llm.system_prompt.split("\n\n## Your active capabilities")[0] + "\n\n" + permissions.capability_summary()
        return {"permissions": permissions.to_api()}, 200

    @app.post("/api/permissions/grant-all")
    def grant_all_permissions() -> tuple[dict, int]:
        permissions.grant_all()
        llm.system_prompt = llm.system_prompt.split("\n\n## Your active capabilities")[0] + "\n\n" + permissions.capability_summary()
        return {"permissions": permissions.to_api()}, 200

    @app.post("/api/permissions/revoke-all")
    def revoke_all_permissions() -> tuple[dict, int]:
        permissions.revoke_all()
        llm.system_prompt = llm.system_prompt.split("\n\n## Your active capabilities")[0] + "\n\n" + permissions.capability_summary()
        return {"permissions": permissions.to_api()}, 200

    @app.get("/api/health")
    def health() -> tuple[dict, int]:
        return {"status": "ok", "interactions": memory.count()}, 200

    _WEARABLE_SYSTEM_PROMPT_SUFFIX = (
        " Respond in 1-2 short sentences only. No markdown, no bullet points, no headers. "
        "Speak naturally as if talking out loud."
    )

    _LANGUAGE_NAMES: dict[str, str] = {
        "en": "English", "hi": "Hindi", "es": "Spanish", "fr": "French",
        "de": "German", "ja": "Japanese", "zh": "Chinese", "ar": "Arabic",
        "pt": "Portuguese", "ko": "Korean", "ru": "Russian", "it": "Italian",
    }

    def _language_suffix() -> str:
        lang = settings.get("preferred_language", "auto")
        if lang and lang != "auto" and lang in _LANGUAGE_NAMES:
            return f" Always respond in {_LANGUAGE_NAMES[lang]}, regardless of the language the user writes in."
        return ""

    @app.post("/api/chat")
    def chat() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        user_input = (payload.get("message") or "").strip()
        if not user_input:
            return {"error": "message field is required"}, 400

        wearable_mode = bool(payload.get("wearable_mode", False))
        lang_suffix = _language_suffix()
        base = llm.system_prompt + lang_suffix
        sys_override = (base + _WEARABLE_SYSTEM_PROMPT_SUFFIX) if wearable_mode else (lang_suffix and base or None)

        intent = parser.parse_intent(user_input)
        uid = _uid()
        intent["_user_id"] = uid
        ctx = _build_context(memory, user_id=uid)
        tool_used: str | None = None

        if intent.get("action_required"):
            # Regex matched confidently — dispatch directly, no LLM needed
            response = actions.execute_action(intent)
        else:
            plugin_response = plugins.dispatch(user_input)
            if plugin_response is not None:
                response = plugin_response
            else:
                # Let the LLM decide: answer directly or call a tool
                text, tool_name, tool_args = llm.query_with_tools(
                    user_input, tools=TOOLS, memory=ctx,
                    system_prompt_override=sys_override,
                )
                if tool_name:
                    tool_intent = tool_call_to_intent(tool_name, tool_args or {})
                    tool_intent["_user_id"] = uid
                    tool_result = actions.execute_action(tool_intent)
                    tool_used = tool_name
                    response = llm.finish_after_tool(
                        user_input, tool_name, tool_result, memory=ctx,
                        system_prompt_override=sys_override,
                    )
                    intent = {**intent, "type": tool_intent.get("type", intent.get("type"))}
                else:
                    response = text or ""

        interaction_id = memory.store_interaction(
            user_input=user_input,
            response=response,
            intent_type=intent.get("type"),
            user_id=uid,
        )
        sem_memory.index_interaction(interaction_id, user_input, user_id=uid)
        result: dict = {
            "id": interaction_id,
            "response": response,
            "intent": intent.get("type"),
        }
        if tool_used:
            result["tool_used"] = tool_used
        return result, 200

    _VOICE_SYSTEM_PROMPT = (
        "You are Jarvis, a voice assistant. "
        "Reply in 1-2 short sentences only — no lists, no markdown, no filler. "
        "Be direct and natural, as if speaking aloud."
    )

    _WEARABLE_SYSTEM_PROMPT_SUFFIX = (
        " Respond in 1-2 short sentences only. No markdown, no bullet points, no headers. "
        "Speak naturally as if talking out loud."
    )

    @app.post("/api/voice-chat")
    def voice_chat() -> tuple[dict, int]:
        """Voice mode endpoint — runs full tool-calling loop so commands like
        'set volume to 50' or 'what's the brightness' actually execute,
        then wraps the result in a short spoken reply."""
        payload = request.get_json(silent=True) or {}
        user_input = (payload.get("message") or "").strip()
        if not user_input:
            return {"error": "message field is required"}, 400

        wearable_mode = bool(payload.get("wearable_mode", False))
        voice_sys = _VOICE_SYSTEM_PROMPT + (_WEARABLE_SYSTEM_PROMPT_SUFFIX if wearable_mode else "")

        uid = _uid()
        ctx = _build_context(memory, user_id=uid)
        tool_used: str | None = None

        text, tool_name, tool_args = llm.query_with_tools(
            user_input,
            tools=TOOLS,
            memory=ctx,
            system_prompt_override=voice_sys,
            max_tokens_override=80 if wearable_mode else 120,
        )

        if tool_name:
            tool_intent = tool_call_to_intent(tool_name, tool_args or {})
            tool_intent["_user_id"] = uid
            tool_result = actions.execute_action(tool_intent)
            tool_used = tool_name
            response = llm.finish_after_tool(
                user_input,
                tool_name,
                tool_result,
                memory=ctx,
                system_prompt_override=voice_sys,
                max_tokens_override=60 if wearable_mode else 80,
            )
        else:
            response = text or ""

        interaction_id = memory.store_interaction(
            user_input=user_input,
            response=response,
            intent_type="voice",
            user_id=uid,
        )
        sem_memory.index_interaction(interaction_id, user_input, user_id=uid)
        result: dict = {"id": interaction_id, "response": response}
        if tool_used:
            result["tool_used"] = tool_used
        return result, 200

    @app.post("/api/tts")
    def tts():
        """Text-to-speech. Tries ElevenLabs, falls back to macOS say."""
        import subprocess, tempfile, platform
        from flask import Response as FlaskResponse
        payload = request.get_json(silent=True) or {}
        text = (payload.get("text") or "").strip()
        if not text:
            return {"error": "text is required"}, 400

        # ── ElevenLabs (primary, with voice fallback) ────────────────────────
        api_key = os.getenv("ELEVENLABS_API_KEY")
        # Support two voice IDs: primary and fallback (e.g. if one hits quota)
        voice_ids = [v.strip() for v in [
            os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
            os.getenv("ELEVENLABS_VOICE_ID_2", "yhf80q1381zd2JJQ4tM7"),
        ] if v.strip()]
        if api_key:
            from elevenlabs.client import ElevenLabs as _EL
            client = _EL(api_key=api_key)
            for voice_id in voice_ids:
                try:
                    chunks = client.text_to_speech.convert(
                        voice_id=voice_id,
                        text=text,
                        model_id="eleven_multilingual_v2",
                        output_format="mp3_44100_128",
                    )
                    audio_bytes = b"".join(chunks)
                    return FlaskResponse(audio_bytes, mimetype="audio/mpeg")
                except Exception as exc:
                    logger.warning("ElevenLabs voice %s failed, trying next: %s", voice_id, exc)
            logger.warning("All ElevenLabs voices exhausted, falling back to local TTS")

        # ── macOS say (local dev fallback) ────────────────────────────────────
        # `say` outputs AIFF-C which Chrome's decodeAudioData() cannot decode.
        # Use afconvert to produce a standard PCM WAV that all browsers support.
        if platform.system() == "Darwin":
            tmp_aiff = tmp_wav = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
                    tmp_aiff = f.name
                tmp_wav = tmp_aiff.replace(".aiff", ".wav")
                word_count = len(text.split())
                timeout_s = max(15, word_count * 2)
                subprocess.run(
                    ["say", "-v", "Daniel", "-o", tmp_aiff, text],
                    timeout=timeout_s, check=True, capture_output=True,
                )
                subprocess.run(
                    ["afconvert", "-f", "WAVE", "-d", "LEI16@22050", tmp_aiff, tmp_wav],
                    timeout=10, check=True, capture_output=True,
                )
                with open(tmp_wav, "rb") as f:
                    audio_bytes = f.read()
                return FlaskResponse(audio_bytes, mimetype="audio/wav")
            except Exception as exc:
                logger.error("macOS say TTS failed: %s", exc)
            finally:
                for p in (tmp_aiff, tmp_wav):
                    if p:
                        try:
                            os.unlink(p)
                        except OSError:
                            pass

        return {"error": "TTS unavailable"}, 503

    @app.post("/api/agent")
    def agent_run() -> tuple[dict, int]:
        """Multi-step agent endpoint.

        Body: { "goal": str, "max_steps": int (optional, default 8) }
        Returns the final answer plus a trace of every tool call made.
        """
        payload = request.get_json(silent=True) or {}
        goal = (payload.get("goal") or payload.get("message") or "").strip()
        if not goal:
            return {"error": "goal field is required"}, 400
        max_steps = int(payload.get("max_steps", 8))
        agent.max_steps = min(max(1, max_steps), 15)

        uid = _uid()
        ctx = _build_context(memory, user_id=uid)
        result = agent.run(goal, memory_context=ctx)

        interaction_id = memory.store_interaction(
            user_input=goal,
            response=result.final_answer,
            intent_type="agent",
            metadata={"steps": len(result.steps), "stopped_early": result.stopped_early},
            user_id=uid,
        )
        sem_memory.index_interaction(interaction_id, goal, user_id=uid)

        return {
            "id": interaction_id,
            "response": result.final_answer,
            "intent": "agent",
            **result.to_dict(),
        }, 200

    # ── background tasks ──────────────────────────────────────────────

    @app.post("/api/tasks")
    def submit_task() -> tuple[dict, int]:
        """Submit a goal to run as a background agent task.

        Body: { "goal": str, "max_steps": int (optional, default 8) }
        Returns immediately with a task_id to poll.
        """
        payload = request.get_json(silent=True) or {}
        goal = (payload.get("goal") or payload.get("message") or "").strip()
        if not goal:
            return {"error": "goal is required"}, 400
        max_steps = min(max(1, int(payload.get("max_steps", 8))), 15)
        task_id = task_mgr.submit(goal, max_steps=max_steps)
        return {"task_id": task_id, "status": "pending", "goal": goal}, 202

    @app.get("/api/tasks")
    def list_tasks() -> tuple[dict, int]:
        return {"tasks": task_mgr.list_all()}, 200

    @app.get("/api/tasks/<task_id>")
    def get_task(task_id: str) -> tuple[dict, int]:
        task = task_mgr.get(task_id)
        if task is None:
            return {"error": "task not found"}, 404
        return task.to_dict(), 200

    @app.delete("/api/tasks/<task_id>")
    def delete_task(task_id: str) -> tuple[dict, int]:
        if task_mgr.delete(task_id):
            return {"deleted": True, "task_id": task_id}, 200
        return {"error": "task not found"}, 404

    @app.patch("/api/tasks/<task_id>")
    def rename_task(task_id: str) -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        label = (payload.get("label") or "").strip()
        if not label:
            return {"error": "label is required"}, 400
        task = task_mgr.get(task_id)
        if task is None:
            return {"error": "task not found"}, 404
        task.label = label
        return task.to_dict(), 200

    @app.post("/api/chat/stream")
    def chat_stream():
        from flask import Response, stream_with_context
        import json as _json

        payload = request.get_json(silent=True) or {}
        user_input = (payload.get("message") or "").strip()
        if not user_input:
            return {"error": "message field is required"}, 400

        intent = parser.parse_intent(user_input)
        uid = _uid()
        intent["_user_id"] = uid

        # Action-engine / plugin intents return instantly — no streaming needed.
        # Wrap as a single SSE event so the frontend can use one code path.
        if intent.get("action_required"):
            response_text = actions.execute_action(intent)
        else:
            plugin_response = plugins.dispatch(user_input)
            if plugin_response is not None:
                response_text = plugin_response
            else:
                response_text = None  # will stream below

        if response_text is not None:
            interaction_id = memory.store_interaction(
                user_input=user_input,
                response=response_text,
                intent_type=intent.get("type"),
                user_id=uid,
            )

            def _single():
                yield f"data: {_json.dumps({'token': response_text})}\n\n"
                yield f"data: {_json.dumps({'done': True, 'intent': intent.get('type'), 'id': interaction_id})}\n\n"

            return Response(
                stream_with_context(_single()),
                mimetype="text/event-stream",
                headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
            )

        # LLM path: stream tokens
        ctx = _build_context(memory, user_id=uid)
        stream_sys = (llm.system_prompt + _language_suffix()) or None

        def _stream():
            full: list[str] = []
            for token in llm.stream_llm(user_input, memory=ctx, system_prompt_override=stream_sys):
                full.append(token)
                yield f"data: {_json.dumps({'token': token})}\n\n"
            full_text = "".join(full)
            interaction_id = memory.store_interaction(
                user_input=user_input,
                response=full_text,
                intent_type=intent.get("type"),
                user_id=uid,
            )
            yield f"data: {_json.dumps({'done': True, 'intent': intent.get('type'), 'id': interaction_id})}\n\n"

        return Response(
            stream_with_context(_stream()),
            mimetype="text/event-stream",
            headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
        )

    @app.get("/api/history")
    def history() -> tuple[dict, int]:
        try:
            limit = int(request.args.get("limit", 20))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        return {"interactions": memory.recent(limit=min(limit, 200), user_id=_uid())}, 200

    @app.get("/api/search")
    def search() -> tuple[dict, int]:
        query = (request.args.get("q") or "").strip()
        if not query:
            return {"error": "q is required"}, 400
        # Try semantic search first; fall back to substring if unavailable
        uid = _uid()
        if sem_memory.available:
            results = sem_memory.search(query, limit=20, user_id=uid)
            if results:
                return {"results": results, "mode": "semantic"}, 200
        return {"results": memory.search(query, limit=20, user_id=uid), "mode": "substring"}, 200

    @app.post("/api/research/person")
    def research_person_endpoint() -> tuple[dict, int]:
        """Aggregate public web information about a person.

        Body: { "name": str, "company": str (opt), "role": str (opt) }
        """
        from jarvis.services.people_research import research_person as _rp
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return {"error": "name is required"}, 400
        profile = _rp(
            name=name,
            company=(payload.get("company") or ""),
            role=(payload.get("role") or ""),
            llm=llm,
        )
        return {"profile": profile.to_dict()}, 200

    @app.post("/api/research/company")
    def research_company_endpoint() -> tuple[dict, int]:
        """Aggregate public web information about a company.

        Body: { "name": str }
        """
        from jarvis.services.people_research import research_company as _rc
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return {"error": "name is required"}, 400
        profile = _rc(name=name, llm=llm)
        return {"profile": profile.to_dict()}, 200

    @app.get("/api/search/web")
    def web_search_endpoint() -> tuple[dict, int]:
        """Live web search — returns raw results + optional LLM summary."""
        from jarvis.services.web_search import search, search_and_summarize
        query = (request.args.get("q") or "").strip()
        if not query:
            return {"error": "q is required"}, 400
        try:
            limit = int(request.args.get("limit", 5))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        summarize = request.args.get("summarize", "true").lower() != "false"
        results = search(query, limit=min(limit, 10))
        summary = search_and_summarize(query, llm=llm, limit=limit) if summarize else None
        return {"query": query, "results": results, "summary": summary}, 200

    @app.post("/api/research")
    def research_endpoint() -> tuple[dict, int]:
        """People / company / topic research pipeline.

        Body: { "subject": str, "kind": "person"|"company"|"topic",
                "company": str (optional hint for person), "role": str (optional) }
        """
        from jarvis.services.research import ResearchPipeline
        payload = request.get_json(silent=True) or {}
        subject = (payload.get("subject") or payload.get("name") or "").strip()
        if not subject:
            return {"error": "subject is required"}, 400
        kind = (payload.get("kind") or "person").lower()
        pipeline = ResearchPipeline(llm=llm)

        if kind == "company":
            profile = pipeline.research_company(subject)
        elif kind == "topic":
            profile = pipeline.research_topic(subject)
        else:
            hints = {}
            if payload.get("company"):
                hints["company"] = payload["company"]
            profile = pipeline.research_person(subject, hints=hints)

        return profile.to_dict(), 200

    @app.get("/api/search/semantic")
    def semantic_search() -> tuple[dict, int]:
        """Dedicated semantic search endpoint — never falls back to substring."""
        query = (request.args.get("q") or "").strip()
        if not query:
            return {"error": "q is required"}, 400
        if not sem_memory.available:
            return {"error": "Semantic search unavailable — sentence-transformers not loaded."}, 503
        try:
            limit = int(request.args.get("limit", 10))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        return {"results": sem_memory.search(query, limit=min(limit, 50), user_id=_uid()), "mode": "semantic"}, 200

    @app.get("/api/plugins")
    def list_plugins() -> tuple[dict, int]:
        return {"plugins": plugins.list()}, 200

    @app.post("/api/plugins/<name>/toggle")
    def toggle_plugin(name: str) -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        enabled = bool(payload.get("enabled", True))
        if not plugins.set_enabled(name, enabled):
            return {"error": f"plugin {name!r} not found"}, 404
        return {"name": name, "enabled": enabled}, 200

    @app.post("/api/plugins/install")
    def install_plugin() -> tuple[dict, int]:
        """Upload a .py file and hot-load it as a new plugin."""
        file = request.files.get("file")
        if file is None or not file.filename:
            return {"error": "file is required"}, 400
        filename = Path(file.filename).name
        if not filename.endswith(".py"):
            return {"error": "only .py files are accepted"}, 400
        plugins_dir = plugins.plugins_dir
        plugins_dir.mkdir(parents=True, exist_ok=True)
        dest = plugins_dir / filename
        file.save(str(dest))
        before = set(plugins.plugins)
        plugins._load_file(dest)
        new_names = list(set(plugins.plugins) - before)
        return {"installed": new_names, "plugins": plugins.list()}, 201

    @app.delete("/api/plugins/<name>")
    def delete_plugin(name: str) -> tuple[dict, int]:
        """Unload and delete a plugin's source file."""
        plugin = plugins.get(name)
        if plugin is None:
            return {"error": f"plugin {name!r} not found"}, 404
        # Find the file by inspecting the module path
        import inspect as _inspect
        try:
            src_file = Path(_inspect.getfile(type(plugin)))
        except (TypeError, OSError):
            return {"error": "cannot determine source file for built-in plugin"}, 400
        plugins.plugins.pop(name, None)
        plugins._enabled.pop(name, None)
        plugins._save_state()
        try:
            src_file.unlink(missing_ok=True)
        except OSError as exc:
            return {"error": str(exc)}, 500
        return {"deleted": name, "plugins": plugins.list()}, 200

    @app.post("/api/plugins/reload")
    def reload_plugins() -> tuple[dict, int]:
        """Re-scan the plugins directory and hot-load any new files."""
        plugins.discover()
        return {"plugins": plugins.list()}, 200

    @app.get("/api/plugins/template")
    def plugin_template() -> tuple[dict, int]:
        """Return the example plugin template source."""
        template_path = Path(__file__).parent.parent.parent.parent / "plugins" / "example_template.py"
        if template_path.exists():
            return {"template": template_path.read_text(encoding="utf-8")}, 200
        # Inline fallback
        return {"template": '''from jarvis.plugins import BasePlugin, PluginManifest

class MyPlugin(BasePlugin):
    def get_manifest(self) -> PluginManifest:
        return PluginManifest(
            name="my_plugin",
            version="0.1.0",
            description="Describe what this plugin does.",
            author="your-name",
            keywords=["trigger", "word"],
            priority=100,
        )

    def run(self, query: str, **kwargs) -> str:
        return f"My plugin handled: {query}"
'''}, 200

    @app.post("/api/face/identify")
    def identify_face() -> tuple[dict, int]:
        """Match an uploaded image against the known-faces DB."""
        if face_engine is None:
            return {"success": False, "matched": False, "error": "Face recognition unavailable on this server"}, 503
        image = request.files.get("image")
        if image is None or not image.filename:
            return {"success": False, "error": "image file is required"}, 400
        with _saved_upload(image) as path:
            result = face_engine.recognize_face(path)

        face_id: str | None = None
        if result.matched and result.person and result.confidence >= 0.6:
            face_id = result.person.name
            cached = result.person.additional_data.get("dossier")
            if not cached:
                entry = vision_osint_store.get(face_id)
                if not entry or entry["status"] == "error":
                    vision_osint_store.set_pending(face_id, face_id)
                    def _bg_research(name: str, fid: str) -> None:
                        try:
                            from jarvis.services.people_research import research_person
                            profile = research_person(name, llm=llm)
                            dossier = {
                                "subject": name,
                                "kind": "person",
                                "summary": profile.summary,
                                "sections": {
                                    "Career": profile.current_role or profile.company or "",
                                    "Education": "; ".join(profile.education),
                                    "Notable Work": "; ".join(profile.notable_work),
                                    "Online Presence": " ".join(profile.public_links),
                                },
                                "sources": [{"title": s, "url": s, "snippet": ""} for s in profile.sources],
                            }
                            vision_osint_store.set_done(fid, dossier)
                            if face_engine:
                                person = next((p for p in face_engine.known_faces if p.name == name), None)
                                if person:
                                    person.additional_data["dossier"] = dossier
                                    face_engine.save()
                        except Exception as exc:
                            vision_osint_store.set_error(fid, str(exc))
                    import threading
                    threading.Thread(target=_bg_research, args=(face_id, face_id), daemon=True).start()

        return {
            "success": True,
            "matched": result.matched,
            "confidence": result.confidence,
            "processing_time": result.processing_time,
            "person": _person_to_dict(result.person) if result.person else None,
            "formatted_result": format_recognition_result(result),
            "error": result.error_message,
            "face_id": face_id,
        }, 200

    # Frontend dashboard expects this name; we keep the route as an alias.
    app.add_url_rule("/api/camera/recognize", view_func=identify_face, methods=["POST"])

    @app.post("/api/face/add-person")
    def face_add_person() -> tuple[dict, int]:
        """Upload one or more face images for a named person.

        Form fields:
          name  — person's display name (required)
          image — one or more image files (required)
        """
        if face_engine is None:
            return {"success": False, "error": "Face recognition unavailable"}, 503
        name = (request.form.get("name") or "").strip()
        if not name:
            return {"success": False, "error": "name is required"}, 400
        organization = (request.form.get("organization") or "").strip() or None
        uploads = request.files.getlist("image")
        uploads = [f for f in uploads if f and f.filename]
        if not uploads:
            return {"success": False, "error": "at least one image file is required"}, 400

        # Save images permanently under data/faces/<name>/
        person_dir = face_engine.data_dir / secure_filename(name)
        person_dir.mkdir(parents=True, exist_ok=True)
        saved_paths: list[str] = []
        tmp_paths: list[str] = []
        try:
            for i, upload in enumerate(uploads):
                original = secure_filename(upload.filename or "face.jpg")
                suffix = Path(original).suffix or ".jpg"
                # Write to temp first, then move to permanent location
                fd, tmp = tempfile.mkstemp(suffix=suffix)
                os.close(fd)
                upload.save(tmp)
                tmp_paths.append(tmp)
                dest = str(person_dir / f"{i:03d}{suffix}")
                os.replace(tmp, dest)
                saved_paths.append(dest)

            metadata = {"organization": organization} if organization else {}
            person = face_engine.add_person(name=name, image_paths=saved_paths, metadata=metadata)
            if person is None:
                # Clean up saved images if encoding failed
                for p in saved_paths:
                    try:
                        os.unlink(p)
                    except OSError:
                        pass
                return {"success": False, "error": "No valid face images processed"}, 422

            return {
                "success": True,
                "name": person.name,
                "images_added": len(saved_paths),
                "statistics": face_engine.get_statistics(),
            }, 200
        finally:
            # Only clean up any remaining temp files (already replaced above)
            for p in tmp_paths:
                try:
                    if os.path.exists(p):
                        os.unlink(p)
                except OSError:
                    pass

    @app.post("/api/face/process-excel")
    def face_process_excel() -> tuple[dict, int]:
        excel = request.files.get("excel_file")
        if excel is None or not excel.filename:
            return {"success": False, "error": "excel_file is required"}, 400
        images_folder = (request.form.get("images_folder") or "").strip() or None
        tolerance = request.form.get("tolerance")
        if tolerance:
            try:
                face_engine.tolerance = float(tolerance)
            except ValueError:
                return {"success": False, "error": "tolerance must be a number"}, 400
        with _saved_upload(excel, suffix=".xlsx") as path:
            try:
                added = face_engine.load_from_excel(path, images_folder=images_folder)
            except ValueError as exc:
                return {"success": False, "error": str(exc)}, 400
        return {
            "success": True,
            "message": f"Imported {added} people.",
            "statistics": face_engine.get_statistics(),
        }, 200

    @app.get("/api/face/statistics")
    def face_statistics() -> tuple[dict, int]:
        return {"statistics": face_engine.get_statistics()}, 200

    @app.get("/api/face/image")
    def face_image():
        """Serve a person's primary face photo by name."""
        name = request.args.get("name", "").strip()
        if not name:
            return {"error": "name is required"}, 400
        person = next(
            (p for p in face_engine.known_faces if p.name.lower() == name.lower()),
            None,
        )
        if not person or not person.primary_image_path:
            return {"error": "person or image not found"}, 404

        stored = person.primary_image_path
        p = Path(stored)

        # Resolve relative paths: stored as "data/faces/images/..." relative
        # to the backend root (two levels above face_engine.data_dir).
        # Try multiple bases so the endpoint works regardless of CWD.
        candidates = [p]
        if not p.is_absolute():
            candidates = [
                Path.cwd() / stored,
                face_engine.data_dir.parent.parent / stored,
                face_engine.data_dir.parent / stored,
                face_engine.data_dir / stored,
            ]

        img_path = next((c for c in candidates if c.exists()), None)
        if img_path is None:
            return {"error": "image file not found on disk"}, 404

        mime = "image/png" if img_path.suffix.lower() == ".png" else "image/jpeg"
        return send_file(str(img_path.resolve()), mimetype=mime)

    @app.post("/api/vision/analyze")
    def vision_analyze() -> tuple[dict, int]:
        if scene_analyzer is None:
            return {"error": "Scene analysis unavailable on this server"}, 503
        image = request.files.get("image")
        if image is None or not image.filename:
            return {"error": "image file is required"}, 400
        # Persist a copy of the upload so /api/vision/history can show it.
        capture_name = f"{int(datetime.now(timezone.utc).timestamp())}_{secure_filename(image.filename)}"
        capture_path = captures_dir / capture_name
        image.save(capture_path)
        scene = scene_analyzer.describe_scene(str(capture_path))
        results = {
            "description": scene.description,
            "scene_description": scene.description,
            "confidence": scene.confidence,
            "objects": scene.objects_detected,
            "objects_detected": scene.objects_detected,
            "scene_type": scene.scene_type,
            "colors": scene.colors,
            "mood": scene.mood,
            "model_used": scene.model_used,
        }
        entry_id = scene_history.record(
            {**results, "model_used": scene.model_used},
            image_url=f"/api/captures/{capture_name}",
        ) if scene_history else None
        return {
            "id": entry_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "image_url": f"/api/captures/{capture_name}",
            "results": results,
            "model_used": scene.model_used,
            "processing_time": scene.processing_time,
        }, 200

    @app.post("/api/glasses/photo")
    def glasses_photo() -> tuple[dict, int]:
        """Accepts a photo shared from smart glasses (e.g. Meta Ray-Ban) and runs scene analysis."""
        if scene_analyzer is None:
            return {"error": "Scene analysis unavailable on this server"}, 503
        image = request.files.get("image") or request.files.get("photo")
        if image is None or not image.filename:
            return {"error": "image or photo file is required"}, 400
        capture_name = f"{int(datetime.now(timezone.utc).timestamp())}_{secure_filename(image.filename)}"
        capture_path = captures_dir / capture_name
        image.save(capture_path)
        scene = scene_analyzer.describe_scene(str(capture_path))
        results = {
            "description": scene.description,
            "scene_description": scene.description,
            "confidence": scene.confidence,
            "objects": scene.objects_detected,
            "objects_detected": scene.objects_detected,
            "scene_type": scene.scene_type,
            "colors": scene.colors,
            "mood": scene.mood,
            "model_used": scene.model_used,
        }
        entry_id = scene_history.record(
            {**results, "model_used": scene.model_used},
            image_url=f"/api/captures/{capture_name}",
        ) if scene_history else None
        return {
            "id": entry_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "image_url": f"/api/captures/{capture_name}",
            "results": results,
            "source": "glasses",
            "model_used": scene.model_used,
            "processing_time": scene.processing_time,
        }, 200

    @app.post("/api/vision/reverse-search")
    def vision_reverse_search() -> tuple[dict, int]:
        """Reverse image search via Google Vision Web Detection."""
        image = request.files.get("image")
        if image is None:
            return {"error": "image file required"}, 400
        image_bytes = image.read()
        from jarvis.services.reverse_image_search import reverse_search_image
        result = reverse_search_image(image_bytes)
        return result, 200

    @app.get("/api/vision/history")
    def vision_history() -> tuple[dict, int]:
        try:
            limit = max(1, min(int(request.args.get("limit", 50)), 200))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        return {"history": scene_history.recent(limit=limit)}, 200

    @app.get("/api/vision/stats")
    def vision_stats() -> tuple[dict, int]:
        return {"stats": scene_history.stats()}, 200

    @app.get("/api/captures/<path:filename>")
    def serve_capture(filename: str):
        from flask import send_from_directory

        return send_from_directory(captures_dir.resolve(), filename)

    @app.get("/api/face/list")
    def face_list() -> tuple[dict, int]:
        """Return all enrolled people with their metadata and avatar URLs."""
        if face_engine is None:
            return {"people": []}, 200
        return {"people": [_person_to_dict(p) for p in face_engine.known_faces]}, 200

    @app.delete("/api/face/person/<name>")
    def face_delete_person(name: str) -> tuple[dict, int]:
        """Remove an enrolled person by name."""
        if face_engine is None:
            return {"success": False, "error": "Face recognition unavailable"}, 503
        removed = face_engine.remove_person(name)
        if not removed:
            return {"success": False, "error": f"Person '{name}' not found"}, 404
        return {"success": True, "remaining": len(face_engine.known_faces)}, 200

    @app.post("/api/face/person/<name>/dossier")
    def face_save_dossier(name: str) -> tuple[dict, int]:
        """Cache a research dossier against a known person so repeat scans
        return it instantly without re-running the research pipeline."""
        if face_engine is None:
            return {"success": False, "error": "Face recognition unavailable"}, 503
        payload = request.get_json(silent=True) or {}
        dossier = payload.get("dossier")
        if not dossier:
            return {"success": False, "error": "dossier is required"}, 400
        person = next((p for p in face_engine.known_faces if p.name == name), None)
        if person is None:
            return {"success": False, "error": f"Person '{name}' not found"}, 404
        person.additional_data["dossier"] = dossier
        person.additional_data["dossier_cached_at"] = datetime.now(timezone.utc).isoformat()
        face_engine.save()
        return {"success": True}, 200

    @app.post("/api/face/reencode-all")
    def face_reencode_all() -> tuple[dict, int]:
        """Re-run InsightFace encoding on every person's stored image paths.

        Called after upgrading from dlib to InsightFace — all existing
        128-dim encodings are empty; this rebuilds them from the saved images.
        """
        if face_engine is None:
            return {"error": "Face recognition unavailable"}, 503
        results = []
        for person in face_engine.known_faces:
            valid_paths = [p for p in person.image_paths if os.path.exists(p)]
            new_encs = [enc for p in valid_paths if (enc := face_engine.encode(p)) is not None]
            person.face_encodings = new_encs
            results.append({"name": person.name, "encodings": len(new_encs), "paths_found": len(valid_paths)})
        face_engine.save()
        ok = [r for r in results if r["encodings"] > 0]
        failed = [r for r in results if r["encodings"] == 0]
        return {"reencoded": len(ok), "failed": len(failed), "details": results}, 200

    @app.post("/api/face/export")
    def face_export() -> tuple[dict, int]:
        """Dump the known-faces metadata (no encodings) to disk."""
        export_path = captures_dir.parent / "faces_export.json"
        payload = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tolerance": face_engine.tolerance,
            "people": [
                {
                    "name": p.name,
                    "age": p.age,
                    "gender": p.gender,
                    "profession": p.profession,
                    "image_count": len(p.image_paths),
                    "encoding_count": len(p.face_encodings),
                    "additional_data": p.additional_data,
                }
                for p in face_engine.known_faces
            ],
        }
        export_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        return {"success": True, "path": str(export_path), "people": len(payload["people"])}, 200

    # ── system control ────────────────────────────────────────────────

    @app.post("/api/system/open-application")
    def system_open_app() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return {"success": False, "error": "name is required"}, 400
        try:
            action_id = system_controller.open_application(
                name=name,
                args=payload.get("args") or [],
                user_id=payload.get("user_id", "default"),
            )
        except (ValueError, PermissionError) as exc:
            return {"success": False, "error": str(exc)}, 400
        return {"success": True, "action_id": action_id, "result": "Awaiting confirmation."}, 200

    @app.post("/api/system/control-files")
    def system_control_files() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        op = (payload.get("action") or payload.get("op") or "").strip()
        path = (payload.get("path") or "").strip()
        if not op or not path:
            return {"success": False, "error": "action and path are required"}, 400
        try:
            action_id = system_controller.control_files(
                op=op,
                path=path,
                target_path=payload.get("target_path"),
                user_id=payload.get("user_id", "default"),
            )
        except (ValueError, PermissionError) as exc:
            return {"success": False, "error": str(exc)}, 400
        return {"success": True, "action_id": action_id, "result": "Awaiting confirmation."}, 200

    @app.post("/api/system/send-message")
    def system_send_message() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        platform_name = (payload.get("platform") or "").strip()
        to = (payload.get("to") or "").strip()
        message = payload.get("message") or ""
        if not platform_name or not to or not message:
            return {"success": False, "error": "platform, to, message are required"}, 400
        action_id = system_controller.send_message(
            platform_name=platform_name,
            to=to,
            message=message,
            user_id=payload.get("user_id", "default"),
        )
        return {"success": True, "action_id": action_id, "result": "Awaiting confirmation."}, 200

    @app.post("/api/system/confirm-action")
    def system_confirm_action() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        action_id = payload.get("action_id")
        confirmed = bool(payload.get("confirmed"))
        if not action_id:
            return {"success": False, "error": "action_id is required"}, 400
        if not system_controller.confirm(action_id, confirmed):
            return {"success": False, "error": "Action not found in pending."}, 404
        return {
            "success": True,
            "message": "Action approved." if confirmed else "Action denied.",
        }, 200

    @app.get("/api/system/pending-confirmations")
    def system_pending_confirmations() -> tuple[dict, int]:
        return {"success": True, "confirmations": system_controller.get_pending()}, 200

    @app.get("/api/system/action-history")
    def system_action_history() -> tuple[dict, int]:
        try:
            limit = max(1, min(int(request.args.get("limit", 50)), 500))
            offset = max(0, int(request.args.get("offset", 0)))
        except ValueError:
            return {"success": False, "error": "limit/offset must be integers"}, 400
        history, total = system_controller.get_history(limit=limit, offset=offset)
        return {"success": True, "history": history, "total": total}, 200

    @app.post("/api/system/action-history/bulk-delete")
    def system_bulk_delete_history() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        action_ids = payload.get("action_ids") or []
        if not isinstance(action_ids, list):
            return {"success": False, "error": "action_ids must be a list"}, 400
        deleted = system_controller.bulk_delete_history(action_ids)
        return {"success": True, "deleted_count": deleted, "message": f"Removed {deleted} entries."}, 200

    @app.delete("/api/system/action-history/<action_id>")
    def system_delete_history_entry(action_id: str) -> tuple[dict, int]:
        if system_controller.delete_history_entry(action_id):
            return {"success": True, "message": "Entry deleted."}, 200
        return {"success": False, "error": "Entry not found."}, 404

    @app.get("/api/system/info")
    def system_info() -> tuple[dict, int]:
        return {"success": True, "info": ActionController.get_system_info()}, 200

    # `/api/system-status` is what the frontend uses for the system widget;
    # it returns the same payload as `/api/system/info`. Legacy code never
    # implemented this route so the dashboard was always broken.
    app.add_url_rule("/api/system-status", view_func=system_info, methods=["GET"])

    @app.get("/api/system/applications")
    def system_applications() -> tuple[dict, int]:
        return {"success": True, "applications": ActionController.get_available_applications()}, 200

    # ── voice ────────────────────────────────────────────────────────

    @app.post("/api/voice/transcribe")
    def voice_transcribe() -> tuple[dict, int]:
        audio = request.files.get("audio") or request.files.get("file")
        if audio is None or not audio.filename:
            return {"error": "audio file is required"}, 400
        with _saved_upload(audio) as path:
            text = transcriber.transcribe(path)
        if text is None:
            return {"error": "Transcription is not configured (set OPENAI_API_KEY)."}, 503
        return {"text": text}, 200

    @app.post("/api/voice/speak")
    def voice_speak() -> tuple:
        from flask import Response

        payload = request.get_json(silent=True) or {}
        text = (payload.get("text") or "").strip()
        language = (payload.get("language") or "en").strip()
        if not text:
            return {"error": "text is required"}, 400
        audio_bytes = synthesizer.synthesize(text, language=language)
        if audio_bytes is None:
            return {"error": "TTS is not configured (set ELEVENLABS_API_KEY)."}, 503
        return Response(audio_bytes, mimetype="audio/mpeg")

    # ── dashboard ────────────────────────────────────────────────────

    @app.get("/api/dashboard/history")
    def dashboard_history() -> tuple[dict, int]:
        try:
            limit = int(request.args.get("limit", 100))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        return {"history": memory.recent(limit=min(limit, 500), user_id=_uid())}, 200

    @app.get("/api/dashboard/stats")
    def dashboard_stats() -> tuple[dict, int]:
        uid = _uid()
        return {
            "interactions": memory.count(user_id=uid),
            "notes": notes.count(user_id=uid),
            "plugins": len(plugins.list()),
            "people": face_engine.get_statistics()["total_people"] if face_engine else 0,
        }, 200

    @app.route("/api/dashboard/notes", methods=["GET", "POST", "DELETE"])
    def dashboard_notes() -> tuple[dict, int]:
        uid = _uid()
        if request.method == "GET":
            return {"notes": notes.list(user_id=uid)}, 200
        if request.method == "DELETE":
            note_id = request.args.get("id")
            if not note_id:
                return {"error": "id is required"}, 400
            return ({"deleted": True}, 200) if notes.delete(note_id, user_id=uid) else ({"error": "not found"}, 404)
        payload = request.get_json(silent=True) or {}
        content = (payload.get("content") or "").strip()
        if not content:
            return {"error": "content is required"}, 400
        return {"note": notes.add(content=content, title=payload.get("title"), user_id=uid)}, 201

    # Alias for frontend which calls /api/notes directly
    app.add_url_rule("/api/notes", view_func=dashboard_notes, methods=["GET", "POST", "DELETE"])

    @app.patch("/api/notes/<note_id>")
    def update_note(note_id: str) -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        updated = notes.update(note_id, title=payload.get("title"), content=payload.get("content"), user_id=_uid())
        if updated is None:
            return {"error": "note not found"}, 404
        return {"note": updated}, 200

    @app.delete("/api/notes/<note_id>")
    def delete_note_by_path(note_id: str) -> tuple[dict, int]:
        return ({"deleted": True}, 200) if notes.delete(note_id, user_id=_uid()) else ({"error": "not found"}, 404)

    @app.route("/api/dashboard/settings", methods=["GET", "POST"])
    def dashboard_settings() -> tuple[dict, int]:
        if request.method == "GET":
            return {"settings": settings.get_all()}, 200
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return {"error": "settings payload must be an object"}, 400
        return {"settings": settings.update(**payload)}, 200

    @app.route("/api/settings", methods=["GET", "POST"])
    def api_settings() -> tuple[dict, int]:
        if request.method == "GET":
            data = settings.get_all()
            data.setdefault("llm_model", llm.model)
            data["llm_provider"] = llm.provider.name
            from jarvis.core.providers import PROVIDERS
            data["available_providers"] = [
                {"id": p.name, "default_model": p.default_chat_model}
                for p in PROVIDERS.values()
            ]
            return {"settings": data}, 200
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return {"error": "settings payload must be an object"}, 400
        saved = settings.update(**payload)
        if "llm_model" in payload and payload["llm_model"]:
            llm.model = payload["llm_model"]
        return {"settings": saved}, 200

    @app.post("/api/dashboard/quick-commands")
    def dashboard_quick_commands() -> tuple[dict, int]:
        # Same handler shape as /api/chat — the frontend's quick commands
        # are just chat messages dispatched without the user typing.
        payload = request.get_json(silent=True) or {}
        message = (payload.get("command") or payload.get("message") or "").strip()
        if not message:
            return {"error": "command is required"}, 400
        uid = _uid()
        intent = parser.parse_intent(message)
        intent["_user_id"] = uid
        if intent.get("action_required"):
            response = actions.execute_action(intent)
        else:
            plugin_response = plugins.dispatch(message)
            response = plugin_response if plugin_response is not None else llm.query_llm(message, memory=_build_context(memory, user_id=uid))
        interaction_id = memory.store_interaction(message, response, intent_type=intent.get("type"), user_id=uid)
        sem_memory.index_interaction(interaction_id, message, user_id=uid)
        return {"response": response, "intent": intent.get("type")}, 200

    # ── knowledge base ───────────────────────────────────────────────

    @app.post("/api/knowledge/add")
    def knowledge_add() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        content = (payload.get("content") or "").strip()
        if not title or not content:
            return {"error": "title and content are required"}, 400
        return {"entry": knowledge.add(title=title, content=content, tags=payload.get("tags"), user_id=_uid())}, 201

    @app.get("/api/knowledge/search")
    def knowledge_search() -> tuple[dict, int]:
        uid = _uid()
        query = (request.args.get("q") or "").strip()
        try:
            limit = int(request.args.get("limit", 20))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        results = knowledge.list_all(limit=limit, user_id=uid) if not query else knowledge.search(query, limit=limit, user_id=uid)
        return {"results": results}, 200

    # ── emotion analysis ─────────────────────────────────────────────

    @app.post("/api/analyze-emotion")
    def analyze_emotion() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        text = (payload.get("text") or "").strip()
        if not text:
            return {"error": "text is required"}, 400
        result = emotion.analyze(text)
        return {
            "emotion": result.emotion,
            "sentiment": result.sentiment,
            "confidence": result.confidence,
            "method": result.method,
        }, 200

    # ── reminders ────────────────────────────────────────────────────

    @app.get("/api/reminders")
    def list_reminders() -> tuple[dict, int]:
        return {"reminders": reminders.list_all(user_id=_uid())}, 200

    @app.get("/api/reminders/pending")
    def pending_reminders() -> tuple[dict, int]:
        return {"reminders": reminders.list_pending(user_id=_uid())}, 200

    @app.get("/api/reminders/due")
    def due_reminders() -> tuple[dict, int]:
        """Reminders whose time has come but haven't been acknowledged yet."""
        uid = _uid()
        due = reminders.list_due()
        if uid is not None:
            due = [r for r in due if r.get("user_id") == uid]
        return {"reminders": due}, 200

    @app.get("/api/timers")
    def list_timers() -> tuple[dict, int]:
        uid = _uid()
        with reminders._lock, reminders._connect() as conn:
            if uid is not None:
                rows = conn.execute(
                    "SELECT * FROM reminders WHERE kind='timer' AND user_id=? ORDER BY created_at DESC",
                    (uid,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM reminders WHERE kind='timer' ORDER BY created_at DESC"
                ).fetchall()
        return {"timers": [reminders._to_dict(r) for r in rows]}, 200

    @app.get("/api/timers/pending")
    def pending_timers() -> tuple[dict, int]:
        uid = _uid()
        with reminders._lock, reminders._connect() as conn:
            if uid is not None:
                rows = conn.execute(
                    "SELECT * FROM reminders WHERE kind='timer' AND fired=0 AND user_id=? ORDER BY due_at ASC",
                    (uid,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM reminders WHERE kind='timer' AND fired=0 ORDER BY due_at ASC"
                ).fetchall()
        return {"timers": [reminders._to_dict(r) for r in rows]}, 200

    @app.delete("/api/reminders/<reminder_id>")
    def delete_reminder(reminder_id: str) -> tuple[dict, int]:
        if reminders.delete(reminder_id, user_id=_uid()):
            return {"deleted": True}, 200
        return {"error": "not found"}, 404

    # ── contacts ──────────────────────────────────────────────────────

    @app.get("/api/contacts")
    def list_contacts() -> tuple[dict, int]:
        return {"contacts": contacts.list_all(user_id=_uid())}, 200

    @app.post("/api/contacts")
    def create_contact() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return {"error": "name is required"}, 400
        c = contacts.add(
            name=name,
            user_id=_uid(),
            phone=payload.get("phone") or None,
            whatsapp=payload.get("whatsapp") or None,
            email=payload.get("email") or None,
            notes=payload.get("notes") or None,
        )
        return {"contact": c}, 201

    @app.get("/api/contacts/search")
    def search_contacts() -> tuple[dict, int]:
        q = request.args.get("q", "").strip()
        if not q:
            return {"contacts": []}, 200
        return {"contacts": contacts.find_by_name(q, user_id=_uid())}, 200

    @app.get("/api/contacts/<contact_id>")
    def get_contact(contact_id: str) -> tuple[dict, int]:
        c = contacts.get(contact_id, user_id=_uid())
        if not c:
            return {"error": "not found"}, 404
        return {"contact": c}, 200

    @app.put("/api/contacts/<contact_id>")
    def update_contact(contact_id: str) -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        c = contacts.update(contact_id, user_id=_uid(), **payload)
        if not c:
            return {"error": "not found"}, 404
        return {"contact": c}, 200

    @app.delete("/api/contacts/<contact_id>")
    def delete_contact(contact_id: str) -> tuple[dict, int]:
        if contacts.delete(contact_id, user_id=_uid()):
            return {"deleted": True}, 200
        return {"error": "not found"}, 404

    # ── autonomous scheduling ─────────────────────────────────────────

    @app.get("/api/schedules")
    def list_schedules() -> tuple[dict, int]:
        return {"jobs": sched.list_all(user_id=_uid())}, 200

    @app.post("/api/schedules")
    def create_schedule() -> tuple[dict, int]:
        """Create a new scheduled job.

        Body: { "name": str, "goal": str, "schedule_expr": str, "enabled": bool (opt) }
        """
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        goal = (payload.get("goal") or "").strip()
        expr = (payload.get("schedule_expr") or "").strip()
        if not name or not goal or not expr:
            return {"error": "name, goal, and schedule_expr are required"}, 400
        enabled = bool(payload.get("enabled", True))
        uid = _uid()
        try:
            job_id = sched.add(name=name, goal=goal, schedule_expr=expr, enabled=enabled, user_id=uid)
        except ValueError as exc:
            return {"error": str(exc)}, 400
        return {"job": sched.get(job_id, user_id=uid).to_dict()}, 201

    @app.get("/api/schedules/<job_id>")
    def get_schedule(job_id: str) -> tuple[dict, int]:
        job = sched.get(job_id, user_id=_uid())
        if job is None:
            return {"error": "job not found"}, 404
        return job.to_dict(), 200

    @app.delete("/api/schedules/<job_id>")
    def delete_schedule(job_id: str) -> tuple[dict, int]:
        if sched.remove(job_id, user_id=_uid()):
            return {"deleted": True, "id": job_id}, 200
        return {"error": "job not found"}, 404

    @app.patch("/api/schedules/<job_id>")
    def toggle_schedule(job_id: str) -> tuple[dict, int]:
        uid = _uid()
        payload = request.get_json(silent=True) or {}
        if "enabled" not in payload:
            return {"error": "enabled field is required"}, 400
        if not sched.set_enabled(job_id, bool(payload["enabled"]), user_id=uid):
            return {"error": "job not found"}, 404
        job = sched.get(job_id, user_id=uid)
        return job.to_dict(), 200

    @app.post("/api/schedules/<job_id>/run")
    def run_schedule_now(job_id: str) -> tuple[dict, int]:
        """Trigger a scheduled job immediately (outside its schedule)."""
        task_id = sched.trigger(job_id, user_id=_uid())
        if task_id is None:
            return {"error": "job not found"}, 404
        return {"task_id": task_id, "status": "submitted"}, 202

    # ── OS / desktop control ──────────────────────────────────────────

    @app.get("/api/os/screenshot")
    def os_screenshot() -> tuple[dict, int]:
        """Capture the full screen and return as base64 PNG."""
        from jarvis.services.os_control import screenshot_b64
        result = screenshot_b64()
        if "error" in result:
            return {"error": result["error"]}, 503
        return result, 200

    @app.get("/api/os/screen-size")
    def os_screen_size() -> tuple[dict, int]:
        from jarvis.services.os_control import get_screen_size
        return get_screen_size(), 200

    @app.post("/api/os/action")
    def os_action() -> tuple[dict, int]:
        """Execute a desktop action (click, type, press, hotkey, scroll).

        Body: { "action": str, ...action-specific params }
        """
        from jarvis.services.os_control import perform_action
        payload = request.get_json(silent=True) or {}
        action = (payload.get("action") or "").strip()
        if not action:
            return {"error": "action is required"}, 400
        # Strip action key before passing kwargs
        kwargs = {k: v for k, v in payload.items() if k != "action"}
        result = perform_action(action, **kwargs)
        return {"result": result}, 200

    # ── Computer Use ──────────────────────────────────────────────────────

    @app.post("/api/computer-use")
    def cu_start() -> tuple[dict, int]:
        """Start a computer use task. Returns task_id immediately."""
        payload = request.get_json(silent=True) or {}
        goal = (payload.get("goal") or "").strip()
        if not goal:
            return {"error": "goal is required"}, 400
        task_id = cu_mgr.submit(goal)
        return {"task_id": task_id, "status": "pending"}, 202

    @app.get("/api/computer-use")
    def cu_list() -> tuple[dict, int]:
        """List all computer use tasks (without screenshot data)."""
        return {"tasks": cu_mgr.list_all()}, 200

    @app.get("/api/computer-use/<task_id>")
    def cu_get(task_id: str) -> tuple[dict, int]:
        """Get full task status + steps. Latest step includes screenshot."""
        task = cu_mgr.get(task_id)
        if task is None:
            return {"error": "task not found"}, 404
        # Return all steps but only include screenshot for the latest one
        d = task.to_dict(include_screenshots=False)
        if task.steps:
            last = task.steps[-1].to_dict()
            if d["steps"]:
                d["steps"][-1]["screenshot"] = last["screenshot"]
        return d, 200

    @app.delete("/api/computer-use/<task_id>")
    def cu_cancel(task_id: str) -> tuple[dict, int]:
        """Cancel a running computer use task."""
        if cu_mgr.cancel(task_id):
            return {"status": "cancelled"}, 200
        return {"error": "task not found"}, 404

    # ── Google integration endpoints ──────────────────────────────────────

    @app.get("/api/google/status")
    def google_status() -> tuple[dict, int]:
        uid = _uid()
        if uid is None or _google_svc is None:
            return {"connected": False, "gmail": False, "calendar": False, "drive": False}, 200
        connected = _google_svc.token_store.has_tokens(uid)
        return {"connected": connected, "gmail": connected, "calendar": connected, "drive": connected}, 200

    @app.get("/api/google/connect")
    def google_connect() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "Must be logged in to connect Google"}, 401
        try:
            from google_auth_oauthlib.flow import Flow
            flow = Flow.from_client_config(
                {"web": {
                    "client_id": _google_client_id_oauth,
                    "client_secret": _google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [f"{_backend_url}/api/google/callback"],
                }},
                scopes=_GOOGLE_SCOPES,
            )
            flow.redirect_uri = f"{_backend_url}/api/google/callback"
            state = _secrets_mod.token_urlsafe(24)
            _oauth_states[state] = (uid, _time_mod.time() + 600)
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                prompt="consent",
                state=state,
            )
            return {"url": auth_url}, 200
        except Exception as exc:
            logger.error("Google connect error: %s", exc)
            return {"error": str(exc)}, 500

    @app.get("/api/google/callback")
    def google_callback():
        from flask import redirect as flask_redirect
        code = request.args.get("code")
        state = request.args.get("state")
        error = request.args.get("error")

        if error:
            return flask_redirect(f"{_frontend_url}/settings?google=error&reason={error}")

        if not code or not state or state not in _oauth_states:
            return flask_redirect(f"{_frontend_url}/settings?google=error&reason=invalid_state")

        uid, expiry = _oauth_states.pop(state)
        if _time_mod.time() > expiry:
            return flask_redirect(f"{_frontend_url}/settings?google=error&reason=state_expired")

        try:
            from google_auth_oauthlib.flow import Flow
            flow = Flow.from_client_config(
                {"web": {
                    "client_id": _google_client_id_oauth,
                    "client_secret": _google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [f"{_backend_url}/api/google/callback"],
                }},
                scopes=_GOOGLE_SCOPES,
            )
            flow.redirect_uri = f"{_backend_url}/api/google/callback"
            flow.fetch_token(code=code)
            creds = flow.credentials
            expiry_iso = creds.expiry.isoformat() if creds.expiry else None
            _google_svc.token_store.save(
                user_id=uid,
                access_token=creds.token,
                refresh_token=creds.refresh_token or "",
                token_expiry=expiry_iso,
                scopes=list(creds.scopes or _GOOGLE_SCOPES),
            )
            logger.info("Google OAuth tokens stored for user %s", uid)
            return flask_redirect(f"{_frontend_url}/settings?google=connected")
        except Exception as exc:
            logger.error("Google callback error: %s", exc)
            return flask_redirect(f"{_frontend_url}/settings?google=error&reason={str(exc)[:100]}")

    @app.delete("/api/google/disconnect")
    def google_disconnect() -> tuple[dict, int]:
        uid = _uid()
        if uid is None:
            return {"error": "Must be logged in"}, 401
        if _google_svc:
            _google_svc.token_store.delete(uid)
        return {"disconnected": True}, 200

    # ── Spotify integration ───────────────────────────────────────────────

    @app.get("/api/spotify/status")
    def spotify_status() -> tuple[dict, int]:
        status = _spotify_svc.status()
        current = None
        if status["connected"]:
            try:
                current = _spotify_svc.current_track()
            except Exception:
                pass
        return {**status, "current_track": current}, 200

    @app.get("/api/spotify/connect")
    def spotify_connect():
        from flask import redirect as _flask_redirect
        if not _spotify_svc.configured:
            return {"error": "Spotify not configured (set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)"}, 503
        state = _secrets_mod.token_urlsafe(24)
        _spotify_oauth_states[state] = _time_mod.time() + 600
        redirect_uri = f"{_backend_url}/api/spotify/callback"
        try:
            auth_url = _spotify_svc.get_auth_url(redirect_uri=redirect_uri, state=state)
            return _flask_redirect(auth_url)
        except Exception as exc:
            return {"error": str(exc)}, 500

    @app.get("/api/spotify/callback")
    def spotify_callback():
        from flask import redirect as _flask_redirect
        code = request.args.get("code")
        state = request.args.get("state", "")
        error = request.args.get("error")
        if error:
            return _flask_redirect(f"{_frontend_url}/settings?spotify=error&reason={error}")
        if not code or state not in _spotify_oauth_states:
            return _flask_redirect(f"{_frontend_url}/settings?spotify=error&reason=invalid_state")
        expiry = _spotify_oauth_states.pop(state)
        if _time_mod.time() > expiry:
            return _flask_redirect(f"{_frontend_url}/settings?spotify=error&reason=state_expired")
        redirect_uri = f"{_backend_url}/api/spotify/callback"
        ok = _spotify_svc.exchange_code(code=code, redirect_uri=redirect_uri)
        if ok:
            return _flask_redirect(f"{_frontend_url}/settings?spotify=connected")
        return _flask_redirect(f"{_frontend_url}/settings?spotify=error&reason=token_exchange_failed")

    @app.delete("/api/spotify/disconnect")
    def spotify_disconnect() -> tuple[dict, int]:
        _spotify_svc.disconnect()
        return {"disconnected": True}, 200

    # ── Home Assistant integration ────────────────────────────────────────

    @app.get("/api/ha/status")
    def ha_status() -> tuple[dict, int]:
        return _ha_svc.status(), 200

    @app.get("/api/ha/devices")
    def ha_devices() -> tuple[dict, int]:
        domain = request.args.get("domain") or None
        states = _ha_svc.get_states(domain=domain)
        devices = [
            {
                "entity_id": s["entity_id"],
                "name": s.get("attributes", {}).get("friendly_name") or s["entity_id"],
                "state": s.get("state"),
                "domain": s["entity_id"].split(".")[0],
            }
            for s in states
        ]
        return {"devices": devices}, 200

    # ── Gmail REST endpoints ──────────────────────────────────────────────

    @app.get("/api/gmail/messages")
    def gmail_list_messages() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        query = request.args.get("q", "")
        try:
            max_results = int(request.args.get("limit", 10))
        except ValueError:
            max_results = 10
        result = _google_svc.gmail.list_messages(uid, query=query, max_results=max_results)
        if isinstance(result, str):
            return {"error": result}, 400
        return {"messages": result}, 200

    @app.get("/api/gmail/messages/<message_id>")
    def gmail_get_message(message_id: str) -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        result = _google_svc.gmail.get_message(uid, message_id)
        if isinstance(result, str):
            return {"error": result}, 400
        return {"message": result}, 200

    @app.post("/api/gmail/send")
    def gmail_send_message() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        payload = request.get_json(silent=True) or {}
        to = (payload.get("to") or "").strip()
        subject = (payload.get("subject") or "").strip()
        body = (payload.get("body") or "").strip()
        if not to or not subject or not body:
            return {"error": "to, subject, and body are required"}, 400
        result = _google_svc.gmail.send_message(uid, to=to, subject=subject, body=body)
        if isinstance(result, str):
            return {"error": result}, 400
        return result, 200

    # ── Calendar REST endpoints ───────────────────────────────────────────

    @app.get("/api/calendar/events")
    def calendar_list_events() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        time_min = request.args.get("time_min")
        time_max = request.args.get("time_max")
        try:
            max_results = int(request.args.get("limit", 10))
        except ValueError:
            max_results = 10
        result = _google_svc.calendar.list_events(uid, time_min=time_min, time_max=time_max, max_results=max_results)
        if isinstance(result, str):
            return {"error": result}, 400
        return {"events": result}, 200

    @app.post("/api/calendar/events")
    def calendar_create_event() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        start = (payload.get("start") or "").strip()
        end = (payload.get("end") or "").strip()
        if not title or not start or not end:
            return {"error": "title, start, and end are required"}, 400
        result = _google_svc.calendar.create_event(
            uid, title=title, start=start, end=end,
            description=payload.get("description", ""),
            location=payload.get("location", ""),
            attendees=payload.get("attendees", []),
        )
        if isinstance(result, str):
            return {"error": result}, 400
        return result, 201

    @app.patch("/api/calendar/events/<event_id>")
    def calendar_update_event(event_id: str) -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        payload = request.get_json(silent=True) or {}
        result = _google_svc.calendar.update_event(
            uid, event_id=event_id,
            title=payload.get("title"),
            start=payload.get("start"),
            end=payload.get("end"),
            description=payload.get("description"),
            location=payload.get("location"),
            attendees=payload.get("attendees"),
        )
        if isinstance(result, str):
            return {"error": result}, 400
        return result, 200

    @app.delete("/api/calendar/events/<event_id>")
    def calendar_delete_event(event_id: str) -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        result = _google_svc.calendar.delete_event(uid, event_id)
        if isinstance(result, str):
            return {"error": result}, 400
        return {"deleted": True}, 200

    # ── Drive REST endpoints ──────────────────────────────────────────────

    @app.get("/api/drive/files")
    def drive_list_files() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        query = request.args.get("q", "")
        try:
            max_results = int(request.args.get("limit", 20))
        except ValueError:
            max_results = 20
        result = _google_svc.drive.list_files(uid, query=query, max_results=max_results)
        if isinstance(result, str):
            return {"error": result}, 400
        return {"files": result}, 200

    @app.post("/api/drive/files")
    def drive_create_file() -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return {"error": "name is required"}, 400
        result = _google_svc.drive.create_file(uid, name=name, content=payload.get("content", ""))
        if isinstance(result, str):
            return {"error": result}, 400
        return result, 201

    @app.patch("/api/drive/files/<file_id>")
    def drive_update_file(file_id: str) -> tuple[dict, int]:
        if _google_svc is None:
            return {"error": "Google integration not configured"}, 503
        uid = _uid()
        if uid is None:
            return {"error": "unauthorized"}, 401
        payload = request.get_json(silent=True) or {}
        if "name" in payload:
            result = _google_svc.drive.rename_file(uid, file_id, payload["name"])
        elif "folder_id" in payload:
            result = _google_svc.drive.move_file(uid, file_id, payload["folder_id"])
        else:
            return {"error": "Provide 'name' to rename or 'folder_id' to move"}, 400
        if isinstance(result, str):
            return {"error": result}, 400
        return result, 200

    # ── Cross-device sync status ─────────────────────────────────────────
    # Lightweight endpoint: returns the latest modification timestamp for
    # each data type so clients can decide whether to re-fetch.

    _sync_modified: dict[str, str] = {}

    def _touch_sync(key: str) -> None:
        _sync_modified[key] = datetime.now(timezone.utc).isoformat()

    @app.get("/api/sync/status")
    def sync_status() -> tuple[dict, int]:
        """Return last-modified ISO timestamps for each data category.

        Clients poll this every 30–60 s and re-fetch a collection only when
        its timestamp is newer than what they last saw.
        """
        # Derive a live timestamp from DB row counts as a fallback when nothing
        # has been mutated in this process lifetime (e.g. after a cold restart).
        def _notes_ts() -> str:
            try:
                with notes._connect() as conn:
                    row = conn.execute("SELECT MAX(updated_at) FROM notes").fetchone()
                    return row[0] or datetime.now(timezone.utc).isoformat()
            except Exception:
                return _sync_modified.get("notes", datetime.now(timezone.utc).isoformat())

        def _reminders_ts() -> str:
            try:
                with reminders._connect() as conn:
                    row = conn.execute("SELECT MAX(created_at) FROM reminders").fetchone()
                    return row[0] or datetime.now(timezone.utc).isoformat()
            except Exception:
                return _sync_modified.get("reminders", datetime.now(timezone.utc).isoformat())

        return {
            "notes": _sync_modified.get("notes") or _notes_ts(),
            "reminders": _sync_modified.get("reminders") or _reminders_ts(),
            "memory": _sync_modified.get("memory", ""),
        }, 200

    # Patch notes and reminders write routes to call _touch_sync so the
    # /api/sync/status timestamp advances on any mutation.
    _orig_dashboard_notes = app.view_functions.get("dashboard_notes")
    if _orig_dashboard_notes:
        def _patched_notes(*a, **kw):
            resp = _orig_dashboard_notes(*a, **kw)
            if request.method in ("POST", "DELETE"):
                _touch_sync("notes")
            return resp
        _patched_notes.__name__ = "dashboard_notes"
        app.view_functions["dashboard_notes"] = _patched_notes

    # ── push notifications ────────────────────────────────────────────────

    @app.post("/api/push/register")
    def push_register() -> tuple[dict, int]:
        uid = _uid()
        payload = request.get_json(silent=True) or {}
        token = (payload.get("token") or "").strip()
        platform = (payload.get("platform") or "").strip()
        subscription = payload.get("subscription")
        if not token or platform not in ("fcm", "webpush"):
            return {"error": "token and platform ('fcm' or 'webpush') required"}, 400
        sub_str = subscription if isinstance(subscription, str) else (
            __import__("json").dumps(subscription) if subscription else None
        )
        entry = push_store.register(uid or "anonymous", token, platform, sub_str)
        return {"registered": True, "id": entry["id"]}, 200

    @app.delete("/api/push/unregister")
    def push_unregister() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        token = (payload.get("token") or "").strip()
        if not token:
            return {"error": "token required"}, 400
        push_store.unregister(token)
        return {"unregistered": True}, 200

    @app.get("/api/push/vapid-public-key")
    def push_vapid_key() -> tuple[dict, int]:
        key = os.getenv("VAPID_PUBLIC_KEY", "")
        if not key:
            return {"error": "VAPID not configured"}, 503
        return {"publicKey": key}, 200

    return app


def _start_reminder_poller(reminders_store: RemindersStore, interval: int = 30, push_service=None) -> None:
    """Background thread: marks due reminders as fired every `interval` seconds."""
    def _poll() -> None:
        while True:
            time.sleep(interval)
            try:
                for r in reminders_store.list_due():
                    reminders_store.mark_fired(r["id"])
                    logger.info("Reminder fired: %s", r["text"])
                    if push_service and r.get("user_id"):
                        push_service.notify_user(
                            r["user_id"],
                            "Reminder",
                            r["text"],
                        )
            except Exception:
                logger.exception("Reminder poller error")

    threading.Thread(target=_poll, daemon=True, name="reminder-poller").start()


def _person_to_dict(person) -> dict:
    image_url = (
        f"/api/face/image?name={urllib.parse.quote(person.name)}"
        if person.primary_image_path
        else None
    )
    return {
        "name": person.name,
        "age": person.age,
        "gender": person.gender,
        "profession": person.profession,
        "image_path": person.primary_image_path,
        "image_url": image_url,
        "additional_data": person.additional_data,
    }


from contextlib import contextmanager  # noqa: E402  (kept near its consumer)


@contextmanager
def _saved_upload(file_storage, suffix: str = ""):
    """Save a Flask upload to a temp file and yield the path. Cleans up on exit."""
    name = secure_filename(file_storage.filename or "")
    if not suffix:
        suffix = Path(name).suffix or ".bin"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        file_storage.save(tmp_path)
        yield tmp_path
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def main() -> None:
    args = _parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    load_dotenv(override=True)
    app = create_app()
    app.run(host=args.host, port=args.port, debug=args.debug)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="jarvis-web")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=5050)
    p.add_argument("--debug", action="store_true")
    p.add_argument("--log-level", default="INFO")
    return p.parse_args()


if __name__ == "__main__":
    main()
