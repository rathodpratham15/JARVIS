# J.A.R.V.I.S

An AI operating companion for personal computing — not a command-driven voice assistant, but an intelligent agent that understands context, reasons through complex requests, executes multi-step tasks autonomously, controls your desktop on command, and integrates with your calendar, messaging, music, and smart home.

Built with Python/Flask on the backend and React + Vite + TypeScript on the frontend, with an Iron Man HUD aesthetic. Installable as a PWA — works on mobile with a bottom nav and wake-word activation ("Hey Jarvis").

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
- **AGENT** ⚡ — multi-step goal execution (shows live tool trace)
- **BG TASK** 🕐 — submits to a background thread; poll for results while doing other things

### Background agent tasks
Long-running goals run on daemon threads with a semaphore-capped worker pool (4 concurrent tasks). The UI polls every 4 s and shows status, step count, and the final answer. Tasks can be cancelled mid-run.

### Autonomous scheduling
JARVIS acts proactively on a cron-like schedule — no prompting required.

```
"every day at 08:00"                          → search web for AI news and save a note
"every monday at 10:00"                       → check reminders and send a briefing
"every 30 minutes"                            → check server health and log a note
"every month on the 15th at 10:00"            → send monthly summary
"every year on july 1st at 9am"               → send a happy birthday WhatsApp
```

Jobs are persisted to SQLite and survive restarts. Managed in **Background Agents**. Supported expressions:
- Interval: `every N minutes/hours/days`
- Daily/Weekly: `every day at 09:00` · `every monday at 10:00`
- Monthly: `every month on the 15th at 10:00`
- Yearly: `every year on july 1st at 9am`

### Messaging — SMS & WhatsApp (Twilio)
Send SMS messages and WhatsApp messages via natural language commands or scheduled jobs.

```
"Send a WhatsApp to mom saying I'll be home by 8"
"SMS +14155552671 your package was delivered"
```

Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`. WhatsApp uses the Twilio sandbox by default (`TWILIO_WHATSAPP_FROM`). The agent resolves contact names to phone numbers automatically via the Contacts store.

### Contacts
SQLite-backed address book. Store names, phone numbers, WhatsApp numbers, and email addresses. The agent resolves "mom" or "John" to the correct number when sending messages.

- CRUD UI at **Contacts** page
- API: `GET/POST /api/contacts`, `GET/PUT/DELETE /api/contacts/<id>`

### Spotify
Control Spotify playback via OAuth 2.0 Authorization Code Flow.

```
"Play Daft Punk on Spotify"
"Skip this song"
"Set volume to 50"
"What's playing?"
```

Connect at `/api/spotify/connect`. Token auto-refreshes. Requires `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`.

### Smart home — Home Assistant
Control any Home Assistant entity by friendly name.

```
"Turn off the living room lights"
"Set the thermostat to 72 degrees"
"What's the temperature sensor reading?"
```

Fuzzy entity name matching. Requires `HOMEASSISTANT_URL` and `HOMEASSISTANT_TOKEN`.

### Google Workspace
Eight agent tools covering Gmail, Google Calendar, and Google Drive.

| Tool | What it does |
|---|---|
| `gmail_search` | Search inbox by query |
| `gmail_read` | Read a message by ID |
| `gmail_send` | Send an email |
| `calendar_list` | List upcoming events |
| `calendar_create` | Create a new event |
| `drive_list` | List files in Drive |
| `drive_upload` | Upload a file |
| `drive_read` | Read a file's content |

OAuth 2.0 flow with refresh token storage. Connect in **Settings → Google Workspace**.

### OS / desktop control
Full desktop automation via pyautogui:
- **Screenshot** — capture the screen and view it live in the browser
- **Click / double-click** — click anywhere on the screenshot
- **Type** — type text at the current cursor position
- **Press key** — press any key (Enter, Escape, Tab, arrows, function keys…)
- **Hotkey** — trigger key chords (Cmd+C, Cmd+V, Cmd+Space, …)
- **Scroll** — scroll at any screen position

The agent can also use these tools autonomously: *"click the Submit button"*, *"type my email address into the form"*.

> macOS: grant Accessibility permission to the terminal running the backend (System Settings → Privacy & Security → Accessibility).

### Web search
Real-time internet search with a three-provider fallback chain:
1. Tavily (`TAVILY_API_KEY`) — primary, direct answers
2. Brave Search API (`BRAVE_API_KEY`) — fallback
3. DuckDuckGo Instant Answer — always available, no key needed

### People & company research
Aggregate public web information into a structured profile.

```
"Research Jensen Huang at NVIDIA"
→ professional background · career history · education · notable work · source links
```

Available in **Research** or via the agent tool `research_person`. Runs 5 parallel web queries and synthesises results into a dossier.

### Voice mode
- STT via OpenAI Whisper API, Groq, or local Whisper fallback
- TTS via ElevenLabs — `/api/voice/speak` returns MP3 bytes
- **Wake word** — Picovoice Porcupine WASM detects "Jarvis" in the browser with zero server round-trips. Requires `VITE_PICOVOICE_ACCESS_KEY`. Falls back to the browser's SpeechRecognition API if no key is set.

### Wearable / smart glasses mode
Compact response mode for small-screen wearables. Forces all responses to 1-2 sentences with no markdown. Toggle in **Settings → Wearable Mode**. The `/api/glasses/photo` endpoint accepts photos shared from smart glasses (e.g. Meta Ray-Ban) for scene analysis.

### Push notifications
- **FCM** — for Android/iOS native apps via `@capacitor/push-notifications`
- **Web Push (VAPID)** — for browsers via the Push API and a service worker

Register tokens at `POST /api/push/register`. Get the VAPID public key at `GET /api/push/vapid-public-key`.
Requires `FCM_SERVICE_ACCOUNT_JSON`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`.

### Vision
- **Face recognition** — match photos or live camera frames against a known-faces DB (InsightFace `buffalo_sc`)
- **Scene analysis** — describe objects, mood, colors, and scene type from any image (Gemini Vision)
- **OSINT dossier** — face scan → reverse image search → research pipeline → structured profile in the UI
- **Live camera** — capture from the browser webcam for real-time face identification

### Memory
- Every interaction stored in SQLite and indexed as a 384-dim embedding
- Semantic search: `/api/search/semantic?q=...` returns the most relevant past interactions by meaning
- LLM context built from semantically relevant history rather than just the most recent N turns

### Reminders & timers
- Natural language: *"remind me to call Pepper in 2 hours"*, *"set a timer for 5 minutes"*
- Persisted in SQLite; background poller fires due reminders as HUD toasts

### Plugins
Drop a `BasePlugin` subclass into `backend/plugins/` — auto-discovered, priority-routed, enable/disable state persisted across restarts.

### Authentication & SSO
- Local username/password with JWT access tokens and bcrypt password hashing
- **Google OAuth** — sign in with Google; Capacitor native Google Sign-In for Android
- **SAML 2.0 SP** — enterprise single sign-on (Okta, Azure AD, Ping)
- **SCIM 2.0** — automated user provisioning/de-provisioning
- **Microsoft OIDC / Entra ID** — native Microsoft identity integration

---

## UI

Iron Man HUD — fully responsive, works on desktop and mobile (PWA + Capacitor Android):

| Page | Contents |
|---|---|
| **Dashboard** | System health, module status, quick actions, interaction stats |
| **Chat** | Streaming chat · multi-step agent mode · background task queue |
| **Voice** | Record audio → transcribe → TTS playback · wake-word indicator |
| **Vision** | Camera recognition · Face ID · Scene analysis · OSINT dossier |
| **Research** | Person / company / topic dossier builder |
| **Notes** | Note-taking with priority levels |
| **Reminders** | Due reminders with alarm chime |
| **Background Agents** | Autonomous scheduled jobs (create, enable/disable, run now) |
| **Contacts** | Address book CRUD |
| **Memory** | Semantic memory explorer |
| **Plugins** | Toggle and manage installed plugins |
| **Computer Use** | Live desktop screenshot · click/type/hotkey control · app launcher |
| **Permissions** | Capability permission manager (system control, web access, camera, …) |
| **Settings** | LLM provider, voice, Spotify, smart home, wearable mode, Google Workspace |

**Mobile:** bottom tab bar navigation, slide-in sidebar drawer, installable as a PWA.

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
| `POST` | `/api/glasses/photo` | Accept photo from smart glasses → scene analysis |
| `GET/POST` | `/api/contacts` | List / create contacts |
| `GET/PUT/DELETE` | `/api/contacts/<id>` | Get / update / delete a contact |
| `GET` | `/api/spotify/connect` | Start Spotify OAuth flow |
| `GET` | `/api/spotify/status` | Current playback state |
| `POST` | `/api/push/register` | Register FCM or Web Push token |
| `GET` | `/api/push/vapid-public-key` | Get VAPID public key for Web Push |
| `GET/POST/DELETE` | `/api/dashboard/notes` | Notes CRUD |
| `GET` | `/api/reminders/due` | Due reminders (polled by frontend) |
| `GET` | `/api/health` | Liveness check |

---

## Configuration

All via `backend/.env`:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Chat, tool use, Whisper STT, scene analysis |
| `GROQ_API_KEY` | Chat + STT alternative — generous free tier |
| `GEMINI_API_KEY` | Scene analysis + vision (preferred over OpenAI Vision) |
| `META_LLAMA_API_KEY` | Meta Llama 3.3-70B via llamameta.net |
| `ELEVENLABS_API_KEY` | TTS voice synthesis |
| `BRAVE_API_KEY` | Web search (2k free queries/month) |
| `TAVILY_API_KEY` | Web search — primary, direct answers |
| `SERPER_API_KEY` | Web search fallback |
| `OPENWEATHER_API_KEY` | Real-time weather |
| `TWILIO_ACCOUNT_SID` | Twilio SMS/WhatsApp (starts with AC) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_SMS_FROM` | Your Twilio phone number (E.164) |
| `TWILIO_WHATSAPP_FROM` | WhatsApp sender (`whatsapp:+14155238886` sandbox default) |
| `SPOTIFY_CLIENT_ID` | Spotify OAuth app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth app client secret |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL |
| `HOMEASSISTANT_URL` | Home Assistant base URL (e.g. `http://homeassistant.local:8123`) |
| `HOMEASSISTANT_TOKEN` | Home Assistant long-lived access token |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase service account JSON (base64 or path) for FCM push |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push |
| `VAPID_PUBLIC_KEY` | VAPID public key for Web Push |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (backend only — never expose to frontend) |
| `SECRET_KEY` | Flask session secret key |
| `JARVIS_AUTH_ENABLED` | `true` to require login |

**Frontend (`.env` in `frontend/`):**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL in production (e.g. Railway URL) |
| `VITE_PICOVOICE_ACCESS_KEY` | Picovoice Porcupine wake-word key |

**Zero-key mode** — time, calculations, reminders, notes, navigation, OS control, and DuckDuckGo web search all run without any API key.

---

## LLM providers

Switch the active provider in **Settings → LLM Provider** or set `JARVIS_PROVIDER` env var:

| Provider | Models | Notes |
|---|---|---|
| `openai` | gpt-4o, gpt-4o-mini | Default |
| `groq` | llama-3.3-70b-versatile, mixtral-8x7b | Fastest free tier |
| `gemini` | gemini-2.0-flash, gemini-1.5-pro | Recommended for agent tasks |
| `meta` | Llama-3.3-70B-Instruct | Via llamameta.net OpenAI-compatible API |
| `anthropic` | claude-sonnet-4-5, claude-haiku-4-5 | Claude models |

---

## Project structure

```
backend/
├── src/jarvis/
│   ├── core/
│   │   ├── agent.py              ReAct multi-step agent loop
│   │   ├── action_engine.py      Intent → action dispatcher
│   │   ├── contacts.py           SQLite contact store + name resolution
│   │   ├── intent_parser.py      Regex-based intent classifier
│   │   ├── llm_core.py           Multi-provider LLM (OpenAI/Groq/Gemini/Meta/Anthropic)
│   │   ├── memory.py             SQLite conversation store
│   │   ├── semantic_memory.py    sqlite-vec vector index (all-MiniLM-L6-v2)
│   │   ├── providers.py          Provider config registry
│   │   ├── push_store.py         FCM + Web Push token store
│   │   ├── reminders.py          Persistent reminders + timers
│   │   ├── scheduler.py          Autonomous cron-like job scheduler (interval/daily/weekly/monthly/yearly)
│   │   ├── task_manager.py       Background agent task queue
│   │   └── tool_definitions.py   OpenAI function schemas
│   ├── ai/            Emotion analyzer, knowledge base
│   ├── dashboard/     Notes store, settings store
│   ├── plugins/       Auto-discovery, BasePlugin contract, persistent state
│   ├── services/
│   │   ├── home_assistant.py     Home Assistant REST API + fuzzy entity matching
│   │   ├── push_service.py       FCM (google-auth) + Web Push VAPID
│   │   ├── people_research.py    Person + company profile aggregation
│   │   ├── os_control.py         Desktop automation (pyautogui wrapper)
│   │   ├── spotify.py            Spotify OAuth + playback control
│   │   ├── twilio_service.py     SMS + WhatsApp via Twilio REST API
│   │   └── web_search.py         Tavily / Brave / DuckDuckGo fallback chain
│   ├── speech/        Whisper transcription, ElevenLabs synthesis
│   ├── vision/        Face recognition (InsightFace), scene analysis, capture history
│   ├── cli/           Text REPL + voice mode
│   └── web/app.py     Flask application (60+ routes)
├── plugins/           Drop user plugins here
└── tests/             pytest test suite

frontend/src/
├── components/        All page views + shared UI components
├── hooks/
│   ├── useReminderPoller.ts      Polls /api/reminders/due every 30 s
│   ├── useVoiceMode.ts           Full voice conversation loop
│   └── useWakeWord.ts            Picovoice Porcupine wake-word listener
├── utils/
│   ├── api.ts                    apiFetch wrapper with auth headers
│   ├── audio.ts                  TTS + Web Audio API helpers
│   └── push.ts                   FCM + Web Push registration
└── types.ts           Shared TypeScript interfaces
```

---

## Running tests

```bash
cd backend
pytest              # no network, no hardware, no API keys required
```

---

## License

MIT.
