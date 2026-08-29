import { useEffect, useRef, useCallback } from "react";

const ACCESS_KEY = import.meta.env.VITE_PICOVOICE_ACCESS_KEY as string | undefined;

interface UseWakeWordOptions {
  enabled: boolean;
  onDetected: () => void;
}

export function useWakeWord({ enabled, onDetected }: UseWakeWordOptions) {
  const workerRef = useRef<any>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const start = useCallback(async () => {
    if (!ACCESS_KEY || workerRef.current) return;

    try {
      const { PorcupineWorker, BuiltInKeyword } = await import(
        "@picovoice/porcupine-web"
      );
      const { WebVoiceProcessor } = await import(
        "@picovoice/web-voice-processor"
      );

      const worker = await PorcupineWorker.create(
        ACCESS_KEY,
        [BuiltInKeyword.Jarvis],
        () => onDetectedRef.current(),
        { publicPath: "/porcupine_params.pv", forceWrite: false }
      );

      workerRef.current = worker;
      await WebVoiceProcessor.subscribe(worker);
    } catch (err) {
      console.warn("[useWakeWord] Porcupine init failed:", err);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!workerRef.current) return;
    try {
      const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");
      await WebVoiceProcessor.unsubscribe(workerRef.current);
      await workerRef.current.release();
      workerRef.current = null;
    } catch (err) {
      console.warn("[useWakeWord] Porcupine release failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!ACCESS_KEY) return;

    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => { stop(); };
  }, [enabled, start, stop]);

  // true = Porcupine is driving wake word; false = fallback to SpeechRecognition
  return { porcupineActive: !!ACCESS_KEY };
}
