import React, { useEffect, useState } from "react";

interface LandingPageProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    icon: "🎤",
    title: "Voice Mode",
    desc: "Wake-word activation, speech-to-text, and ElevenLabs neural TTS — have a full conversation hands-free.",
  },
  {
    icon: "👁️",
    title: "Vision & OSINT",
    desc: "Point a camera at anyone. InsightFace biometrics + Gemini Vision reverse-search surfaces their full public profile in seconds.",
  },
  {
    icon: "🤖",
    title: "Agent Loop",
    desc: "Multi-step ReAct agents with tool use — web search, file ops, code execution — that plan and self-correct.",
  },
  {
    icon: "📧",
    title: "Gmail · Calendar · Drive",
    desc: "Read emails, draft replies, create events, and search Drive — all through natural language via OAuth.",
  },
  {
    icon: "🖥️",
    title: "Computer Use",
    desc: "Screenshots → Gemini Vision → pyautogui. JARVIS sees your screen and controls it like a human operator.",
  },
  {
    icon: "🔬",
    title: "Research Pipeline",
    desc: "Ask about any person or company. Parallel Tavily searches are synthesised into a structured dossier by the LLM.",
  },
  {
    icon: "⏰",
    title: "Autonomous Scheduling",
    desc: "CRON-style jobs run in the background — daily briefings, monitoring tasks, reminder chains.",
  },
  {
    icon: "🔒",
    title: "Secure Multi-User Auth",
    desc: "Google OAuth + email whitelist + bcrypt password auth. JWT sessions, per-user memory, role-based permissions.",
  },
];

const STACK = [
  "Python 3.12", "Flask", "React 18", "TypeScript", "TailwindCSS",
  "Groq LLaMA", "Gemini Vision", "ElevenLabs TTS", "InsightFace",
  "SQLite", "Tavily Search", "Google OAuth", "Capacitor (Android/iOS)",
];

const STATS = [
  { value: "8+", label: "AI Models" },
  { value: "20+", label: "Agent Tools" },
  { value: "3", label: "Platforms" },
  { value: "∞", label: "Possibility" },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [typed, setTyped] = useState("");
  const [blink, setBlink] = useState(true);
  const full = "Personal AI Operating System";

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      setTyped(full.slice(0, i + 1));
      i++;
      if (i >= full.length) clearInterval(t);
    }, 55);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-white font-mono overflow-x-hidden">

      {/* top bar */}
      <div className="border-b border-[#00E5FF]/20 px-6 py-3 flex items-center justify-between">
        <span className="text-[#00E5FF] text-xs tracking-[0.3em] font-bold">J.A.R.V.I.S.</span>
        <div className="flex gap-4">
          <a
            href="https://github.com/rathodpratham15/JARVIS"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/50 hover:text-[#00E5FF] transition-colors tracking-widest"
          >
            GITHUB ↗
          </a>
          <button
            onClick={onEnter}
            className="text-xs text-[#00E5FF] border border-[#00E5FF]/40 px-3 py-1 hover:bg-[#00E5FF]/10 transition-colors tracking-widest"
          >
            SIGN IN
          </button>
        </div>
      </div>

      {/* hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
        <p className="text-[#00E5FF] text-xs tracking-[0.4em] mb-6 opacity-70">SYSTEM ONLINE // v2.0</p>
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4 text-white">
          J.A.R.V.I.S.
        </h1>
        <div className="h-8 flex items-center gap-1 mb-8">
          <span className="text-lg md:text-xl text-[#00E5FF]">{typed}</span>
          <span
            className="inline-block w-0.5 h-5 bg-[#00E5FF]"
            style={{ opacity: blink ? 1 : 0, transition: "opacity 0.1s" }}
          />
        </div>
        <p className="max-w-2xl text-white/50 text-sm md:text-base leading-relaxed mb-10">
          A self-hosted AI assistant that can hear you, see your screen, identify faces,
          research anyone in seconds, and autonomously execute multi-step tasks —
          all running on your own infrastructure.
        </p>

        {/* stats */}
        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-[#00E5FF]">{s.value}</div>
              <div className="text-xs text-white/40 tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={onEnter}
            className="px-8 py-3 bg-[#00E5FF] text-black font-bold text-sm tracking-widest hover:bg-[#00bfdb] transition-colors"
          >
            ACCESS SYSTEM ▶
          </button>
          <a
            href="https://github.com/rathodpratham15/JARVIS"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border border-white/20 text-white/70 text-sm tracking-widest hover:border-[#00E5FF]/50 hover:text-white transition-colors"
          >
            VIEW SOURCE ↗
          </a>
        </div>
      </section>

      {/* divider */}
      <div className="border-t border-[#00E5FF]/10 mx-6" />

      {/* features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-[#00E5FF] text-xs tracking-[0.4em] mb-2 opacity-70">CAPABILITIES</p>
        <h2 className="text-2xl font-bold mb-12 text-white">What JARVIS can do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="border border-white/10 p-5 hover:border-[#00E5FF]/40 hover:bg-[#00E5FF]/5 transition-all group"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="text-sm font-bold text-white mb-2 group-hover:text-[#00E5FF] transition-colors">
                {f.title}
              </div>
              <div className="text-xs text-white/40 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divider */}
      <div className="border-t border-[#00E5FF]/10 mx-6" />

      {/* architecture diagram (ASCII) */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-[#00E5FF] text-xs tracking-[0.4em] mb-2 opacity-70">ARCHITECTURE</p>
        <h2 className="text-2xl font-bold mb-10 text-white">How it's built</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              layer: "01 // FRONTEND",
              items: ["React 18 + TypeScript", "TailwindCSS + Lucide icons", "Capacitor (Android / iOS)", "SSE streaming chat", "Web Audio API"],
            },
            {
              layer: "02 // BACKEND",
              items: ["Python 3.12 + Flask", "SQLite (memory, faces, notes)", "ThreadPoolExecutor agents", "Google OAuth + JWT", "Railway deployment"],
            },
            {
              layer: "03 // AI LAYER",
              items: ["Groq LLaMA (fast inference)", "Gemini Vision (scene + OSINT)", "InsightFace buffalo_sc", "ElevenLabs neural TTS", "Tavily web search"],
            },
          ].map(col => (
            <div key={col.layer} className="border border-white/10 p-6">
              <div className="text-[#00E5FF] text-xs tracking-widest mb-4">{col.layer}</div>
              <ul className="space-y-2">
                {col.items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/60">
                    <span className="text-[#00E5FF] text-xs">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* divider */}
      <div className="border-t border-[#00E5FF]/10 mx-6" />

      {/* tech stack pills */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-[#00E5FF] text-xs tracking-[0.4em] mb-2 opacity-70">TECH STACK</p>
        <h2 className="text-2xl font-bold mb-8 text-white">Built with</h2>
        <div className="flex flex-wrap gap-2">
          {STACK.map(t => (
            <span
              key={t}
              className="border border-white/20 px-3 py-1 text-xs text-white/60 hover:border-[#00E5FF]/50 hover:text-[#00E5FF] transition-colors"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* divider */}
      <div className="border-t border-[#00E5FF]/10 mx-6" />

      {/* built by */}
      <section className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <div>
          <p className="text-[#00E5FF] text-xs tracking-[0.4em] mb-2 opacity-70">BUILDER</p>
          <h2 className="text-2xl font-bold mb-3 text-white">Pratham Rathod</h2>
          <p className="text-sm text-white/50 max-w-md leading-relaxed">
            MS Computer Science @ Northeastern University. Building AI systems
            that actually work — not demos. JARVIS is a full-stack, production-grade
            personal AI OS built entirely from scratch.
          </p>
          <div className="flex gap-4 mt-4">
            <a
              href="mailto:rathod.pr@northeastern.edu"
              className="text-xs text-white/40 hover:text-[#00E5FF] transition-colors tracking-widest"
            >
              EMAIL ↗
            </a>
            <a
              href="https://github.com/rathodpratham15"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-[#00E5FF] transition-colors tracking-widest"
            >
              GITHUB ↗
            </a>
            <a
              href="https://linkedin.com/in/prathamrathod"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-[#00E5FF] transition-colors tracking-widest"
            >
              LINKEDIN ↗
            </a>
          </div>
        </div>
        <button
          onClick={onEnter}
          className="flex-shrink-0 px-10 py-4 bg-[#00E5FF] text-black font-bold text-sm tracking-widest hover:bg-[#00bfdb] transition-colors"
        >
          ACCESS SYSTEM ▶
        </button>
      </section>

      {/* footer */}
      <div className="border-t border-[#00E5FF]/10 px-6 py-6 flex items-center justify-between text-xs text-white/20">
        <span>J.A.R.V.I.S. // JUST A RATHER VERY INTELLIGENT SYSTEM</span>
        <span>SYSTEM NOMINAL</span>
      </div>
    </div>
  );
};
