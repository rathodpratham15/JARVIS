"""Google Calendar service — list and manage events."""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .token_store import GoogleTokenStore

logger = logging.getLogger(__name__)

NOT_CONNECTED = "Google Calendar is not connected. Please connect your Google account in Settings."


class CalendarService:
    def __init__(self, token_store: "GoogleTokenStore", client_id: str, client_secret: str) -> None:
        self._store = token_store
        self._client_id = client_id
        self._client_secret = client_secret

    def _build(self, user_id: str):
        from googleapiclient.discovery import build
        creds = self._store.get_credentials(user_id, self._client_id, self._client_secret)
        if creds is None:
            return None
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    def list_events(self, user_id: str, time_min: Optional[str] = None,
                    time_max: Optional[str] = None, max_results: int = 10) -> "list[dict] | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            now = datetime.now(timezone.utc)
            tmin = time_min or now.isoformat()
            tmax = time_max or (now + timedelta(days=7)).isoformat()
            resp = svc.events().list(
                calendarId="primary",
                timeMin=tmin,
                timeMax=tmax,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            events = []
            for e in resp.get("items", []):
                start = e.get("start", {})
                end = e.get("end", {})
                events.append({
                    "id": e["id"],
                    "title": e.get("summary", "(no title)"),
                    "start": start.get("dateTime") or start.get("date", ""),
                    "end": end.get("dateTime") or end.get("date", ""),
                    "location": e.get("location", ""),
                    "description": e.get("description", ""),
                    "attendees": [a.get("email", "") for a in e.get("attendees", [])],
                })
            return events
        except Exception as exc:
            logger.error("Calendar list_events error: %s", exc)
            return f"Calendar error: {exc}"

    def create_event(self, user_id: str, title: str, start: str, end: str,
                     description: str = "", attendees: Optional[list[str]] = None,
                     location: str = "") -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            body: dict = {
                "summary": title,
                "start": {"dateTime": start, "timeZone": "UTC"},
                "end": {"dateTime": end, "timeZone": "UTC"},
            }
            if description:
                body["description"] = description
            if location:
                body["location"] = location
            if attendees:
                body["attendees"] = [{"email": a} for a in attendees]
            event = svc.events().insert(
                calendarId="primary", body=body,
                sendUpdates="all" if attendees else "none"
            ).execute()
            return {"id": event["id"], "title": event.get("summary"), "link": event.get("htmlLink", "")}
        except Exception as exc:
            logger.error("Calendar create_event error: %s", exc)
            return f"Calendar error: {exc}"

    def update_event(self, user_id: str, event_id: str, title: Optional[str] = None,
                     start: Optional[str] = None, end: Optional[str] = None,
                     description: Optional[str] = None, location: Optional[str] = None,
                     attendees: Optional[list[str]] = None) -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            event = svc.events().get(calendarId="primary", eventId=event_id).execute()
            if title:
                event["summary"] = title
            if start:
                event["start"] = {"dateTime": start, "timeZone": "UTC"}
            if end:
                event["end"] = {"dateTime": end, "timeZone": "UTC"}
            if description is not None:
                event["description"] = description
            if location is not None:
                event["location"] = location
            if attendees is not None:
                event["attendees"] = [{"email": a} for a in attendees]
            updated = svc.events().update(calendarId="primary", eventId=event_id, body=event).execute()
            return {"id": updated["id"], "title": updated.get("summary"), "link": updated.get("htmlLink", "")}
        except Exception as exc:
            logger.error("Calendar update_event error: %s", exc)
            return f"Calendar error: {exc}"

    def delete_event(self, user_id: str, event_id: str) -> "bool | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            svc.events().delete(calendarId="primary", eventId=event_id).execute()
            return True
        except Exception as exc:
            logger.error("Calendar delete_event error: %s", exc)
            return f"Calendar error: {exc}"
