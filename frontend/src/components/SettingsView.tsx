import React, { useState } from "react";
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
} from "lucide-react";
import { PersonalityMode, ThemeAccent } from "../types";
import { THEME_CONFIGS } from "../utils/theme";
import { playUiSound } from "../utils/audio";

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
  const [selectedModel, setSelectedModel] = useState("gemini-3.6-flash");
  const [selectedVoice, setSelectedVoice] = useState("Kore (British Male - J.A.R.V.I.S.)");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    playUiSound("success");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 08</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
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
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                Cognitive Processor
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Gemini reasoning models, temperature scaling, and voice acoustics
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            <div className="space-y-4">
              {/* Provider & API Status */}
              <div className="space-y-1.5">
                <label className="label-secondary">AI INFERENCE PROVIDER</label>
                <div className="p-3 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-[#1a1a1a]">Google Gemini API (Server-Side Proxy)</span>
                  <span className="px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a] text-[10px]">
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
                  <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended Default)</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tactical Synthesis)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast Latency)</option>
                </select>
              </div>

              <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

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
                    <option value="Fenrir (Deep Tactical)">Fenrir (Deep Tactical)</option>
                  </select>
                </div>
              </div>

              {/* Verbal Speech Toggle */}
              <div className="p-3 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#1a1a1a]" />
                  <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                    SYNTHESIZE VERBAL SPEECH (TTS)
                  </span>
                </div>
                <button
                  onClick={onToggleSpeech}
                  className={`w-9 h-5 border border-[#1a1a1a] transition p-0.5 flex items-center ${
                    speechEnabled ? "bg-[#00E5FF] justify-end" : "bg-[#ccc] justify-start"
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
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                Visual Archetype
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Stark Neo-Brutalist & Editorial theme configurations
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

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
                      className={`w-full p-3 border border-[#1a1a1a] text-left flex items-center justify-between transition ${
                        isSelected
                          ? "bg-[#00E5FF] text-black font-bold"
                          : "bg-[#EBEBEA] text-[#1a1a1a] hover:bg-black/5"
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

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* System Info */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>CORE VERSION</span>
                <span className="font-bold text-[#1a1a1a]">J.A.R.V.I.S. v4.2 EDITORIAL</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>FRAMEWORK</span>
                <span className="font-bold text-[#1a1a1a]">REACT 18 + TAILWIND CSS</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>STORAGE</span>
                <span className="font-bold text-[#1a1a1a]">LOCAL STORAGE PERSISTENCE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
