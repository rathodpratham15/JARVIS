"""OpenAI-compatible tool definitions for JARVIS action engine.

Each tool maps to an intent type that ActionEngine already handles.
The LLM uses these to decide whether a user request should be dispatched
to the action engine rather than answered as plain text.
"""

from __future__ import annotations

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather or forecast for a location.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "location": {"type": "string", "description": "City name or 'current location'"},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_time_or_date",
            "description": "Get the current time or date.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["time", "date"],
                        "description": "Whether to return time or date.",
                    },
                },
                "required": ["kind"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "Evaluate an arithmetic expression.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "expression": {"type": "string", "description": "Math expression, e.g. '1024 * 768'"},
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_reminder",
            "description": "Save a reminder for the user, optionally at a specific time.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "text": {"type": "string", "description": "What to remind the user about"},
                    "time": {"type": "string", "description": "When to fire the reminder, e.g. 'in 5 minutes', '9pm', 'tomorrow'"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_timer",
            "description": "Set a countdown timer.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "duration": {"type": "string", "description": "Duration, e.g. '5 minutes', '30 seconds'"},
                },
                "required": ["duration"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_note",
            "description": "Save a note for the user.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "text": {"type": "string", "description": "The note content"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_application",
            "description": "Open or launch an application by name.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "app_name": {"type": "string", "description": "Application name, e.g. 'Spotify', 'Chrome'"},
                },
                "required": ["app_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": (
                "Search the internet for real-time information, current events, "
                "facts about people, companies, products, research, or anything "
                "that requires up-to-date or public web data. Use this whenever "
                "the user asks about someone's background, a company, recent news, "
                "or any topic that benefits from live web results."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "query": {"type": "string", "description": "Search query optimised for a search engine"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_directions",
            "description": "Get directions or navigate to a destination.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "destination": {"type": "string", "description": "Place or address to navigate to"},
                },
                "required": ["destination"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_smart_home",
            "description": "Control a smart home device (lights, thermostat, fan, etc.).",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "device": {"type": "string", "description": "Device name, e.g. 'bedroom lights', 'thermostat'"},
                    "action": {
                        "type": "string",
                        "enum": ["turn_on", "turn_off", "dim", "toggle", "set_temp"],
                        "description": "Action to perform",
                    },
                    "temperature": {"type": "number", "description": "Target temperature for set_temp action"},
                },
                "required": ["device", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "research_person",
            "description": (
                "Look up publicly available professional information about a person. "
                "Use when the user wants to learn about someone's background, career, "
                "education, or public work — e.g. before a meeting, after a networking "
                "event, or when given a name and company from a business card."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "Full name of the person"},
                    "company": {"type": "string", "description": "Company or organisation (optional, helps disambiguation)"},
                    "role": {"type": "string", "description": "Job title or role (optional)"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "research_company",
            "description": (
                "Look up publicly available information about a company or organisation — "
                "industry, founding, key people, products, recent news."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "Company or organisation name"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_app",
            "description": (
                "Control a macOS application using AppleScript — media playback, "
                "volume, track info, app activation/quit, system notifications, "
                "or run a custom AppleScript snippet. "
                "Use for: 'play Spotify', 'pause music', 'next song', 'previous track', "
                "'set volume to 50', 'mute', 'quit Safari', 'switch to Chrome', "
                "'what song is playing', 'send me a notification'."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "app_action": {
                        "type": "string",
                        "enum": [
                            "play", "pause", "play_pause",
                            "next_track", "previous_track",
                            "get_track",
                            "set_volume", "system_volume",
                            "mute", "unmute",
                            "activate", "quit", "frontmost",
                            "notify", "run_script",
                        ],
                        "description": "Action to perform",
                    },
                    "app": {
                        "type": "string",
                        "description": "App name to target (default: Spotify). E.g. 'Spotify', 'Music', 'Safari', 'Chrome'.",
                    },
                    "volume": {
                        "type": "integer",
                        "description": "Volume level 0–100 (for set_volume / system_volume actions)",
                    },
                    "title": {
                        "type": "string",
                        "description": "Notification title (for notify action)",
                    },
                    "message": {
                        "type": "string",
                        "description": "Notification body (for notify action)",
                    },
                    "script": {
                        "type": "string",
                        "description": "Raw AppleScript to execute (for run_script action)",
                    },
                },
                "required": ["app_action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "os_control",
            "description": (
                "Control the desktop: move the mouse, click, double-click, type text, "
                "press keyboard keys, trigger hotkeys (e.g. Cmd+C), or scroll. "
                "Use when the user asks to click something on screen, type in a field, "
                "press a key combination, or interact with a running application."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["click", "double_click", "move", "scroll", "type", "press", "hotkey"],
                        "description": "The desktop action to perform",
                    },
                    "x": {"type": "integer", "description": "Screen X coordinate (pixels from left)"},
                    "y": {"type": "integer", "description": "Screen Y coordinate (pixels from top)"},
                    "text": {"type": "string", "description": "Text to type (for 'type' action)"},
                    "key": {"type": "string", "description": "Key name to press, e.g. 'enter', 'escape', 'tab'"},
                    "keys": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key chord for hotkey, e.g. ['command', 'c'] for Cmd+C",
                    },
                    "button": {
                        "type": "string",
                        "enum": ["left", "right", "middle"],
                        "description": "Mouse button for click actions (default: left)",
                    },
                    "clicks": {
                        "type": "integer",
                        "description": "Number of scroll ticks (positive = up, negative = down)",
                    },
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_schedule",
            "description": (
                "Create a recurring scheduled job that JARVIS will run autonomously. "
                "Use when the user asks to schedule a recurring task, e.g. "
                "'every morning check the news and save a summary', 'remind me daily at 9am to review my calendar'."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "Short job name, e.g. 'Morning Briefing'"},
                    "goal": {"type": "string", "description": "Full description of what JARVIS should do each time the job runs"},
                    "schedule_expr": {
                        "type": "string",
                        "description": (
                            "Schedule expression. Examples: 'every 30 minutes', 'every 2 hours', "
                            "'every day at 09:00', 'every monday at 08:00', 'every friday at 17:00', "
                            "'every month on the 15th at 10:00', 'every year on july 1st at 9am'"
                        ),
                    },
                },
                "required": ["name", "goal", "schedule_expr"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_schedules",
            "description": "List all currently configured scheduled jobs, their status, and last run info.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_schedule",
            "description": "Delete a scheduled job by its ID. Use after listing schedules to find the ID.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "job_id": {"type": "string", "description": "The UUID of the scheduled job to delete"},
                },
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gmail_list",
            "description": "List recent emails from the user's Gmail inbox. Use when asked to check email, show inbox, or list messages.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "query": {"type": "string", "description": "Gmail search query, e.g. 'from:boss@company.com' or 'subject:meeting'. Leave empty for inbox."},
                    "max_results": {"type": "integer", "description": "Number of emails to fetch (default 10)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gmail_send",
            "description": "Send an email via Gmail. Use when the user asks to send, compose, or write an email.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "to": {"type": "string", "description": "Recipient email address"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body text"},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gmail_search",
            "description": "Search Gmail for emails matching a query.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "query": {"type": "string", "description": "Gmail search query, e.g. 'from:alice@example.com subject:invoice'"},
                    "max_results": {"type": "integer", "description": "Max results (default 20)"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calendar_list",
            "description": "List upcoming calendar events. Use when asked about schedule, meetings, what's on the calendar today/this week.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "time_min": {"type": "string", "description": "Start of time range in ISO 8601 format (default: now)"},
                    "time_max": {"type": "string", "description": "End of time range in ISO 8601 format (default: 7 days from now)"},
                    "max_results": {"type": "integer", "description": "Max events (default 10)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calendar_create",
            "description": "Create a new Google Calendar event. Use when the user asks to schedule a meeting, add an event, or book time.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string", "description": "Event title"},
                    "start": {"type": "string", "description": "Start datetime in ISO 8601 format, e.g. '2026-08-24T10:00:00Z'"},
                    "end": {"type": "string", "description": "End datetime in ISO 8601 format"},
                    "description": {"type": "string", "description": "Event description (optional)"},
                    "location": {"type": "string", "description": "Event location (optional)"},
                    "attendees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of attendee email addresses (optional)",
                    },
                },
                "required": ["title", "start", "end"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calendar_update",
            "description": "Update or reschedule an existing calendar event by its ID. Use after listing events to get the event ID.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "event_id": {"type": "string", "description": "Google Calendar event ID"},
                    "title": {"type": "string", "description": "New event title (optional)"},
                    "start": {"type": "string", "description": "New start datetime ISO 8601 (optional)"},
                    "end": {"type": "string", "description": "New end datetime ISO 8601 (optional)"},
                    "description": {"type": "string", "description": "New description (optional)"},
                    "location": {"type": "string", "description": "New location (optional)"},
                },
                "required": ["event_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "drive_list",
            "description": "List or search files in the user's Google Drive.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "query": {"type": "string", "description": "File name search term (optional)"},
                    "max_results": {"type": "integer", "description": "Max files to return (default 20)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "drive_create",
            "description": "Create a new file in Google Drive with the given content.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "File name including extension, e.g. 'meeting_notes.txt'"},
                    "content": {"type": "string", "description": "File text content"},
                },
                "required": ["name", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_sms",
            "description": (
                "Send an SMS text message to a phone number via Twilio. "
                "Use when the user asks to text, SMS, or message someone by phone number. "
                "Also used by scheduled jobs like 'send happy birthday SMS to +1234567890'."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "to": {"type": "string", "description": "Recipient phone number in E.164 format (e.g. +14155552671) OR a contact name (e.g. 'mom', 'John')"},
                    "message": {"type": "string", "description": "The text message body to send"},
                },
                "required": ["to", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp",
            "description": (
                "Send a WhatsApp message to a phone number via Twilio. "
                "Use when the user asks to send a WhatsApp message. "
                "Also used by scheduled jobs like 'send happy birthday on WhatsApp to +967xxxxxx'."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "to": {"type": "string", "description": "Recipient phone number in E.164 format (e.g. +14155552671) OR a contact name (e.g. 'mom', 'John')"},
                    "message": {"type": "string", "description": "The WhatsApp message body to send"},
                },
                "required": ["to", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "system_api",
            "description": (
                "Control system-level settings: volume, screen brightness, Do Not Disturb (Focus mode), and WiFi. "
                "Use for requests like 'set volume to 70', 'mute', 'unmute', 'turn on do not disturb', "
                "'disable wifi', 'what's the brightness', etc."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "get_volume", "set_volume", "mute", "unmute",
                            "get_brightness", "set_brightness",
                            "enable_dnd", "disable_dnd",
                            "get_wifi", "enable_wifi", "disable_wifi",
                        ],
                        "description": "The system action to perform.",
                    },
                    "level": {
                        "type": "integer",
                        "description": "For set_volume and set_brightness: integer 0–100.",
                    },
                },
                "required": ["action"],
            },
        },
    },
]

# Map tool function names → intent dicts that ActionEngine understands
def tool_call_to_intent(name: str, args: dict) -> dict:
    """Convert an LLM tool call into an intent dict for ActionEngine."""
    base = {"action_required": True}

    if name == "get_weather":
        return {**base, "type": "weather", "location": args.get("location", "current location")}

    if name == "get_time_or_date":
        kind = args.get("kind", "time")
        return {**base, "type": kind}

    if name == "calculate":
        return {**base, "type": "calculation", "expression": args.get("expression", "")}

    if name == "set_reminder":
        return {**base, "type": "reminder", "reminder_text": args.get("text", ""), "time": args.get("time")}

    if name == "set_timer":
        return {**base, "type": "timer", "duration": args.get("duration", "")}

    if name == "save_note":
        return {**base, "type": "note", "note_text": args.get("text", "")}

    if name == "open_application":
        return {**base, "type": "open_app", "app_name": args.get("app_name", "")}

    if name == "search_web":
        return {**base, "type": "web_search", "query": args.get("query", ""), "limit": args.get("limit", 5)}

    if name == "get_directions":
        return {**base, "type": "navigation", "destination": args.get("destination", "")}

    if name == "control_smart_home":
        return {
            **base,
            "type": "smart_home",
            "device": args.get("device", ""),
            "smart_home_action": args.get("action", "toggle"),
            "temperature": args.get("temperature"),
        }

    if name == "control_app":
        return {
            **base,
            "type": "control_app",
            "app_action": args.get("app_action", ""),
            "app": args.get("app", "Spotify"),
            "volume": args.get("volume"),
            "title": args.get("title"),
            "message": args.get("message"),
            "script": args.get("script"),
        }

    if name == "research_person":
        return {
            **base,
            "type": "research_person",
            "name": args.get("name", ""),
            "company": args.get("company", ""),
            "role": args.get("role", ""),
        }

    if name == "research_company":
        return {**base, "type": "research_company", "name": args.get("name", "")}

    if name == "os_control":
        return {
            **base,
            "type": "os_control",
            "os_action": args.get("action", ""),
            "x": args.get("x"),
            "y": args.get("y"),
            "text": args.get("text"),
            "key": args.get("key"),
            "keys": args.get("keys"),
            "button": args.get("button", "left"),
            "clicks": args.get("clicks"),
        }

    if name == "create_schedule":
        return {
            **base,
            "type": "create_schedule",
            "name": args.get("name", ""),
            "goal": args.get("goal", ""),
            "schedule_expr": args.get("schedule_expr", ""),
        }

    if name == "list_schedules":
        return {**base, "type": "list_schedules"}

    if name == "delete_schedule":
        return {**base, "type": "delete_schedule", "job_id": args.get("job_id", "")}

    if name == "system_api":
        return {**base, "type": "system_api", "action": args.get("action", ""), "level": args.get("level")}

    if name == "gmail_list":
        return {**base, "type": "gmail_list", "query": args.get("query", ""), "max_results": int(args.get("max_results", 10))}

    if name == "gmail_send":
        return {**base, "type": "gmail_send", "to": args.get("to", ""), "subject": args.get("subject", ""), "body": args.get("body", "")}

    if name == "gmail_search":
        return {**base, "type": "gmail_search", "query": args.get("query", ""), "max_results": int(args.get("max_results", 20))}

    if name == "calendar_list":
        return {**base, "type": "calendar_list", "time_min": args.get("time_min"), "time_max": args.get("time_max"), "max_results": int(args.get("max_results", 10))}

    if name == "calendar_create":
        return {**base, "type": "calendar_create", "title": args.get("title", ""), "start": args.get("start", ""), "end": args.get("end", ""), "description": args.get("description", ""), "location": args.get("location", ""), "attendees": args.get("attendees", [])}

    if name == "calendar_update":
        return {**base, "type": "calendar_update", "event_id": args.get("event_id", ""), "title": args.get("title"), "start": args.get("start"), "end": args.get("end"), "description": args.get("description"), "location": args.get("location")}

    if name == "drive_list":
        return {**base, "type": "drive_list", "query": args.get("query", ""), "max_results": int(args.get("max_results", 20))}

    if name == "drive_create":
        return {**base, "type": "drive_create", "name": args.get("name", ""), "content": args.get("content", "")}

    if name == "send_sms":
        return {**base, "type": "send_sms", "to": args.get("to", ""), "message": args.get("message", "")}

    if name == "send_whatsapp":
        return {**base, "type": "send_whatsapp", "to": args.get("to", ""), "message": args.get("message", "")}

    return {**base, "type": "conversation"}
