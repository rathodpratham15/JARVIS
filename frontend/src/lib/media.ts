import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { stripMarkdown } from "@/lib/format";

export async function resizeImage(file: Blob, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return new Promise((res) => canvas.toBlob(res as BlobCallback, "image/jpeg", 0.88)) as Promise<Blob>;
}

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>, active = true) {
  const [status, setStatus] = useState<"init" | "live" | "denied" | "error" | "unsupported">("init");
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setStatus("init");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("live");
      })
      .catch((e: Error) => !cancelled && setStatus(e?.name === "NotAllowedError" ? "denied" : "error"));
    return () => { cancelled = true; stop(); };
  }, [active, videoRef, stop]);

  const capture = useCallback((): Promise<Blob | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  }, [videoRef]);

  return { status, capture, stop };
}

export function useDictation(
  onText: (t: string) => void,
  onError?: (m: string) => void
) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const recRef = useRef<MediaRecorder | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const { transcribe } = await import("@/lib/api");
          const text = await transcribe(new Blob(chunks, { type: rec.mimeType }));
          if (text) onText(text);
        } catch {
          onError?.("Couldn't transcribe audio. Try again.");
        }
        setState("idle");
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
    } catch {
      onError?.("Microphone access was denied. Allow it in your browser settings.");
    }
  };
  const stop = () => recRef.current?.state === "recording" && recRef.current.stop();
  return { state, start, stop };
}

let currentAudio: { stop(): void } | null = null;

export function stopSpeaking() {
  currentAudio?.stop();
  currentAudio = null;
}

export async function speak(text: string, { onStart }: { onStart?: () => void } = {}): Promise<{ engine?: string; cancelled?: boolean }> {
  stopSpeaking();
  let cancelled = false;
  let audio: HTMLAudioElement | null = null;
  const handle = {
    stop() {
      cancelled = true;
      audio?.pause();
      window.speechSynthesis?.cancel();
    },
  };
  currentAudio = handle;
  try {
    const res = await fetch(`${API}/tts`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("tts unavailable");
    const blob = await res.blob();
    if (cancelled) return { cancelled: true };
    const url = URL.createObjectURL(blob);
    audio = new Audio(url);
    await new Promise<void>((resolve, reject) => {
      audio!.onended = resolve;
      audio!.onpause = resolve;
      audio!.onerror = reject;
      onStart?.();
      audio!.play().catch(reject);
    });
    URL.revokeObjectURL(url);
    return { engine: "elevenlabs" };
  } catch {
    if (cancelled) return { cancelled: true };
    if (!window.speechSynthesis) throw new Error("no speech");
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(stripMarkdown(text).slice(0, 3000));
      u.onend = resolve;
      u.onerror = resolve;
      onStart?.();
      window.speechSynthesis.speak(u);
    });
    return { engine: "browser" };
  } finally {
    if (currentAudio === handle) currentAudio = null;
  }
}
