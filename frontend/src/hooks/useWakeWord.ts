import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

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
      if (!activated) {
        const matches = result.matches ?? [];
        if (matches.length > 0) {
          const text = matches.join(' ').toLowerCase();
          if (text.includes('jarvis')) { activated = true; onActivation(); }
        }
      }
    } catch { }

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
  // Chrome requires a user gesture before audio capture works; track whether
  // we've seen one yet so we don't spin trying to start before it's possible.
  const gestureRef = useRef(false);
  const gotResultRef = useRef(false); // whether this session ever produced audio

  const startWebNow = useCallback(() => {
    if (Capacitor.isNativePlatform()) return;
    if (recRef.current) return; // already running

    const w = window as unknown as Record<string, unknown>;
    const Rec = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as SpeechRecCtor | undefined;
    if (!Rec) return;

    setSupported(true);
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onstart = () => { setListening(true); };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      // Only restart if this session produced audio AND no pending restart is scheduled.
      if (enabledRef.current && gestureRef.current && gotResultRef.current) {
        gotResultRef.current = false;
        setTimeout(startWebNow, 1500);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setSupported(false);
      }
      // Silently ignore aborted / no-speech
    };
    rec.onresult = (e) => {
      gotResultRef.current = true;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (isWakePhrase(t)) {
          gotResultRef.current = false; // prevent onend from scheduling another restart
          recRef.current = null;
          rec.stop();
          onActivation();
          setTimeout(startWebNow, 3000);
          return;
        }
      }
    };

    try { rec.start(); } catch { recRef.current = null; }
  }, [onActivation]);

  const stopWeb = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!enabled) { stopWeb(); return; }

    // Start immediately in case gesture already happened (e.g. page navigation)
    startWebNow();

    // Also hook into any user interaction — Chrome needs this for autoplay-style capture
    const onGesture = () => {
      if (!gestureRef.current) {
        gestureRef.current = true;
        startWebNow();
      }
    };
    document.addEventListener('click', onGesture);
    document.addEventListener('keydown', onGesture);
    return () => {
      document.removeEventListener('click', onGesture);
      document.removeEventListener('keydown', onGesture);
      stopWeb();
    };
  }, [enabled, startWebNow, stopWeb]);

  return { listening, supported };
}
