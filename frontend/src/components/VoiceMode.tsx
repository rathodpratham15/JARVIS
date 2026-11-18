import { useCallback, useEffect, useRef, useState } from "react";
import { X, MicOff, Loader2, MessageSquareText, Hand } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { streamChat, transcribe } from "@/lib/api";
import { speak, stopSpeaking } from "@/lib/media";

const BARS = 28;
const LABELS: Record<string, string> = {
  requesting: "Requesting microphone…", listening: "Listening", processing: "Thinking…",
  speaking: "Speaking — tap to interrupt", denied: "Microphone unavailable", error: "Something went wrong",
};

type VoiceState = "requesting" | "listening" | "processing" | "speaking" | "denied" | "error";

function Waveform({ state, level }: { state: VoiceState; level: number }) {
  if (state === "processing") {
    return (
      <div className="relative h-40 w-40 grid place-items-center" data-testid="voice-processing">
        <span className="absolute inset-0 rounded-full bg-j-accent/30 animate-ping" />
        <span className="h-20 w-20 rounded-full bg-j-accent grid place-items-center"><Loader2 className="h-7 w-7 text-black animate-spin" /></span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-[5px] h-40" data-testid="voice-waveform">
      {[...Array(BARS)].map((_, i) => {
        const shape = Math.sin((i / (BARS - 1)) * Math.PI);
        const live = state === "listening" ? 0.12 + Math.min(1, level * 6) * shape * (0.6 + 0.4 * Math.sin(i * 1.7 + level * 40)) : 0.12;
        return (
          <span key={i}
            className={`w-[5px] rounded-full ${state === "speaking" ? "bg-j-accent" : "bg-j-text"}`}
            style={{ height: `${Math.max(6, live * 150)}px`, transition: "height 90ms linear" }} />
        );
      })}
    </div>
  );
}

export default function VoiceMode() {
  const { closeModal, currentConvId, settings, setConversations, bumpRefresh, refreshConversations } = useApp();
  const [state, setState] = useState<VoiceState>("requesting");
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<string | null>(currentConvId);
  const aliveRef = useRef(true);
  const usedRef = useRef(false);

  const respond = async (text: string) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let reply = "";
    await streamChat(
      { conversation_id: convRef.current || null, message: text, personality: settings?.personality || "standard" },
      {
        signal: ctrl.signal,
        onEvent: (ev) => {
          if (ev.type === "meta" && !convRef.current) {
            convRef.current = ev.conversation_id;
            setConversations((l) => [ev.conversation, ...l]);
          }
          if (ev.type === "delta") reply += ev.content;
          if (ev.type === "error") throw new Error(ev.detail);
        },
      },
    ).catch((e: Error) => { if (e.name !== "AbortError") throw e; });
    usedRef.current = true;
    if (!aliveRef.current || ctrl.signal.aborted) return;
    setTranscript((t) => [...t, { role: "assistant", text: reply }]);
    setState("speaking");
    await speak(reply).catch(() => {});
  };

  const listen = useCallback(() => {
    if (!aliveRef.current || !streamRef.current) return;
    setState("listening");
    const rec = new MediaRecorder(streamRef.current);
    const chunks: Blob[] = [];
    const analyser = ctxRef.current!.createAnalyser();
    analyser.fftSize = 1024;
    ctxRef.current!.createMediaStreamSource(streamRef.current).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let spoke = false;
    let lastVoice = performance.now();
    const startedAt = performance.now();
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += ((data[i] - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / data.length);
      setLevel(rms);
      const now = performance.now();
      if (rms > 0.035) { spoke = true; lastVoice = now; }
      if ((spoke && now - lastVoice > 1400) || now - startedAt > 30000) { if (rec.state === "recording") rec.stop(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      cancelAnimationFrame(rafRef.current);
      setLevel(0);
      if (!aliveRef.current) return;
      if (!spoke) return listen();
      setState("processing");
      try {
        const text = await transcribe(new Blob(chunks, { type: rec.mimeType }));
        if (!text) return listen();
        setTranscript((t) => [...t, { role: "user", text }]);
        await respond(text);
        if (aliveRef.current) listen();
      } catch {
        if (aliveRef.current) { setState("error"); setTimeout(listen, 1500); }
      }
    };
    rec.start();
    recRef.current = rec;
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        if (!aliveRef.current) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        ctxRef.current = new AudioContext();
        listen();
      })
      .catch(() => setState("denied"));
    return () => {
      aliveRef.current = false;
      cancelAnimationFrame(rafRef.current);
      abortRef.current?.abort();
      stopSpeaking();
      if (recRef.current?.state === "recording") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close();
    };
  }, [listen]);

  const end = () => {
    closeModal("voice");
    if (usedRef.current) { refreshConversations(); if (convRef.current === currentConvId) bumpRefresh(); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tapOrb = () => {
    if (state === "speaking") { stopSpeaking(); return; }
    if (state === "listening" && recRef.current?.state === "recording") recRef.current.stop();
  };

  return (
    <div className="fixed inset-0 z-50 bg-j-main flex flex-col" data-testid="voice-mode">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => setShowTranscript((s) => !s)} data-testid="voice-transcript-toggle"
          className={`h-10 px-4 rounded-full text-sm flex items-center gap-2 border border-j-border hover:bg-j-hover ${showTranscript ? "bg-j-hover" : ""}`}>
          <MessageSquareText className="h-4 w-4" /> {showTranscript ? "Hide transcript" : "Show transcript"}
        </button>
        <span className="text-sm text-j-muted">Voice mode</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        {state === "denied" ? (
          <div className="text-center max-w-sm" data-testid="voice-denied">
            <div className="h-16 w-16 rounded-full bg-j-surface grid place-items-center mx-auto mb-5"><MicOff className="h-7 w-7 text-j-muted" /></div>
            <p className="font-medium">Microphone access is needed for voice mode</p>
            <p className="text-sm text-j-muted mt-2">Allow microphone access in your browser's site settings, then reopen voice mode.</p>
          </div>
        ) : (
          <button onClick={tapOrb} className="outline-none" data-testid="voice-orb">
            {state === "requesting" ? <Loader2 className="h-8 w-8 animate-spin text-j-muted" /> : <Waveform state={state} level={level} />}
          </button>
        )}
        <p className="mt-8 text-sm text-j-muted h-5" data-testid="voice-state-label">{state !== "denied" && LABELS[state]}</p>
        {state === "listening" && <p className="mt-1 text-xs text-j-muted/70 flex items-center gap-1.5"><Hand className="h-3 w-3" /> Pause to send, or tap the waveform</p>}

        {showTranscript && (
          <div className="mt-8 w-full max-w-[680px] max-h-[35vh] overflow-y-auto scrollbar-thin space-y-3 border-t border-j-border pt-5" data-testid="voice-transcript">
            {!transcript.length && <p className="text-sm text-j-muted text-center">Your conversation will appear here.</p>}
            {transcript.map((t, i) => (
              <div key={i} className={`text-sm ${t.role === "user" ? "text-right" : ""}`}>
                <span className={`inline-block px-3.5 py-2 rounded-2xl ${t.role === "user" ? "bg-j-surface" : ""}`}>{t.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center pb-10">
        <button onClick={end} className="h-14 w-14 rounded-full bg-j-surface hover:bg-red-500 hover:text-white transition-colors grid place-items-center" data-testid="voice-end-button">
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
