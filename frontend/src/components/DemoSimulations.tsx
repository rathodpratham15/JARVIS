import React, { useEffect, useRef, useState } from "react";

// ── Voice Mode ────────────────────────────────────────────────────────────────

const VOICE_SCRIPT = [
  { role: "user", text: "Hey JARVIS, what's on my schedule today?" },
  { role: "jarvis", text: "Good morning. You have three items: a standup at 9am, a product review at 2pm, and a 1-on-1 at 5pm. Arc Reactor output is stable." },
  { role: "user", text: "Set a reminder for the product review." },
  { role: "jarvis", text: "Done. Reminder set for 1:45pm — fifteen minutes before the product review." },
];

export const VoiceDemo: React.FC = () => {
  const [messages, setMessages] = useState<{ role: string; text: string; partial: string }[]>([]);
  const [waveActive, setWaveActive] = useState(false);
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.toLowerCase().includes("google uk english male"))
      || voices.find(v => v.lang === "en-GB")
      || voices[0];
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  };

  const typeMessage = (idx: number, charIdx: number, onDone: () => void) => {
    const msg = VOICE_SCRIPT[idx];
    if (charIdx > msg.text.length) { onDone(); return; }
    setMessages(prev => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], partial: msg.text.slice(0, charIdx) };
      return next;
    });
    timerRef.current = setTimeout(() => typeMessage(idx, charIdx + 1, onDone), charIdx === 0 ? 0 : 28);
  };

  const runStep = (step: number) => {
    if (step >= VOICE_SCRIPT.length) {
      timerRef.current = setTimeout(() => { setMessages([]); stepRef.current = 0; runStep(0); }, 3500);
      return;
    }
    const msg = VOICE_SCRIPT[step];
    setMessages(prev => [...prev, { role: msg.role, text: msg.text, partial: "" }]);
    setWaveActive(msg.role === "user");
    timerRef.current = setTimeout(() => {
      if (msg.role === "jarvis") speak(msg.text);
      typeMessage(step, 0, () => {
        setWaveActive(false);
        timerRef.current = setTimeout(() => { stepRef.current = step + 1; runStep(step + 1); }, 900);
      });
    }, msg.role === "user" ? 400 : 700);
  };

  useEffect(() => {
    window.speechSynthesis?.getVoices(); // pre-load voices
    timerRef.current = setTimeout(() => runStep(0), 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const bars = [3, 7, 10, 5, 9, 4, 8, 6, 10, 3, 7, 5];

  return (
    <div className="flex flex-col h-full gap-4 p-2">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1 h-8">
          {bars.map((h, i) => (
            <div key={i} className="w-0.5 bg-[#00E5FF] transition-all duration-150"
              style={{ height: waveActive ? `${h * 3}px` : "4px", opacity: waveActive ? 1 : 0.3, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
        <span className="text-[10px] text-[#00E5FF] tracking-widest">{waveActive ? "LISTENING..." : "STANDBY"}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed ${
              m.role === "user"
                ? "bg-white/10 border border-white/20 text-white/90"
                : "bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF]"
            }`}>
              {m.role === "jarvis" && (
                <div className="text-[9px] tracking-widest text-[#00E5FF]/60 mb-1">J.A.R.V.I.S.</div>
              )}
              {m.partial || (m.partial === "" && i === messages.length - 1 ? "" : m.text)}
              {i === messages.length - 1 && m.partial !== m.text && (
                <span className="inline-block w-0.5 h-3 bg-current ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-white/30 tracking-widest border-t border-white/10 pt-2">
        WHISPER STT → GROQ LLAMA → ELEVENLABS TTS
      </div>
    </div>
  );
};

// ── Vision & OSINT ────────────────────────────────────────────────────────────

export const VisionDemo: React.FC = () => {
  const [phase, setPhase] = useState<"scan" | "lock" | "dossier">("scan");
  const [scanY, setScanY] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [dossierLines, setDossierLines] = useState<string[]>([]);

  const DOSSIER = [
    "NAME: Arjun Mehra",
    "ROLE: Software Engineer @ Google",
    "EDUCATION: IIT Bombay, CS 2019",
    "LOCATION: San Francisco, CA",
    "LINKEDIN: linkedin.com/in/arjunmehra",
    "GITHUB: github.com/arjunm",
  ];

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    const reset = () => {
      setPhase("scan"); setScanY(0); setConfidence(0); setDossierLines([]);
      interval = setInterval(() => setScanY(p => { if (p >= 100) { clearInterval(interval); t = setTimeout(lockOn, 400); return 100; } return p + 2; }), 40);
    };

    const lockOn = () => {
      setPhase("lock");
      let c = 0;
      interval = setInterval(() => { c += 3; setConfidence(Math.min(c, 97)); if (c >= 97) { clearInterval(interval); t = setTimeout(showDossier, 500); } }, 30);
    };

    const showDossier = () => {
      setPhase("dossier");
      DOSSIER.forEach((line, i) => { t = setTimeout(() => setDossierLines(p => [...p, line]), i * 280); });
      t = setTimeout(reset, DOSSIER.length * 280 + 3000);
    };

    reset();
    return () => { clearInterval(interval); clearTimeout(t); };
  }, []);

  return (
    <div className="flex gap-3 h-full p-2">
      {/* Face panel */}
      <div className="relative w-40 shrink-0 bg-[#080808] border border-white/10 overflow-hidden flex items-center justify-center">
        {/* Silhouette */}
        <svg viewBox="0 0 80 100" className="w-24 opacity-20 fill-white">
          <ellipse cx="40" cy="35" rx="22" ry="26" />
          <path d="M10 100 Q10 65 40 62 Q70 65 70 100Z" />
        </svg>

        {/* Scan line */}
        {phase === "scan" && (
          <div className="absolute left-0 right-0 h-px bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] pointer-events-none"
            style={{ top: `${scanY}%`, transition: "top 0.04s linear" }} />
        )}

        {/* Lock box */}
        {(phase === "lock" || phase === "dossier") && (
          <div className="absolute inset-4 border-2 border-[#00E5FF] shadow-[0_0_12px_#00E5FF]">
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-[#00E5FF]" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-[#00E5FF]" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-[#00E5FF]" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-[#00E5FF]" />
          </div>
        )}

        {(phase === "lock" || phase === "dossier") && (
          <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-[#00E5FF] font-bold tracking-widest">
            {confidence}% MATCH
          </div>
        )}
      </div>

      {/* Dossier panel */}
      <div className="flex-1 space-y-1.5 overflow-hidden">
        <div className="text-[10px] text-[#00E5FF] tracking-widest mb-2 uppercase">
          {phase === "scan" ? "SCANNING..." : phase === "lock" ? "LOCKING TARGET..." : "DOSSIER ASSEMBLED"}
        </div>
        {dossierLines.map((line, i) => (
          <div key={i} className="text-[11px] text-white/80 flex items-center gap-2">
            <span className="text-[#00E5FF] text-[9px]">▸</span>
            <span className="font-mono">{line}</span>
          </div>
        ))}
        {phase === "dossier" && dossierLines.length < DOSSIER.length && (
          <div className="text-[10px] text-[#00E5FF] animate-pulse">POPULATING...</div>
        )}
      </div>
    </div>
  );
};

// ── Agent Loop ────────────────────────────────────────────────────────────────

const AGENT_SCRIPT = [
  { type: "user", text: "> Find me the cheapest flight BOS → NYC next Friday" },
  { type: "plan", text: "PLANNING: Decomposing task into 3 steps..." },
  { type: "step", text: "STEP 1 → tavily_search('BOS NYC flights Friday cheap')" },
  { type: "result", text: "  ✓ 12 results found. Cheapest: $134 Spirit 07:15AM" },
  { type: "step", text: "STEP 2 → check_availability('Spirit FL2847 2026-09-05')" },
  { type: "result", text: "  ✓ 4 seats remaining. Booking window open." },
  { type: "step", text: "STEP 3 → calendar_add('NYC trip', '2026-09-05 07:15')" },
  { type: "result", text: "  ✓ Added to calendar. Reminder set for 06:00." },
  { type: "done", text: "✓ TASK COMPLETE — Spirit $134, departs 07:15AM Friday." },
];

export const AgentDemo: React.FC = () => {
  const [lines, setLines] = useState<typeof AGENT_SCRIPT>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let step = 0;
    const addLine = () => {
      if (step >= AGENT_SCRIPT.length) {
        timerRef.current = setTimeout(() => { setLines([]); step = 0; addLine(); }, 3000);
        return;
      }
      setLines(prev => [...prev, AGENT_SCRIPT[step]]);
      step++;
      timerRef.current = setTimeout(addLine, step === 1 ? 600 : 650);
    };
    timerRef.current = setTimeout(addLine, 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const colorMap: Record<string, string> = {
    user: "text-white",
    plan: "text-yellow-400",
    step: "text-[#00E5FF]",
    result: "text-emerald-400",
    done: "text-emerald-300 font-bold",
  };

  return (
    <div className="h-full p-3 flex flex-col gap-1 overflow-hidden bg-[#050608]">
      <div className="text-[10px] text-white/30 tracking-widest mb-2">JARVIS REACT AGENT // LOG STREAM</div>
      <div className="flex-1 space-y-1.5 overflow-hidden font-mono text-[11px]">
        {lines.map((l, i) => (
          <div key={i} className={`${colorMap[l.type]} leading-relaxed`}>
            {i === lines.length - 1 && l !== AGENT_SCRIPT[AGENT_SCRIPT.length - 1]
              ? <>{l.text}<span className="animate-pulse">▌</span></>
              : l.text}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Research Pipeline ─────────────────────────────────────────────────────────

const RESEARCH_QUERIES = [
  "Jensen Huang",
  "Jensen Huang NVIDIA CEO biography",
  "Jensen Huang professional background career",
  "Jensen Huang NVIDIA leadership",
  "Jensen Huang Stanford EE Stanford",
];

const PROFILE_FIELDS = [
  ["NAME", "Jensen Huang"],
  ["ROLE", "Co-founder & CEO, NVIDIA Corporation"],
  ["EDUCATION", "Oregon State → Stanford EE MS"],
  ["FOUNDED", "NVIDIA, 1993 (age 30)"],
  ["NET WORTH", "$100B+ (2026)"],
  ["KNOWN FOR", "GPU computing, AI infrastructure, CUDA"],
];

export const ResearchDemo: React.FC = () => {
  const [progress, setProgress] = useState([0, 0, 0, 0, 0]);
  const [phase, setPhase] = useState<"search" | "synthesize" | "profile">("search");
  const [profileFields, setProfileFields] = useState<string[][]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const run = () => {
      setProgress([0, 0, 0, 0, 0]); setPhase("search"); setProfileFields([]);

      const intervals = RESEARCH_QUERIES.map((_, i) => {
        const delay = i * 180;
        return setTimeout(() => {
          let p = 0;
          const iv = setInterval(() => {
            p += Math.random() * 12 + 5;
            setProgress(prev => { const n = [...prev]; n[i] = Math.min(p, 100); return n; });
            if (p >= 100) clearInterval(iv);
          }, 80);
        }, delay);
      });

      timerRef.current = setTimeout(() => {
        setPhase("synthesize");
        timerRef.current = setTimeout(() => {
          setPhase("profile");
          PROFILE_FIELDS.forEach(([k, v], i) => {
            timerRef.current = setTimeout(() => setProfileFields(prev => [...prev, [k, v]]), i * 300);
          });
          timerRef.current = setTimeout(run, PROFILE_FIELDS.length * 300 + 3000);
        }, 1200);
      }, 2800);

      return () => intervals.forEach(clearTimeout);
    };
    run();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="h-full p-3 flex flex-col gap-3 overflow-hidden text-xs font-mono">
      {phase === "search" && (
        <>
          <div className="text-[10px] text-[#00E5FF] tracking-widest">5X PARALLEL SEARCH // SUBJECT: JENSEN HUANG</div>
          <div className="space-y-2">
            {RESEARCH_QUERIES.map((q, i) => (
              <div key={i} className="space-y-0.5">
                <div className="text-[10px] text-white/50 truncate">{q}</div>
                <div className="h-1 bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#00E5FF] transition-all duration-100" style={{ width: `${progress[i]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {phase === "synthesize" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-[#00E5FF] tracking-widest animate-pulse text-sm">SYNTHESIZING PROFILE...</div>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-[#00E5FF] animate-bounce" style={{ animationDelay: `${i*0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {phase === "profile" && (
        <>
          <div className="text-[10px] text-[#00E5FF] tracking-widest">DOSSIER // JENSEN HUANG</div>
          <div className="space-y-1.5">
            {profileFields.map(([k, v], i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="text-[#00E5FF]/60 w-20 shrink-0">{k}</span>
                <span className="text-white/80">{v}</span>
              </div>
            ))}
            {profileFields.length < PROFILE_FIELDS.length && (
              <span className="text-[#00E5FF] animate-pulse">▌</span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Computer Use ──────────────────────────────────────────────────────────────

const COMPUTER_STEPS = [
  { action: "SCREENSHOT", detail: "Capturing display at 1440×900...", cursor: { x: 50, y: 50 } },
  { action: "ANALYZE", detail: "Gemini Vision: browser open, Gmail visible, compose button at [1320, 82]", cursor: { x: 50, y: 50 } },
  { action: "CLICK", detail: "Moving cursor → Compose button [1320, 82]", cursor: { x: 88, y: 12 } },
  { action: "EXECUTE", detail: "click(1320, 82) — modal opened", cursor: { x: 88, y: 12 } },
  { action: "ANALYZE", detail: "To: field active. Recipient: investor@vc.com", cursor: { x: 50, y: 35 } },
  { action: "TYPE", detail: "type('investor@vc.com') + Tab", cursor: { x: 50, y: 35 } },
  { action: "TYPE", detail: "type('Q3 Update — JARVIS traction metrics attached')", cursor: { x: 50, y: 50 } },
  { action: "CLICK", detail: "click(Send) — email dispatched ✓", cursor: { x: 75, y: 80 } },
  { action: "DONE", detail: "Task complete. Email sent to investor@vc.com.", cursor: { x: 50, y: 50 } },
];

export const ComputerDemo: React.FC = () => {
  const [stepIdx, setStepIdx] = useState(0);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [clickFlash, setClickFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let i = 0;
    const next = () => {
      if (i >= COMPUTER_STEPS.length) { i = 0; timerRef.current = setTimeout(next, 1500); return; }
      const step = COMPUTER_STEPS[i];
      setStepIdx(i);
      setCursor(step.cursor);
      if (step.action === "CLICK" || step.action === "EXECUTE") {
        timerRef.current = setTimeout(() => setClickFlash(true), 300);
        timerRef.current = setTimeout(() => setClickFlash(false), 600);
      }
      i++;
      timerRef.current = setTimeout(next, 900);
    };
    timerRef.current = setTimeout(next, 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const step = COMPUTER_STEPS[stepIdx];
  const COLOR: Record<string, string> = {
    SCREENSHOT: "text-white/60", ANALYZE: "text-yellow-400",
    CLICK: "text-[#00E5FF]", EXECUTE: "text-emerald-400",
    TYPE: "text-purple-400", DONE: "text-emerald-300",
  };

  return (
    <div className="h-full p-3 flex flex-col gap-3 overflow-hidden">
      {/* Fake screen */}
      <div className="relative flex-1 bg-[#1a1b1e] border border-white/10 overflow-hidden">
        {/* Fake browser chrome */}
        <div className="h-6 bg-[#2a2b2e] border-b border-white/10 flex items-center px-2 gap-1.5">
          <div className="w-2 h-2 bg-red-500/60" />
          <div className="w-2 h-2 bg-yellow-500/60" />
          <div className="w-2 h-2 bg-green-500/60" />
          <div className="flex-1 mx-2 h-3 bg-[#1a1b1e] border border-white/10 text-[8px] text-white/30 flex items-center px-1">mail.google.com</div>
        </div>
        {/* Content blur placeholder */}
        <div className="absolute inset-6 top-8 grid grid-cols-3 gap-1 opacity-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-3 bg-white" style={{ opacity: Math.random() * 0.5 + 0.2 }} />
          ))}
        </div>
        {/* Compose button hint */}
        <div className="absolute top-8 right-2 text-[8px] bg-[#00E5FF]/20 border border-[#00E5FF]/40 px-1.5 py-0.5 text-[#00E5FF]">+ COMPOSE</div>
        {/* Animated cursor */}
        <div className="absolute w-3 h-3 pointer-events-none transition-all duration-500 ease-in-out"
          style={{ left: `${cursor.x}%`, top: `${cursor.y}%`, transform: "translate(-50%,-50%)" }}>
          <svg viewBox="0 0 12 12" fill="white" className="drop-shadow-[0_0_4px_white]">
            <path d="M0 0 L0 9 L3 6 L6 12 L7.5 11.3 L4.5 5.3 L8 5.3Z" />
          </svg>
          {clickFlash && <div className="absolute -inset-2 border border-[#00E5FF] animate-ping opacity-60" />}
        </div>
      </div>

      {/* Log */}
      <div className="font-mono text-[11px] space-y-0.5 border-t border-white/10 pt-2">
        <div className="flex gap-2">
          <span className={`font-bold ${COLOR[step.action]}`}>[{step.action}]</span>
          <span className="text-white/60 leading-relaxed">{step.detail}</span>
        </div>
        <div className="text-[10px] text-white/30">PIL + GEMINI VISION + PYAUTOGUI // STEP {stepIdx + 1}/{COMPUTER_STEPS.length}</div>
      </div>
    </div>
  );
};
