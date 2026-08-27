# Google Play Store Submission Guide

> Read this when ready to publish. APK is at `~/Downloads/app-release.apk` (5.6 MB, built Aug 23 2026).

---

## Pre-requisites

- [ ] Google Play Developer account ($25 one-time fee at play.google.com/console)
- [ ] Signed release APK — already built: `~/Downloads/app-release.apk`
- [ ] Privacy policy URL — live at `https://rathodpratham15.github.io/JARVIS/privacy-policy` (enable GitHub Pages first — see bottom of this doc)
- [ ] Visual assets (see Step 3)

---

## Step 1 — Create Developer Account

1. Go to [play.google.com/console](https://play.google.com/console)
2. Sign in with a Google account
3. Pay the **$25 one-time registration fee**
4. Fill in developer name: `Pratham Rathod`
5. Wait up to 48 hours for approval (you can start the listing immediately)

---

## Step 2 — Create the App Listing

In the console: **All apps → Create app**

| Field | Value |
|---|---|
| App name | `JARVIS – AI Assistant` |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |

### Store Listing — Short Description (80 chars max)
```
Your personal AI OS — voice, vision, agents & research in one app.
```

### Store Listing — Full Description
```
JARVIS is a production-grade personal AI operating system built from scratch.
It's not a chatbot wrapper — it's a full AI stack that handles your calendar,
inbox, research, computer control, and more through natural conversation.

KEY CAPABILITIES

🎙 Voice Mode
Talk to JARVIS hands-free. Wake word detection, real-time speech recognition,
and natural TTS responses — a true voice-first interface.

👁 Vision & OSINT
Point your camera at anyone and JARVIS runs face recognition, reverse image
search, and a full intelligence dossier using live web sources.

🤖 Autonomous Agents
JARVIS can plan and execute multi-step tasks — searching the web, running code,
browsing pages, and reporting results back to you.

🔍 Deep Research
Ask JARVIS to research a person, company, or topic and receive a structured
dossier with verified sources, summaries, and key facts.

💻 Computer Use
JARVIS can control your desktop — open apps, fill forms, navigate browsers —
all through natural language.

BUILT FOR POWER USERS
No fluff, no filler. JARVIS is designed for people who want an AI that
actually does things, not just answers questions.

Requires a backend connection (self-hosted or Railway deployment).
```

### Category & Tags
- **Category:** Productivity
- **Tags:** AI assistant, voice assistant, AI agent, personal AI, productivity

---

## Step 3 — Visual Assets to Prepare

| Asset | Size | Notes |
|---|---|---|
| App icon | 512 × 512 px PNG | No alpha — J.A.R.V.I.S. logo on `#0d0f12` dark bg |
| Feature graphic | 1024 × 500 px PNG | "J.A.R.V.I.S." + "Personal AI Operating System" on dark bg |
| Phone screenshots | Min 2, 16:9 or 9:16 | Grab: Chat page, Dashboard, Voice mode, Vision scan |
| Tablet screenshot (optional) | 16:9 | Same views on wider layout |

**Tip:** Use the app running locally on an Android emulator or device, navigate to each view, take screenshots.

---

## Step 4 — Verify the APK Signing

Run this before uploading to catch any signing issues:

```bash
keytool -printcert -jarfile ~/Downloads/app-release.apk
```

You should see a certificate with your keystore details. If it says "unsigned" or errors out, the APK needs to be re-signed with the release keystore.

---

## Step 5 — Upload the APK

1. In the console: **Release → Production → Create new release**
2. Click **Upload** → drag `app-release.apk`
3. Add release notes:
   ```
   Initial release of JARVIS – AI Assistant.
   Voice, vision, agents, research, and computer control in one app.
   ```

**Note:** Google may prompt you to upgrade to an AAB (Android App Bundle) instead of APK. AABs are smaller for users but require generating one from the Android project. The APK works fine for initial submission.

---

## Step 6 — Content Rating

Fill out the IARC questionnaire (under **Policy → App content → Content rating**):
- No violence, user-generated public content, location sharing, or mature themes → should receive **Everyone** or **Everyone 10+**

---

## Step 7 — Required Policy Links

Under **Policy → App content**:
- **Privacy policy URL:** `https://rathodpratham15.github.io/JARVIS/privacy-policy`
- **Data safety:** Declare that you collect email (for auth) and camera/mic (for vision/voice, on-device session only)

---

## Step 8 — Review & Submit

1. Fix any red warnings in the console sidebar
2. Click **Send for review**
3. Initial review typically takes **2–7 business days**

---

## Enable GitHub Pages (for privacy policy URL)

1. Go to github.com/rathodpratham15/JARVIS → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder: `/docs`
4. Save — privacy policy will be live at:
   `https://rathodpratham15.github.io/JARVIS/privacy-policy`

---

## Re-building a signed APK (if needed)

The Android project is in `frontend/android/`. To build a new signed release:

```bash
cd frontend
npx cap sync android
cd android
./gradlew assembleRelease
# Then sign with your keystore:
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore your-release-key.jks \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  your-key-alias
# Zipalign:
zipalign -v 4 app-release-unsigned.apk app-release.apk
```
