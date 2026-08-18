import React, { useState, useEffect } from "react";
import { Mic, MicOff, Volume2, Sparkles, Radio, Play, RefreshCw, CheckCircle2 } from "lucide-react";
import { speakJarvisText, playUiSound } from "../utils/audio";

interface VoiceViewProps {
  onProcessVoiceCommand: (transcript: string) => Promise<string>;
  wakeWord?: string;
  accentColor?: string;
}

export const VoiceView: React.FC<VoiceViewProps> = ({
  onProcessVoiceCommand,
  wakeWord = "Hey Jarvis",
  accentColor = "cyan",
}) => {
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [transcript, setTranscript] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [voiceHistory, setVoiceHistory] = useState<
    { id: string; time: string; input: string; reply: string }[]
  >([]);

  // Handle Voice Command
  const handleStartListening = () => {
    if (voiceState !== "idle") {
      setVoiceState("idle");
      return;
    }

    playUiSound("beep");
    setVoiceState("listening");
    setTranscript("Listening for spoken directive...");

    // Check for Browser Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const resultText = event.results[current][0].transcript;
        setTranscript(resultText);
      };

      recognition.onend = async () => {
        if (transcript && transcript !== "Listening for spoken directive...") {
          await processQuery(transcript);
        } else {
          setVoiceState("idle");
        }
      };

      recognition.onerror = () => {
        // Fallback simulation
        simulateVoiceInput();
      };

      recognition.start();
    } else {
      simulateVoiceInput();
    }
  };

  const simulateVoiceInput = () => {
    const sampleQueries = [
      "What's the weather like today?",
      "Summarize my notes from this week.",
      "Search for the latest AI news and save a summary.",
      "Set a reminder for my meeting at 3pm.",
    ];
    const query = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];

    let i = 0;
    setTranscript("");
    const interval = setInterval(() => {
      setTranscript(query.slice(0, i + 1));
      i++;
      if (i >= query.length) {
        clearInterval(interval);
        setTimeout(() => {
          processQuery(query);
        }, 800);
      }
    }, 40);
  };

  const processQuery = async (queryText: string) => {
    setVoiceState("thinking");
    playUiSound("scan");

    try {
      const reply = await onProcessVoiceCommand(queryText);
      setAiReply(reply);
      setVoiceState("speaking");
      playUiSound("success");

      setVoiceHistory((prev) => [
        {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString(),
          input: queryText,
          reply,
        },
        ...prev,
      ]);

      speakJarvisText(reply, () => {
        setVoiceState("idle");
      });
    } catch (err) {
      setVoiceState("idle");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-mono text-black">
      {/* Top Banner Header */}
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
              Wake word active: <strong className="text-black bg-[#00e5ff] px-1 py-0.5 border border-black">"{wakeWord}"</strong> • Low-latency audio pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-black px-3 py-1 bg-[#f3f3ee] border-2 border-black text-black">
            STATUS: <strong className="text-black uppercase underline">{voiceState}</strong>
          </span>
        </div>
      </div>

      {/* Main Center Holographic Voice Hub */}
      <div className="relative flex flex-col items-center justify-center p-8 sm:p-12 bg-white border-2 border-black shadow-[6px_6px_0px_#000000] space-y-6">
        {/* Animated Background Pulse Waves */}
        {voiceState === "listening" && (
          <div className="absolute inset-0 border-2 border-black animate-ping pointer-events-none opacity-20" />
        )}

        {/* Center Mic Button */}
        <div
          className={`relative cursor-pointer group w-32 h-32 border-2 border-[#1a1a1a] flex items-center justify-center transition ${
            voiceState === "listening" ? "bg-[#00E5FF]" : voiceState === "thinking" ? "bg-amber-300" : voiceState === "speaking" ? "bg-emerald-300" : "bg-[#EBEBEA] hover:bg-[#00E5FF]"
          }`}
          onClick={handleStartListening}
        >
          {voiceState === "idle" && <Mic className="w-10 h-10 text-[#1a1a1a] group-hover:scale-110 transition" />}
          {voiceState === "listening" && <Radio className="w-10 h-10 text-[#1a1a1a] animate-pulse" />}
          {voiceState === "thinking" && <RefreshCw className="w-10 h-10 text-[#1a1a1a] animate-spin" />}
          {voiceState === "speaking" && <Volume2 className="w-10 h-10 text-[#1a1a1a] animate-bounce" />}
        </div>

        {/* Audio Spectrum Waveform Visualizer */}
        <div className="flex items-center gap-1.5 h-12">
          {[40, 70, 25, 90, 60, 100, 45, 80, 30, 95, 50, 85, 40, 75].map((h, i) => (
            <div
              key={i}
              className={`w-2 border-2 border-black transition-all duration-150 ${
                voiceState === "listening"
                  ? "bg-[#00e5ff] animate-pulse"
                  : voiceState === "thinking"
                  ? "bg-amber-400 animate-pulse"
                  : voiceState === "speaking"
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-black/20"
              }`}
              style={{
                height: voiceState === "idle" ? "10px" : `${Math.max(12, h * (i % 2 === 0 ? 1 : 0.6))}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        {/* Status Prompt Text */}
        <div className="text-center space-y-1">
          <p className="text-sm font-mono font-black text-black">
            {voiceState === "idle" && "Tap Arc Orb or speak wake word to initiate speech"}
            {voiceState === "listening" && "Listening... Speak your command now, Sir"}
            {voiceState === "thinking" && "J.A.R.V.I.S. processing voice acoustics & intent..."}
            {voiceState === "speaking" && "J.A.R.V.I.S. replying verbally..."}
          </p>
        </div>

        {/* Live Transcript Display Box */}
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

      {/* Voice Interaction History */}
      <div className="p-5 bg-white border-2 border-black space-y-4 shadow-[4px_4px_0px_#000000]">
        <h3 className="text-xs font-heading font-black uppercase tracking-widest text-black">
          RECENT VOICE INTERACTIONS
        </h3>

        <div className="space-y-3">
          {voiceHistory.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-[#f3f3ee] border-2 border-black shadow-[2px_2px_0px_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
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
