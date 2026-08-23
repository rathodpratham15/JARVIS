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
// After this, speakJarvisText will always use ElevenLabs via AudioContext.
export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
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
  } catch (err) {
    // Ignore audio context errors silently
  }
}

// Active AudioContext source node so we can stop mid-speech
let activeTtsSource: AudioBufferSourceNode | null = null;

// Text-To-Speech: calls /api/tts (macOS say → WAV, or ElevenLabs if configured)
// and plays the returned audio through AudioContext. Falls back to browser
// speechSynthesis if the backend call fails.
export async function speakJarvisText(text: string, onEnd?: () => void): Promise<void> {
  if (typeof window === "undefined") { onEnd?.(); return; }

  // Stop any currently playing TTS
  stopJarvisSpeech();

  const cleanText = text
    .replace(/```[\s\S]*?```/g, "")           // fenced code blocks
    .replace(/\|[^\n]+\|/g, "")               // table rows
    .replace(/^[-:|]+$/gm, "")               // table separators
    .replace(/---+/g, "")                     // horizontal rules
    .replace(/\*\*(.*?)\*\*/g, "$1")          // bold
    .replace(/\*(.*?)\*/g, "$1")              // italic
    .replace(/`(.*?)`/g, "$1")               // inline code
    .replace(/#+\s+/g, "")                   // headers
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")      // links
    .replace(/^\s*[-*+]\s+/gm, "")           // bullet points
    .replace(/^\s*\d+\.\s+/gm, "")           // numbered lists
    .replace(/\n+/g, " ")                     // newlines → spaces
    .replace(/\s{2,}/g, " ")                  // collapse whitespace
    .trim();

  // ── Backend TTS via AudioContext (bypasses Chrome autoplay restrictions) ──
  try {
    const res = await apiFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const ctx = getAudioContext();
    if (!ctx) throw new Error("No AudioContext");
    // Ensure the context is running before decoding/playing
    if (ctx.state === "suspended") await ctx.resume();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(ctx.destination);
    activeTtsSource = source;
    source.onended = () => {
      activeTtsSource = null;
      onEnd?.();
    };
    source.start(0);
    console.log("[JARVIS TTS] backend TTS playing, duration:", audioBuf.duration.toFixed(1) + "s");
    return;
  } catch (err) {
    console.warn("[JARVIS TTS] backend TTS failed, falling back to speechSynthesis:", err);
  }

  // ── Fallback: browser SpeechSynthesis ────────────────────────────────────
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }

  const buildAndSpeak = (voices: SpeechSynthesisVoice[]) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const britishVoice =
      voices.find(
        (v) =>
          v.lang.includes("en-GB") ||
          v.name.toLowerCase().includes("british") ||
          v.name.toLowerCase().includes("daniel") ||
          v.name.toLowerCase().includes("george") ||
          v.name.toLowerCase().includes("male")
      ) || voices.find((v) => v.lang.startsWith("en"));
    if (britishVoice) utterance.voice = britishVoice;
    utterance.pitch = 0.95;
    utterance.rate = 1.05;
    utterance.onend = () => { onEnd?.(); };
    utterance.onerror = () => { onEnd?.(); };
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

export function stopJarvisSpeech() {
  if (activeTtsSource) {
    try { activeTtsSource.stop(); } catch {}
    activeTtsSource = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
