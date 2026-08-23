"""Gmail service — list, read, send messages."""
from __future__ import annotations
import base64, logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .token_store import GoogleTokenStore

logger = logging.getLogger(__name__)

NOT_CONNECTED = "Gmail is not connected. Please connect your Google account in Settings."


class GmailService:
    def __init__(self, token_store: "GoogleTokenStore", client_id: str, client_secret: str) -> None:
        self._store = token_store
        self._client_id = client_id
        self._client_secret = client_secret

    def _build(self, user_id: str):
        from googleapiclient.discovery import build
        creds = self._store.get_credentials(user_id, self._client_id, self._client_secret)
        if creds is None:
            return None
        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    def list_messages(self, user_id: str, query: str = "", max_results: int = 10) -> "list[dict] | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            resp = svc.users().messages().list(
                userId="me", q=query or "in:inbox", maxResults=max_results
            ).execute()
            messages = resp.get("messages", [])
            results = []
            for m in messages:
                msg = svc.users().messages().get(
                    userId="me", id=m["id"], format="metadata",
                    metadataHeaders=["Subject", "From", "Date"]
                ).execute()
                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                results.append({
                    "id": msg["id"],
                    "subject": headers.get("Subject", "(no subject)"),
                    "from": headers.get("From", ""),
                    "date": headers.get("Date", ""),
                    "snippet": msg.get("snippet", ""),
                })
            return results
        except Exception as exc:
            logger.error("Gmail list_messages error: %s", exc)
            return f"Gmail error: {exc}"

    def get_message(self, user_id: str, message_id: str) -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            msg = svc.users().messages().get(userId="me", id=message_id, format="full").execute()
            payload = msg.get("payload", {})
            headers = {h["name"]: h["value"] for h in payload.get("headers", [])}

            def _extract_body(part):
                if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                    return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                for p in part.get("parts", []):
                    result = _extract_body(p)
                    if result:
                        return result
                return ""

            return {
                "id": msg["id"],
                "subject": headers.get("Subject", "(no subject)"),
                "from": headers.get("From", ""),
                "to": headers.get("To", ""),
                "date": headers.get("Date", ""),
                "body": _extract_body(payload),
                "snippet": msg.get("snippet", ""),
            }
        except Exception as exc:
            logger.error("Gmail get_message error: %s", exc)
            return f"Gmail error: {exc}"

    def send_message(self, user_id: str, to: str, subject: str, body: str) -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            msg = MIMEMultipart()
            msg["to"] = to
            msg["subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            sent = svc.users().messages().send(userId="me", body={"raw": raw}).execute()
            return {"id": sent["id"], "status": "sent"}
        except Exception as exc:
            logger.error("Gmail send error: %s", exc)
            return f"Gmail send error: {exc}"

    def search_messages(self, user_id: str, query: str, max_results: int = 20) -> "list[dict] | str":
        return self.list_messages(user_id, query=query, max_results=max_results)
