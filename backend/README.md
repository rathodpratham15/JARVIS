# Backend

Python package `jarvis` — the brain of J.A.R.V.I.S. Exposes both a CLI (`jarvis`) and an HTTP API (`jarvis-web`) consumed by the React frontend in `../frontend/`.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # then fill in OPENAI_API_KEY
jarvis                        # text REPL
jarvis --voice                # mic + speakers + webcam
jarvis-web                    # http://127.0.0.1:5050
jarvis-faces --help           # manage the face DB
pytest                        # run the test suite
```

Without an `OPENAI_API_KEY` the app boots in **demo mode** — known intents (time, weather, jokes, calculations, etc.) still work via the action engine; free-form chat returns a canned reply.

## Layout

```
backend/
├── pyproject.toml            # package metadata + dependencies + console scripts
├── plugins/
│   └── example_template.py   # drop your own BasePlugin .py files here
├── src/jarvis/
│   ├── core/
│   │   ├── intent_parser.py  # regex classifier with ~20 intents
│   │   ├── action_engine.py  # dispatcher + safe-AST math evaluator
│   │   ├── llm_core.py       # OpenAI Chat Completions wrapper
│   │   └── memory.py         # SQLite conversation log
│   ├── ai/
│   │   ├── emotion.py        # OpenAI / lexicon sentiment classifier
│   │   └── knowledge.py      # SQLite-backed knowledge entries
│   ├── dashboard/
│   │   ├── notes.py          # SQLite notes CRUD
│   │   └── settings.py       # JSON key/value
│   ├── plugins/              # BasePlugin contract + dynamic loader
│   ├── speech/
│   │   ├── transcription.py  # OpenAI Whisper API (cloud)
│   │   └── synthesis.py      # ElevenLabs TTS
│   ├── system/
│   │   └── control.py        # ActionController with approval flow
│   ├── vision/
│   │   ├── faces.py          # FaceRecognitionEngine (dlib)
│   │   ├── scenes.py         # SceneAnalyzer (Gemini / GPT-4o-mini)
│   │   └── history.py        # SQLite scene-analysis log
│   ├── services/
│   │   └── weather_service.py
│   ├── cli/main.py           # `jarvis` console script
│   └── web/app.py            # `jarvis-web` Flask app
└── tests/                    # pytest suite (77 cases, all mocked)
```

## HTTP API

| Method | Path                                   | Purpose                                    |
| ------ | -------------------------------------- | ------------------------------------------ |
| GET    | `/api/health`                          | liveness                                   |
| POST   | `/api/chat`                            | send a message, get a reply                |
| GET    | `/api/history`                         | recent interactions                        |
| GET    | `/api/search?q=`                       | substring search over interactions         |
| GET POST | `/api/dashboard/settings`            | flat user settings                         |
| GET POST DELETE | `/api/dashboard/notes`        | notes CRUD                                 |
| GET    | `/api/dashboard/history?limit=100`     | dashboard alias of `/api/history`          |
| GET    | `/api/dashboard/stats`                 | counts: interactions, notes, plugins, people |
| POST   | `/api/dashboard/quick-commands`        | chat shortcut (no chat box typing)         |
| GET    | `/api/plugins`                         | list discovered plugins                    |
| POST   | `/api/plugins/<name>/toggle`           | enable/disable a plugin                    |
| POST   | `/api/face/identify`                   | match an uploaded image                    |
| POST   | `/api/camera/recognize`                | (alias)                                    |
| POST   | `/api/face/process-excel`              | bulk-ingest from spreadsheet               |
| GET    | `/api/face/statistics`                 | counts + processing time                   |
| POST   | `/api/face/export`                     | dump face DB metadata to JSON              |
| POST   | `/api/vision/analyze`                  | scene description for an upload            |
| GET    | `/api/vision/history`                  | past scene analyses                        |
| GET    | `/api/vision/stats`                    | vision counts                              |
| GET    | `/api/captures/<filename>`             | serve a saved upload                       |
| POST   | `/api/system/open-application`         | queue an app launch (awaits confirm)       |
| POST   | `/api/system/control-files`            | queue a file op                            |
| POST   | `/api/system/send-message`             | queue a message (not configured by default) |
| POST   | `/api/system/confirm-action`           | approve or deny a pending action           |
| GET    | `/api/system/pending-confirmations`    | list pending                               |
| GET    | `/api/system/action-history`           | paginated history                          |
| DELETE | `/api/system/action-history/<id>`      | drop one entry                             |
| POST   | `/api/system/action-history/bulk-delete` | drop many                               |
| GET    | `/api/system/info`, `/api/system-status` | platform info, CPU, memory               |
| GET    | `/api/system/applications`             | list (best-effort) installed apps          |
| POST   | `/api/voice/transcribe`                | audio file → text (Whisper API)            |
| POST   | `/api/voice/speak`                     | `{text}` → MP3 bytes                       |
| POST   | `/api/knowledge/add`                   | add a knowledge entry                      |
| GET    | `/api/knowledge/search?q=`             | substring search                           |
| POST   | `/api/analyze-emotion`                 | `{text}` → `{emotion, sentiment, ...}`     |

Example:

```bash
curl -X POST http://127.0.0.1:5050/api/chat \
     -H 'content-type: application/json' \
     -d '{"message": "calculate 15 plus 7"}'
# → {"id":"...","response":"The result of 15 + 7 is 22","intent":"calculation"}
```

## Design notes

- **No `eval()`.** The calculator parses expressions through `ast.parse` and walks them with a whitelist of arithmetic node types. `__import__('os')` and `open('/etc/passwd')` raise `ValueError`.
- **Intent classifier is regex, not an LLM call.** Cheaper, deterministic, and good enough for the ~20 fixed intents. The LLM only runs for utterances that fall through to the `conversation` intent.
- **Memory is SQLite.** Thread-safe, indexed by timestamp + intent type. ~140 lines.
- **Action approval flow.** All system actions queue in pending state and require `POST /api/system/confirm-action` before executing. Background thread handles execution; results land in JSONL log + in-memory ring buffer (1000 entries).
- **Shell-injection-safe.** `subprocess.run([...])` with no `shell=True`; arguments containing shell metacharacters (`|`, `;`, `&`, `$`, …) are rejected.
- **Plugins are for extensions, not built-ins.** Built-in intents (calculator, datetime, weather) are handled by `ActionEngine` directly. Plugins are dropped into `plugins/` and discovered automatically.
- **Voice in/out lives in the browser** for web mode. The backend transcribes audio bytes posted to it and returns synthesized MP3 bytes; capture and playback are the React app's job.
- **Voice in/out lives in `jarvis.local`** for the CLI. `jarvis --voice` opens the system mic via `pyaudio`/`speech_recognition`, sends bytes to Whisper, dispatches through the same intent → action pipeline, plays the response via ElevenLabs (or `pyttsx3` offline). Camera-driven intents (`who is this person?`, `what is this?`) open the webcam via `cv2`, capture one frame, and pass it to the same `FaceRecognitionEngine` / `SceneAnalyzer` the web routes use.

## Managing the face database

`jarvis-faces` is the maintenance CLI. Everything is local — encodings live in `data/faces/known_faces.pkl` (a list of `PersonData` dataclasses).

```bash
# Add yourself from a few photos
jarvis-faces add "Pratham" ~/photos/me1.jpg ~/photos/me2.jpg ~/photos/me3.jpg

# Bulk import from a folder where each subfolder is one person
#
#   /path/to/people/
#   ├── alice/
#   │   ├── 1.jpg
#   │   ├── 2.jpg
#   │   └── 3.jpg
#   ├── bob/
#   │   └── headshot.png
#   └── carla/
#       ├── front.jpg
#       └── side.jpg
#
jarvis-faces import-folder /path/to/people

# Bulk import from a spreadsheet (Name + Image columns; Image may be a
# single image path or a folder of images for that person; extra columns
# like Age / Gender / Profession are stored as additional_data).
jarvis-faces import-excel people.xlsx --images-folder /path/to/images

# Inspect, remove, get stats
jarvis-faces list
jarvis-faces remove "Alice"
jarvis-faces stats
```

For 1000s of people, the import-folder pattern is the cleanest. Encoding is single-threaded CPU-bound (dlib) — budget roughly 0.1–1 second per image depending on resolution. The progress bar shows live status. Re-running is safe: existing entries are preserved (it appends).

The same import path is also exposed over HTTP at `POST /api/face/process-excel` (multipart upload from the React `FaceRecognitionDashboard`).

## Configuration

| Variable | Required for | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | chat, transcription, fallback scene analysis | Without it, free-form chat → demo mode. |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | scene analysis | Preferred over OpenAI Vision when set. |
| `OPENWEATHER_API_KEY` | weather | Real-time weather lookups. |
| `WEATHER_API_KEY` | weather (alt) | WeatherAPI.com fallback. |
| `ELEVENLABS_API_KEY` | TTS | Audio synthesis at `/api/voice/speak`. |
| `JARVIS_DB` | optional | Memory db path (default `data/memory.db`). |
| `JARVIS_FACE_DIR` | optional | Face encodings dir (default `data/faces`). |
| `JARVIS_FACE_TOLERANCE` | optional | Match confidence floor (default `0.5`). |
| `JARVIS_PLUGINS_DIR` | optional | Plugin scan dir (default `plugins`). |
| `CORS_ORIGINS` | optional | Comma-separated list (default `*`). |
