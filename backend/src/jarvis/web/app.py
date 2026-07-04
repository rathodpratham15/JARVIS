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
from flask import Flask, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

from jarvis.ai import EmotionAnalyzer, KnowledgeBase
from jarvis.core.action_engine import ActionEngine
from jarvis.core.intent_parser import IntentParser
from jarvis.core.llm_core import LLMCore
from jarvis.core.tool_definitions import TOOLS, tool_call_to_intent
from jarvis.core.memory import Memory
from jarvis.core.reminders import RemindersStore
from jarvis.core.semantic_memory import SemanticMemory
from jarvis.dashboard import NotesStore, SettingsStore
from jarvis.plugins import PluginManager
from jarvis.speech import Synthesizer, Transcriber
from jarvis.system import ActionController
from jarvis.vision import (
    FaceRecognitionEngine,
    SceneAnalyzer,
    SceneHistoryStore,
    format_recognition_result,
)

logger = logging.getLogger(__name__)


def _build_context(memory: Memory, n: int = 5, query: str = "", sem: "SemanticMemory | None" = None) -> str | None:
    if query and sem and sem.available:
        relevant = sem.search(query, limit=n)
        if relevant:
            return " || ".join(f"User: {r['user_input']} | Assistant: {r['response']}" for r in relevant)
    recent = memory.recent(limit=n)
    if not recent:
        return None
    return " || ".join(f"User: {r['user_input']} | Assistant: {r['response']}" for r in recent)


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

    notes = NotesStore(db_path=os.getenv("JARVIS_NOTES_DB", "data/notes.db"))
    reminders = RemindersStore(db_path=os.getenv("JARVIS_REMINDERS_DB", "data/reminders.db"))
    settings = SettingsStore(path=os.getenv("JARVIS_SETTINGS", "data/settings.json"))
    knowledge = KnowledgeBase(db_path=os.getenv("JARVIS_KNOWLEDGE_DB", "data/knowledge.db"))
    emotion = EmotionAnalyzer()

    sem_memory = SemanticMemory(db_path=os.getenv("JARVIS_DB", "data/memory.db"))

    parser = IntentParser()
    llm = LLMCore()
    actions = ActionEngine(notes_store=notes, reminders_store=reminders, settings_store=settings, llm=llm)
    memory = Memory(db_path=os.getenv("JARVIS_DB", "data/memory.db"))
    plugins = PluginManager(plugins_dir=os.getenv("JARVIS_PLUGINS_DIR", "plugins"))
    plugins.discover()
    face_engine = FaceRecognitionEngine(
        data_dir=os.getenv("JARVIS_FACE_DIR", "data/faces"),
        tolerance=float(os.getenv("JARVIS_FACE_TOLERANCE", "0.5")),
    )
    scene_analyzer = SceneAnalyzer()
    scene_history = SceneHistoryStore(
        db_path=os.getenv("JARVIS_VISION_HISTORY_DB", "data/vision_history.db"),
    )
    captures_dir = Path(os.getenv("JARVIS_CAPTURES_DIR", "data/captures"))
    captures_dir.mkdir(parents=True, exist_ok=True)
    system_controller = ActionController(
        log_path=os.getenv("JARVIS_SYSTEM_LOG", "logs/system_actions.jsonl"),
    )
    transcriber = Transcriber()
    synthesizer = Synthesizer()

    _start_reminder_poller(reminders)

    @app.get("/api/health")
    def health() -> tuple[dict, int]:
        return {"status": "ok", "interactions": memory.count()}, 200

    @app.post("/api/chat")
    def chat() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        user_input = (payload.get("message") or "").strip()
        if not user_input:
            return {"error": "message field is required"}, 400

        intent = parser.parse_intent(user_input)
        ctx = _build_context(memory)
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
                    user_input, tools=TOOLS, memory=ctx
                )
                if tool_name:
                    tool_intent = tool_call_to_intent(tool_name, tool_args or {})
                    tool_result = actions.execute_action(tool_intent)
                    tool_used = tool_name
                    response = llm.finish_after_tool(
                        user_input, tool_name, tool_result, memory=ctx
                    )
                    intent = {**intent, "type": tool_intent.get("type", intent.get("type"))}
                else:
                    response = text or ""

        interaction_id = memory.store_interaction(
            user_input=user_input,
            response=response,
            intent_type=intent.get("type"),
        )
        sem_memory.index_interaction(interaction_id, user_input)
        result: dict = {
            "id": interaction_id,
            "response": response,
            "intent": intent.get("type"),
        }
        if tool_used:
            result["tool_used"] = tool_used
        return result, 200

    @app.post("/api/chat/stream")
    def chat_stream():
        from flask import Response, stream_with_context
        import json as _json

        payload = request.get_json(silent=True) or {}
        user_input = (payload.get("message") or "").strip()
        if not user_input:
            return {"error": "message field is required"}, 400

        intent = parser.parse_intent(user_input)

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
            # Non-LLM response: emit as a single data event then done
            interaction_id = memory.store_interaction(
                user_input=user_input,
                response=response_text,
                intent_type=intent.get("type"),
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
        ctx = _build_context(memory)

        def _stream():
            full: list[str] = []
            for token in llm.stream_llm(user_input, memory=ctx):
                full.append(token)
                yield f"data: {_json.dumps({'token': token})}\n\n"
            full_text = "".join(full)
            interaction_id = memory.store_interaction(
                user_input=user_input,
                response=full_text,
                intent_type=intent.get("type"),
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
        return {"interactions": memory.recent(limit=min(limit, 200))}, 200

    @app.get("/api/search")
    def search() -> tuple[dict, int]:
        query = (request.args.get("q") or "").strip()
        if not query:
            return {"error": "q is required"}, 400
        # Try semantic search first; fall back to substring if unavailable
        if sem_memory.available:
            results = sem_memory.search(query, limit=20)
            if results:
                return {"results": results, "mode": "semantic"}, 200
        return {"results": memory.search(query, limit=20), "mode": "substring"}, 200

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
        return {"results": sem_memory.search(query, limit=min(limit, 50)), "mode": "semantic"}, 200

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

    @app.post("/api/face/identify")
    def identify_face() -> tuple[dict, int]:
        """Match an uploaded image against the known-faces DB."""
        image = request.files.get("image")
        if image is None or not image.filename:
            return {"success": False, "error": "image file is required"}, 400
        with _saved_upload(image) as path:
            result = face_engine.recognize_face(path)
        return {
            "success": True,
            "matched": result.matched,
            "confidence": result.confidence,
            "processing_time": result.processing_time,
            "person": _person_to_dict(result.person) if result.person else None,
            "formatted_result": format_recognition_result(result),
            "error": result.error_message,
        }, 200

    # Frontend dashboard expects this name; we keep the route as an alias.
    app.add_url_rule("/api/camera/recognize", view_func=identify_face, methods=["POST"])

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

    @app.post("/api/vision/analyze")
    def vision_analyze() -> tuple[dict, int]:
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
        )
        return {
            "id": entry_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "image_url": f"/api/captures/{capture_name}",
            "results": results,
            "model_used": scene.model_used,
            "processing_time": scene.processing_time,
        }, 200

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
        if not text:
            return {"error": "text is required"}, 400
        audio_bytes = synthesizer.synthesize(text)
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
        return {"history": memory.recent(limit=min(limit, 500))}, 200

    @app.get("/api/dashboard/stats")
    def dashboard_stats() -> tuple[dict, int]:
        return {
            "interactions": memory.count(),
            "notes": notes.count(),
            "plugins": len(plugins.list()),
            "people": face_engine.get_statistics()["total_people"],
        }, 200

    @app.route("/api/dashboard/notes", methods=["GET", "POST", "DELETE"])
    def dashboard_notes() -> tuple[dict, int]:
        if request.method == "GET":
            return {"notes": notes.list()}, 200
        if request.method == "DELETE":
            note_id = request.args.get("id")
            if not note_id:
                return {"error": "id is required"}, 400
            return ({"deleted": True}, 200) if notes.delete(note_id) else ({"error": "not found"}, 404)
        payload = request.get_json(silent=True) or {}
        content = (payload.get("content") or "").strip()
        if not content:
            return {"error": "content is required"}, 400
        return {"note": notes.add(content=content, title=payload.get("title"))}, 201

    @app.route("/api/dashboard/settings", methods=["GET", "POST"])
    def dashboard_settings() -> tuple[dict, int]:
        if request.method == "GET":
            return {"settings": settings.get_all()}, 200
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return {"error": "settings payload must be an object"}, 400
        return {"settings": settings.update(**payload)}, 200

    @app.post("/api/dashboard/quick-commands")
    def dashboard_quick_commands() -> tuple[dict, int]:
        # Same handler shape as /api/chat — the frontend's quick commands
        # are just chat messages dispatched without the user typing.
        payload = request.get_json(silent=True) or {}
        message = (payload.get("command") or payload.get("message") or "").strip()
        if not message:
            return {"error": "command is required"}, 400
        intent = parser.parse_intent(message)
        if intent.get("action_required"):
            response = actions.execute_action(intent)
        else:
            plugin_response = plugins.dispatch(message)
            response = plugin_response if plugin_response is not None else llm.query_llm(message, memory=_build_context(memory))
        interaction_id = memory.store_interaction(message, response, intent_type=intent.get("type"))
        sem_memory.index_interaction(interaction_id, message)
        return {"response": response, "intent": intent.get("type")}, 200

    # ── knowledge base ───────────────────────────────────────────────

    @app.post("/api/knowledge/add")
    def knowledge_add() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        content = (payload.get("content") or "").strip()
        if not title or not content:
            return {"error": "title and content are required"}, 400
        return {"entry": knowledge.add(title=title, content=content, tags=payload.get("tags"))}, 201

    @app.get("/api/knowledge/search")
    def knowledge_search() -> tuple[dict, int]:
        query = (request.args.get("q") or "").strip()
        try:
            limit = int(request.args.get("limit", 20))
        except ValueError:
            return {"error": "limit must be an integer"}, 400
        results = knowledge.list_all(limit=limit) if not query else knowledge.search(query, limit=limit)
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
        return {"reminders": reminders.list_all()}, 200

    @app.get("/api/reminders/pending")
    def pending_reminders() -> tuple[dict, int]:
        return {"reminders": reminders.list_pending()}, 200

    @app.get("/api/reminders/due")
    def due_reminders() -> tuple[dict, int]:
        """Reminders whose time has come but haven't been acknowledged yet."""
        return {"reminders": reminders.list_due()}, 200

    @app.get("/api/timers")
    def list_timers() -> tuple[dict, int]:
        with reminders._lock, reminders._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM reminders WHERE kind='timer' ORDER BY created_at DESC"
            ).fetchall()
        return {"timers": [reminders._to_dict(r) for r in rows]}, 200

    @app.get("/api/timers/pending")
    def pending_timers() -> tuple[dict, int]:
        with reminders._lock, reminders._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM reminders WHERE kind='timer' AND fired=0 ORDER BY due_at ASC"
            ).fetchall()
        return {"timers": [reminders._to_dict(r) for r in rows]}, 200

    @app.delete("/api/reminders/<reminder_id>")
    def delete_reminder(reminder_id: str) -> tuple[dict, int]:
        if reminders.delete(reminder_id):
            return {"deleted": True}, 200
        return {"error": "not found"}, 404

    return app


def _start_reminder_poller(reminders_store: RemindersStore, interval: int = 30) -> None:
    """Background thread: marks due reminders as fired every `interval` seconds."""
    def _poll() -> None:
        while True:
            time.sleep(interval)
            try:
                for r in reminders_store.list_due():
                    reminders_store.mark_fired(r["id"])
                    logger.info("Reminder fired: %s", r["text"])
            except Exception:
                logger.exception("Reminder poller error")

    threading.Thread(target=_poll, daemon=True, name="reminder-poller").start()


def _person_to_dict(person) -> dict:
    return {
        "name": person.name,
        "age": person.age,
        "gender": person.gender,
        "profession": person.profession,
        "image_path": person.primary_image_path,
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
    load_dotenv()
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
