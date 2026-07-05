"""Dispatches parsed intents to concrete actions."""

from __future__ import annotations

import ast
import logging
import operator
import os
import platform
import random
import re
import subprocess
import urllib.parse
import webbrowser
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Callable, Optional

from jarvis.services.weather_service import get_weather
from jarvis.services.smart_home import control_device as _smart_home_control
from jarvis.services.web_search import search_and_summarize as _web_search


if TYPE_CHECKING:
    from jarvis.core.reminders import RemindersStore
    from jarvis.dashboard.notes import NotesStore

logger = logging.getLogger(__name__)

JOKES = [
    "Why don't scientists trust atoms? Because they make up everything!",
    "I told my wife she was drawing her eyebrows too high. She looked surprised.",
    "Why don't programmers like nature? It has too many bugs.",
    "I'm reading a book about anti-gravity. It's impossible to put down!",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "What do you call a fake noodle? An impasta!",
    "Why don't eggs tell jokes? They'd crack each other up!",
]

GREETINGS = [
    "Hello! I'm Jarvis, your AI assistant. How can I help you today?",
    "Hi there! What can I do for you?",
    "Good to see you! How may I assist you today?",
]

GOODBYES = [
    "Goodbye! Have a great day!",
    "See you later! Take care!",
    "Until next time!",
]

_WORD_OPERATORS = {
    "plus": "+", "add": "+",
    "minus": "-", "subtract": "-",
    "times": "*", "multiply": "*", "multiplied by": "*",
    "divided by": "/", "divide": "/",
    "to the power of": "**", "squared": "**2", "cubed": "**3",
}

# Whitelist of AST node types that the safe math evaluator allows.
_SAFE_OPERATORS: dict[type, Callable] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
    ast.Mod: operator.mod,
    ast.FloorDiv: operator.floordiv,
}


def _safe_eval(expression: str) -> float:
    """Evaluate an arithmetic expression using a whitelisted AST walker.

    Replaces the original `eval()` call. Raises `ValueError` for any node
    type not in `_SAFE_OPERATORS` or for non-numeric literals.
    """
    tree = ast.parse(expression, mode="eval")
    return _eval_node(tree.body)


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _SAFE_OPERATORS:
        return _SAFE_OPERATORS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _SAFE_OPERATORS:
        return _SAFE_OPERATORS[type(node.op)](_eval_node(node.operand))
    raise ValueError(f"Disallowed expression element: {ast.dump(node)}")


def _parse_duration(duration_str: Optional[str]) -> Optional[timedelta]:
    """Convert '5 minutes', '30 seconds', '2 hours' to a timedelta."""
    if not duration_str:
        return None
    m = re.search(r"(\d+)\s*(second|minute|hour)s?", duration_str, re.IGNORECASE)
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2).lower()
    return {"second": timedelta(seconds=n), "minute": timedelta(minutes=n), "hour": timedelta(hours=n)}[unit]


def _parse_due_time(time_str: Optional[str]) -> Optional[datetime]:
    """Convert an extracted time string to an absolute UTC datetime, or None."""
    if not time_str:
        return None
    s = time_str.lower().strip()
    now = datetime.now()

    m = re.match(r"in (\d+)\s*(second|minute|hour)s?", s)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        delta = {"second": timedelta(seconds=n), "minute": timedelta(minutes=n), "hour": timedelta(hours=n)}[unit]
        return (now + delta).astimezone(timezone.utc)

    m = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)?", s)
    if m:
        hour, minute, period = int(m.group(1)), int(m.group(2)), m.group(3)
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        due = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if due <= now:
            due += timedelta(days=1)
        return due.astimezone(timezone.utc)

    if "tomorrow" in s:
        return (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    if "tonight" in s:
        due = now.replace(hour=20, minute=0, second=0, microsecond=0)
        if due <= now:
            due += timedelta(days=1)
        return due.astimezone(timezone.utc)

    return None


class ActionEngine:
    """Maps intent dicts to handler methods and returns a spoken response."""

    def __init__(
        self,
        notes_store: "Optional[NotesStore]" = None,
        reminders_store: "Optional[RemindersStore]" = None,
        settings_store=None,
        llm=None,
    ) -> None:
        if notes_store is None:
            from jarvis.dashboard.notes import NotesStore
            notes_store = NotesStore()
        if reminders_store is None:
            from jarvis.core.reminders import RemindersStore
            reminders_store = RemindersStore()
        if settings_store is None:
            from jarvis.dashboard.settings import SettingsStore
            settings_store = SettingsStore()
        self._notes = notes_store
        self._reminders = reminders_store
        self._settings = settings_store
        self._llm = llm
        self.actions: dict[str, Callable[[dict], str]] = {
            "search": self._search,
            "weather": self._weather,
            "open_app": self._open_app,
            "time": self._time,
            "date": self._date,
            "define": self._define,
            "fact": self._fact,
            "joke": self._joke,
            "reminder": self._reminder,
            "note": self._note,
            "calculation": self._calculate,
            "music": self._music,
            "smart_home": self._smart_home,
            "timer": self._timer,
            "navigation": self._navigation,
            "news": self._news,
            "email": self._email,
            "greeting": self._greeting,
            "goodbye": self._goodbye,
            "help": self._help,
            "person_identification": self._identify_person,
            "visual_recognition": self._visual_recognition,
            "web_search": self._web_search,
            "research_person": self._research_person,
            "research_company": self._research_company,
            "os_control": self._os_control,
            "conversation": self._conversation,
        }

    def execute_action(self, intent: dict) -> str:
        """Run the handler for `intent['type']`. Falls back to conversation."""
        intent_type = intent.get("type", "conversation")
        handler = self.actions.get(intent_type, self._conversation)
        try:
            return handler(intent)
        except Exception as exc:
            logger.exception("Action %s failed", intent_type)
            return f"I ran into a problem with that: {exc}"

    # ── handlers ──────────────────────────────────────────────────────────

    @staticmethod
    def _search(intent: dict) -> str:
        query = (intent.get("query") or "").strip()
        if not query:
            return "What would you like me to search for?"
        webbrowser.open(f"https://www.google.com/search?q={urllib.parse.quote_plus(query)}")
        return f"I'm searching for '{query}' on Google."

    @staticmethod
    def _weather(intent: dict) -> str:
        return get_weather(intent.get("location"))

    @staticmethod
    def _open_app(intent: dict) -> str:
        app = (intent.get("app_name") or "").strip()
        if not app:
            return "Which application would you like me to open?"
        system = platform.system()
        if system == "Darwin":
            result = subprocess.run(["open", "-a", app], capture_output=True, text=True)
            if result.returncode == 0:
                return f"Opening {app}."
            return f"I couldn't find or open {app}."
        if system == "Windows":
            try:
                subprocess.run(["start", "", app], shell=True, check=True)
                return f"Opening {app}."
            except subprocess.CalledProcessError:
                return f"I couldn't open {app}."
        if system == "Linux":
            from shutil import which

            executable = which(app)
            if not executable:
                return f"I couldn't find {app} on your PATH."
            subprocess.Popen([executable])
            return f"Opening {app}."
        return f"Opening apps isn't supported on {system}."

    @staticmethod
    def _time(intent: dict) -> str:
        now = datetime.now()
        return f"The current time is {now.strftime('%I:%M %p')} on {now.strftime('%A, %B %d, %Y')}."

    @staticmethod
    def _date(intent: dict) -> str:
        return f"Today is {datetime.now().strftime('%A, %B %d, %Y')}."

    @staticmethod
    def _define(intent: dict) -> str:
        term = (intent.get("query") or "").replace("define ", "").strip()
        if not term:
            return "What would you like me to define?"
        webbrowser.open(f"https://www.google.com/search?q={urllib.parse.quote_plus(f'define {term}')}")
        return f"I've opened a definition search for '{term}'."

    @staticmethod
    def _fact(intent: dict) -> str:
        query = (intent.get("query") or "").strip()
        if not query:
            return "What would you like to know about?"
        webbrowser.open(f"https://www.google.com/search?q={urllib.parse.quote_plus(query)}")
        return f"I've opened a search for '{query}'."

    @staticmethod
    def _joke(intent: dict) -> str:
        return random.choice(JOKES)

    def _reminder(self, intent: dict) -> str:
        text = (intent.get("reminder_text") or "").strip()
        if not text:
            return "What would you like me to remind you about?"
        time_info = intent.get("time")
        due = _parse_due_time(time_info)
        self._reminders.add(text, due_at=due)
        if due:
            return f"Reminder set: '{text}' at {due.strftime('%I:%M %p')}."
        return f"Reminder saved: '{text}'."

    def _note(self, intent: dict) -> str:
        text = (intent.get("note_text") or "").strip()
        if not text:
            return "What would you like me to note down?"
        self._notes.add(content=text)
        return f"Saved your note: '{text}'"

    @staticmethod
    def _calculate(intent: dict) -> str:
        expression = (intent.get("expression") or "").strip()
        if not expression:
            return "What would you like me to calculate?"
        for word, symbol in _WORD_OPERATORS.items():
            expression = re.sub(rf"\b{word}\b", symbol, expression, flags=re.IGNORECASE)
        try:
            result = _safe_eval(expression)
        except ZeroDivisionError:
            return "I can't divide by zero."
        except (ValueError, SyntaxError) as exc:
            return f"I couldn't evaluate that expression: {exc}"
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        return f"The result of {expression} is {result}"

    @staticmethod
    def _music(intent: dict) -> str:
        song = (intent.get("song") or "").strip()
        if song:
            url = f"https://music.youtube.com/search?q={urllib.parse.quote_plus(song)}"
            webbrowser.open(url)
            return f"Searching for '{song}' on YouTube Music."
        webbrowser.open("https://music.youtube.com")
        return "Opening YouTube Music for you."

    def _smart_home(self, intent: dict) -> str:
        device = (intent.get("device") or "").strip()
        if not device:
            return "Which device would you like to control?"
        action = intent.get("smart_home_action", "toggle")
        extra = {"temperature": intent["temperature"]} if "temperature" in intent else None
        ha_url = self._settings.get("ha_url", "")
        ha_token = self._settings.get("ha_token", "")
        return _smart_home_control(device, action, extra=extra, ha_url=ha_url, ha_token=ha_token)

    def _timer(self, intent: dict) -> str:
        duration_str = intent.get("duration")
        if not duration_str:
            return "How long should I set the timer for?"
        delta = _parse_duration(duration_str)
        if delta is None:
            return f"I didn't understand the duration '{duration_str}'. Try '5 minutes' or '30 seconds'."
        due = (datetime.now(timezone.utc) + delta)
        self._reminders.add(text=f"Timer: {duration_str}", due_at=due, kind="timer")
        # Human-readable duration
        total = int(delta.total_seconds())
        if total >= 3600:
            label = f"{total // 3600}h {(total % 3600) // 60}m" if total % 3600 else f"{total // 3600} hour(s)"
        elif total >= 60:
            label = f"{total // 60} minute(s)"
        else:
            label = f"{total} second(s)"
        return f"Timer set for {label}."

    @staticmethod
    def _navigation(intent: dict) -> str:
        destination = (intent.get("destination") or "").strip()
        if not destination:
            return "Where would you like directions to?"
        webbrowser.open(f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote_plus(destination)}")
        return f"Getting directions to {destination}."

    @staticmethod
    def _news(intent: dict) -> str:
        webbrowser.open("https://news.google.com")
        return "Opening Google News."

    @staticmethod
    def _email(intent: dict) -> str:
        query = (intent.get("query") or intent.get("original_text") or "").strip()
        to = re.search(r"to\s+([\w.+-]+@[\w.-]+)", query, re.IGNORECASE)
        if to:
            webbrowser.open(f"mailto:{to.group(1)}")
            return f"Opening your email client to compose a message to {to.group(1)}."
        if "check" in query.lower() or "inbox" in query.lower():
            webbrowser.open("https://mail.google.com")
            return "Opening Gmail."
        webbrowser.open("https://mail.google.com/mail/u/0/#compose")
        return "Opening Gmail to compose a new message."

    @staticmethod
    def _greeting(intent: dict) -> str:
        return random.choice(GREETINGS)

    @staticmethod
    def _goodbye(intent: dict) -> str:
        return random.choice(GOODBYES)

    @staticmethod
    def _identify_person(intent: dict) -> str:
        # Camera capture is a hardware concern handled by the web UI
        # (POST /api/face/identify with an uploaded image). The CLI
        # cannot meaningfully grab a webcam frame in a portable way.
        return "Open the web UI and upload a photo to identify a person."

    @staticmethod
    def _visual_recognition(intent: dict) -> str:
        return "Open the web UI and upload an image for scene analysis."

    @staticmethod
    def _help(intent: dict) -> str:
        return (
            "I can help with: search ('search for…'), time, date, weather, "
            "calculations ('calculate 2 plus 2'), opening apps ('open Spotify'), "
            "reminders, notes, music, navigation, news, jokes, "
            "person identification ('who is this?'), and visual recognition "
            "('what is this?'). Just ask."
        )

    def _research_person(self, intent: dict) -> str:
        name = (intent.get("name") or "").strip()
        if not name:
            return "Who would you like me to research?"
        from jarvis.services.research import ResearchPipeline
        pipeline = ResearchPipeline(llm=self._llm)
        hints = {}
        if intent.get("company"):
            hints["company"] = intent["company"]
        profile = pipeline.research_person(name=name, hints=hints)
        if profile.sections:
            parts = [profile.summary, ""]
            for section, content in profile.sections.items():
                if content and content.lower() not in ("...", "n/a", ""):
                    parts.append(f"**{section}**: {content}")
            return "\n".join(parts).strip()
        return profile.summary

    def _research_company(self, intent: dict) -> str:
        name = (intent.get("name") or "").strip()
        if not name:
            return "Which company would you like me to research?"
        from jarvis.services.research import ResearchPipeline
        pipeline = ResearchPipeline(llm=self._llm)
        profile = pipeline.research_company(name=name)
        if profile.sections:
            parts = [profile.summary, ""]
            for section, content in profile.sections.items():
                if content and content.lower() not in ("...", "n/a", ""):
                    parts.append(f"**{section}**: {content}")
            return "\n".join(parts).strip()
        return profile.summary

    @staticmethod
    def _os_control(intent: dict) -> str:
        from jarvis.services.os_control import perform_action, screenshot_b64
        action = (intent.get("os_action") or "").strip()
        if not action:
            return "Which desktop action should I perform? (click, type, press, hotkey, scroll)"
        if action == "screenshot":
            result = screenshot_b64()
            if "error" in result:
                return result["error"]
            return f"Screenshot captured ({result['width']}×{result['height']} px)."
        kwargs = {}
        for k in ("x", "y", "text", "key", "keys", "button", "clicks"):
            if intent.get(k) is not None:
                kwargs[k] = intent[k]
        return perform_action(action, **kwargs)

    def _web_search(self, intent: dict) -> str:
        query = (intent.get("query") or "").strip()
        if not query:
            return "What would you like me to search for?"
        limit = int(intent.get("limit") or 5)
        return _web_search(query, llm=self._llm, limit=limit)

    @staticmethod
    def _conversation(intent: dict) -> str:
        return random.choice(
            [
                "I'm here to help! What would you like to do?",
                "How can I assist you today?",
                "I'm listening. What do you need?",
            ]
        )

    def get_reminders(self) -> list[dict]:
        return self._reminders.list_pending()

    def supported_actions(self) -> list[str]:
        return list(self.actions.keys())
