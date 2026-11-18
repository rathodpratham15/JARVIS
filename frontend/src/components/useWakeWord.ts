import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export const wakeWordSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export function useWakeWord() {
  const { settings, modal, openModal } = useApp();
  const recRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const enabled = settings?.wake_word_enabled && !modal.voice && wakeWordSupported();
  const phrase = (settings?.wake_word || "Hey Jarvis").toLowerCase().replace(/[^a-z ]/g, "");

  useEffect(() => {
    if (!enabled) return undefined;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return undefined;
    const rec = new SR();
    let alive = true;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join(" ").toLowerCase().replace(/[^a-z ]/g, "");
      if (said.includes(phrase)) {
        alive = false;
        rec.stop();
        openModal("voice");
      }
    };
    rec.onend = () => alive && setTimeout(() => { try { rec.start(); } catch { /* already started */ } }, 400);
    try { rec.start(); } catch { /* ignore */ }
    recRef.current = rec;
    return () => { alive = false; rec.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phrase]);
}
