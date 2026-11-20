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

    def _get_primary_timezone(self, svc) -> str:
        """Return the IANA timezone of the user's primary calendar."""
        try:
            return svc.calendars().get(calendarId="primary").execute().get("timeZone", "UTC")
        except Exception:
            return "UTC"

    def _get_calendar_ids(self, svc) -> list[str]:
        """Return all calendar IDs the user has access to."""
        try:
            items = svc.calendarList().list().execute().get("items", [])
            ids = [c["id"] for c in items if not c.get("deleted")]
            return ids or ["primary"]
        except Exception:
            return ["primary"]

    def list_events(self, user_id: str, time_min: Optional[str] = None,
                    time_max: Optional[str] = None, max_results: int = 10) -> "list[dict] | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            now = datetime.now(timezone.utc)
            # Use the user's local date string so Google applies the calendar's
            # own timezone when interpreting "today", avoiding UTC-offset issues.
            today_date = now.strftime("%Y-%m-%d")
            tmin = time_min or f"{today_date}T00:00:00Z"
            tmax = time_max or (now + timedelta(days=7)).strftime("%Y-%m-%dT00:00:00Z")

            seen_ids: set[str] = set()
            events: list[dict] = []

            for cal_id in self._get_calendar_ids(svc):
                try:
                    resp = svc.events().list(
                        calendarId=cal_id,
                        timeMin=tmin,
                        timeMax=tmax,
                        maxResults=max_results,
                        singleEvents=True,
                        orderBy="startTime",
                    ).execute()
                except Exception as exc:
                    logger.warning("Calendar list_events(%s) error: %s", cal_id, exc)
                    continue
                for e in resp.get("items", []):
                    if e["id"] in seen_ids:
                        continue
                    seen_ids.add(e["id"])
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

            # Sort merged results by start time
            events.sort(key=lambda e: e["start"])
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
            cal_tz = self._get_primary_timezone(svc)
            body: dict = {
                "summary": title,
                "start": {"dateTime": start, "timeZone": cal_tz},
                "end": {"dateTime": end, "timeZone": cal_tz},
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

    def _find_calendar_for_event(self, svc, event_id: str) -> str:
        """Return the calendarId that owns event_id, falling back to 'primary'."""
        for cal_id in self._get_calendar_ids(svc):
            try:
                svc.events().get(calendarId=cal_id, eventId=event_id).execute()
                return cal_id
            except Exception:
                continue
        return "primary"

    def update_event(self, user_id: str, event_id: str, title: Optional[str] = None,
                     start: Optional[str] = None, end: Optional[str] = None,
                     description: Optional[str] = None, location: Optional[str] = None,
                     attendees: Optional[list[str]] = None) -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            cal_id = self._find_calendar_for_event(svc, event_id)
            event = svc.events().get(calendarId=cal_id, eventId=event_id).execute()

            # Preserve original event timezone so the LLM's naive datetime
            # (e.g. "2026-11-20T19:00:00") is kept in the user's local tz
            # rather than being misread as UTC.
            orig_tz = (
                event.get("start", {}).get("timeZone")
                or event.get("end", {}).get("timeZone")
                or self._get_primary_timezone(svc)
            )

            # Guard: refuse to reschedule to a time in the past.
            if start:
                try:
                    from zoneinfo import ZoneInfo
                    tz_obj = ZoneInfo(orig_tz)
                    naive_str = start.split("+")[0].rstrip("Z")
                    # Interpret the LLM's naive datetime in the event's local timezone
                    candidate = datetime.fromisoformat(naive_str).replace(tzinfo=tz_obj)
                    if candidate < datetime.now(timezone.utc):
                        return (
                            f"Cannot reschedule to {start} ({orig_tz}) because that time is "
                            f"already in the past."
                        )
                except Exception:
                    pass  # If parsing fails, let Google reject it

            if title:
                event["summary"] = title
            if start:
                event["start"] = {"dateTime": start, "timeZone": orig_tz}
            if end:
                event["end"] = {"dateTime": end, "timeZone": orig_tz}
            if description is not None:
                event["description"] = description
            if location is not None:
                event["location"] = location
            if attendees is not None:
                event["attendees"] = [{"email": a} for a in attendees]
            updated = svc.events().update(calendarId=cal_id, eventId=event_id, body=event).execute()
            return {"id": updated["id"], "title": updated.get("summary"), "link": updated.get("htmlLink", "")}
        except Exception as exc:
            logger.error("Calendar update_event error: %s", exc)
            return f"Calendar error: {exc}"

    def delete_event(self, user_id: str, event_id: str) -> "bool | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            cal_id = self._find_calendar_for_event(svc, event_id)
            svc.events().delete(calendarId=cal_id, eventId=event_id).execute()
            return True
        except Exception as exc:
            logger.error("Calendar delete_event error: %s", exc)
            return f"Calendar error: {exc}"
