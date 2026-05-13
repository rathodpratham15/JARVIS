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
from datetime import datetime
from pathlib import Path
from typing import Callable

from jarvis.services.weather_service import get_weather

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

NOTES_FILE = Path.home() / "jarvis_notes.txt"

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


class ActionEngine:
    """Maps intent dicts to handler methods and returns a spoken response."""

    def __init__(self) -> None:
        self.reminders: list[dict] = []
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
        self.reminders.append(
            {
                "id": len(self.reminders) + 1,
                "text": text,
                "time": time_info,
                "created": datetime.now().isoformat(),
                "completed": False,
            }
        )
        return f"I've set a reminder for '{text}'{' ' + time_info if time_info else ''}."

    @staticmethod
    def _note(intent: dict) -> str:
        text = (intent.get("note_text") or "").strip()
        if not text:
            return "What would you like me to note down?"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with NOTES_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"[{timestamp}] {text}\n")
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

    @staticmethod
    def _smart_home(intent: dict) -> str:
        device = intent.get("device", "device")
        return f"Smart home control for {device} is not yet implemented."

    @staticmethod
    def _timer(intent: dict) -> str:
        duration = intent.get("duration")
        if not duration:
            return "How long should I set the timer for?"
        return f"Timer for {duration} is not yet implemented."

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
        return "Email functionality is not yet implemented."

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
        return list(self.reminders)

    def supported_actions(self) -> list[str]:
        return list(self.actions.keys())
