import React, { useEffect, useRef, useState } from "react";
import { VoiceDemo, VisionDemo, AgentDemo, ResearchDemo, ComputerDemo } from "./DemoSimulations";

interface LandingPageProps {
  onEnter: () => void;
}

const FEATURE_DATA: Record<string, {
  categoryBadge: string;
  title: string;
  subtitle: string;
  feedTitle: string;
  hudMode: string;
  hudSub: string;
  hudIcon: string;
  hudStatus: string;
  bullets: string[];
  techPipeline: string;
  videoSrc: string;
}> = {
  voice: {
    categoryBadge: "FEATURE PROTOCOL 01",
    title: "VOICE MODE",
    subtitle: "Zero-latency neural conversation loop with custom acoustic synthesis",
    feedTitle: "FEED: VOICE_SYNTHESIS_STREAM.MP4",
    hudMode: "[SUBROUTINE: VOICE_MODE_ACTIVE]",
    hudSub: "SYNTHETIC AUDIO WAVEFORM ENGINE",
    hudIcon: "🎤",
    hudStatus: '"Hey JARVIS, what is on my calendar today?"',
    bullets: [
      'Wake-word activation: <strong class="text-white">"Hey JARVIS"</strong>',
      'Speech-to-text via <strong class="text-white">Whisper</strong>',
      '<strong class="text-white">ElevenLabs</strong> neural TTS response',
      "Full hands-free conversation loop",
    ],
    techPipeline: "Whisper STT → Groq LLaMA inference → ElevenLabs TTS → Web Audio API",
    videoSrc: "",
  },
  vision: {
    categoryBadge: "FEATURE PROTOCOL 02",
    title: "VISION & OSINT",
    subtitle: "Real-time biometric facial recognition and autonomous intelligence dossier assembly",
    feedTitle: "FEED: OPTICAL_BIOMETRIC_SCAN.MP4",
    hudMode: "[SUBROUTINE: VISION_OSINT_ACTIVE]",
    hudSub: "INSIGHTFACE BIOMETRICS & GEMINI VISION",
    hudIcon: "👁️",
    hudStatus: "TARGET IDENTIFIED: LOCK ACQUIRED (99.4%)",
    bullets: [
      'Camera detects a face using <strong class="text-white">InsightFace</strong> biometrics',
      '<strong class="text-white">Gemini Vision</strong> reverse-searches the image',
      "Research pipeline builds a full public-profile dossier",
      "Dossier appears alongside the face match in real time",
    ],
    techPipeline: "InsightFace buffalo_sc → Gemini Vision → Tavily Search → LLM synthesis",
    videoSrc: "",
  },
  agent: {
    categoryBadge: "FEATURE PROTOCOL 03",
    title: "AGENT LOOP",
    subtitle: "Autonomous multi-step planning, tool orchestration, self-correction, and streaming",
    feedTitle: "FEED: AUTONOMOUS_REACT_LOOP.MP4",
    hudMode: "[SUBROUTINE: AGENT_REACT_LOOP]",
    hudSub: "RECURSIVE TASK PLANNING & TOOL DISPATCH",
    hudIcon: "🤖",
    hudStatus: "STEP 3/4: TAVILY WEB PROBE EXECUTED. ADAPTING PLAN...",
    bullets: [
      "User gives a multi-step task in natural language",
      "Agent autonomously plans the required steps",
      "Uses web search and custom tool calls to execute",
      "Self-corrects and streams the final result",
    ],
    techPipeline: "Groq LLaMA ReAct loop → Tavily → Custom tools → Streaming SSE",
    videoSrc: "",
  },
  research: {
    categoryBadge: "FEATURE PROTOCOL 04",
    title: "RESEARCH PIPELINE",
    subtitle: "Multi-threaded parallel intelligence gathering and structured profile synthesis",
    feedTitle: "FEED: DEEP_OSINT_SYNTHESIS.MP4",
    hudMode: "[SUBROUTINE: DEEP_RESEARCH_MATRIX]",
    hudSub: "5X PARALLEL OSINT WEB DISPATCH",
    hudIcon: "🔬",
    hudStatus: "5 PARALLEL WEB QUERIES COMPLETE. COMPILING PROFILE...",
    bullets: [
      "Ask about any person or company",
      "Five parallel web searches run simultaneously",
      "LLM synthesises findings into a structured dossier",
      "Sources cited alongside the generated profile",
    ],
    techPipeline: "Tavily parallel search → Dedup → Groq synthesis → JSON profile",
    videoSrc: "",
  },
  computer: {
    categoryBadge: "FEATURE PROTOCOL 05",
    title: "COMPUTER USE",
    subtitle: "Direct visual screen comprehension and automated mouse/keyboard execution",
    feedTitle: "FEED: COMPUTER_USE_AGENT.MP4",
    hudMode: "[SUBROUTINE: DESKTOP_AUTOMATION_ACTIVE]",
    hudSub: "PIL SCREENSHOT & PYAUTOGUI ACTION LOOP",
    hudIcon: "🖥️",
    hudStatus: "LOCATED BUTTON [EXPORT]. DISPATCHING SYNTHETIC CLICK...",
    bullets: [
      "JARVIS captures a screenshot of the current screen",
      '<strong class="text-white">Gemini Vision</strong> interprets what is visible',
      "Agent plans: click, type, or scroll — then executes",
      '<strong class="text-white">PyAutoGUI</strong> acts and repeats until task is done',
    ],
    techPipeline: "PIL screenshot → Gemini Vision → Action plan → PyAutoGUI execution",
    videoSrc: "",
  },
};

const TABS = ["voice", "vision", "agent", "research", "computer"] as const;
type TabKey = typeof TABS[number];
const TAB_LABELS: Record<TabKey, string> = {
  voice: "🎤 VOICE MODE",
  vision: "👁️ VISION & OSINT",
  agent: "🤖 AGENT LOOP",
  research: "🔬 RESEARCH",
  computer: "🖥️ COMPUTER USE",
};

const CAPABILITIES = [
  { icon: "🎤", title: "VOICE MODE", desc: "Natural hands-free interaction with JARVIS.", tech: "WHISPER + ELEVENLABS" },
  { icon: "👁️", title: "VISION & OSINT", desc: "Understand images, faces, and public information.", tech: "GEMINI VISION + INSIGHTFACE" },
  { icon: "🤖", title: "AGENT LOOP", desc: "Plan, execute, verify, and adapt autonomously.", tech: "REACT LOOP + SSE STREAM" },
  { icon: "📧", title: "GMAIL / CALENDAR / DRIVE", desc: "Connect everyday productivity workflows.", tech: "GOOGLE WORKSPACE OAUTH" },
  { icon: "🖥️", title: "COMPUTER USE", desc: "See and interact with the desktop like a human operator.", tech: "PYAUTOGUI + OCR GROUNDING" },
  { icon: "🔬", title: "RESEARCH PIPELINE", desc: "Search, synthesize, structure, and cite information.", tech: "TAVILY 5X PARALLEL SEARCH" },
  { icon: "⏰", title: "AUTONOMOUS SCHEDULING", desc: "Run tasks and workflows automatically on a schedule.", tech: "BACKGROUND CRON DAEMON" },
  { icon: "🔒", title: "SECURE AUTH", desc: "Protected access using modern authentication.", tech: "LOCAL ENCRYPTION + JWT" },
];

const STACK = [
  "Python 3.12", "Flask", "React 18", "TypeScript", "TailwindCSS",
  "Groq LLaMA", "Gemini Vision", "ElevenLabs TTS", "InsightFace",
  "SQLite", "Tavily Search", "Google OAuth", "Capacitor",
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("voice");
  const [typed, setTyped] = useState("");
  const [blink, setBlink] = useState(true);
  const typingDone = useRef(false);

  const full = "Personal AI Operating System";

  useEffect(() => {
    if (typingDone.current) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) { clearInterval(t); typingDone.current = true; }
    }, 55);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(t);
  }, []);

  const switchTab = (tab: TabKey) => setActiveTab(tab);

  const data = FEATURE_DATA[activeTab];

  return (
    <div className="min-h-screen bg-[#080808] text-white font-mono antialiased overflow-x-hidden" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        .lp-no-radius * { border-radius: 0 !important; }
        .grid-pattern {
          background-size: 40px 40px;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
        }
        .cyan-radial { background: radial-gradient(circle at 50% 30%, rgba(0,229,255,0.08) 0%, rgba(8,8,8,0) 70%); }
        .scanline-fx {
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,229,255,0.04) 50%, rgba(0,229,255,0.04));
          background-size: 100% 4px;
        }
        .jarvis-card { transition: all 0.2s cubic-bezier(0.16,1,0.3,1); }
        .jarvis-card:hover { border-color: #00E5FF; background-color: rgba(0,229,255,0.02); box-shadow: 0 0 16px rgba(0,229,255,0.2); }
        @keyframes radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .radar-sweep { animation: radarSweep 6s linear infinite; }
        @keyframes cursorBlink { 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
        .cursor-blink { animation: cursorBlink 0.9s infinite; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.3); }
        ::-webkit-scrollbar-thumb:hover { background: #00E5FF; }
      `}</style>

      <div className="lp-no-radius">

        {/* ── TOP NAV ── */}
        <header className="sticky top-0 z-50 w-full bg-[#080808]/90 backdrop-blur-md border-b border-[#00E5FF]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] animate-pulse" />
              <span className="text-lg font-extrabold tracking-[0.25em] text-white">J.A.R.V.I.S.</span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-[#00E5FF]/60 border border-[#00E5FF]/30 px-1.5 py-0.5">
                CORE // v2.0
              </span>
            </div>
            <nav className="flex items-center gap-3 sm:gap-5">
              <a href="#demo" className="hidden md:inline-block text-xs uppercase tracking-wider text-white/70 hover:text-[#00E5FF] transition-colors py-1 px-2 hover:bg-[#00E5FF]/5">[DEMO]</a>
              <a href="#capabilities" className="hidden md:inline-block text-xs uppercase tracking-wider text-white/70 hover:text-[#00E5FF] transition-colors py-1 px-2 hover:bg-[#00E5FF]/5">[CAPABILITIES]</a>
              <a href="#architecture" className="hidden md:inline-block text-xs uppercase tracking-wider text-white/70 hover:text-[#00E5FF] transition-colors py-1 px-2 hover:bg-[#00E5FF]/5">[ARCH]</a>
              <a href="https://github.com/rathodpratham15/JARVIS" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex text-xs uppercase tracking-wider text-white/80 hover:text-[#00E5FF] border border-white/10 hover:border-[#00E5FF] hover:bg-[#00E5FF]/5 px-3 py-1.5 transition-all items-center gap-1.5">
                <span>GITHUB</span><span className="text-[#00E5FF]">↗</span>
              </a>
              <button onClick={onEnter}
                className="text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-black bg-[#00E5FF] hover:bg-[#00E5FF]/90 px-3 sm:px-4 py-1 sm:py-1.5 border border-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.4)] transition-all">
                SIGN IN
              </button>
            </nav>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="relative pt-20 pb-24 lg:pt-28 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden grid-pattern">
          <div className="absolute inset-0 cyan-radial pointer-events-none" />
          <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 border border-[#00E5FF]/40 bg-[#00E5FF]/5 text-xs tracking-widest text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.15)]">
              <span className="w-2 h-2 bg-[#00E5FF] shadow-[0_0_6px_#00E5FF] animate-ping" />
              <span>SYSTEM ONLINE // v2.0</span>
            </div>

            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-[0.2em] sm:tracking-[0.25em] text-white uppercase select-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
              J.A.R.V.I.S.
            </h1>

            <div className="min-h-[2.5rem] flex items-center justify-center">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-medium tracking-wide text-[#00E5FF] flex items-center justify-center">
                <span>{typed}</span>
                <span className="cursor-blink text-[#00E5FF] ml-1 font-bold" style={{ opacity: blink ? 1 : 0 }}>_</span>
              </h2>
            </div>

            <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-white/60 leading-relaxed px-2">
              A self-hosted personal AI operating system engineered for autonomous computing. Seamlessly interact through neural voice, computer vision, deep OSINT web research, custom agent tools, and native desktop control.
            </p>

            <div className="pt-6 pb-2 max-w-4xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left">
                {[["8+", "AI Models"], ["20+", "Agent Tools"], ["3", "Platforms"], ["∞", "Possibility"]].map(([v, l]) => (
                  <div key={l} className="p-4 sm:p-5 border border-white/10 bg-[#111318]/60 jarvis-card">
                    <div className="text-2xl sm:text-3xl font-bold text-[#00E5FF] tracking-tight">{v}</div>
                    <div className="text-[11px] uppercase tracking-wider text-white/50 mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <a href="#demo"
                className="w-full sm:w-auto px-8 py-3.5 bg-[#00E5FF] text-black font-bold text-sm tracking-wider uppercase border border-[#00E5FF] hover:bg-[#00E5FF]/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] flex items-center justify-center gap-2 transition-all">
                <span>ACCESS SYSTEM</span><span>▶</span>
              </a>
              <a href="https://github.com/rathodpratham15/JARVIS" target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 border border-[#00E5FF]/40 text-[#00E5FF] font-semibold text-sm tracking-wider uppercase hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 hover:shadow-[0_0_12px_rgba(0,229,255,0.2)] flex items-center justify-center gap-2 transition-all">
                <span>VIEW SOURCE</span><span>↗</span>
              </a>
            </div>
          </div>
        </section>

        {/* ── CAPABILITIES GRID ── */}
        <section id="capabilities" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#080808]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <div className="text-xs uppercase tracking-widest text-[#00E5FF] font-semibold">// MULTI-MODAL SYSTEM CAPABILITIES</div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white uppercase">WHAT JARVIS CAN DO</h2>
              <p className="text-xs sm:text-sm text-white/50">Eight integrated tactical subsystems designed for autonomous orchestration.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CAPABILITIES.map(c => (
                <div key={c.title} className="p-6 border border-white/10 bg-[#111318]/50 jarvis-card space-y-4 group">
                  <div className="w-10 h-10 bg-[#080808] border border-white/10 group-hover:border-[#00E5FF] flex items-center justify-center text-xl transition-colors">{c.icon}</div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold tracking-wider text-white group-hover:text-[#00E5FF] uppercase transition-colors">{c.title}</h3>
                    <p className="text-xs text-white/50 leading-relaxed">{c.desc}</p>
                  </div>
                  <div className="pt-2 text-[10px] text-[#00E5FF]/60 uppercase tracking-wider">{c.tech}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DEMO SHOWCASE ── */}
        <section id="demo" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-t border-b border-[#00E5FF]/20 bg-[#0a0b0e] relative">
          <div className="max-w-7xl mx-auto space-y-12">

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#00E5FF] font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#00E5FF]" />
                  <span>// INTERACTIVE TELEMETRY VIEWPORT</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white uppercase mt-2">SEE IT IN ACTION</h2>
              </div>
              <div className="text-xs text-white/50 tracking-wider">LIVE DEMO MATRIX • SELECT CAPABILITY BELOW</div>
            </div>

            {/* Tab Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border border-white/10 bg-[#080808] p-1.5">
              {TABS.map(tab => (
                <button key={tab} onClick={() => switchTab(tab)}
                  className={`py-3 px-3 text-xs font-bold uppercase tracking-wider border transition-all text-center flex items-center justify-center gap-2 ${
                    activeTab === tab
                      ? "border-[#00E5FF] bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.2)]"
                      : "border-white/10 text-white/60 hover:text-white hover:border-white/30"
                  } ${tab === "computer" ? "col-span-2 sm:col-span-1" : ""}`}>
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Demo Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

              {/* Video / HUD Panel */}
              <div className="lg:col-span-7">
                <div className="border border-[#00E5FF]/40 bg-black shadow-[0_0_24px_rgba(0,229,255,0.15)] overflow-hidden">
                  <div className="bg-[#111318] border-b border-[#00E5FF]/20 px-4 py-2 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#00E5FF] animate-pulse" />
                      <span className="text-white font-semibold uppercase tracking-wider">{data.feedTitle}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/50">
                      <span className="hidden sm:inline">1080P // 60 FPS</span>
                      <span className="text-[#00E5FF]">00:08 / 00:08</span>
                    </div>
                  </div>

                  <div className="relative w-full aspect-video bg-[#050608] overflow-hidden scanline-fx">
                    <div className="absolute inset-0">
                      {activeTab === "voice"    && <VoiceDemo />}
                      {activeTab === "vision"   && <VisionDemo />}
                      {activeTab === "agent"    && <AgentDemo />}
                      {activeTab === "research" && <ResearchDemo />}
                      {activeTab === "computer" && <ComputerDemo />}
                    </div>
                  </div>

                  <div className="p-3 bg-[#080808] border-t border-[#00E5FF]/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-[#00E5FF]">▶ PREVIEW LOOP</span>
                      <span className="text-white/20">|</span>
                      <span className="text-white/60">PROMPT READY // 1080P 8S</span>
                    </div>
                    <button onClick={onEnter} className="text-[11px] text-white/70 hover:text-[#00E5FF] border border-white/10 px-2 py-0.5 transition-colors">
                      RUN SUBROUTINE ⚡
                    </button>
                  </div>
                </div>
              </div>

              {/* Feature Info Panel */}
              <div className="lg:col-span-5 space-y-6">
                <div className="border border-white/10 bg-[#111318]/90 p-6 sm:p-8 space-y-6 shadow-lg">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[#00E5FF] font-semibold">{data.categoryBadge}</div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight mt-1">{data.title}</h3>
                    <p className="text-xs text-white/60 mt-1">{data.subtitle}</p>
                  </div>

                  <div className="border-b border-white/10" />

                  <div className="space-y-3">
                    {data.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-[#00E5FF] font-bold text-sm shrink-0">▶</span>
                        <span className="text-xs sm:text-sm text-white/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: b }} />
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-white/10" />

                  <div className="space-y-2 bg-[#080808] p-4 border border-[#00E5FF]/20">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-1.5">
                      <span>⚡</span><span>HOW IT WORKS // PIPELINE</span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">{data.techPipeline}</p>
                  </div>

                  <button onClick={onEnter}
                    className="w-full py-3 bg-[#00E5FF]/10 hover:bg-[#00E5FF] text-[#00E5FF] hover:text-black font-bold text-xs uppercase tracking-wider border border-[#00E5FF] transition-all flex items-center justify-center gap-2">
                    <span>RUN LIVE INTERACTION SUBROUTINE</span><span>⚡</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── ARCHITECTURE ── */}
        <section id="architecture" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-[#0a0b0e]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#00E5FF] font-semibold">// SYSTEM TOPOLOGY</div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white uppercase mt-2">ARCHITECTURE</h2>
              </div>
              <div className="text-xs text-white/50 tracking-wider">THREE-TIER DECOUPLED STACK • LOCAL FIRST</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  num: "01", label: "FRONTEND", badge: "CLIENT LAYER",
                  desc: "High-performance reactive interfaces with native cross-platform mobile and desktop runtime bindings.",
                  items: [["React 18", "UI VIRTUAL DOM"], ["TypeScript", "TYPE-SAFETY"], ["TailwindCSS", "UTILITY STYLING"], ["Capacitor", "MOBILE RUNTIME"], ["Web Audio API", "DSP SPECTRUM"]],
                },
                {
                  num: "02", label: "BACKEND", badge: "HOST ENGINE",
                  desc: "Asynchronous Python orchestration kernel managing background daemons, local storage, and secure OAuth tokens.",
                  items: [["Python 3.12", "CORE RUNTIME"], ["Flask", "REST & DISPATCH"], ["SQLite", "VECTOR MEMORY"], ["SSE", "LIVE STREAMING"], ["Custom Agent Tools", "TOOL DISPATCH"], ["Google OAuth", "WORKSPACE AUTH"]],
                },
                {
                  num: "03", label: "AI LAYER", badge: "COGNITIVE SUITE",
                  desc: "Multi-model cognitive pipeline leveraging low-latency inference, biometrics, vision reasoning, and search grounding.",
                  items: [["Groq LLaMA", "FAST REASONING"], ["Gemini Vision", "MULTIMODAL OCR"], ["Whisper", "NEURAL STT"], ["ElevenLabs", "TTS SYNTHESIS"], ["InsightFace", "BIOMETRIC EMBED"], ["Tavily Search", "PARALLEL OSINT"]],
                },
              ].map(col => (
                <div key={col.num} className="border border-white/10 bg-[#111318]/70 p-6 sm:p-8 space-y-6 jarvis-card">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <span className="text-xs font-bold text-[#00E5FF] tracking-widest">{col.num} / {col.label}</span>
                    <span className="text-[10px] px-2 py-0.5 border border-[#00E5FF]/30 text-[#00E5FF] bg-[#00E5FF]/5">{col.badge}</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{col.desc}</p>
                  <div className="space-y-2 text-xs">
                    {col.items.map(([name, tag]) => (
                      <div key={name} className="p-2.5 bg-[#080808] border border-white/10 flex items-center justify-between">
                        <span className="text-white">{name}</span>
                        <span className="text-white/40 text-[10px]">{tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TECH STACK ── */}
        <section className="py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-[#080808] border-b border-white/10">
          <div className="max-w-7xl mx-auto space-y-8 text-center">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-[#00E5FF] font-semibold">// PRODUCTION SPECIFICATION</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">POWERED BY INDUSTRY-STANDARD ARCHITECTURE</h2>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-5xl mx-auto pt-2">
              {STACK.map(t => (
                <span key={t} className="px-4 py-2 bg-[#111318] border border-white/15 text-xs text-white/90 uppercase tracking-wider hover:border-[#00E5FF] hover:text-[#00E5FF] hover:bg-[#00E5FF]/5 transition-all cursor-default">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── BUILDER ── */}
        <section className="py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-[#0a0b0e] border-b border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="border border-white/10 bg-[#111318]/70 p-8 sm:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-10">
              <div className="space-y-5 max-w-xl">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[#00E5FF] font-semibold mb-3">// BUILDER</div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase">Pratham Rathod</h2>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  MS Computer Science @ Northeastern University. Building AI systems that actually work — not demos. JARVIS is a full-stack, production-grade personal AI OS built entirely from scratch.
                </p>
                <div className="flex flex-wrap gap-5 pt-1">
                  {[
                    { label: "EMAIL ↗", href: "mailto:rathod.pr@northeastern.edu" },
                    { label: "GITHUB ↗", href: "https://github.com/rathodpratham15" },
                    { label: "LINKEDIN ↗", href: "https://linkedin.com/in/prathamrathod" },
                  ].map(link => (
                    <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-white/40 hover:text-[#00E5FF] transition-colors tracking-widest border-b border-transparent hover:border-[#00E5FF] pb-0.5">
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <button onClick={onEnter}
                className="flex-shrink-0 px-10 py-4 bg-[#00E5FF] text-black font-bold text-sm tracking-widest hover:bg-[#00E5FF]/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all">
                ACCESS SYSTEM ▶
              </button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="bg-[#050608] py-10 px-4 sm:px-6 lg:px-8 border-t border-white/10 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
              <span className="font-extrabold tracking-widest text-white text-sm">J.A.R.V.I.S.</span>
              <span className="text-white/40">|</span>
              <span className="text-white/50">SELF-HOSTED AI OPERATING SYSTEM</span>
            </div>
            <div className="flex items-center gap-6 text-white/60">
              <a href="#demo" className="hover:text-[#00E5FF] transition-colors">DEMO</a>
              <a href="#capabilities" className="hover:text-[#00E5FF] transition-colors">CAPABILITIES</a>
              <a href="#architecture" className="hover:text-[#00E5FF] transition-colors">ARCHITECTURE</a>
              <a href="https://github.com/rathodpratham15/JARVIS" target="_blank" rel="noopener noreferrer" className="hover:text-[#00E5FF] transition-colors">SOURCE ↗</a>
            </div>
            <div className="text-white/40 text-[11px]">SECURITY ENCLAVE // NOMINAL (0 ERRORS)</div>
          </div>
        </footer>

      </div>
    </div>
  );
};
