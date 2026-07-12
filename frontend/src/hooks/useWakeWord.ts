/**
 * Wake-word listener — continuously listens for "jarvis" (or "hey jarvis" /
 * "hi jarvis") using the Web Speech API and calls `onActivation` when heard.
 *
 * The hook does nothing on browsers that don't support SpeechRecognition
 * (Firefox desktop) or when the user denies microphone access.
 *
 * Usage:
 *   useWakeWord({ onActivation: () => navigate('/chat') })
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

// Web Speech API types not in every TS lib — declare minimally
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { [i: number]: { [j: number]: { transcript: string } } & { length: number } } & { length: number };
}
interface SpeechRecognitionErrorEvent { error: string; }
interface SpeechRec extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
}
type SpeechRecCtor = new () => SpeechRec;

interface UseWakeWordOptions {
  onActivation: () => void;
  enabled?: boolean;
}

export function useWakeWord({ onActivation, enabled = true }: UseWakeWordOptions) {
  // Android WebView doesn't ship the Chrome speech service — skip entirely on native
  // to prevent a crash when the permission dialog resolves.
  if (Capacitor.isNativePlatform()) {
    return { listening: false, supported: false };
  }

  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const isWakePhrase = (transcript: string): boolean => {
    const t = transcript.toLowerCase().trim();
    return (
      t.includes('jarvis') ||
      t.includes('hey jarvis') ||
      t.includes('hi jarvis') ||
      t.includes('ok jarvis')
    );
  };

  const start = useCallback(() => {
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setSupported(false);
      }
    };
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (isWakePhrase(transcript)) {
          onActivation();
          rec.stop();
          setTimeout(() => { try { rec.start(); } catch { /* ignore */ } }, 3000);
          return;
        }
      }
    };

    try {
      rec.start();
    } catch { /* already started */ }
  }, [onActivation]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [enabled, start, stop]);

  return { listening, supported };
}
