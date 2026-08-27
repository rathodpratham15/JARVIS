import React, { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  Mic,
  Palette,
  Key,
  Volume2,
  Check,
  Download,
  RotateCcw,
  Mail,
  Calendar,
  HardDrive,
  Link2,
  Link2Off,
  Loader2,
} from "lucide-react";
import { PersonalityMode, ThemeAccent } from "../types";
import { THEME_CONFIGS } from "../utils/theme";
import { playUiSound } from "../utils/audio";
import { API_BASE } from "../utils/api";

interface SettingsViewProps {
  personalityMode: PersonalityMode;
  onSelectPersonality: (mode: PersonalityMode) => void;
  speechEnabled: boolean;
  onToggleSpeech: () => void;
  accentColor: ThemeAccent;
  onChangeAccentColor: (color: ThemeAccent) => void;
  wakeWord: string;
  onChangeWakeWord: (word: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  personalityMode,
  onSelectPersonality,
  speechEnabled,
  onToggleSpeech,
  accentColor,
  onChangeAccentColor,
  wakeWord,
  onChangeWakeWord,
}) => {
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Kore (British Male - J.A.R.V.I.S.)");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [providerName, setProviderName] = useState("—");
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; gmail: boolean; calendar: boolean; drive: boolean } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings ?? {};
        if (s.llm_model) setSelectedModel(s.llm_model);
        if (s.llm_provider) setProviderName(s.llm_provider.toUpperCase());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/google/status`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("jarvis_access_token")}` },
    })
      .then((r) => r.json())
      .then(setGoogleStatus)
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get("google");
    if (googleParam === "connected") {
      window.history.replaceState({}, "", "/settings");
      fetch(`${API_BASE}/api/google/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jarvis_access_token")}` },
      })
        .then((r) => r.json())
        .then(setGoogleStatus)
        .catch(() => {});
    }
  }, []);

  const handleSave = async () => {
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm_model: selectedModel }),
      });
    } catch (_) {}
    playUiSound("success");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleConnectGoogle = async () => {
    setGoogleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/google/connect`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jarvis_access_token")}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setGoogleLoading(false);
      }
    } catch {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGoogleLoading(true);
    try {
      await fetch(`${API_BASE}/api/google/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("jarvis_access_token")}` },
      });
      setGoogleStatus((s) => s ? { ...s, connected: false, gmail: false, calendar: false, drive: false } : s);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleExportDiagnostics = () => {
    playUiSound("beep");
    const data = {
      timestamp: new Date().toISOString(),
      system: "J.A.R.V.I.S. Operations Core",
      model: selectedModel,
      voice: selectedVoice,
      personality: personalityMode,
      theme: accentColor,
      status: "OPERATIONAL",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-diagnostics-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 08</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            System Settings
          </h1>
          <p className="label-secondary mt-1">
            LLM COGNITIVE PARAMETERS, SPEECH SYNTHESIS & HARDWARE INTERFACES
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportDiagnostics}
            className="editorial-btn-outline"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT DIAGNOSTICS</span>
          </button>
          <button
            onClick={handleSave}
            className="editorial-btn-primary"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>SAVED TO CORE</span>
              </>
            ) : (
              <span>APPLY CONFIGURATION</span>
            )}
          </button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: LLM & Voice Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 01</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Cognitive Processor
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Gemini reasoning models, temperature scaling, and voice acoustics
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            <div className="space-y-4">
              {/* Provider & API Status */}
              <div className="space-y-1.5">
                <label className="label-secondary">AI INFERENCE PROVIDER</label>
                <div className="p-3 bg-[#111318] border border-zinc-800 flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white">{providerName} (Server-Side Proxy)</span>
                  <span className="px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-zinc-800 text-[10px]">
                    CONNECTED
                  </span>
                </div>
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="label-secondary">PRIMARY MODEL ENGINE</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="editorial-input"
                >
                  <optgroup label="Groq (Fast)">
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Ultra Fast)</option>
                    <option value="llama-4-scout-17b-16e-instruct">llama-4-scout-17b-16e-instruct</option>
                  </optgroup>
                  <optgroup label="Gemini">
                    <option value="models/gemini-3.6-flash">gemini-3.6-flash (Recommended)</option>
                    <option value="models/gemini-2.5-pro">gemini-2.5-pro (Advanced Reasoning)</option>
                    <option value="models/gemini-2.5-flash">gemini-2.5-flash (Balanced Speed)</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini (Efficient)</option>
                  </optgroup>
                </select>
              </div>

              <div className="border-b border-dashed border-zinc-800/30 my-4" />

              {/* Voice & Wake Word */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-secondary">WAKE WORD TRIGGER</label>
                  <input
                    type="text"
                    value={wakeWord}
                    onChange={(e) => onChangeWakeWord(e.target.value)}
                    className="editorial-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label-secondary">SYNTHESIS ACOUSTICS</label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="editorial-input"
                  >
                    <option value="Kore (British Male - J.A.R.V.I.S.)">Kore (British Male - J.A.R.V.I.S.)</option>
                    <option value="Zephyr (Smooth Baritone)">Zephyr (Smooth Baritone)</option>
                    <option value="Puck (Crisp Tenor)">Puck (Crisp Tenor)</option>
                    <option value="Aoede (Soft Alto)">Aoede (Soft Alto)</option>
                  </select>
                </div>
              </div>

              {/* Verbal Speech Toggle */}
              <div className="p-3 bg-[#111318] border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-white" />
                  <span className="font-mono text-xs font-bold text-white">
                    SYNTHESIZE VERBAL SPEECH (TTS)
                  </span>
                </div>
                <button
                  onClick={onToggleSpeech}
                  className={`w-9 h-5 border border-zinc-800 transition p-0.5 flex items-center ${
                    speechEnabled ? "bg-[#00E5FF] justify-end" : "bg-zinc-700 justify-start"
                  }`}
                >
                  <div className="w-3.5 h-3.5 bg-black" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Schemes & System Manifest (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Visual Archetype
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Stark Neo-Brutalist & Editorial theme configurations
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Theme Palettes Grid */}
            <div className="space-y-2.5">
              <label className="label-secondary">SELECT PALETTE MATRIX</label>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {Object.values(THEME_CONFIGS).map((thm) => {
                  const isSelected = accentColor === thm.id;
                  return (
                    <button
                      key={thm.id}
                      onClick={() => {
                        onChangeAccentColor(thm.id);
                        playUiSound("beep");
                      }}
                      className={`w-full p-3 border border-zinc-800 text-left flex items-center justify-between transition ${
                        isSelected
                          ? "bg-[#00E5FF] text-black font-bold"
                          : "bg-[#111318] text-white hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center -space-x-1">
                          {thm.swatchColors.map((c, i) => (
                            <span
                              key={i}
                              className="w-3 h-3 rounded-full border border-black"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-xs">{thm.name}</span>
                      </div>

                      {isSelected && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 bg-black text-[#00E5FF]">
                          ACTIVE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* System Info */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>CORE VERSION</span>
                <span className="font-bold text-white">J.A.R.V.I.S. v4.2 EDITORIAL</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>FRAMEWORK</span>
                <span className="font-bold text-white">REACT 18 + TAILWIND CSS</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>STORAGE</span>
                <span className="font-bold text-white">LOCAL STORAGE PERSISTENCE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="editorial-panel space-y-6">
        <div>
          <div className="overline-cyan">PANEL 03</div>
          <h2 className="font-serif text-2xl font-bold text-white">
            Integrations
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Connect external services to enable Gmail, Calendar, and Drive access
          </p>
        </div>

        <div className="border-b border-zinc-800" />

        {/* Google Workspace */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white uppercase">Google Workspace</span>
              {googleStatus?.connected && (
                <span className="px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-zinc-800 text-[10px] font-mono">
                  CONNECTED
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Mail, label: "Gmail", key: "gmail" as const },
                { icon: Calendar, label: "Calendar", key: "calendar" as const },
                { icon: HardDrive, label: "Drive", key: "drive" as const },
              ].map(({ icon: Icon, label, key }) => (
                <div
                  key={key}
                  className={`p-2.5 border border-zinc-800 flex items-center gap-2 font-mono text-xs ${
                    googleStatus?.[key]
                      ? "bg-[#00E5FF]/20 text-white"
                      : "bg-[#111318] text-zinc-500"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {googleStatus?.[key] && (
                    <span className="ml-auto text-[10px]">✓</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-400 font-sans">
              {googleStatus?.connected
                ? "JARVIS can read/send emails, manage calendar events, and access Drive files."
                : "Connect to enable Gmail, Calendar, and Drive in chat and agent mode."}
            </p>
          </div>
          <div>
            {googleStatus?.connected ? (
              <button
                onClick={handleDisconnectGoogle}
                disabled={googleLoading}
                className="editorial-btn-outline flex items-center gap-1.5"
              >
                {googleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                <span>DISCONNECT</span>
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={googleLoading}
                className="editorial-btn-primary flex items-center gap-1.5"
              >
                {googleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>CONNECT GOOGLE</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
