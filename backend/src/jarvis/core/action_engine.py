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
from jarvis.services.system_api import handle_system_api as _handle_system_api


if TYPE_CHECKING:
    from jarvis.core.permissions import Permission, PermissionsManager
    from jarvis.core.reminders import RemindersStore
    from jarvis.core.scheduler import Scheduler
    from jarvis.dashboard.notes import NotesStore

logger = logging.getLogger(__name__)

# Web equivalents for common apps — used as fallback when running on Linux servers
# where desktop apps cannot be launched.
_APP_WEB_URLS: dict[str, str] = {
    "whatsapp": "https://web.whatsapp.com",
    "instagram": "https://www.instagram.com",
    "twitter": "https://twitter.com",
    "x": "https://x.com",
    "facebook": "https://www.facebook.com",
    "messenger": "https://www.messenger.com",
    "gmail": "https://mail.google.com",
    "youtube": "https://www.youtube.com",
    "spotify": "https://open.spotify.com",
    "netflix": "https://www.netflix.com",
    "linkedin": "https://www.linkedin.com",
    "slack": "https://slack.com",
    "discord": "https://discord.com/app",
    "telegram": "https://web.telegram.org",
    "maps": "https://maps.google.com",
    "google maps": "https://maps.google.com",
    "calendar": "https://calendar.google.com",
    "google calendar": "https://calendar.google.com",
    "drive": "https://drive.google.com",
    "google drive": "https://drive.google.com",
    "docs": "https://docs.google.com",
    "sheets": "https://sheets.google.com",
    "reddit": "https://www.reddit.com",
    "github": "https://github.com",
    "notion": "https://notion.so",
    "figma": "https://figma.com",
}

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
        scheduler: "Optional[Scheduler]" = None,
        permissions: "Optional[PermissionsManager]" = None,
        google_service=None,
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
        self._scheduler = scheduler
        self._permissions = permissions
        self._google = google_service
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
            "control_app": self._control_app,
            "create_schedule": self._create_schedule,
            "list_schedules": self._list_schedules,
            "delete_schedule": self._delete_schedule,
            "system_api": self._system_api,
            "conversation": self._conversation,
            "gmail_list": self._gmail_list,
            "gmail_send": self._gmail_send,
            "gmail_search": self._gmail_search,
            "calendar_list": self._calendar_list,
            "calendar_create": self._calendar_create,
            "calendar_update": self._calendar_update,
            "drive_list": self._drive_list,
            "drive_create": self._drive_create,
        }

    def _require(self, perm_name: str, label: str) -> Optional[str]:
        """Return an error string if `perm_name` is denied, else None."""
        if self._permissions is None:
            return None
        from jarvis.core.permissions import Permission
        try:
            perm = Permission(perm_name)
        except ValueError:
            return None
        if not self._permissions.is_granted(perm):
            return f"Permission denied: {label} is not enabled. Enable it in the Permissions settings."
        return None

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
        app_key = app.lower()
        web_url = _APP_WEB_URLS.get(app_key)
        if system == "Darwin":
            result = subprocess.run(["open", "-a", app], capture_output=True, text=True)
            if result.returncode == 0:
                return f"Opening {app}."
            if web_url:
                webbrowser.open(web_url)
                return f"Opening the web version of {app}."
            return f"I couldn't find or open {app}."
        if system == "Windows":
            try:
                subprocess.run(["start", "", app], shell=True, check=True)
                return f"Opening {app}."
            except subprocess.CalledProcessError:
                if web_url:
                    webbrowser.open(web_url)
                    return f"Opening the web version of {app}."
                return f"I couldn't open {app}."
        if system == "Linux":
            from shutil import which
            executable = which(app) or which(app_key)
            if executable:
                subprocess.Popen([executable])
                return f"Opening {app}."
            if web_url:
                return f"Here's the web version of {app}: [{app}]({web_url})"
            return (
                f"I can't launch desktop apps on this server. "
                f"Run JARVIS locally to open {app} on your device."
            )
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
        err = self._require("reminders", "Reminders & Calendar")
        if err:
            return err
        text = (intent.get("reminder_text") or "").strip()
        if not text:
            return "What would you like me to remind you about?"
        time_info = intent.get("time")
        due = _parse_due_time(time_info)
        self._reminders.add(text, due_at=due, user_id=intent.get("_user_id"))
        if due:
            return f"Reminder set: '{text}' at {due.strftime('%I:%M %p')}."
        return f"Reminder saved: '{text}'."

    def _note(self, intent: dict) -> str:
        err = self._require("file_access", "File & Data Access")
        if err:
            return err
        text = (intent.get("note_text") or "").strip()
        if not text:
            return "What would you like me to note down?"
        self._notes.add(content=text, user_id=intent.get("_user_id"))
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
        self._reminders.add(text=f"Timer: {duration_str}", due_at=due, kind="timer", user_id=intent.get("_user_id"))
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
        err = self._require("web_access", "Web & Research")
        if err:
            return err
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
        err = self._require("web_access", "Web & Research")
        if err:
            return err
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

    def _control_app(self, intent: dict) -> str:
        err = self._require("system_control", "System Control")
        if err:
            return err
        from jarvis.services.app_control import handle_control_app
        return handle_control_app(intent)

    def _os_control(self, intent: dict) -> str:
        err = self._require("computer_use", "Computer Use")
        if err:
            return err
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
        err = self._require("web_access", "Web & Research")
        if err:
            return err
        query = (intent.get("query") or "").strip()
        if not query:
            return "What would you like me to search for?"
        limit = int(intent.get("limit") or 5)
        return _web_search(query, llm=self._llm, limit=limit)

    def _create_schedule(self, intent: dict) -> str:
        err = self._require("scheduler", "Autonomous Scheduler")
        if err:
            return err
        if self._scheduler is None:
            return "Scheduler is not available."
        name = (intent.get("name") or "").strip()
        goal = (intent.get("goal") or "").strip()
        expr = (intent.get("schedule_expr") or "").strip()
        if not name or not goal or not expr:
            return "Please provide a name, goal, and schedule expression for the job."
        try:
            job_id = self._scheduler.add(name=name, goal=goal, schedule_expr=expr, enabled=True, user_id=intent.get("_user_id"))
            return f"Scheduled job '{name}' created (ID: {job_id[:8]}…). It will run {expr}."
        except ValueError as exc:
            return f"Invalid schedule expression: {exc}"

    def _list_schedules(self, intent: dict) -> str:
        err = self._require("scheduler", "Autonomous Scheduler")
        if err:
            return err
        if self._scheduler is None:
            return "Scheduler is not available."
        jobs = self._scheduler.list_all(user_id=intent.get("_user_id"))
        if not jobs:
            return "No scheduled jobs configured yet."
        lines = [f"Found {len(jobs)} scheduled job(s):"]
        for j in jobs:
            status = "enabled" if j["enabled"] else "paused"
            runs = j["run_count"]
            lines.append(f"• [{j['id'][:8]}] {j['name']} — {j['schedule_expr']} ({status}, {runs} runs)")
        return "\n".join(lines)

    def _delete_schedule(self, intent: dict) -> str:
        err = self._require("scheduler", "Autonomous Scheduler")
        if err:
            return err
        if self._scheduler is None:
            return "Scheduler is not available."
        job_id = (intent.get("job_id") or "").strip()
        uid = intent.get("_user_id")
        if not job_id:
            return "Please provide the job ID to delete. Use list_schedules to find it."
        if self._scheduler.remove(job_id, user_id=uid):
            return f"Scheduled job {job_id[:8]}… has been deleted."
        jobs = self._scheduler.list_all(user_id=uid)
        matches = [j for j in jobs if j["id"].startswith(job_id)]
        if len(matches) == 1 and self._scheduler.remove(matches[0]["id"], user_id=uid):
            return f"Scheduled job '{matches[0]['name']}' has been deleted."
        return f"No job found with ID starting with '{job_id}'."

    @staticmethod
    def _system_api(intent: dict) -> str:
        return _handle_system_api(intent)

    @staticmethod
    def _conversation(intent: dict) -> str:
        return random.choice(
            [
                "I'm here to help! What would you like to do?",
                "How can I assist you today?",
                "I'm listening. What do you need?",
            ]
        )

    def _gmail_list(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot access Gmail without a logged-in user."
        result = self._google.gmail.list_messages(uid, query=intent.get("query", ""), max_results=intent.get("max_results", 10))
        if isinstance(result, str):
            return result
        if not result:
            return "Your inbox is empty."
        lines = [f"Found {len(result)} message(s):"]
        for m in result:
            lines.append(f"• {m['date'][:16]} | From: {m['from'][:30]} | {m['subject']} — {m['snippet'][:60]}")
        return "\n".join(lines)

    def _gmail_send(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot send email without a logged-in user."
        to = intent.get("to", "")
        subject = intent.get("subject", "")
        body = intent.get("body", "")
        if not to or not subject or not body:
            return "Please provide 'to', 'subject', and 'body' to send an email."
        result = self._google.gmail.send_message(uid, to=to, subject=subject, body=body)
        if isinstance(result, str):
            return result
        return f"Email sent to {to} with subject '{subject}'."

    def _gmail_search(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot search Gmail without a logged-in user."
        result = self._google.gmail.search_messages(uid, query=intent.get("query", ""), max_results=intent.get("max_results", 20))
        if isinstance(result, str):
            return result
        if not result:
            return "No emails found matching that search."
        lines = [f"Found {len(result)} result(s):"]
        for m in result:
            lines.append(f"• {m['date'][:16]} | From: {m['from'][:30]} | {m['subject']} — {m['snippet'][:60]}")
        return "\n".join(lines)

    def _calendar_list(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot access Calendar without a logged-in user."
        result = self._google.calendar.list_events(
            uid,
            time_min=intent.get("time_min"),
            time_max=intent.get("time_max"),
            max_results=intent.get("max_results", 10),
        )
        if isinstance(result, str):
            return result
        if not result:
            return "No upcoming events found."
        lines = [f"Found {len(result)} upcoming event(s):"]
        for e in result:
            attendees = ", ".join(e["attendees"]) if e["attendees"] else "no attendees"
            lines.append(f"• {e['start'][:16]} — {e['title']} ({attendees}){' @ ' + e['location'] if e['location'] else ''}")
        return "\n".join(lines)

    def _calendar_create(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot create Calendar event without a logged-in user."
        title = intent.get("title", "")
        start = intent.get("start", "")
        end = intent.get("end", "")
        if not title or not start or not end:
            return "Please provide a title, start time, and end time for the event."
        result = self._google.calendar.create_event(
            uid, title=title, start=start, end=end,
            description=intent.get("description", ""),
            location=intent.get("location", ""),
            attendees=intent.get("attendees", []),
        )
        if isinstance(result, str):
            return result
        attendees = intent.get("attendees", [])
        msg = f"Event '{title}' created for {start[:16]}."
        if attendees:
            msg += f" Invite sent to: {', '.join(attendees)}."
        if result.get("link"):
            msg += f" View: {result['link']}"
        return msg

    def _calendar_update(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot update Calendar event without a logged-in user."
        event_id = intent.get("event_id", "")
        if not event_id:
            return "Please provide the event ID to update."
        result = self._google.calendar.update_event(
            uid, event_id=event_id,
            title=intent.get("title"),
            start=intent.get("start"),
            end=intent.get("end"),
            description=intent.get("description"),
            location=intent.get("location"),
        )
        if isinstance(result, str):
            return result
        return f"Event '{result.get('title', event_id)}' updated."

    def _drive_list(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot access Drive without a logged-in user."
        result = self._google.drive.list_files(uid, query=intent.get("query", ""), max_results=intent.get("max_results", 20))
        if isinstance(result, str):
            return result
        if not result:
            return "No files found in Drive."
        lines = [f"Found {len(result)} file(s):"]
        for f in result:
            lines.append(f"• {f['name']} ({f['type'].split('.')[-1] if '.' in f['type'] else f['type']}) — modified {f['modified'][:10]}")
        return "\n".join(lines)

    def _drive_create(self, intent: dict) -> str:
        if self._google is None:
            return "Google integration not configured."
        uid = intent.get("_user_id")
        if not uid:
            return "Cannot create Drive file without a logged-in user."
        name = intent.get("name", "")
        content = intent.get("content", "")
        if not name:
            return "Please provide a file name."
        result = self._google.drive.create_file(uid, name=name, content=content)
        if isinstance(result, str):
            return result
        return f"File '{name}' created in Drive." + (f" View: {result['link']}" if result.get("link") else "")

    def get_reminders(self) -> list[dict]:
        return self._reminders.list_pending()

    def supported_actions(self) -> list[str]:
        return list(self.actions.keys())
