"""Twilio SMS and WhatsApp messaging service.

Requires three Railway env vars:
    TWILIO_ACCOUNT_SID   — from console.twilio.com
    TWILIO_AUTH_TOKEN    — from console.twilio.com
    TWILIO_SMS_FROM      — your Twilio phone number, e.g. +15017122661
    TWILIO_WHATSAPP_FROM — WhatsApp sender; sandbox default is whatsapp:+14155238886
                           (production: your approved WA business number, e.g. whatsapp:+15017122661)
"""

from __future__ import annotations

import logging
import os

import requests

logger = logging.getLogger(__name__)

_TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


def _credentials() -> tuple[str, str, str, str]:
    sid   = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    sms_from = os.getenv("TWILIO_SMS_FROM", "").strip()
    wa_from  = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886").strip()
    if not sid or not token:
        raise RuntimeError(
            "Twilio not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to Railway env vars."
        )
    return sid, token, sms_from, wa_from


def _send(to: str, from_: str, body: str) -> dict:
    sid, token, _, _ = _credentials()
    url = _TWILIO_API.format(sid=sid)
    resp = requests.post(
        url,
        data={"To": to, "From": from_, "Body": body},
        auth=(sid, token),
        timeout=15,
    )
    data = resp.json()
    if resp.status_code not in (200, 201):
        raise RuntimeError(data.get("message") or f"Twilio error {resp.status_code}")
    logger.info("Twilio message sent to %s (sid=%s)", to, data.get("sid"))
    return data


def send_sms(to: str, message: str) -> str:
    """Send an SMS. `to` must be E.164 format e.g. +14155552671."""
    _, _, sms_from, _ = _credentials()
    if not sms_from:
        raise RuntimeError(
            "TWILIO_SMS_FROM not set. Add your Twilio phone number to Railway env vars."
        )
    to = to.strip()
    if not to.startswith("+"):
        to = "+" + to
    data = _send(to=to, from_=sms_from, body=message)
    return f"SMS sent to {to} (message SID: {data.get('sid', '?')})"


def send_whatsapp(to: str, message: str) -> str:
    """Send a WhatsApp message via Twilio sandbox or production sender."""
    _, _, _, wa_from = _credentials()
    to = to.strip()
    if not to.startswith("+"):
        to = "+" + to
    wa_to = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to
    data = _send(to=wa_to, from_=wa_from, body=message)
    return f"WhatsApp message sent to {to} (message SID: {data.get('sid', '?')})"
