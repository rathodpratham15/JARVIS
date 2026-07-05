# J.A.R.V.I.S

An AI operating companion for personal computing — not a command-driven voice assistant, but an intelligent agent that understands context, reasons through complex requests, and executes multi-step tasks on your behalf.

Built with Python/Flask on the backend and React + Vite + TypeScript on the frontend, with an Iron Man HUD aesthetic.

```
.
├── backend/     Python package (jarvis) — Flask API, CLI, agent core
└── frontend/    React + Vite + TypeScript — Iron Man HUD interface
```

---

## Quick start

**Terminal 1 — backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # add your API keys
jarvis-web              # → http://127.0.0.1:5050
```

**Terminal 2 — frontend**
```bash
cd frontend
pnpm install
pnpm dev                # → http://127.0.0.1:5173
```

The Vite dev server proxies `/api/*` to the backend — no CORS config needed.

**CLI (no browser)**
```bash
jarvis            # text REPL
jarvis --voice    # mic + speakers + webcam (Iron Man mode)
```

---

## What it does

### Agent loop
The core feature. JARVIS maintains a full reasoning thread across multiple tool calls until a complex goal is satisfied.

```
You:    "Search for the latest fusion energy news and save a summary as a note"

Step 1  search_web("fusion energy news 2026")  →  [web snippets]
Step 2  save_note("Fusion update: NIF achieved...")  →  "Saved."
Final   "I found the latest developments on fusion energy and saved a summary note."
```

Switch to **AGENT mode** in the chat UI (gold ⚡ button) for multi-step goals. Stay in **CHAT mode** for single-turn streaming responses.

### Intelligent chat
- Regex intent classifier handles known intents directly (time, weather, calculations, reminders, notes, navigation, smart home) — fast, no API cost
- LLM tool use for everything else: the model decides whether to answer directly or call a tool
- Streaming responses via SSE — tokens appear as they arrive
- Conversation history with semantic retrieval (embeddings via `all-MiniLM-L6-v2`)

### Web search
Real-time internet search with a three-provider fallback chain:
1. Brave Search API (`BRAVE_API_KEY`) — preferred
2. Serper.dev (`SERPER_API_KEY`) — fallback
3. DuckDuckGo Instant Answer — always available, no key needed

The LLM synthesises search results into a concise answer. Works out of the box without any API key.

### Memory
- Every interaction stored in SQLite and indexed as a 384-dim embedding
- Semantic search: `/api/search?q=...` returns the most relevant past interactions by meaning, not keyword
- LLM context built from semantically relevant history rather than just the most recent N turns

### Vision
- **Face recognition** — match uploaded photos or live camera frames against a known-faces database. Bulk import via Excel. Tolerance configurable per-session.
- **Scene analysis** — describe objects, mood, colors, and scene type from any image. Powered by Gemini Vision or GPT-4o-mini.
- **Live camera** — capture frames directly from the browser webcam for real-time face identification.

### Voice
- STT via OpenAI Whisper API or Groq (configurable), with local Whisper and Google Speech as fallbacks
- TTS via ElevenLabs — `/api/voice/speak` returns MP3 bytes
- Browser captures audio and posts to `/api/voice/transcribe`

### Reminders & timers
- Natural language: *"remind me to call Pepper in 2 hours"*, *"set a timer for 5 minutes"*
- Persisted in SQLite with scheduled `due_at` timestamps
- Background poller fires due reminders; frontend surfaces them as HUD toasts

### Smart home
Home Assistant REST API integration. Set `HA_URL` and `HA_TOKEN` in `.env` or via the Settings page.
Commands: turn on/off, dim, toggle, set temperature. Entity matched by friendly name with slug fallback.

### Plugins
Drop a `BasePlugin` subclass into `backend/plugins/` — it's auto-discovered, priority-routed, and enable/disable state persisted across restarts.

### System control
Open applications, copy/move/delete files — all require explicit user approval in the UI before execution. Shell-injection-safe (`subprocess` list mode, shell-metachar rejection, blocked system paths).

---

## UI

Nine-section Iron Man HUD:

| Section | Contents |
|---|---|
| **Dashboard** | System health, module status, quick actions, stats |
| **Chat** | Streaming chat + multi-step agent mode |
| **Voice Input** | Record audio → transcribe → TTS playback |
| **Vision** | Camera recognition · Face ID · Scene analysis |
| **Intelligence** | Emotion analysis · Knowledge base |
| **Data** | Memory explorer · Notes |
| **Plugins** | Toggle and manage installed plugins |
| **System Control** | Launch apps, approve/deny pending actions |
| **Settings** | Voice, smart home (HA_URL + HA_TOKEN), privacy |

---

## API

45 routes. Key ones:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/agent` | Multi-step agent — `{ goal, max_steps }` → step trace + final answer |
| `POST` | `/api/chat` | Single-turn chat |
| `POST` | `/api/chat/stream` | Streaming chat via SSE |
| `GET` | `/api/search?q=` | Semantic search over conversation history |
| `GET` | `/api/search/web?q=` | Live web search with LLM summary |
| `GET` | `/api/search/semantic?q=` | Embedding-based memory search |
| `POST` | `/api/voice/transcribe` | Audio file → text |
| `POST` | `/api/voice/speak` | Text → MP3 bytes |
| `POST` | `/api/face/identify` | Match image against face database |
| `POST` | `/api/vision/analyze` | Scene description for uploaded image |
| `GET/POST/DELETE` | `/api/dashboard/notes` | Notes CRUD |
| `GET/POST` | `/api/dashboard/settings` | Settings read/write |
| `GET` | `/api/reminders/pending` | Active reminders |
| `GET` | `/api/timers/pending` | Active timers |
| `POST` | `/api/system/open-application` | Queue app launch (requires approval) |
| `POST` | `/api/system/confirm-action` | Approve or deny a pending action |
| `GET` | `/api/health` | Liveness check |

---

## Configuration

All via `backend/.env` (copy from `.env.example`):

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Chat, tool use, Whisper STT, scene analysis |
| `GROQ_API_KEY` | Chat + STT alternative — generous free tier |
| `GEMINI_API_KEY` | Scene analysis (preferred over OpenAI Vision) |
| `ELEVENLABS_API_KEY` | TTS voice synthesis |
| `BRAVE_API_KEY` | Web search (2k free queries/month) |
| `SERPER_API_KEY` | Web search fallback (2.5k free/month) |
| `OPENWEATHER_API_KEY` | Real-time weather |
| `HA_URL` + `HA_TOKEN` | Home Assistant smart home control |

**Zero-key mode** — the system works without any API keys: time, calculations, reminders, notes, navigation, and DuckDuckGo web search all run locally. Free-form chat returns demo responses.

---

## Project structure

```
backend/
├── src/jarvis/
│   ├── core/
│   │   ├── agent.py           ReAct multi-step agent loop
│   │   ├── action_engine.py   Intent → action dispatcher
│   │   ├── intent_parser.py   Regex-based intent classifier
│   │   ├── llm_core.py        OpenAI/Groq client (chat, streaming, tool use)
│   │   ├── memory.py          SQLite conversation store
│   │   ├── semantic_memory.py sqlite-vec vector index (all-MiniLM-L6-v2)
│   │   ├── reminders.py       Persistent reminders + timers
│   │   └── tool_definitions.py OpenAI function schemas
│   ├── ai/            Emotion analyzer, knowledge base
│   ├── dashboard/     Notes store, settings store
│   ├── plugins/       Auto-discovery, BasePlugin contract, persistent state
│   ├── services/      Weather, web search (Brave/Serper/DDG), smart home (HA)
│   ├── speech/        Whisper transcription, ElevenLabs synthesis
│   ├── system/        OS control with approval flow
│   ├── vision/        Face recognition, scene analysis, capture history
│   ├── cli/           Text REPL + voice mode
│   └── web/app.py     Flask application (45 routes)
├── plugins/           Drop user plugins here
└── tests/             80 pytest cases

frontend/
└── src/
    ├── pages/         Dashboard, Chat, Vision, Intelligence, Data, ...
    ├── components/
    │   ├── hud/       HudPanel, StatusDot, MonoLabel, PageHeader, UploadZone
    │   └── layout/    TopBar, Sidebar, Footer, Layout
    ├── config/nav.ts  Navigation items
    ├── hooks/         useReminderPoller
    └── lib/hudToast.ts HUD-styled toast notifications
```

---

## Running tests

```bash
cd backend
pytest              # 80 cases — no network, no hardware, no API keys required
```

The suite mocks dlib, OpenAI, Gemini, ElevenLabs, and `subprocess.run`.

---

## License

MIT.
