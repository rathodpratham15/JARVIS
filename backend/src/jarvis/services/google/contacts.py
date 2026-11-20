from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .token_store import GoogleTokenStore

logger = logging.getLogger(__name__)


class ContactsService:
    def __init__(self, token_store: "GoogleTokenStore", client_id: str, client_secret: str) -> None:
        self.token_store = token_store
        self._client_id = client_id
        self._client_secret = client_secret

    def search_contacts(self, user_id: str, query: str, max_results: int = 10) -> list[dict]:
        creds = self.token_store.get_credentials(user_id, self._client_id, self._client_secret)
        if creds is None:
            return []
        try:
            from googleapiclient.discovery import build
            svc = build("people", "v1", credentials=creds)
            results = svc.people().searchContacts(
                query=query,
                pageSize=max_results,
                readMask="names,emailAddresses,phoneNumbers",
            ).execute()
            contacts = []
            for r in results.get("results", []):
                p = r.get("person", {})
                name = (p.get("names") or [{}])[0].get("displayName", "")
                email = (p.get("emailAddresses") or [{}])[0].get("value", "")
                phone = (p.get("phoneNumbers") or [{}])[0].get("value", "")
                contacts.append({"name": name, "email": email, "phone": phone})
            return contacts
        except Exception as exc:
            logger.warning("ContactsService.search_contacts failed: %s", exc)
            return []

    def list_contacts(self, user_id: str, max_results: int = 20) -> list[dict]:
        creds = self.token_store.get_credentials(user_id, self._client_id, self._client_secret)
        if creds is None:
            return []
        try:
            from googleapiclient.discovery import build
            svc = build("people", "v1", credentials=creds)
            results = svc.people().connections().list(
                resourceName="people/me",
                pageSize=max_results,
                personFields="names,emailAddresses,phoneNumbers",
            ).execute()
            contacts = []
            for p in results.get("connections", []):
                name = (p.get("names") or [{}])[0].get("displayName", "")
                email = (p.get("emailAddresses") or [{}])[0].get("value", "")
                phone = (p.get("phoneNumbers") or [{}])[0].get("value", "")
                contacts.append({"name": name, "email": email, "phone": phone})
            return contacts
        except Exception as exc:
            logger.warning("ContactsService.list_contacts failed: %s", exc)
            return []
