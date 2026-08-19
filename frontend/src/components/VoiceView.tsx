import React, { useState, useEffect, useRef, useCallback } from "react";
import { Aperture, Volume2, Radio, Play, RefreshCw } from "lucide-react";
import { speakJarvisText, playUiSound } from "../utils/audio";

interface VoiceViewProps {
  onProcessVoiceCommand: (transcript: string) => Promise<string>;
  wakeWord?: string;
  accentColor?: string;
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export const VoiceView: React.FC<VoiceViewProps> = ({
  onProcessVoiceCommand,
  wakeWord = "Hey Jarvis",
  accentColor = "cyan",
}) => {
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [transcript, setTranscript] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [wakeActive, setWakeActive] = useState(true);
  const [voiceHistory, setVoiceHistory] = useState<
    { id: string; time: string; input: string; reply: string }[]
  >([]);

  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const wakeActiveRef = useRef(wakeActive);
  wakeActiveRef.current = wakeActive;
  const commandInProgressRef = useRef(false);
  const onProcessVoiceCommandRef = useRef(onProcessVoiceCommand);
  onProcessVoiceCommandRef.current = onProcessVoiceCommand;

  const wakeRecognitionRef = useRef<any>(null);
  const commandRecognitionRef = useRef<any>(null);
  const startWakeListenerRef = useRef<(() => void) | null>(null);

  const wakeWordLower = wakeWord.toLowerCase();

  // ── process query ──────────────────────────────────────────────────────────
  const processQuery = useCallback(async (queryText: string) => {
    setVoiceState("thinking");
    playUiSound("scan");
    const restoreWake = () => {
      commandInProgressRef.current = false;
      if (wakeActiveRef.current) startWakeListenerRef.current?.();
    };
    try {
      const reply = await onProcessVoiceCommandRef.current(queryText);
      setAiReply(reply);
      setVoiceState("speaking");
      playUiSound("success");
      setVoiceHistory(prev => [{
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        input: queryText,
        reply,
      }, ...prev]);
      speakJarvisText(reply, () => { setVoiceState("idle"); restoreWake(); });
    } catch {
      setVoiceState("idle");
      restoreWake();
    }
  }, []); // stable — uses refs for all external deps

  // ── command recognition (one-shot after wake word) ─────────────────────────
  const startCommandListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    const rec = new SpeechRecognitionAPI();
    commandRecognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    let finalText = "";
    let lastInterim = "";

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (interim) lastInterim = interim;
      setTranscript(finalText || interim);
    };

    rec.onend = () => {
      const query = (finalText || lastInterim).trim();
      if (query) {
        processQuery(query);
      } else {
        commandInProgressRef.current = false;
        setVoiceState("idle");
        if (wakeActiveRef.current) startWakeListenerRef.current?.();
      }
    };

    rec.onerror = () => {
      commandInProgressRef.current = false;
      setVoiceState("idle");
      if (wakeActiveRef.current) startWakeListenerRef.current?.();
    };
    rec.start();
  }, [processQuery]);

  // ── wake word listener (always-on background recognition) ─────────────────
  const startWakeListener = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    const rec = new SpeechRecognitionAPI();
    wakeRecognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    let permissionDenied = false;

    rec.onresult = (e: any) => {
      if (voiceStateRef.current !== "idle") return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        // Normalize: lowercase + strip punctuation so "Hey, Jarvis" matches "hey jarvis"
        const t = e.results[i][0].transcript.toLowerCase().replace(/[^\w\s]/g, "");
        if (t.includes(wakeWordLower)) {
          commandInProgressRef.current = true;
          rec.stop();
          playUiSound("beep");
          setTranscript("");
          setAiReply("");
          setVoiceState("listening");
          startCommandListening();
          return;
        }
      }
    };

    // Only restart when NOT mid-command (Chrome runs one recognition at a time)
    rec.onend = () => {
      if (!permissionDenied && wakeActiveRef.current && !commandInProgressRef.current) {
        try { rec.start(); } catch {}
      }
    };

    rec.onerror = (e: any) => {
      console.warn("[JARVIS wake] SpeechRecognition error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Mic permission denied — can't recover; user must grant permission
        permissionDenied = true;
        console.error("[JARVIS wake] Microphone permission denied. Grant mic access and reload.");
        return;
      }
      if (wakeActiveRef.current && !commandInProgressRef.current) {
        try { rec.start(); } catch {}
      }
    };

    try { rec.start(); } catch {}
  }, [wakeWordLower, startCommandListening]);

  // Keep ref current so processQuery can call it without circular deps
  useEffect(() => { startWakeListenerRef.current = startWakeListener; }, [startWakeListener]);

  // ── toggle wake word listener ──────────────────────────────────────────────
  useEffect(() => {
    if (wakeActive) {
      startWakeListener();
    } else {
      wakeRecognitionRef.current?.stop();
    }
    return () => { wakeRecognitionRef.current?.stop(); };
  }, [wakeActive, startWakeListener]);

  // ── tap orb handler ────────────────────────────────────────────────────────
  const handleOrbClick = () => {
    if (voiceState === "listening") {
      commandRecognitionRef.current?.stop();
      setVoiceState("idle");
      return;
    }
    if (voiceState !== "idle") return;

    playUiSound("beep");
    setTranscript("");
    setAiReply("");
    setVoiceState("listening");
    if (SpeechRecognitionAPI) {
      startCommandListening();
    } else {
      simulateVoiceInput();
    }
  };

  const simulateVoiceInput = () => {
    const samples = [
      "What's the weather like today?",
      "Summarize my notes from this week.",
      "Search for the latest AI news and save a summary.",
      "Set a reminder for my meeting at 3pm.",
    ];
    const query = samples[Math.floor(Math.random() * samples.length)];
    let i = 0;
    setTranscript("");
    const iv = setInterval(() => {
      setTranscript(query.slice(0, i + 1));
      i++;
      if (i >= query.length) { clearInterval(iv); setTimeout(() => processQuery(query), 800); }
    }, 40);
  };

  const stateColor = {
    idle: "bg-[#EBEBEA] hover:bg-[#00E5FF]",
    listening: "bg-[#00E5FF] scale-110",
    thinking: "bg-amber-300 scale-105",
    speaking: "bg-emerald-400 scale-105",
  }[voiceState];

  const ringColor = {
    idle: "",
    listening: "#00E5FF",
    thinking: "#fbbf24",
    speaking: "#34d399",
  }[voiceState];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-mono text-black">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border-2 border-black shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00e5ff] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-black tracking-wide">
              HANDS-FREE VOICE MATRIX
            </h2>
            <p className="text-xs font-mono font-bold text-black/70">
              Wake word:{" "}
              <strong className="text-black bg-[#00e5ff] px-1 py-0.5 border border-black">
                "{wakeWord}"
              </strong>{" "}
              • Low-latency audio pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Wake word toggle */}
          <button
            onClick={() => setWakeActive(v => !v)}
            className={`text-[10px] font-mono font-black px-3 py-1.5 border-2 border-black transition ${
              wakeActive ? "bg-[#00E5FF] text-black" : "bg-[#EBEBEA] text-black/60"
            }`}
          >
            {wakeActive ? "WAKE WORD: ON" : "WAKE WORD: OFF"}
          </button>
          <span className="text-xs font-mono font-black px-3 py-1 bg-[#f3f3ee] border-2 border-black text-black">
            STATUS: <strong className="uppercase underline">{voiceState}</strong>
          </span>
        </div>
      </div>

      {/* Orb Hub */}
      <div className="relative flex flex-col items-center justify-center p-8 sm:p-12 bg-white border-2 border-black shadow-[6px_6px_0px_#000000] space-y-6">
        {/* Arc Orb */}
        <div className="relative flex items-center justify-center w-48 h-48">
          {voiceState !== "idle" && (
            <>
              <span className="absolute inline-flex w-full h-full rounded-full opacity-30 animate-ping"
                style={{ backgroundColor: ringColor }} />
              <span className="absolute inline-flex w-3/4 h-3/4 rounded-full opacity-20 animate-ping [animation-delay:150ms]"
                style={{ backgroundColor: ringColor }} />
            </>
          )}
          <button
            onClick={handleOrbClick}
            className={`group relative z-10 w-36 h-36 rounded-full border-4 border-[#1a1a1a] flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.18)] transition-all duration-300 ${stateColor}`}
          >
            {voiceState === "idle"      && <Aperture  className="w-12 h-12 text-[#1a1a1a] group-hover:scale-110 transition" />}
            {voiceState === "listening" && <Radio     className="w-12 h-12 text-[#1a1a1a] animate-pulse" />}
            {voiceState === "thinking"  && <RefreshCw className="w-12 h-12 text-[#1a1a1a] animate-spin" />}
            {voiceState === "speaking"  && <Volume2   className="w-12 h-12 text-[#1a1a1a] animate-bounce" />}
          </button>
        </div>

        {/* Waveform */}
        <div className="flex items-center gap-1.5 h-12">
          {[40, 70, 25, 90, 60, 100, 45, 80, 30, 95, 50, 85, 40, 75].map((h, i) => (
            <div
              key={i}
              className={`w-2 border-2 border-black transition-all duration-150 ${
                voiceState === "listening" ? "bg-[#00e5ff] animate-pulse"
                : voiceState === "thinking" ? "bg-amber-400 animate-pulse"
                : voiceState === "speaking" ? "bg-emerald-400 animate-pulse"
                : "bg-black/20"
              }`}
              style={{
                height: voiceState === "idle" ? "10px" : `${Math.max(12, h * (i % 2 === 0 ? 1 : 0.6))}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        {/* Prompt */}
        <p className="text-sm font-mono font-black text-black text-center">
          {voiceState === "idle"      && `Tap the orb or say "${wakeWord}" to initiate speech`}
          {voiceState === "listening" && "Listening… speak your command now, Sir"}
          {voiceState === "thinking"  && "J.A.R.V.I.S. processing voice acoustics & intent…"}
          {voiceState === "speaking"  && "J.A.R.V.I.S. replying verbally…"}
        </p>

        {/* Transcript / reply box */}
        {(transcript || aiReply) && (
          <div className="w-full max-w-2xl p-4 bg-[#f3f3ee] border-2 border-black text-xs sm:text-sm font-mono space-y-2 text-left shadow-[3px_3px_0px_#000000]">
            {transcript && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-black text-black">SPOKEN TRANSCRIPT:</span>
                <p className="text-black font-bold">{transcript}</p>
              </div>
            )}
            {aiReply && (
              <div className="space-y-0.5 pt-2 border-t-2 border-black">
                <span className="text-[10px] font-mono font-black text-[#00a8bb]">J.A.R.V.I.S. VERBAL RESPONSE:</span>
                <p className="text-black font-bold">{aiReply}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice History */}
      <div className="p-5 bg-white border-2 border-black space-y-4 shadow-[4px_4px_0px_#000000]">
        <h3 className="text-xs font-heading font-black uppercase tracking-widest text-black">
          RECENT VOICE INTERACTIONS
        </h3>
        <div className="space-y-3">
          {voiceHistory.length === 0 && (
            <p className="text-xs font-mono text-black/40">No interactions yet.</p>
          )}
          {voiceHistory.map((item) => (
            <div key={item.id} className="p-3 bg-[#f3f3ee] border-2 border-black shadow-[2px_2px_0px_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-black/60">{item.time}</span>
                  <span className="font-black text-black font-mono">User: "{item.input}"</span>
                </div>
                <p className="text-black/80 font-mono text-xs">{item.reply}</p>
              </div>
              <button
                onClick={() => speakJarvisText(item.reply)}
                className="self-start sm:self-center px-2.5 py-1 bg-white hover:bg-slate-50 border-2 border-black text-black font-mono font-bold text-[11px] flex items-center gap-1 shadow-[2px_2px_0px_#000000] transition"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>REPLAY</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
