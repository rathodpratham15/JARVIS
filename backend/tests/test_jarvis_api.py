# J.A.R.V.I.S. backend regression tests: auth, settings, conversations/chat stream, feedback, contacts, memories, face, discoveries, search, tts
import io
import json
import os
import struct
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TOKEN = "test_session_jarvis"


def png_bytes(w=8, h=8, color=(255, 0, 0)):
    raw = b"".join(b"\x00" + bytes(color) * w for _ in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {TOKEN}"})
    return sess


def read_sse(resp):
    events = []
    for line in resp.iter_lines(decode_unicode=True):
        if line and line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


# ---- Auth ----
class TestAuth:
    def test_me_bearer(self, s):
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["user_id"] == "test-user-1"
        assert "_id" not in r.json()

    def test_me_cookie(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", cookies={"session_token": TOKEN})
        assert r.status_code == 200

    def test_me_unauth(self):
        assert requests.get(f"{BASE_URL}/api/auth/me").status_code == 401
        assert requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer bogus"}).status_code == 401


# ---- Settings ----
class TestSettings:
    def test_get_and_save(self, s):
        r = s.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        orig = r.json()
        assert "integrations" in orig
        r = s.post(f"{BASE_URL}/api/settings", json={"personality": "tactical", "integrations": {"gmail": True}})
        assert r.status_code == 200
        assert r.json()["personality"] == "tactical" and r.json()["integrations"]["gmail"] is True
        assert s.get(f"{BASE_URL}/api/settings").json()["personality"] == "tactical"
        # restore
        s.post(f"{BASE_URL}/api/settings", json={"personality": orig["personality"], "integrations": orig["integrations"]})

    def test_bad_personality(self, s):
        assert s.post(f"{BASE_URL}/api/settings", json={"personality": "evil"}).status_code == 400


# ---- Chat + conversations ----
class TestChat:
    conv_id = None
    asst_id = None

    def test_stream_new_conversation(self, s):
        r = s.post(f"{BASE_URL}/api/chat/stream", json={"message": "TEST_ reply with just the word PONG", "personality": "concise"}, stream=True, timeout=120)
        assert r.status_code == 200
        ev = read_sse(r)
        types = [e["type"] for e in ev]
        assert types[0] == "meta"
        assert "delta" in types, ev
        assert types[-1] == "done", ev
        TestChat.conv_id = ev[0]["conversation_id"]
        TestChat.asst_id = ev[-1]["message"]["id"]
        assert "PONG" in ev[-1]["message"]["content"].upper()

    def test_get_conversation(self, s):
        r = s.get(f"{BASE_URL}/api/conversations/{TestChat.conv_id}")
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert [m["role"] for m in msgs] == ["user", "assistant"]

    def test_regenerate(self, s):
        r = s.post(f"{BASE_URL}/api/chat/stream", json={"conversation_id": TestChat.conv_id, "regenerate": True, "personality": "concise"}, stream=True, timeout=120)
        ev = read_sse(r)
        assert ev[-1]["type"] == "done"
        msgs = s.get(f"{BASE_URL}/api/conversations/{TestChat.conv_id}").json()["messages"]
        assert len(msgs) == 2
        TestChat.asst_id = msgs[1]["id"]

    def test_feedback(self, s):
        r = s.post(f"{BASE_URL}/api/messages/{TestChat.asst_id}/feedback", json={"value": "up"})
        assert r.status_code == 200
        msgs = s.get(f"{BASE_URL}/api/conversations/{TestChat.conv_id}").json()["messages"]
        assert msgs[1]["feedback"] == "up"
        assert s.post(f"{BASE_URL}/api/messages/{TestChat.asst_id}/feedback", json={"value": "bad"}).status_code == 400
        assert s.post(f"{BASE_URL}/api/messages/nope/feedback", json={"value": "up"}).status_code == 404

    def test_edit(self, s):
        msgs = s.get(f"{BASE_URL}/api/conversations/{TestChat.conv_id}").json()["messages"]
        uid = msgs[0]["id"]
        r = s.post(f"{BASE_URL}/api/chat/stream", json={"conversation_id": TestChat.conv_id, "edit_message_id": uid, "message": "TEST_ reply with just the word PING", "personality": "concise"}, stream=True, timeout=120)
        ev = read_sse(r)
        assert ev[-1]["type"] == "done"
        msgs = s.get(f"{BASE_URL}/api/conversations/{TestChat.conv_id}").json()["messages"]
        assert len(msgs) == 2
        assert "PING" in msgs[0]["content"]

    def test_empty_message(self, s):
        assert s.post(f"{BASE_URL}/api/chat/stream", json={"message": ""}).status_code == 400

    def test_list_rename_archive(self, s):
        cid = TestChat.conv_id
        assert any(c["id"] == cid for c in s.get(f"{BASE_URL}/api/conversations").json())
        r = s.patch(f"{BASE_URL}/api/conversations/{cid}", json={"title": "TEST_ renamed"})
        assert r.json()["title"] == "TEST_ renamed"
        s.patch(f"{BASE_URL}/api/conversations/{cid}", json={"archived": True})
        assert any(c["id"] == cid for c in s.get(f"{BASE_URL}/api/conversations?archived=true").json())
        assert not any(c["id"] == cid for c in s.get(f"{BASE_URL}/api/conversations").json())
        s.patch(f"{BASE_URL}/api/conversations/{cid}", json={"archived": False})

    def test_search(self, s):
        r = s.get(f"{BASE_URL}/api/search", params={"q": "TEST_ renamed"})
        assert r.status_code == 200
        assert any(c["conversation_id"] == TestChat.conv_id for c in r.json()["conversations"])

    def test_delete(self, s):
        cid = TestChat.conv_id
        assert s.delete(f"{BASE_URL}/api/conversations/{cid}").status_code == 200
        assert s.get(f"{BASE_URL}/api/conversations/{cid}").status_code == 404


# ---- Uploads + image chat ----
class TestUploads:
    def test_upload_and_fetch(self, s):
        r = s.post(f"{BASE_URL}/api/uploads", files={"file": ("t.png", png_bytes(), "image/png")}, timeout=60)
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        f = s.get(f"{BASE_URL}/api/files/{path}", timeout=60)
        assert f.status_code == 200 and f.content[:4] == b"\x89PNG"

    def test_upload_non_image(self, s):
        r = s.post(f"{BASE_URL}/api/uploads", files={"file": ("t.txt", b"hello", "text/plain")})
        assert r.status_code == 400


# ---- Contacts ----
class TestContacts:
    def test_crud(self, s):
        r = s.post(f"{BASE_URL}/api/contacts", json={"name": "TEST_Alice", "phone": "+15550001", "email": "a@x.com"})
        assert r.status_code == 200
        cid = r.json()["id"]
        assert any(c["id"] == cid for c in s.get(f"{BASE_URL}/api/contacts").json())
        r = s.put(f"{BASE_URL}/api/contacts/{cid}", json={"name": "TEST_Alice2", "phone": "+1"})
        assert r.json()["name"] == "TEST_Alice2"
        sr = s.get(f"{BASE_URL}/api/search", params={"q": "TEST_Alice2"}).json()
        assert any(c["id"] == cid for c in sr["contacts"])
        assert s.delete(f"{BASE_URL}/api/contacts/{cid}").status_code == 200
        assert s.delete(f"{BASE_URL}/api/contacts/{cid}").status_code == 404

    def test_empty_name(self, s):
        assert s.post(f"{BASE_URL}/api/contacts", json={"name": "  "}).status_code == 400


# ---- Memories ----
class TestMemories:
    def test_add_delete(self, s):
        r = s.post(f"{BASE_URL}/api/memories", json={"title": "TEST_ likes tea", "category": "Personal", "importance": "Low"})
        assert r.status_code == 200
        mid = r.json()["id"]
        assert any(m["id"] == mid for m in s.get(f"{BASE_URL}/api/memories").json())
        assert s.delete(f"{BASE_URL}/api/memories/{mid}").status_code == 200
        assert s.post(f"{BASE_URL}/api/memories", json={"title": "x", "category": "Bad"}).status_code == 400


# ---- Face / discoveries / tts ----
class TestVision:
    def test_face(self, s):
        assert s.get(f"{BASE_URL}/api/face/status").json()["available"] is False
        r = s.post(f"{BASE_URL}/api/face/add-person", data={"name": "TEST_Bob", "role": "friend"}, files={"photo": ("p.png", png_bytes(), "image/png")}, timeout=60)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert any(p["id"] == pid for p in s.get(f"{BASE_URL}/api/face/list").json())
        assert s.delete(f"{BASE_URL}/api/face/{pid}").status_code == 200
        r = s.post(f"{BASE_URL}/api/face/identify", files={"image": ("p.png", png_bytes(), "image/png")})
        assert r.status_code == 503

    def test_discoveries(self, s):
        r = s.post(f"{BASE_URL}/api/discoveries", json={"name": "TEST_Carol", "confidence": 0.9})
        assert r.status_code == 200
        did = r.json()["id"]
        r2 = s.post(f"{BASE_URL}/api/discoveries", json={"name": "TEST_Carol", "confidence": 0.8})
        assert r2.json()["id"] == did
        assert s.patch(f"{BASE_URL}/api/discoveries/{did}", json={"notes": "hi"}).json()["notes"] == "hi"
        assert s.delete(f"{BASE_URL}/api/discoveries/{did}").status_code == 200
        assert s.delete(f"{BASE_URL}/api/discoveries/{did}").status_code == 404

    def test_tts(self, s):
        r = s.post(f"{BASE_URL}/api/tts", json={"text": "Hello"}, timeout=60)
        assert r.status_code in (200, 503)
        print("TTS status", r.status_code, r.text[:100])
