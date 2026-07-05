# J.A.R.V.I.S

An AI operating companion for personal computing — not a command-driven voice assistant, but an intelligent agent that understands context, reasons through complex requests, executes multi-step tasks autonomously, and controls your desktop on command.

Built with Python/Flask on the backend and React + Vite + TypeScript on the frontend, with an Iron Man HUD aesthetic. Installable as a PWA — works on mobile with a bottom nav and wake-word activation ("Hi JARVIS").

```
.
├── backend/     Python package (jarvis) — Flask API, CLI, agent core
└── frontend/    React + Vite + TypeScript — Iron Man HUD interface (PWA)
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
npm install
npm run dev             # → http://127.0.0.1:5173
```

The Vite dev server proxies `/api/*` to the backend — no CORS config needed.

**Install on mobile (PWA)**
Open the app in Chrome (Android) or Safari (iOS) → browser menu → **Add to Home Screen**. Launches fullscreen like a native app, with wake-word activation.

**CLI (no browser)**
```bash
jarvis            # text REPL
jarvis --voice    # mic + speakers + webcam
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

Three modes in the chat UI:
- **CHAT** — single-turn streaming responses via SSE
- **AGENT** ⚡ — multi-step goal execution (synchronous, shows tool trace)
- **BG TASK** 🕐 — submits the goal to a background thread; poll for results while doing other things

### Background agent tasks
Long-running goals run on daemon threads with a semaphore-capped worker pool (4 concurrent tasks). The UI polls every 4 s and shows status, step count, and the final answer. Tasks can be cancelled mid-run.

### Autonomous scheduling
JARVIS acts proactively on a cron-like schedule — no prompting required.

```
"every day at 08:00" → search web for today's AI news and save a summary note
"every monday at 10:00" → check my reminders and send a briefing
"every 30 minutes" → check server health and log a note if anything is off
```

Jobs are persisted to SQLite and survive restarts. Managed in **Data → SCHEDULE**.

### OS / desktop control
Full desktop automation via pyautogui:
- **Screenshot** — capture the screen and view it live in the browser
- **Click / double-click** — click anywhere on the screenshot to click that screen position
- **Type** — type text at the current cursor position
- **Press key** — press any key (Enter, Escape, Tab, arrows, function keys…)
- **Hotkey** — trigger key chords (Cmd+C, Cmd+V, Cmd+Space, …)
- **Scroll** — scroll at any screen position

The agent can also use these tools autonomously: *"click the Submit button"*, *"type my email address into the form"*.

> macOS: grant Accessibility permission to the terminal running the backend (System Settings → Privacy & Security → Accessibility).

### Web search
Real-time internet search with a three-provider fallback chain:
1. Brave Search API (`BRAVE_API_KEY`) — preferred
2. Serper.dev (`SERPER_API_KEY`) — fallback
3. DuckDuckGo Instant Answer — always available, no key needed

The LLM synthesises results into a concise answer.

### People & company research
Aggregate public web information into a structured profile — useful before meetings or after networking events.

```
"Research Jensen Huang at NVIDIA"
→ professional background · career history · education · notable work · source links
```

Available in **Intelligence → Research** or via the agent tool `research_person`.

### Intelligent chat
- Regex intent classifier handles known intents directly — fast, no API cost
- LLM tool use (OpenAI function calling) for everything else — 13 registered tools
- Streaming responses via SSE
- Conversation history with semantic retrieval (embeddings via `all-MiniLM-L6-v2`)

### Memory
- Every interaction stored in SQLite and indexed as a 384-dim embedding
- Semantic search: `/api/search?q=...` returns the most relevant past interactions by meaning
- LLM context built from semantically relevant history rather than just the most recent N turns

### Vision
- **Face recognition** — match photos or live camera frames against a known-faces DB
- **Scene analysis** — describe objects, mood, colors, and scene type from any image
- **Live camera** — capture from the browser webcam for real-time face identification

### Voice
- STT via OpenAI Whisper API or Groq; local Whisper and Google Speech as fallbacks
- TTS via ElevenLabs — `/api/voice/speak` returns MP3 bytes
- **Wake word** — say "Hi JARVIS" (or "Hey JARVIS") to activate the chat from any page (PWA / mobile)

### Reminders & timers
- Natural language: *"remind me to call Pepper in 2 hours"*, *"set a timer for 5 minutes"*
- Persisted in SQLite; background poller fires due reminders as HUD toasts

### Smart home
Home Assistant REST API integration. Set `HA_URL` and `HA_TOKEN` in `.env` or Settings.
Commands: turn on/off, dim, toggle, set temperature. Entity matched by friendly name.

### Plugins
Drop a `BasePlugin` subclass into `backend/plugins/` — auto-discovered, priority-routed, enable/disable state persisted across restarts.

---

## UI

Nine-section Iron Man HUD — fully responsive, works on desktop and mobile:

| Section | Contents |
|---|---|
| **Dashboard** | System health, module status, quick actions, interaction stats |
| **Chat** | Streaming chat · multi-step agent mode · background task queue |
| **Voice Input** | Record audio → transcribe → TTS playback |
| **Vision** | Camera recognition · Face ID · Scene analysis |
| **Intelligence** | Emotion analysis · People/company research · Knowledge base |
| **Data** | Memory explorer · Notes · Autonomous schedule manager |
| **Plugins** | Toggle and manage installed plugins |
| **System Control** | Live desktop screenshot · click/type/hotkey control · app launcher |
| **Settings** | Voice, smart home (HA_URL + HA_TOKEN), privacy |

**Mobile:** bottom tab bar navigation, slide-in sidebar drawer, installable as a PWA with wake-word activation.

---

## API

60+ routes. Key ones:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/agent` | Multi-step agent — `{ goal, max_steps }` → step trace + final answer |
| `POST` | `/api/tasks` | Submit background task → returns `task_id` immediately |
| `GET` | `/api/tasks` | List all background tasks |
| `DELETE` | `/api/tasks/<id>` | Cancel a running task |
| `POST` | `/api/chat` | Single-turn chat |
| `POST` | `/api/chat/stream` | Streaming chat via SSE |
| `GET` | `/api/search/web?q=` | Live web search with LLM summary |
| `GET` | `/api/search/semantic?q=` | Embedding-based memory search |
| `POST` | `/api/research` | People / company / topic research pipeline |
| `GET` | `/api/os/screenshot` | Full-screen screenshot → base64 PNG |
| `POST` | `/api/os/action` | Desktop action (click, type, press, hotkey, scroll) |
| `GET/POST` | `/api/schedules` | List / create autonomous scheduled jobs |
| `PATCH` | `/api/schedules/<id>` | Enable / disable a job |
| `POST` | `/api/schedules/<id>/run` | Trigger a job immediately |
| `POST` | `/api/voice/transcribe` | Audio file → text |
| `POST` | `/api/voice/speak` | Text → MP3 bytes |
| `POST` | `/api/face/identify` | Match image against face database |
| `POST` | `/api/vision/analyze` | Scene description for uploaded image |
| `GET/POST/DELETE` | `/api/dashboard/notes` | Notes CRUD |
| `GET` | `/api/reminders/due` | Due reminders (polled by frontend) |
| `POST` | `/api/system/open-application` | Queue app launch (requires UI approval) |
| `GET` | `/api/health` | Liveness check |

---

## Configuration

All via `backend/.env`:

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

**Zero-key mode** — time, calculations, reminders, notes, navigation, OS control, and DuckDuckGo web search all run without any API key. Free-form chat returns demo responses.

---

## Project structure

```
backend/
├── src/jarvis/
│   ├── core/
│   │   ├── agent.py            ReAct multi-step agent loop
│   │   ├── action_engine.py    Intent → action dispatcher (14 handlers)
│   │   ├── intent_parser.py    Regex-based intent classifier
│   │   ├── llm_core.py         OpenAI/Groq (chat, streaming, tool use)
│   │   ├── memory.py           SQLite conversation store
│   │   ├── semantic_memory.py  sqlite-vec vector index (all-MiniLM-L6-v2)
│   │   ├── reminders.py        Persistent reminders + timers
│   │   ├── task_manager.py     Background agent task queue
│   │   ├── scheduler.py        Autonomous cron-like job scheduler
│   │   └── tool_definitions.py OpenAI function schemas (13 tools)
│   ├── ai/            Emotion analyzer, knowledge base
│   ├── dashboard/     Notes store, settings store
│   ├── plugins/       Auto-discovery, BasePlugin contract, persistent state
│   ├── services/
│   │   ├── web_search.py       Brave / Serper / DuckDuckGo fallback chain
│   │   ├── people_research.py  Person + company profile aggregation
│   │   ├── os_control.py       Desktop automation (pyautogui wrapper)
│   │   └── smart_home.py       Home Assistant REST API
│   ├── speech/        Whisper transcription, ElevenLabs synthesis
│   ├── system/        OS control with approval flow
│   ├── vision/        Face recognition, scene analysis, capture history
│   ├── cli/           Text REPL + voice mode
│   └── web/app.py     Flask application (60+ routes)
├── plugins/           Drop user plugins here
└── tests/             80 pytest cases

frontend/src/
├── pages/             Dashboard, Chat, Vision, Intelligence, Data, SystemControl, …
├── components/
│   ├── hud/           HudPanel, StatusDot, MonoLabel, PageHeader, ScanLoader
│   ├── MobileNav.tsx  Bottom tab bar (mobile)
│   ├── Layout.tsx     Responsive layout (sidebar drawer on mobile)
│   ├── TopBar.tsx     Header with hamburger on mobile
│   └── Sidebar.tsx    Desktop sidebar / mobile drawer
├── hooks/
│   ├── useReminderPoller.ts  Polls /api/reminders/due every 30 s
│   └── useWakeWord.ts        Wake-word listener ("Hi JARVIS")
├── config/nav.ts      Navigation items
└── lib/hudToast.ts    HUD-styled toast notifications
```

---

## Running tests

```bash
cd backend
pytest              # 80 cases — no network, no hardware, no API keys required
```

---

## License

MIT.
