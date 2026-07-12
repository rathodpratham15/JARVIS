import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { toast } from 'sonner';

// Web Speech API types — not in every TS lib
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { [i: number]: { [j: number]: { transcript: string } } & { length: number } } & { length: number };
}
interface SpeechRecognitionErrorEvent { error: string; }
interface SpeechRec extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
}
type SpeechRecCtor = new () => SpeechRec;

interface UseWakeWordOptions {
  onActivation: () => void;
  enabled?: boolean;
}

function isWakePhrase(transcript: string): boolean {
  const t = transcript.toLowerCase().trim();
  return t.includes('jarvis');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Native Android path (uses @capacitor-community/speech-recognition) ───────

async function runNativeLoop(
  onActivation: () => void,
  runningRef: React.MutableRefObject<boolean>,
  setListening: (v: boolean) => void
) {
  const { speechRecognition } = await SpeechRecognition.requestPermissions();
  if (speechRecognition !== 'granted') { setListening(false); return; }

  setListening(true);

  while (runningRef.current) {
    // Re-register partial results listener each iteration — some Android
    // versions drop the listener after the recognizer session ends.
    await SpeechRecognition.removeAllListeners();
    let activated = false;

    const handle = await SpeechRecognition.addListener(
      'partialResults',
      (data: { matches: string[] }) => {
        if (activated) return;
        const text = (data.matches ?? []).join(' ').toLowerCase();
        if (text.includes('jarvis')) {
          activated = true;
          onActivation();
          SpeechRecognition.stop().catch(() => {});
        }
      }
    );

    try {
      // start() resolves when the recognizer session ends (silence / timeout)
      const result = await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 5,
        partialResults: true,
        popup: false,
      });
      // Also check final matches in case partialResults didn't fire
      if (!activated && result.matches) {
        const text = result.matches.join(' ').toLowerCase();
        // Debug: show what was heard
        if (text.length > 0) toast(`Heard: "${result.matches[0]}"`, { duration: 2000 });
        if (text.includes('jarvis')) {
          activated = true;
          onActivation();
        }
      }
    } catch {
      // recognition ended or errored — loop will restart
    }

    handle.remove();
    if (runningRef.current) await sleep(400);
  }

  await SpeechRecognition.removeAllListeners();
  setListening(false);
}

// ─── Browser path (Web Speech API) ────────────────────────────────────────────

export function useWakeWord({ onActivation, enabled = true }: UseWakeWordOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  // ── Native Android ──────────────────────────────────────────────────────────
  const nativeRunning = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    SpeechRecognition.available().then(({ available }) => {
      if (!available) return;
      setSupported(true);
      if (!enabled) return;

      nativeRunning.current = true;
      runNativeLoop(onActivation, nativeRunning, setListening).catch(() => {
        setListening(false);
      });
    });

    return () => {
      nativeRunning.current = false;
      SpeechRecognition.stop().catch(() => {});
      setListening(false);
    };
  // onActivation intentionally excluded — stable ref assumed at call site
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Web Speech API (browser / PWA) ─────────────────────────────────────────
  const recRef = useRef<SpeechRec | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startWeb = useCallback(() => {
    if (Capacitor.isNativePlatform()) return;

    const w = window as unknown as Record<string, unknown>;
    const Rec = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as SpeechRecCtor | undefined;
    if (!Rec) return;

    setSupported(true);
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      if (enabledRef.current) {
        setTimeout(() => { try { rec.start(); } catch { /* ignore */ } }, 500);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setSupported(false);
    };
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (isWakePhrase(e.results[i][0].transcript)) {
          onActivation();
          rec.stop();
          setTimeout(() => { try { rec.start(); } catch { /* ignore */ } }, 3000);
          return;
        }
      }
    };

    try { rec.start(); } catch { /* already started */ }
  }, [onActivation]);

  const stopWeb = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (enabled) startWeb(); else stopWeb();
    return stopWeb;
  }, [enabled, startWeb, stopWeb]);

  return { listening, supported };
}
