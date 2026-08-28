"""Push notification service — FCM (native mobile) + Web Push (browser/PWA).

Required env vars (set on Railway):
  FCM_SERVICE_ACCOUNT_JSON  — Firebase service account JSON as a single-line string.
                              Leave unset to disable FCM; web push still works.
  VAPID_PRIVATE_KEY         — VAPID EC private key (base64url, generate with pywebpush)
  VAPID_PUBLIC_KEY          — VAPID EC public key (base64url)
  VAPID_CLAIMS_EMAIL        — Contact email, e.g. mailto:you@example.com

Generate VAPID keys (one-time):
  pip install pywebpush
  python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_key,v.public_key)"
"""

from __future__ import annotations

import json
import logging
import os
from typing import TYPE_CHECKING, Optional

import requests

if TYPE_CHECKING:
    from jarvis.core.push_store import PushTokenStore

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, token_store: "PushTokenStore") -> None:
        self._store = token_store
        self._fcm_project_id: Optional[str] = None
        self._vapid_private = os.getenv("VAPID_PRIVATE_KEY", "")
        self._vapid_public = os.getenv("VAPID_PUBLIC_KEY", "")
        self._vapid_email = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@example.com")

        sa_json = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "")
        if sa_json:
            try:
                sa = json.loads(sa_json)
                self._fcm_project_id = sa.get("project_id")
                self._fcm_sa = sa
                logger.info("FCM configured for project %s", self._fcm_project_id)
            except Exception:
                logger.warning("FCM_SERVICE_ACCOUNT_JSON is invalid JSON — FCM disabled")
                self._fcm_sa = None
        else:
            self._fcm_sa = None
            logger.info("FCM_SERVICE_ACCOUNT_JSON not set — FCM push disabled")

        if not self._vapid_private:
            logger.info("VAPID_PRIVATE_KEY not set — web push disabled")

    def _get_fcm_token(self) -> Optional[str]:
        if not self._fcm_sa:
            return None
        try:
            from google.oauth2 import service_account
            import google.auth.transport.requests as google_requests
            creds = service_account.Credentials.from_service_account_info(
                self._fcm_sa,
                scopes=["https://www.googleapis.com/auth/firebase.messaging"],
            )
            creds.refresh(google_requests.Request())
            return creds.token
        except Exception as e:
            logger.error("Failed to get FCM access token: %s", e)
            return None

    def send_fcm(self, token: str, title: str, body: str, data: Optional[dict] = None) -> bool:
        if not self._fcm_project_id:
            return False
        access_token = self._get_fcm_token()
        if not access_token:
            return False
        url = f"https://fcm.googleapis.com/v1/projects/{self._fcm_project_id}/messages:send"
        payload = {
            "message": {
                "token": token,
                "notification": {"title": title, "body": body},
                "data": {k: str(v) for k, v in (data or {}).items()},
            }
        }
        try:
            resp = requests.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return True
            logger.warning("FCM send failed %d: %s", resp.status_code, resp.text[:200])
            return False
        except Exception as e:
            logger.error("FCM send error: %s", e)
            return False

    def send_web_push(self, subscription_json: str, title: str, body: str, data: Optional[dict] = None) -> bool:
        if not self._vapid_private:
            return False
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            logger.warning("pywebpush not installed — web push skipped (pip install pywebpush)")
            return False
        try:
            subscription = json.loads(subscription_json)
            payload = json.dumps({"title": title, "body": body, "data": data or {}})
            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=self._vapid_private,
                vapid_claims={"sub": self._vapid_email},
            )
            return True
        except Exception as e:
            logger.warning("Web push send error: %s", e)
            return False

    def notify_user(self, user_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
        tokens = self._store.get_tokens_for_user(user_id)
        if not tokens:
            return
        for t in tokens:
            try:
                if t["platform"] == "fcm":
                    self.send_fcm(t["token"], title, body, data)
                elif t["platform"] == "webpush" and t.get("subscription"):
                    self.send_web_push(t["subscription"], title, body, data)
            except Exception as e:
                logger.error("notify_user error for token %s: %s", t["token"][:16], e)
