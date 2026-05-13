# J.A.R.V.I.S

Personal AI assistant inspired by Tony Stark's. Full-stack: a Python backend that does intent parsing → action dispatch → LLM fallback → SQLite-backed memory, plus optional vision (face recognition + scene analysis), system control, plugins, and voice. A React + Vite + Tailwind frontend consumes the backend's HTTP API.

```
.
├── backend/        Python package (`jarvis`) — Flask API + CLI
└── frontend/       React + Vite + Tailwind UI
```

## Quick start

Two terminals:

```bash
# terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env       # then add OPENAI_API_KEY etc.
jarvis-web                 # http://127.0.0.1:5050
```

```bash
# terminal 2 — frontend
cd frontend
pnpm install
cp .env.example .env       # only needed if the backend isn't on :5050
pnpm dev                   # http://127.0.0.1:5173
```

The Vite dev server proxies `/api/*` and `/socket.io/*` to the backend, so the frontend can use plain relative URLs (`fetch('/api/chat', ...)`) without CORS gymnastics.

The CLI is installed by `pip install`. Two modes:

```bash
jarvis                     # text REPL
jarvis --voice             # mic + speakers + webcam (Iron-Man mode)
```

In `--voice`, press Enter to talk (5-second push-to-talk by default), Whisper transcribes, intent → action engine → response, ElevenLabs (or `pyttsx3` offline) speaks it back. Saying "who is this person" or "what is this" opens the system camera, captures a frame, and runs face / scene recognition against it. Type a message instead of pressing Enter to send text without recording.

## What works

- **Chat**: regex intent classifier → action engine for known intents (calculator, time, weather, app launching, navigation, etc.) → GPT-4 for free-form chat → memory persisted in SQLite.
- **Vision**: face recognition (dlib via `face_recognition`) + scene analysis (Gemini Vision or GPT-4o-mini). Excel-driven bulk face ingestion. Persisted scene history.
- **System control**: open applications, file operations, with an explicit approve-before-execute flow. Shell-injection-safe (list-mode `subprocess`, no `shell=True`, shell-metachar rejection).
- **Plugins**: drop a `BasePlugin` subclass into `backend/plugins/` and it's auto-loaded; optional priority + keyword routing.
- **Voice**: STT via OpenAI Whisper API, TTS via ElevenLabs. Browser captures audio and posts to `/api/voice/transcribe`; `/api/voice/speak` returns MP3 bytes.
- **Dashboards**: notes, settings, knowledge base, emotion analysis, plugin manager, system controller, memory explorer.

## API surface

32 routes — see [backend/README.md](backend/README.md) for the full table.

Key ones:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat` | Send a message, get a response |
| GET | `/api/health` | Liveness check |
| GET POST DELETE | `/api/dashboard/notes` | Notes CRUD |
| POST | `/api/face/identify` | Match an uploaded image against the known-faces DB |
| POST | `/api/vision/analyze` | Scene description for an uploaded image |
| POST | `/api/system/open-application` | Queue an app launch (requires user confirm) |
| POST | `/api/voice/transcribe` | Audio → text |

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | backend `.env` | Chat + Whisper transcription + scene analysis (GPT-4o-mini fallback) |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | backend `.env` | Scene analysis (preferred over OpenAI Vision) |
| `OPENWEATHER_API_KEY` | backend `.env` | Real-time weather |
| `ELEVENLABS_API_KEY` | backend `.env` | TTS audio synthesis |
| `VITE_API_URL` | frontend `.env` | Backend URL the dev proxy forwards to (default `http://localhost:5050`) |

Without any keys, the chat side runs in **demo mode** — known intents (time, weather, calculations, jokes) still work via the action engine; free-form chat returns canned replies.

## Project structure

```
backend/
├── pyproject.toml
├── src/jarvis/
│   ├── core/          intent_parser, action_engine, llm_core, memory
│   ├── ai/            emotion, knowledge base
│   ├── dashboard/     notes, settings
│   ├── plugins/       loader + BasePlugin contract
│   ├── speech/        Whisper transcription, ElevenLabs synthesis
│   ├── system/        action approval flow + os control
│   ├── vision/        face recognition + scene analysis + history
│   ├── services/      weather
│   ├── cli/main.py    `jarvis` console script
│   └── web/app.py     `jarvis-web` Flask app
├── plugins/           drop user plugins here (auto-discovered)
└── tests/             77 pytest cases

frontend/
├── package.json
├── vite.config.ts     `/api` and `/socket.io` proxy → backend
└── src/
    ├── components/    each dashboard is one .tsx file
    ├── hooks/, utils/, lib/
    └── types/
```

## Running tests

```bash
cd backend
pytest                  # 77 cases, no network or hardware required
```

The suite mocks dlib, OpenAI, Gemini, ElevenLabs, and `subprocess.run` — so it works on a fresh checkout without API keys or a webcam attached.

## License

MIT.
