import React, { useState, useEffect, useRef, useCallback } from "react";
import { Aperture, Volume2, Radio, Play, RefreshCw } from "lucide-react";
import { speakJarvisText, stopJarvisSpeech, playUiSound } from "../utils/audio";

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
  const queryIdRef = useRef(0);
  const onProcessVoiceCommandRef = useRef(onProcessVoiceCommand);
  onProcessVoiceCommandRef.current = onProcessVoiceCommand;

  const wakeRecognitionRef = useRef<any>(null);
  const commandRecognitionRef = useRef<any>(null);
  const startWakeListenerRef = useRef<(() => void) | null>(null);

  const wakeWordLower = wakeWord.toLowerCase();

  const processQuery = useCallback(async (queryText: string) => {
    const queryId = ++queryIdRef.current;
    const isCurrent = () => queryIdRef.current === queryId;

    setVoiceState("thinking");
    playUiSound("scan");

    commandInProgressRef.current = false;
    if (wakeActiveRef.current && !wakeRecognitionRef.current) {
      startWakeListenerRef.current?.();
    }

    const ensureWake = () => {
      if (wakeActiveRef.current && !wakeRecognitionRef.current) {
        startWakeListenerRef.current?.();
      }
    };

    try {
      const reply = await onProcessVoiceCommandRef.current(queryText);
      if (!isCurrent()) return;
      setAiReply(reply);
      setVoiceState("speaking");
      playUiSound("success");
      setVoiceHistory(prev => [{
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        input: queryText,
        reply,
      }, ...prev]);
      const MAX_SPEAK_CHARS = 300;
      let textToSpeak = reply;
      if (reply.length > MAX_SPEAK_CHARS) {
        const cut = reply.lastIndexOf(" ", MAX_SPEAK_CHARS);
        textToSpeak = reply.slice(0, cut > 0 ? cut : MAX_SPEAK_CHARS) + "… full response shown above.";
      }
      speakJarvisText(textToSpeak, () => {
        if (!isCurrent()) return;
        setVoiceState("idle");
        ensureWake();
      });
    } catch {
      if (!isCurrent()) return;
      setVoiceState("idle");
      ensureWake();
    }
  }, []);

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

  const startWakeListener = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    const rec = new SpeechRecognitionAPI();
    wakeRecognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    let permissionDenied = false;

    rec.onresult = (e: any) => {
      const state = voiceStateRef.current;
      if (state === "listening") return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().replace(/[^\w\s]/g, "");
        if (t.includes(wakeWordLower)) {
          if (state === "thinking" || state === "speaking") {
            queryIdRef.current++;
            stopJarvisSpeech();
            playUiSound("alert");
          } else {
            playUiSound("beep");
          }
          commandInProgressRef.current = true;
          wakeRecognitionRef.current = null;
          rec.stop();
          setTranscript("");
          setAiReply("");
          setVoiceState("listening");
          startCommandListening();
          return;
        }
      }
    };

    const isCurrent = () => wakeRecognitionRef.current === rec;

    rec.onend = () => {
      if (!permissionDenied && isCurrent() && wakeActiveRef.current && !commandInProgressRef.current) {
        try { rec.start(); } catch {}
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        permissionDenied = true;
        return;
      }
      if (isCurrent() && wakeActiveRef.current && !commandInProgressRef.current) {
        try { rec.start(); } catch {}
      }
    };

    try { rec.start(); } catch {}
  }, [wakeWordLower, startCommandListening]);

  useEffect(() => { startWakeListenerRef.current = startWakeListener; }, [startWakeListener]);

  useEffect(() => {
    if (wakeActive) {
      startWakeListener();
    } else {
      const r = wakeRecognitionRef.current;
      wakeRecognitionRef.current = null;
      r?.stop();
    }
    return () => {
      const r = wakeRecognitionRef.current;
      wakeRecognitionRef.current = null;
      r?.stop();
    };
  }, [wakeActive, startWakeListener]);

  const handleOrbClick = () => {
    if (voiceState === "thinking" || voiceState === "speaking") {
      queryIdRef.current++;
      stopJarvisSpeech();
      setVoiceState("idle");
      return;
    }

    if (voiceState === "listening") {
      commandRecognitionRef.current?.stop();
      setVoiceState("idle");
      return;
    }
    if (voiceState !== "idle") return;

    commandInProgressRef.current = true;
    const wakeRec = wakeRecognitionRef.current;
    wakeRecognitionRef.current = null;
    wakeRec?.stop();

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
    idle: "bg-zinc-800 hover:bg-white hover:text-black",
    listening: "bg-white scale-110",
    thinking: "bg-amber-400 scale-105 hover:bg-red-400",
    speaking: "bg-emerald-500 scale-105 hover:bg-red-400",
  }[voiceState];

  const ringColor = {
    idle: "",
    listening: "#ffffff",
    thinking: "#fbbf24",
    speaking: "#34d399",
  }[voiceState];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-mono">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-[#111318] border border-zinc-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-zinc-700 text-white border border-zinc-800">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-white tracking-wide">
              HANDS-FREE VOICE MATRIX
            </h2>
            <p className="text-xs font-mono font-bold text-zinc-400">
              Wake word:{" "}
              <strong className="text-black bg-white px-1 py-0.5">
                "{wakeWord}"
              </strong>{" "}
              • Low-latency audio pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setWakeActive(v => !v)}
            className={`text-[10px] font-mono font-black px-3 py-1.5 border border-zinc-800 transition ${
              wakeActive ? "bg-white text-black border-transparent" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {wakeActive ? "WAKE WORD: ON" : "WAKE WORD: OFF"}
          </button>
          <span className="text-xs font-mono font-black px-3 py-1 bg-[#111318] border border-zinc-800 text-zinc-300">
            STATUS: <strong className="uppercase text-white">{voiceState}</strong>
          </span>
        </div>
      </div>

      {/* Orb Hub */}
      <div className="relative flex flex-col items-center justify-center p-8 sm:p-12 bg-[#111318] border border-zinc-800 shadow-lg space-y-6">
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
            className={`group relative z-10 w-36 h-36 rounded-full border-2 border-zinc-700 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 ${stateColor}`}
          >
            {voiceState === "idle"      && <Aperture  className="w-12 h-12 text-zinc-300 group-hover:text-black group-hover:scale-110 transition" />}
            {voiceState === "listening" && <Radio     className="w-12 h-12 text-black animate-pulse" />}
            {voiceState === "thinking"  && <RefreshCw className="w-12 h-12 text-black animate-spin" />}
            {voiceState === "speaking"  && <Volume2   className="w-12 h-12 text-black animate-bounce" />}
          </button>
        </div>

        {/* Waveform */}
        <div className="flex items-center gap-1.5 h-12">
          {[40, 70, 25, 90, 60, 100, 45, 80, 30, 95, 50, 85, 40, 75].map((h, i) => (
            <div
              key={i}
              className={`w-2 rounded-sm transition-all duration-150 ${
                voiceState === "listening" ? "bg-white animate-pulse"
                : voiceState === "thinking" ? "bg-amber-400 animate-pulse"
                : voiceState === "speaking" ? "bg-emerald-400 animate-pulse"
                : "bg-zinc-700"
              }`}
              style={{
                height: voiceState === "idle" ? "8px" : `${Math.max(12, h * (i % 2 === 0 ? 1 : 0.6))}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        {/* Prompt */}
        <p className="text-sm font-mono font-bold text-zinc-300 text-center">
          {voiceState === "idle"      && `Tap the orb or say "${wakeWord}" to initiate speech`}
          {voiceState === "listening" && "Listening… speak your command now, Sir"}
          {voiceState === "thinking"  && `J.A.R.V.I.S. processing… tap or say "${wakeWord}" to cancel`}
          {voiceState === "speaking"  && `J.A.R.V.I.S. replying verbally… tap or say "${wakeWord}" to interrupt`}
        </p>

        {/* Transcript / reply box */}
        {(transcript || aiReply) && (
          <div className="w-full max-w-2xl p-4 bg-[#0d0f12] border border-zinc-800 text-xs sm:text-sm font-mono space-y-2 text-left shadow-lg">
            {transcript && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-black text-zinc-400">SPOKEN TRANSCRIPT:</span>
                <p className="text-white font-bold">{transcript}</p>
              </div>
            )}
            {aiReply && (
              <div className="space-y-0.5 pt-2 border-t border-zinc-800">
                <span className="text-[10px] font-mono font-black text-zinc-400">J.A.R.V.I.S. VERBAL RESPONSE:</span>
                <p className="text-zinc-100 font-bold">{aiReply}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice History */}
      <div className="p-5 bg-[#111318] border border-zinc-800 space-y-4 shadow-lg">
        <h3 className="text-xs font-heading font-black uppercase tracking-widest text-white">
          RECENT VOICE INTERACTIONS
        </h3>
        <div className="space-y-3">
          {voiceHistory.length === 0 && (
            <p className="text-xs font-mono text-zinc-600">No interactions yet.</p>
          )}
          {voiceHistory.map((item) => (
            <div key={item.id} className="p-3 bg-[#0d0f12] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-zinc-500">{item.time}</span>
                  <span className="font-black text-white font-mono">User: "{item.input}"</span>
                </div>
                <p className="text-zinc-400 font-mono text-xs">{item.reply}</p>
              </div>
              <button
                onClick={() => speakJarvisText(item.reply)}
                className="self-start sm:self-center px-2.5 py-1 bg-[#111318] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-mono font-bold text-[11px] flex items-center gap-1 transition"
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
