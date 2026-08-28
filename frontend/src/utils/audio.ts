// Web Speech API and Web Audio API helper for J.A.R.V.I.S audio feedback

import { apiFetch } from "./api";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Call once inside a user-gesture handler to satisfy Chrome's autoplay policy.
export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// Whether to attempt the backend /api/tts call (ElevenLabs).
// Set to true only when the backend has ELEVENLABS_API_KEY configured.
// App.tsx calls setTtsBackendEnabled() after fetching auth config.
let _backendTtsEnabled = false;

export function setTtsBackendEnabled(enabled: boolean): void {
  _backendTtsEnabled = enabled;
}

// Play futuristic UI beep sound effect
export function playUiSound(type: "beep" | "success" | "alert" | "scan" | "power") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "beep") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "alert") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "scan") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.linearRampToValueAtTime(2400, now + 0.15);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "power") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Ignore audio context errors silently
  }
}

// Active AudioContext source node so we can stop mid-speech
let activeTtsSource: AudioBufferSourceNode | null = null;

// Pick the best available native voice for speechSynthesis.
// Priority: local service voices (Siri on iOS/macOS, Google TTS on Android)
// with English language, preferring a natural-sounding male voice.
function pickNativeVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter(v => v.lang.startsWith("en"));
  if (en.length === 0) return voices[0] ?? null;

  // Local service = the OS's own TTS engine (Siri on Apple, Google TTS on Android)
  const local = en.filter(v => v.localService);
  const pool = local.length > 0 ? local : en;

  // Prefer specific high-quality named voices
  const preferredNames = ["daniel", "oliver", "arthur", "rishi", "siri", "google uk english male", "google us english"];
  for (const name of preferredNames) {
    const match = pool.find(v => v.name.toLowerCase().includes(name));
    if (match) return match;
  }
  return pool[0] ?? en[0];
}

function speakNative(text: string, onEnd?: () => void): void {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }

  const buildAndSpeak = (voices: SpeechSynthesisVoice[]) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickNativeVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.pitch = 0.95;
    utterance.rate = 1.05;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    buildAndSpeak(voices);
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      buildAndSpeak(window.speechSynthesis.getVoices());
    };
  }
}

// Strips markdown formatting so the TTS engine speaks clean text.
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/^[-:|]+$/gm, "")
    .replace(/---+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#+\s+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Text-To-Speech entry point.
// Uses ElevenLabs via backend only when ELEVENLABS_API_KEY is configured
// (signalled by setTtsBackendEnabled(true) at app startup).
// Otherwise uses the device's native voice engine (Siri on iOS/macOS,
// Google TTS on Android, Microsoft voices on Windows) via speechSynthesis.
export async function speakJarvisText(text: string, onEnd?: () => void): Promise<void> {
  if (typeof window === "undefined") { onEnd?.(); return; }

  stopJarvisSpeech();
  const cleanText = stripMarkdown(text);

  // ── ElevenLabs via backend (only when configured) ─────────────────────────
  if (_backendTtsEnabled) {
    try {
      const res = await apiFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const ctx = getAudioContext();
      if (!ctx) throw new Error("No AudioContext");
      if (ctx.state === "suspended") await ctx.resume();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(ctx.destination);
      activeTtsSource = source;
      source.onended = () => { activeTtsSource = null; onEnd?.(); };
      source.start(0);
      return;
    } catch {
      // ElevenLabs failed — fall through to native
    }
  }

  // ── Native OS voice (Siri / Google TTS / Microsoft) ─────────────────────
  speakNative(cleanText, onEnd);
}

export function stopJarvisSpeech() {
  if (activeTtsSource) {
    try { activeTtsSource.stop(); } catch {}
    activeTtsSource = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
