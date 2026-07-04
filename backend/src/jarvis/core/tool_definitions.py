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
                "properties": {
                    "location": {"type": "string", "description": "City name or 'current location'"},
                },
                "required": [],
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
            "description": "Search the web for a query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
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
        return {**base, "type": "search", "query": args.get("query", "")}

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

    return {**base, "type": "conversation"}
