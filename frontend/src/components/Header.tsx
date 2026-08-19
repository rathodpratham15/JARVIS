import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Search,
  Sparkles,
  ChevronDown,
  Cpu,
  Menu,
} from "lucide-react";
import { PageId, PersonalityMode, ServiceHealth, ThemeAccent } from "../types";
import { stopJarvisSpeech } from "../utils/audio";

interface HeaderProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  services: ServiceHealth[];
  personalityMode: PersonalityMode;
  onSelectPersonality: (mode: PersonalityMode) => void;
  onOpenResearch: () => void;
  speechEnabled: boolean;
  onToggleSpeech: () => void;
  accentColor: ThemeAccent;
  onChangeAccentColor: (color: ThemeAccent) => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onSelectPage,
  personalityMode,
  onSelectPersonality,
  onOpenResearch,
  speechEnabled,
  onToggleSpeech,
  onToggleMobileSidebar,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [personalityDropdownOpen, setPersonalityDropdownOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " UTC"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const personalities: PersonalityMode[] = [
    "Standard",
    "Tactical",
    "Formal",
    "Concise",
  ];

  return (
    <header className="w-full bg-[#F2F2EF] border-b border-[#1a1a1a] sticky top-0 z-50">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          {/* Mobile sidebar trigger */}
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden h-8 w-8 flex items-center justify-center border border-[#1a1a1a] bg-[#EBEBEA] hover:bg-black/10 transition shrink-0"
            title="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectPage("dashboard")}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-2.5 h-2.5 bg-[#00E5FF] border border-[#1a1a1a] animate-pulse" />
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-bold text-sm tracking-wider text-[#1a1a1a] uppercase">
                J.A.R.V.I.S.
              </span>
              <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest hidden sm:inline">
                // PERSONAL AI OS
              </span>
            </div>
          </button>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#1a1a1a]/20">
            <span className="font-mono text-[10px] text-[#555] uppercase">
              SYS CLOCK
            </span>
            <span className="font-mono text-[11px] font-bold text-[#1a1a1a] bg-[#EBEBEA] px-2 py-0.5 border border-[#1a1a1a]/40">
              {currentTime || "03:40:00 UTC"}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Personality Mode Dropdown */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setPersonalityDropdownOpen(!personalityDropdownOpen)}
              className="editorial-btn-outline text-[10px] py-1.5 px-2.5 h-8 gap-1.5 bg-[#EBEBEA]"
              title="Change Personality Directive"
            >
              <Sparkles className="w-3 h-3 text-[#1a1a1a]" />
              <span className="truncate max-w-[90px]">{personalityMode}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {personalityDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-[#F2F2EF] border border-[#1a1a1a] shadow-lg z-50 p-1">
                <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#555] border-b border-[#1a1a1a]/20 mb-1">
                  Personality Protocol
                </div>
                {personalities.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onSelectPersonality(mode);
                      setPersonalityDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-mono transition flex items-center justify-between ${
                      personalityMode === mode
                        ? "bg-[#00E5FF] text-black font-bold"
                        : "text-[#1a1a1a] hover:bg-black/5"
                    }`}
                  >
                    <span>{mode}</span>
                    {personalityMode === mode && (
                      <span className="w-1.5 h-1.5 bg-black" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Audio TTS Toggle */}
          <button
            onClick={() => {
              if (speechEnabled) stopJarvisSpeech();
              onToggleSpeech();
            }}
            className={`h-8 w-8 border border-[#1a1a1a] flex items-center justify-center transition ${
              speechEnabled
                ? "bg-[#00E5FF] text-black"
                : "bg-[#EBEBEA] text-[#555] hover:text-[#1a1a1a]"
            }`}
            title={speechEnabled ? "Voice Output Active" : "Voice Output Muted"}
          >
            {speechEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-black" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

        </div>
      </div>
    </header>
  );
};
