import asyncio
import base64
import io
import json
import logging
import os
import re
import uuid
from contextlib import suppress
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import bcrypt
import requests
from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('EMERGENT_LLM_KEY')
OPENAI_KEY = os.environ.get('OPENAI_API_KEY')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID') or os.environ.get('VITE_GOOGLE_CLIENT_ID')
MODEL = "claude-sonnet-4-5"
APP_NAME = "jarvis"
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True), IndexModel([("email", ASCENDING)], name="email")],
    "user_sessions": [IndexModel([("session_token", ASCENDING)], name="token")],
    "conversations": [IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated"), IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "messages": [IndexModel([("conversation_id", ASCENDING), ("created_at", ASCENDING)], name="conv_created"), IndexModel([("user_id", ASCENDING)], name="user")],
    "contacts": [IndexModel([("user_id", ASCENDING), ("name", ASCENDING)], name="user_name")],
    "memories": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "settings": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "files": [IndexModel([("storage_path", ASCENDING)], name="path")],
    "face_people": [IndexModel([("user_id", ASCENDING)], name="user")],
    "discoveries": [IndexModel([("user_id", ASCENDING), ("last_seen", DESCENDING)], name="user_seen")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


# ---------- Local file storage ----------
def put_object(path: str, data: bytes, content_type: str) -> dict:
    dest = UPLOADS_DIR / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {"path": path, "size": len(data)}


def get_object(path: str) -> tuple[bytes, str]:
    dest = UPLOADS_DIR / path
    if not dest.exists():
        raise FileNotFoundError(f"File not found: {path}")
    ext = dest.suffix.lower().lstrip(".")
    ctype_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
    return dest.read_bytes(), ctype_map.get(ext, "application/octet-stream")


async def store_image(user_id: str, upload: UploadFile) -> str:
    if not (upload.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only image files are supported")
    data = await upload.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 10 MB")
    ext = (upload.filename or "img.jpg").rsplit(".", 1)[-1].lower()[:5] or "jpg"
    path = f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.{ext}"
    result = await asyncio.to_thread(put_object, path, data, upload.content_type or "image/jpeg")
    await db.files.insert_one({"id": new_id(), "user_id": user_id, "storage_path": path, "original_filename": upload.filename,
                               "content_type": upload.content_type, "size": result.get("size"), "is_deleted": False, "created_at": now_iso()})
    return path


# ---------- Auth ----------
class LoginIn(BaseModel):
    username: str
    password: str

class SignupIn(BaseModel):
    username: str
    password: str
    email: Optional[str] = ""

@api.post("/auth/login")
async def auth_login(body: LoginIn, response: Response):
    user = await db.users.find_one({"username": body.username.strip()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid username or password")
    if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Invalid username or password")
    token = uuid.uuid4().hex
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=30), "created_at": now_iso()})
    response.set_cookie("session_token", token, httponly=True, samesite="lax", path="/", max_age=30 * 86400)
    return {k: v for k, v in user.items() if k != "password_hash"}

@api.post("/auth/signup")
async def auth_signup(body: SignupIn, response: Response):
    username = body.username.strip()
    if not username or len(username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")
    if not body.password or len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await db.users.find_one({"username": username}):
        raise HTTPException(409, "Username already taken")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {"user_id": user_id, "username": username, "name": username,
            "email": (body.email or "").strip(), "password_hash": pw_hash, "picture": None, "created_at": now_iso()}
    await db.users.insert_one({**user})
    token = uuid.uuid4().hex
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=30), "created_at": now_iso()})
    response.set_cookie("session_token", token, httponly=True, samesite="lax", path="/", max_age=30 * 86400)
    return {k: v for k, v in user.items() if k != "password_hash"}


async def get_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


@api.post("/auth/session")
async def auth_session(request: Request, response: Response):
    raise HTTPException(501, "OAuth session not configured — use /auth/login instead")


@api.get("/auth/config")
async def auth_config():
    return {
        "google_enabled": bool(GOOGLE_CLIENT_ID),
        "google_client_id": GOOGLE_CLIENT_ID or "",
        "microsoft_enabled": bool(os.environ.get("MICROSOFT_CLIENT_ID")),
        "saml_enabled": bool(os.environ.get("SAML_ENABLED")),
        "password_enabled": True,
    }


class GoogleTokenIn(BaseModel):
    token: str


@api.post("/auth/google")
async def auth_google(body: GoogleTokenIn, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not configured")
    # Verify the Google ID token via Google's tokeninfo endpoint
    try:
        r = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.token},
            timeout=10,
        )
        if not r.ok:
            raise HTTPException(401, "Invalid Google token")
        info = r.json()
        if info.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(401, "Token audience mismatch")
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise HTTPException(401, "Google token verification failed")

    email = info.get("email", "").lower().strip()
    name = info.get("name") or info.get("given_name") or email.split("@")[0]
    picture = info.get("picture")
    if not email:
        raise HTTPException(400, "No email in Google token")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {"user_id": user_id, "username": email.split("@")[0], "name": name,
                "email": email, "password_hash": None, "picture": picture, "created_at": now_iso()}
        await db.users.insert_one({**user})
    elif picture and not user.get("picture"):
        await db.users.update_one({"email": email}, {"$set": {"picture": picture, "name": name}})
        user = {**user, "picture": picture, "name": name}

    token = uuid.uuid4().hex
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=30), "created_at": now_iso()})
    response.set_cookie("session_token", token, httponly=True, samesite="lax", path="/", max_age=30 * 86400)
    return {k: v for k, v in user.items() if k != "password_hash"}

@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_user)):
    return user


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    header = request.headers.get("Authorization", "")
    if not token and header.startswith("Bearer "):
        token = header[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


# ---------- Settings ----------
DEFAULT_SETTINGS = {
    "theme": "dark", "language": "English", "personality": "standard", "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "memory_enabled": True, "wake_word": "Hey Jarvis", "wake_word_enabled": False,
    "integrations": {"google_calendar": False, "gmail": False, "google_drive": False},
}


async def load_settings(user_id: str) -> dict:
    doc = await db.settings.find_one({"user_id": user_id}, {"_id": 0, "user_id": 0}) or {}
    merged = {**DEFAULT_SETTINGS, **doc}
    merged["integrations"] = {**DEFAULT_SETTINGS["integrations"], **doc.get("integrations", {})}
    return merged


@api.get("/settings")
async def get_settings(user: dict = Depends(get_user)):
    return await load_settings(user["user_id"])


@api.post("/settings")
async def save_settings(body: dict, user: dict = Depends(get_user)):
    allowed = {k: v for k, v in body.items() if k in DEFAULT_SETTINGS}
    if "personality" in allowed and allowed["personality"] not in PERSONALITIES:
        raise HTTPException(400, "Unknown personality")
    if "integrations" in allowed:
        current = await load_settings(user["user_id"])
        allowed["integrations"] = {**current["integrations"], **{k: bool(v) for k, v in allowed["integrations"].items() if k in DEFAULT_SETTINGS["integrations"]}}
    await db.settings.update_one({"user_id": user["user_id"]}, {"$set": allowed}, upsert=True)
    return await load_settings(user["user_id"])


# ---------- Uploads / files ----------
@api.post("/uploads")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_user)):
    return {"path": await store_image(user["user_id"], file)}


@api.get("/files/{path:path}")
async def download_file(path: str, user: dict = Depends(get_user)):
    record = await db.files.find_one({"storage_path": path, "user_id": user["user_id"], "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    data, ctype = await asyncio.to_thread(get_object, path)
    return Response(content=data, media_type=record.get("content_type") or ctype, headers={"Cache-Control": "private, max-age=86400"})


# ---------- Conversations ----------
class ConversationPatch(BaseModel):
    title: Optional[str] = None
    archived: Optional[bool] = None


async def list_conversations(user_id: str, limit: int, archived: bool = False):
    return await db.conversations.find({"user_id": user_id, "archived": archived}, {"_id": 0}).sort("updated_at", -1).to_list(limit)


@api.get("/conversations")
async def get_conversations(archived: bool = False, limit: int = Query(200, ge=1, le=500), user: dict = Depends(get_user)):
    return await list_conversations(user["user_id"], limit, archived)


@api.get("/history")
async def get_history(limit: int = Query(30, ge=1, le=500), user: dict = Depends(get_user)):
    return await list_conversations(user["user_id"], limit)


async def get_conv_or_404(conv_id: str, user_id: str) -> dict:
    conv = await db.conversations.find_one({"id": conv_id, "user_id": user_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@api.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(get_user)):
    conv = await get_conv_or_404(conv_id, user["user_id"])
    conv["messages"] = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return conv


@api.patch("/conversations/{conv_id}")
async def patch_conversation(conv_id: str, body: ConversationPatch, user: dict = Depends(get_user)):
    await get_conv_or_404(conv_id, user["user_id"])
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "title" in update:
        update["title"] = update["title"].strip()[:120] or "New chat"
    if update:
        await db.conversations.update_one({"id": conv_id}, {"$set": update})
    return await get_conv_or_404(conv_id, user["user_id"])


@api.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(get_user)):
    await get_conv_or_404(conv_id, user["user_id"])
    paths = [m["image_path"] async for m in db.messages.find({"conversation_id": conv_id, "image_path": {"$ne": None}}, {"image_path": 1})]
    if paths:
        await db.files.update_many({"storage_path": {"$in": paths}, "user_id": user["user_id"]}, {"$set": {"is_deleted": True}})
    await db.conversations.delete_one({"id": conv_id})
    await db.messages.delete_many({"conversation_id": conv_id})
    return {"ok": True}


class FeedbackIn(BaseModel):
    value: Optional[str] = None


@api.post("/messages/{msg_id}/feedback")
async def message_feedback(msg_id: str, body: FeedbackIn, user: dict = Depends(get_user)):
    if body.value not in (None, "up", "down"):
        raise HTTPException(400, "Invalid feedback")
    res = await db.messages.update_one({"id": msg_id, "user_id": user["user_id"], "role": "assistant"}, {"$set": {"feedback": body.value}})
    if not res.matched_count:
        raise HTTPException(404, "Message not found")
    return {"ok": True, "feedback": body.value}


# ---------- Chat ----------
PERSONALITIES = {
    "standard": "Tone: balanced, warm and conversational.",
    "tactical": "Tone: direct, brief and action-oriented. Lead with the answer, then short actionable steps. No filler or pleasantries.",
    "formal": "Tone: professional and structured. Use clear headings or numbered points where helpful and precise language.",
    "concise": "Answer in one to two sentences maximum. No lists, no headings, unless explicitly asked.",
}


class ChatIn(BaseModel):
    conversation_id: Optional[str] = None
    message: Optional[str] = ""
    personality: str = "standard"
    image_path: Optional[str] = None
    edit_message_id: Optional[str] = None
    regenerate: bool = False


async def build_system_prompt(user: dict, personality: str, settings: dict) -> str:
    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
    parts = [
        f"You are J.A.R.V.I.S., a capable, friendly personal AI assistant for {user.get('name', 'the user')}. Today is {today} (UTC).",
        PERSONALITIES.get(personality, PERSONALITIES["standard"]),
        "Use Markdown when it helps (lists, tables, code blocks with language tags, LaTeX math with $...$).",
        "You do not have live access to the user's calendar, email, files or the web. If asked, say so briefly and offer a useful alternative.",
        "Notes and reminders the user asks you to keep are saved to memory automatically - confirm them naturally.",
        f"Reply in {settings.get('language', 'English')} unless the user writes in another language.",
    ]
    if settings.get("memory_enabled", True):
        mems = await db.memories.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(60)
        if mems:
            lines = "\n".join(f"- [{m['category']}/{m['importance']}] {m['title']}" for m in mems)
            parts.append(f"What you remember about the user (use naturally when relevant, never recite the list):\n{lines}")
    return "\n\n".join(parts)


def history_entry(m: dict) -> dict:
    text = m.get("content") or ""
    if m.get("image_path"):
        text = (text + "\n\n[The user attached an image here]").strip()
    return {"role": m["role"], "content": text or "(empty)"}


def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


async def extract_memories(user_id: str, user_text: str, reply: str):
    try:
        existing = await db.memories.find({"user_id": user_id}, {"_id": 0, "title": 1}).to_list(200)
        prompt = (
            "Extract durable facts worth remembering long-term about the user from this exchange: preferences, personal details, "
            "projects, work context, explicit notes or reminders they asked to keep. Skip trivia and anything already known.\n"
            f"Already known: {json.dumps([e['title'] for e in existing])}\n\n"
            f"User: {user_text}\nAssistant: {reply[:1500]}\n\n"
            'Return ONLY a JSON array (possibly empty) of objects: {"title": short third-person fact, '
            '"category": one of Personal|Project|Security|Work|System, "importance": one of High|Medium|Low}.'
        )
        if not anthropic_client:
            return
        resp = await anthropic_client.messages.create(model=MODEL, max_tokens=800,
            system="You extract structured memories. Output JSON only.",
            messages=[{"role": "user", "content": prompt}])
        out = resp.content[0].text if resp.content else ""
        match = re.search(r"\[.*\]", out or "", re.S)
        items = json.loads(match.group(0)) if match else []
        for it in items[:5]:
            if not isinstance(it, dict) or not it.get("title"):
                continue
            await db.memories.insert_one({
                "id": new_id(), "user_id": user_id, "title": str(it["title"])[:200],
                "category": it.get("category") if it.get("category") in MEMORY_CATEGORIES else "Personal",
                "importance": it.get("importance") if it.get("importance") in MEMORY_IMPORTANCE else "Medium",
                "source": "auto", "created_at": now_iso(),
            })
    except Exception as exc:
        logger.warning("memory extraction failed: %s", exc)


@api.post("/chat/stream")
async def chat_stream(body: ChatIn, user: dict = Depends(get_user)):
    uid = user["user_id"]
    settings = await load_settings(uid)
    text = (body.message or "").strip()
    image_path = body.image_path

    if body.conversation_id:
        conv = await get_conv_or_404(body.conversation_id, uid)
    else:
        if not text and not image_path:
            raise HTTPException(400, "Message is empty")
        title = (text or "Image").replace("\n", " ")[:60]
        conv = {"id": new_id(), "user_id": uid, "title": title, "archived": False, "created_at": now_iso(), "updated_at": now_iso()}
        await db.conversations.insert_one({**conv})
    conv_id = conv["id"]

    if body.regenerate:
        msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
        last_user = next((m for m in reversed(msgs) if m["role"] == "user"), None)
        if not last_user:
            raise HTTPException(400, "Nothing to regenerate")
        await db.messages.delete_many({"conversation_id": conv_id, "role": "assistant", "created_at": {"$gt": last_user["created_at"]}})
        user_msg = last_user
    else:
        if body.edit_message_id:
            target = await db.messages.find_one({"id": body.edit_message_id, "conversation_id": conv_id, "role": "user"}, {"_id": 0})
            if not target:
                raise HTTPException(404, "Message not found")
            image_path = image_path or target.get("image_path")
            await db.messages.delete_many({"conversation_id": conv_id, "created_at": {"$gte": target["created_at"]}})
        if not text and not image_path:
            raise HTTPException(400, "Message is empty")
        if image_path and not await db.files.find_one({"storage_path": image_path, "user_id": uid}):
            raise HTTPException(400, "Unknown attachment")
        user_msg = {"id": new_id(), "conversation_id": conv_id, "user_id": uid, "role": "user", "content": text,
                    "image_path": image_path, "created_at": now_iso()}
        await db.messages.insert_one({**user_msg})
        user_msg.pop("_id", None)

    prior = await db.messages.find({"conversation_id": conv_id, "created_at": {"$lt": user_msg["created_at"]}}, {"_id": 0}).sort("created_at", 1).to_list(200)
    system = await build_system_prompt(user, body.personality, settings)
    history = [{"role": "system", "content": system}] + [history_entry(m) for m in prior[-40:]]

    image_b64 = None
    if user_msg.get("image_path"):
        try:
            data, ctype = await asyncio.to_thread(get_object, user_msg["image_path"])
            image_b64 = (base64.b64encode(data).decode(), ctype or "image/jpeg")
        except Exception as exc:
            logger.warning("could not load image: %s", exc)

    async def save_assistant(content: str, stopped: bool = False) -> dict:
        msg = {"id": new_id(), "conversation_id": conv_id, "user_id": uid, "role": "assistant", "content": content,
               "feedback": None, "stopped": stopped, "created_at": now_iso()}
        await db.messages.insert_one({**msg})
        await db.conversations.update_one({"id": conv_id}, {"$set": {"updated_at": now_iso()}})
        return msg

    async def gen():
        parts: list[str] = []
        state = {"saved": False, "errored": False}
        yield sse({"type": "meta", "conversation_id": conv_id, "conversation": conv, "user_message": user_msg})
        try:
            if not anthropic_client:
                raise RuntimeError("No Anthropic API key configured")
            prompt_text = user_msg.get("content") or "Please look at this image."
            # Build user content block (text + optional image)
            user_content: list = []
            if image_b64:
                b64_data, media_type = image_b64
                user_content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64_data}})
            user_content.append({"type": "text", "text": prompt_text})
            # Build messages (history excludes system which we pass separately)
            messages = [{"role": m["role"], "content": m["content"]} for m in prior[-40:] if m.get("content")]
            messages.append({"role": "user", "content": user_content})
            async with anthropic_client.messages.stream(
                model=MODEL,
                max_tokens=4096,
                system=system,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    parts.append(text)
                    yield sse({"type": "delta", "content": text})
            reply = "".join(parts)
            msg = await save_assistant(reply)
            state["saved"] = True
            yield sse({"type": "done", "message": msg})
            if settings.get("memory_enabled", True):
                asyncio.create_task(extract_memories(uid, prompt_text, reply))
        except Exception as exc:
            state["errored"] = True
            logger.exception("chat stream failed: %s", exc)
            yield sse({"type": "error", "detail": "Something went wrong while generating a response."})
        finally:
            if not state["saved"] and not state["errored"] and parts:
                asyncio.create_task(save_assistant("".join(parts), stopped=True))

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- Voice ----------
class TTSIn(BaseModel):
    text: str
    voice_id: Optional[str] = None


def clean_for_speech(text: str) -> str:
    text = re.sub(r"```.*?```", " (code omitted) ", text, flags=re.S)
    text = re.sub(r"\$\$.*?\$\$", " ", text, flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[#*_`>|~]", "", text)
    return re.sub(r"\s+", " ", text).strip()[:2500]


TTS_STATE = {"error": None}


@api.get("/tts/status")
async def tts_status(user: dict = Depends(get_user)):
    has_key = bool(os.environ.get("ELEVENLABS_API_KEY"))
    if has_key and TTS_STATE.get("checked_key") != os.environ["ELEVENLABS_API_KEY"]:
        key = os.environ["ELEVENLABS_API_KEY"]
        try:
            r = await asyncio.to_thread(requests.get, "https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": key}, timeout=15)
            TTS_STATE["error"] = "ElevenLabs rejected the API key" if "invalid_api_key" in r.text else None
        except Exception:
            TTS_STATE["error"] = "ElevenLabs could not be reached"
        TTS_STATE["checked_key"] = key
    return {"available": has_key and not TTS_STATE["error"], "error": TTS_STATE["error"] if has_key else "No ElevenLabs key configured"}


@api.post("/tts")
async def tts(body: TTSIn, user: dict = Depends(get_user)):
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise HTTPException(503, "Voice output is unavailable. Add an ElevenLabs key to enable it.")
    text = clean_for_speech(body.text)
    if not text:
        raise HTTPException(400, "Nothing to speak")
    voice_id = body.voice_id or (await load_settings(user["user_id"]))["voice_id"]

    def synth() -> bytes:
        from elevenlabs import ElevenLabs
        el = ElevenLabs(api_key=key)
        return b"".join(el.text_to_speech.convert(text=text, voice_id=voice_id, model_id="eleven_multilingual_v2"))

    try:
        audio = await asyncio.to_thread(synth)
    except Exception as exc:
        logger.warning("tts failed: %s", exc)
        TTS_STATE["error"] = "ElevenLabs rejected the request (check the API key)" if "api_key" in str(exc) else "ElevenLabs failed to respond"
        raise HTTPException(503, "Voice service failed to respond")
    TTS_STATE["error"] = None
    return Response(content=audio, media_type="audio/mpeg")


@api.post("/stt")
async def stt(audio: UploadFile = File(...), user: dict = Depends(get_user)):
    data = await audio.read()
    if len(data) < 1000:
        return {"text": ""}
    buf = io.BytesIO(data)
    ctype = audio.content_type or ""
    buf.name = "audio.mp4" if "mp4" in ctype else ("audio.ogg" if "ogg" in ctype else "audio.webm")
    if not OPENAI_KEY:
        raise HTTPException(503, "Speech-to-text unavailable — set OPENAI_API_KEY to enable it")
    try:
        import openai
        oai = openai.AsyncOpenAI(api_key=OPENAI_KEY)
        res = await oai.audio.transcriptions.create(file=(buf.name, buf, audio.content_type or "audio/webm"), model="whisper-1", response_format="json")
    except Exception as exc:
        logger.warning("stt failed: %s", exc)
        raise HTTPException(502, "Transcription failed")
    return {"text": (res.text or "").strip()}


# ---------- Contacts ----------
class ContactIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""


@api.get("/contacts")
async def get_contacts(user: dict = Depends(get_user)):
    return await db.contacts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("name", 1).collation({"locale": "en"}).to_list(5000)


@api.post("/contacts")
async def create_contact(body: ContactIn, user: dict = Depends(get_user)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    doc = {"id": new_id(), "user_id": user["user_id"], **body.model_dump(), "name": body.name.strip(), "created_at": now_iso()}
    await db.contacts.insert_one({**doc})
    return doc


@api.put("/contacts/{cid}")
async def update_contact(cid: str, body: ContactIn, user: dict = Depends(get_user)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    res = await db.contacts.update_one({"id": cid, "user_id": user["user_id"]}, {"$set": {**body.model_dump(), "name": body.name.strip()}})
    if not res.matched_count:
        raise HTTPException(404, "Contact not found")
    return await db.contacts.find_one({"id": cid}, {"_id": 0})


@api.delete("/contacts/{cid}")
async def delete_contact(cid: str, user: dict = Depends(get_user)):
    res = await db.contacts.delete_one({"id": cid, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Contact not found")
    return {"ok": True}


# ---------- Memories ----------
MEMORY_CATEGORIES = ["Personal", "Project", "Security", "Work", "System"]
MEMORY_IMPORTANCE = ["High", "Medium", "Low"]


class MemoryIn(BaseModel):
    title: str
    category: str = "Personal"
    importance: str = "Medium"


@api.get("/memories")
async def get_memories(user: dict = Depends(get_user)):
    return await db.memories.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/memories")
async def add_memory(body: MemoryIn, user: dict = Depends(get_user)):
    if not body.title.strip() or body.category not in MEMORY_CATEGORIES or body.importance not in MEMORY_IMPORTANCE:
        raise HTTPException(400, "Invalid memory")
    doc = {"id": new_id(), "user_id": user["user_id"], "title": body.title.strip()[:200], "category": body.category,
           "importance": body.importance, "source": "manual", "created_at": now_iso()}
    await db.memories.insert_one({**doc})
    return doc


@api.delete("/memories/{mid}")
async def delete_memory(mid: str, user: dict = Depends(get_user)):
    res = await db.memories.delete_one({"id": mid, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Memory not found")
    return {"ok": True}


@api.delete("/memories")
async def clear_memories(user: dict = Depends(get_user)):
    res = await db.memories.delete_many({"user_id": user["user_id"]})
    return {"ok": True, "deleted": res.deleted_count}


# ---------- Vision / faces ----------
@api.get("/face/status")
async def face_status(user: dict = Depends(get_user)):
    return {"available": False, "reason": "Face recognition service is not connected."}


@api.get("/face/list")
async def face_list(user: dict = Depends(get_user)):
    return await db.face_people.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/face/add-person")
async def face_add(name: str = Form(...), role: str = Form(""), photo: UploadFile = File(...), user: dict = Depends(get_user)):
    if not name.strip():
        raise HTTPException(400, "Name is required")
    path = await store_image(user["user_id"], photo)
    doc = {"id": new_id(), "user_id": user["user_id"], "name": name.strip(), "role": role.strip(), "photo_path": path, "created_at": now_iso()}
    await db.face_people.insert_one({**doc})
    return doc


@api.delete("/face/{pid}")
async def face_delete(pid: str, user: dict = Depends(get_user)):
    person = await db.face_people.find_one({"id": pid, "user_id": user["user_id"]}, {"_id": 0})
    if not person:
        raise HTTPException(404, "Person not found")
    await db.face_people.delete_one({"id": pid})
    in_use = await db.discoveries.find_one({"user_id": user["user_id"], "photo_path": person["photo_path"]})
    if not in_use:
        await db.files.update_one({"storage_path": person["photo_path"]}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@api.post("/face/identify")
async def face_identify(image: UploadFile = File(...), user: dict = Depends(get_user)):
    raise HTTPException(503, "Face recognition is unavailable right now.")


class DiscoveryIn(BaseModel):
    name: str
    role: Optional[str] = ""
    photo_path: Optional[str] = None
    confidence: Optional[float] = None
    notes: Optional[str] = ""


@api.get("/discoveries")
async def get_discoveries(user: dict = Depends(get_user)):
    return await db.discoveries.find({"user_id": user["user_id"]}, {"_id": 0}).sort("last_seen", -1).to_list(2000)


@api.post("/discoveries")
async def save_discovery(body: DiscoveryIn, user: dict = Depends(get_user)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    existing = await db.discoveries.find_one({"user_id": user["user_id"], "name": body.name.strip()}, {"_id": 0})
    if existing:
        await db.discoveries.update_one({"id": existing["id"]}, {"$set": {"last_seen": now_iso(), "confidence": body.confidence}})
        return await db.discoveries.find_one({"id": existing["id"]}, {"_id": 0})
    doc = {"id": new_id(), "user_id": user["user_id"], **body.model_dump(), "name": body.name.strip(), "last_seen": now_iso(), "created_at": now_iso()}
    await db.discoveries.insert_one({**doc})
    return doc


class NotesIn(BaseModel):
    notes: str


@api.patch("/discoveries/{did}")
async def update_discovery(did: str, body: NotesIn, user: dict = Depends(get_user)):
    res = await db.discoveries.update_one({"id": did, "user_id": user["user_id"]}, {"$set": {"notes": body.notes}})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return await db.discoveries.find_one({"id": did}, {"_id": 0})


@api.delete("/discoveries/{did}")
async def delete_discovery(did: str, user: dict = Depends(get_user)):
    res = await db.discoveries.delete_one({"id": did, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Search ----------
@api.get("/search")
async def search(q: str = Query(..., min_length=1), user: dict = Depends(get_user)):
    uid = user["user_id"]
    rx = {"$regex": re.escape(q.strip()), "$options": "i"}
    msgs = await db.messages.find({"user_id": uid, "content": rx}, {"_id": 0}).sort("created_at", -1).to_list(60)
    title_hits = await db.conversations.find({"user_id": uid, "title": rx}, {"_id": 0}).to_list(20)
    conv_ids = list({m["conversation_id"] for m in msgs} | {c["id"] for c in title_hits})
    convs = {c["id"]: c for c in await db.conversations.find({"id": {"$in": conv_ids}}, {"_id": 0}).to_list(100)}
    results, seen = [], set()
    for m in msgs:
        cid = m["conversation_id"]
        if cid in seen or cid not in convs:
            continue
        seen.add(cid)
        content = m["content"]
        idx = content.lower().find(q.strip().lower())
        snippet = content[max(0, idx - 40): idx + 100] if idx >= 0 else content[:140]
        results.append({"conversation_id": cid, "title": convs[cid]["title"], "snippet": snippet, "updated_at": convs[cid]["updated_at"]})
    for c in title_hits:
        if c["id"] not in seen:
            results.append({"conversation_id": c["id"], "title": c["title"], "snippet": "", "updated_at": c["updated_at"]})
    contacts = await db.contacts.find({"user_id": uid, "$or": [{"name": rx}, {"email": rx}, {"phone": rx}]}, {"_id": 0}).to_list(20)
    return {"conversations": results[:20], "contacts": contacts}


app.include_router(api)

CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[] if CORS_ORIGINS == ['*'] else CORS_ORIGINS,
    allow_origin_regex=".*" if CORS_ORIGINS == ['*'] else None,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("JARVIS backend started (local storage: %s)", UPLOADS_DIR)


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
