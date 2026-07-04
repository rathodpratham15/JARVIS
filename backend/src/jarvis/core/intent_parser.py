"""Regex-based intent classifier.

Classifies a user utterance into one of a fixed set of intents and extracts
basic entities (search query, app name, location, math expression, etc.).
This is intentionally rule-based — it's fast, deterministic, and has no API
cost. For utterances that don't match any pattern, the result is
`conversation` and the action engine routes the input to the LLM.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


INTENT_PATTERNS: dict[str, list[str]] = {
    "search": [
        r"search (?:for )?(.+)",
        r"look up (.+)",
        r"find (.+)",
        r"google (.+)",
        r"tell me about (.+)",
    ],
    "weather": [
        r"\bweather\b", r"\btemperature\b", r"\bforecast\b",
        r"\brain\b", r"\bsunny\b", r"\bcloudy\b", r"\bhot\b", r"\bcold\b", r"\bstorm\b",
    ],
    "open_app": [r"open (.+)", r"launch (.+)", r"start (.+)", r"run (.+)", r"close (.+)", r"quit (.+)"],
    "time": [r"what time", r"current time", r"time is it", r"what's the time", r"tell me the time"],
    "date": [r"what.*date", r"today.*date", r"current date", r"date today", r"what day is it"],
    "define": [r"define (.+)", r"definition of (.+)", r"meaning of (.+)", r"what does (.+) mean"],
    "fact": [r"who is (.+)", r"facts about (.+)", r"information about (.+)"],
    "joke": [r"tell me a joke", r"\bjoke\b", r"\bfunny\b", r"make me laugh", r"something funny"],
    "reminder": [r"remind me", r"set a reminder", r"don't forget", r"remember to", r"schedule"],
    "note": [r"take a note", r"write down", r"note that", r"remember this", r"save this note"],
    "calculation": [
        r"calculate (.+)",
        r"compute (.+)",
        r"what is \d+.*[\+\-\*\/].*\d+",
        r"what's \d+.*[\+\-\*\/].*\d+",
        r"\d+\s*(?:plus|minus|times|divided by)\s*\d+",
    ],
    "music": [r"play music", r"play (.+)", r"\bmusic\b", r"\bsong\b", r"\bspotify\b", r"\bvolume\b"],
    "news": [
        r"(?:latest |tech |world |breaking )?news",
        r"(?:latest |today's |breaking )?headlines",
        r"what's happening",
        r"current events",
    ],
    "greeting": [r"\bhello\b", r"\bhi\b", r"\bhey\b", r"good morning", r"good afternoon", r"good evening", r"\bjarvis\b"],
    "goodbye": [r"\bbye\b", r"\bgoodbye\b", r"see you", r"\bexit\b", r"\bquit\b", r"\bstop\b", r"\bshutdown\b", r"turn off", r"power off"],
    "help": [r"\bhelp\b", r"what can you do", r"\bcommands\b", r"\bassist\b"],
    "smart_home": [r"turn on (.+)", r"turn off (.+)", r"\blights\b", r"\bthermostat\b", r"temperature to", r"dim (.+)", r"\bbrightness\b"],
    "email": [r"send email", r"email (.+)", r"check email", r"new messages"],
    "timer": [r"set timer", r"timer for", r"\bcountdown\b", r"\balarm\b"],
    "navigation": [r"directions to (.+)", r"navigate to (.+)", r"how to get to (.+)", r"route to (.+)", r"\btraffic\b"],
    "person_identification": [
        r"who is this person", r"who is this", r"identify this person",
        r"who am I looking at", r"who is in front of me", r"identify the person",
        r"recognize this person", r"tell me who this is", r"who are they",
        r"identify them", r"scan this person", r"analyze this person",
        # Self-referential — "open the camera and recognize me".
        r"scan my face", r"scan my self", r"scan myself",
        r"\brecognize me\b", r"\bidentify me\b",
        r"who am i", r"do you know me", r"do you recognize me",
        r"facial recognition", r"face recognition",
    ],
    "visual_recognition": [
        r"what is this", r"what am I looking at", r"identify this", r"recognize this",
        r"scan this", r"what do you see", r"visual scan", r"google lens",
        r"what's in this image", r"detect objects", r"identify objects",
        r"object detection", r"scan the room", r"look around",
    ],
}

# Most-specific intents are checked first so that, e.g., "who is this person"
# resolves to person_identification rather than the generic "fact" intent.
PRIORITY_ORDER = [
    "visual_recognition", "person_identification",
    "time", "date", "weather", "calculation", "define", "fact", "joke",
    "reminder", "note", "open_app", "music", "news",
    "navigation", "timer", "smart_home", "email",
    "greeting", "goodbye", "help", "search",
]

# Intents that ActionEngine handles directly. Anything else (notably
# `conversation`) is routed to the LLM by the CLI/web layer. `joke`,
# `greeting`, `goodbye`, and `help` are deliberately included here even
# though they are conversational — their canned handlers in ActionEngine
# are cheaper and more reliable than burning an LLM call.
ACTION_REQUIRED = {
    "search", "weather", "open_app", "time", "date", "define", "fact",
    "reminder", "note", "calculation", "music", "smart_home", "timer",
    "navigation", "email", "news", "person_identification", "visual_recognition",
    "joke", "greeting", "goodbye", "help",
}

LOCATION_PATTERNS = [r"in ([A-Za-z\s,]+)", r"at ([A-Za-z\s,]+)", r"near ([A-Za-z\s,]+)", r"for ([A-Za-z\s,]+)"]
DURATION_PATTERN = r"(\d+)\s*(seconds?|minutes?|hours?)"
MATH_PATTERN = r"(\d+\s*[\+\-\*\/]\s*\d+)"

_WORD_OPERATORS = {
    "plus": "+", "add": "+", "and": "+",
    "minus": "-", "subtract": "-",
    "times": "*", "multiply": "*", "multiplied by": "*",
    "divided by": "/", "divide": "/",
}

_APP_ALIASES = [
    r"(spotify|apple music)", r"(chrome|safari|firefox|browser)",
    r"(calculator|calc)", r"(notes|notepad|textedit)", r"(calendar|cal)",
    r"(mail|email)", r"(messages|text)", r"(maps|navigation)",
    r"(photos|pictures)", r"(settings|preferences)",
]


class IntentParser:
    """Compiles patterns once and matches utterances against them."""

    def __init__(self) -> None:
        self._compiled: dict[str, list[re.Pattern]] = {
            intent: [re.compile(p, re.IGNORECASE) for p in patterns]
            for intent, patterns in INTENT_PATTERNS.items()
        }
        self._location = [re.compile(p, re.IGNORECASE) for p in LOCATION_PATTERNS]
        self._app_aliases = [re.compile(p, re.IGNORECASE) for p in _APP_ALIASES]

    def parse_intent(self, command: str) -> dict:
        if not command or not command.strip():
            return self._result("unknown", 0.0, {}, "Empty command")

        text = command.strip()
        intent, confidence, data = self._best_intent(text)
        return self._result(intent, confidence, data, text)

    def _best_intent(self, text: str) -> tuple[str, float, dict]:
        for intent in PRIORITY_ORDER:
            for compiled in self._compiled[intent]:
                match = compiled.search(text)
                if match:
                    return intent, 0.8, self._extract(intent, text, match)
        return "conversation", 0.5, {}

    def _extract(self, intent: str, text: str, match: re.Match) -> dict:
        groups = match.groups()
        first = groups[-1].strip() if groups else None

        if intent == "search":
            return {"query": first}
        if intent == "open_app":
            return {"app_name": first or self._app_alias(text)}
        if intent == "weather":
            loc = self._location_from(text)
            return {"location": loc} if loc else {"location": "current location"}
        if intent in ("define", "fact"):
            return {"query": first}
        if intent == "note":
            return {"note_text": _strip_prefixes(text, ["take a note:?", "write down:?", "note that:?", "remember this:?", "save this note:?"])}
        if intent == "reminder":
            return {
                "reminder_text": _strip_prefixes(text, ["remind me to", "remind me", "set a reminder to", "don't forget to", "remember to"]),
                "time": _first_match(r"(\d{1,2}:\d{2}\s*(?:am|pm)?)|(?:in \d+ \w+)|(?:tomorrow|today|tonight)", text),
            }
        if intent == "calculation":
            return {"expression": _extract_math(text)}
        if intent == "music":
            return {"song": first}
        if intent == "smart_home":
            if re.search(r"\bturn on\b|\bswitch on\b|\blights? on\b|\benable\b|\bactivate\b", text, re.IGNORECASE):
                action = "turn_on"
            elif re.search(r"\bturn off\b|\bswitch off\b|\blights? off\b|\bdisable\b|\bdeactivate\b", text, re.IGNORECASE):
                action = "turn_off"
            elif re.search(r"\bdim\b|\bdimmer\b|\bbrightness\b", text, re.IGNORECASE):
                action = "dim"
            elif re.search(r"\btemperature to\b|\bset.*thermostat\b|\bheat\b|\bcool\b", text, re.IGNORECASE):
                action = "set_temp"
            else:
                action = "toggle"
            # Extract device name from the action phrase.
            dm = re.search(
                r"(?:turn on|turn off|switch on|switch off|dim|enable|disable|activate|deactivate)"
                r"\s+(?:the\s+)?(.+)",
                text, re.IGNORECASE,
            )
            if dm:
                device = dm.group(1).strip()
            elif action == "set_temp":
                # "set the thermostat to 72" → device = "thermostat"
                tm = re.search(r"(?:the\s+)?(\w+(?:\s+\w+)?)\s+to\s+\d+", text, re.IGNORECASE)
                device = tm.group(1).strip() if tm else "thermostat"
            else:
                device = first or text.strip()
            # Extract temperature value for set_temp
            temp_m = re.search(r"to\s+(\d+)", text, re.IGNORECASE)
            extra = {"temperature": int(temp_m.group(1))} if temp_m and action == "set_temp" else {}
            return {"device": device, "smart_home_action": action, **extra}
        if intent == "timer":
            duration = re.search(DURATION_PATTERN, text, re.IGNORECASE)
            return {"duration": f"{duration.group(1)} {duration.group(2)}"} if duration else {}
        if intent == "navigation":
            return {"destination": first}
        return {}

    def _location_from(self, text: str) -> Optional[str]:
        for pattern in self._location:
            m = pattern.search(text)
            if m:
                return re.sub(r"\b(the|a|an)\b", "", m.group(1), flags=re.IGNORECASE).strip()
        return None

    def _app_alias(self, text: str) -> Optional[str]:
        for pattern in self._app_aliases:
            m = pattern.search(text)
            if m:
                return m.group(1)
        return None

    @staticmethod
    def _result(intent: str, confidence: float, data: dict, original_text: str) -> dict:
        return {
            "type": intent,
            "confidence": confidence,
            "original_text": original_text,
            "timestamp": datetime.now().isoformat(),
            "action_required": intent in ACTION_REQUIRED,
            **data,
        }

    @staticmethod
    def supported_intents() -> list[str]:
        return list(INTENT_PATTERNS.keys()) + ["conversation"]


def _strip_prefixes(text: str, prefixes: list[str]) -> str:
    out = text
    for p in prefixes:
        out = re.sub(rf"^{p}\s*", "", out, flags=re.IGNORECASE)
    return out.strip()


def _first_match(pattern: str, text: str) -> Optional[str]:
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(0).strip() if m else None


def _extract_math(text: str) -> str:
    direct = re.search(MATH_PATTERN, text)
    if direct:
        return direct.group(1).strip()

    expr = text.lower()
    for word, symbol in _WORD_OPERATORS.items():
        expr = re.sub(rf"\b{word}\b", symbol, expr)
    converted = re.search(MATH_PATTERN, expr)
    if converted:
        return converted.group(1).strip()
    return text.strip()
