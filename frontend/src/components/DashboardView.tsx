import React, { useState, useEffect } from "react";
import {
  Cpu,
  Mic,
  Eye,
  Database,
  Puzzle,
  UserCheck,
  Zap,
  MessageSquare,
  FileText,
  Users,
  Search,
  Volume2,
  VolumeX,
  Play,
  ArrowRight,
  ShieldCheck,
  Activity,
  CheckCircle,
  ExternalLink,
  Sliders,
  ChevronDown,
} from "lucide-react";
import {
  ServiceHealth,
  ActivityLog,
  AgentTask,
  PageId,
  PersonalityMode,
  ThemeAccent,
} from "../types";
import { ArcReactorWidget } from "./ArcReactorWidget";
import { playUiSound } from "../utils/audio";

interface DashboardViewProps {
  services: ServiceHealth[];
  logs?: ActivityLog[];
  activeAgentTask?: AgentTask;
  onSelectPage: (page: PageId) => void;
  onOpenResearch: () => void;
  onOpenAgentTask: () => void;
  personalityMode?: PersonalityMode;
  onSelectPersonality?: (mode: PersonalityMode) => void;
  speechEnabled?: boolean;
  onToggleSpeech?: () => void;
  accentColor?: ThemeAccent;
  onChangeAccentColor?: (color: ThemeAccent) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  services,
  logs = [],
  activeAgentTask,
  onSelectPage,
  onOpenResearch,
  onOpenAgentTask,
  personalityMode = "Stark Protocol",
  onSelectPersonality,
  speechEnabled = true,
  onToggleSpeech,
  accentColor = "brutalist",
  onChangeAccentColor,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [cpuLoad, setCpuLoad] = useState<number>(14);
  const [ramLoad, setRamLoad] = useState<number>(38);
  const [temperature, setTemperature] = useState<number>(38.4);
  const [reactorOutput, setReactorOutput] = useState<string>("98.7%");
  const [personalityDropdownOpen, setPersonalityDropdownOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live Clock updating every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " PST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subtle telemetry simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(Math.floor(12 + Math.random() * 6));
      setRamLoad(Math.floor(36 + Math.random() * 4));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handlePulseArcCore = () => {
    playUiSound("power");
    setReactorOutput("99.9%");
    setStatusMessage("Arc Reactor Core Diagnostics: Peak 99.9% Quantum Coherence.");
    setTimeout(() => {
      setReactorOutput("98.7%");
      setStatusMessage(null);
    }, 3500);
  };

  const getServiceIcon = (id: string) => {
    switch (id) {
      case "llm":
        return <Cpu className="w-4 h-4 text-[#1a1a1a]" />;
      case "voice":
        return <Mic className="w-4 h-4 text-[#1a1a1a]" />;
      case "vision":
        return <Eye className="w-4 h-4 text-[#1a1a1a]" />;
      case "memory":
        return <Database className="w-4 h-4 text-[#1a1a1a]" />;
      case "plugins":
        return <Puzzle className="w-4 h-4 text-[#1a1a1a]" />;
      case "face":
        return <UserCheck className="w-4 h-4 text-[#1a1a1a]" />;
      default:
        return <Activity className="w-4 h-4 text-[#1a1a1a]" />;
    }
  };

  const personalities: PersonalityMode[] = [
    "Stark Protocol",
    "Tactical",
    "Formal",
    "Protocol Zero",
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 00</div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Operational Command Center
          </h1>
          <p className="label-secondary mt-1">
            SYSTEM OVERVIEW, DIAGNOSTIC TELEMETRY, AND ACTIVE SUBSYSTEM HEALTH
          </p>
        </div>

        {/* Top Right Subsystem Telemetry Strip & Quick Action Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Subsystems Micro-Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBEBEA] border border-[#1a1a1a] font-mono text-[11px]">
            <span className="text-[#666] font-bold text-[10px]">SUBSYSTEMS</span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#1a1a1a]/30">
              <span className="relative flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] border border-black" />
              </span>
              <span className="relative flex items-center justify-center">
                <Mic className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] border border-black" />
              </span>
              <span className="relative flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] border border-black" />
              </span>
              <span className="relative flex items-center justify-center">
                <Database className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] border border-black" />
              </span>
              <span className="relative flex items-center justify-center">
                <Puzzle className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] border border-black" />
              </span>
              <span className="relative flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] border border-black" />
              </span>
            </div>
          </div>

          {/* Clock */}
          <div className="px-3 py-1.5 bg-[#EBEBEA] border border-[#1a1a1a] font-mono text-xs font-bold text-[#1a1a1a] tracking-wider">
            {currentTime || "07:00:54 PST"}
          </div>

          {/* Personality Protocol Selector */}
          {onSelectPersonality && (
            <div className="relative">
              <button
                onClick={() => setPersonalityDropdownOpen(!personalityDropdownOpen)}
                className="px-3 py-1.5 bg-[#EBEBEA] border border-[#1a1a1a] text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-black/5 transition"
              >
                <Zap className="w-3.5 h-3.5 text-[#00E5FF] fill-[#00E5FF]" />
                <span>{personalityMode}</span>
                <ChevronDown className="w-3 h-3 text-[#555]" />
              </button>

              {personalityDropdownOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-[#F2F2EF] border border-[#1a1a1a] z-50 shadow-[4px_4px_0px_#1a1a1a] p-1 font-mono text-xs">
                  {personalities.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        onSelectPersonality(mode);
                        setPersonalityDropdownOpen(false);
                        playUiSound("beep");
                      }}
                      className={`w-full text-left px-2.5 py-1.5 transition ${
                        personalityMode === mode
                          ? "bg-[#00E5FF] text-black font-bold"
                          : "text-[#1a1a1a] hover:bg-black/5"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sound Toggle */}
          {onToggleSpeech && (
            <button
              onClick={() => {
                onToggleSpeech();
                playUiSound("beep");
              }}
              className="p-1.5 bg-[#EBEBEA] border border-[#1a1a1a] hover:bg-black/5 transition text-[#1a1a1a]"
              title={speechEnabled ? "Voice Output Active" : "Voice Output Muted"}
            >
              {speechEnabled ? (
                <Volume2 className="w-4 h-4 text-[#00E5FF]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#888]" />
              )}
            </button>
          )}

          {/* Target Research Button */}
          <button
            onClick={() => {
              playUiSound("beep");
              onOpenResearch();
            }}
            className="editorial-btn-outline text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>RESEARCH</span>
          </button>

          {/* Autonomous Agent Task Launch */}
          <button
            onClick={() => {
              playUiSound("power");
              onOpenAgentTask();
            }}
            className="editorial-btn-primary text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>LAUNCH TASK</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-[#00E5FF]/20 border border-[#1a1a1a] flex items-center justify-between font-mono text-xs font-bold text-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-black fill-[#00E5FF]" />
            <span>{statusMessage}</span>
          </div>
          <span className="px-2 py-0.5 bg-black text-[#00E5FF] text-[10px] uppercase">ACTIVE</span>
        </div>
      )}

      {/* Hero Diagnostic Telemetry Banner (Arc Reactor + Center Text + Action Buttons) */}
      <div className="editorial-panel p-6 sm:p-8 bg-[#F2F2EF] border border-[#1a1a1a] relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Arc Reactor Hologram HUD (4 cols) */}
          <div className="lg:col-span-4 flex justify-center lg:justify-start">
            <ArcReactorWidget
              size="lg"
              outputPercent={reactorOutput}
              temperatureC={temperature}
              interactive={true}
              onClick={handlePulseArcCore}
            />
          </div>

          {/* Center: Command Center Telemetry (5 cols) */}
          <div className="lg:col-span-5 space-y-3 text-left">
            <div className="inline-block px-2.5 py-1 bg-black text-[#00E5FF] font-mono text-[10px] font-bold tracking-widest border border-[#1a1a1a] uppercase">
              PRIMARY TELEMETRY: ALL SYSTEMS OPERATIONAL
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1a1a1a] tracking-tight">
              J.A.R.V.I.S. Command Center
            </h2>

            <p className="text-xs sm:text-sm text-[#444] font-sans leading-relaxed">
              Neural framework active. Multi-threaded processing running at peak efficiency. Connected to StarkNet orbital satellites & local workshop grid.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 font-mono text-xs font-bold text-[#1a1a1a]">
              <span>CPU: <strong className="text-black">{cpuLoad}%</strong></span>
              <span className="text-[#00E5FF] font-black">•</span>
              <span>RAM: <strong className="text-black">{ramLoad}% (12.4 GB)</strong></span>
              <span className="text-[#00E5FF] font-black">•</span>
              <span>TEMP: <strong className="text-black">{temperature}°C STABLE</strong></span>
            </div>
          </div>

          {/* Right: Quick Action Buttons (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-2.5">
            <button
              onClick={() => {
                playUiSound("beep");
                onSelectPage("voice");
              }}
              className="w-full p-3 bg-[#EBEBEA] hover:bg-[#00E5FF] text-[#1a1a1a] hover:text-black font-mono text-xs font-bold border border-[#1a1a1a] transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-[#1a1a1a]" />
                <span>VOICE MODE</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => {
                playUiSound("beep");
                onSelectPage("vision");
              }}
              className="w-full p-3 bg-[#EBEBEA] hover:bg-[#00E5FF] text-[#1a1a1a] hover:text-black font-mono text-xs font-bold border border-[#1a1a1a] transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-[#1a1a1a]" />
                <span>VISION FEED</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => {
                playUiSound("beep");
                onOpenResearch();
              }}
              className="w-full p-3 bg-[#EBEBEA] hover:bg-[#00E5FF] text-[#1a1a1a] hover:text-black font-mono text-xs font-bold border border-[#1a1a1a] transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-[#1a1a1a]" />
                <span>TARGET RESEARCH</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* 4-Column Stat Metric Cards (Interactions, Directives, Plugins, Dossiers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Interactions */}
        <div
          onClick={() => {
            playUiSound("beep");
            onSelectPage("chat");
          }}
          className="editorial-panel p-5 cursor-pointer hover:bg-black/5 transition group relative"
        >
          <div className="flex items-start justify-between">
            <span className="label-secondary">INTERACTIONS</span>
            <div className="w-8 h-8 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#1a1a1a]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl font-bold text-[#1a1a1a]">
              2,849
            </div>
            <div className="font-mono text-[11px] text-[#00a8bb] font-bold mt-1">
              +12 today
            </div>
          </div>
        </div>

        {/* Metric 2: Directives */}
        <div
          onClick={() => {
            playUiSound("beep");
            onSelectPage("notes");
          }}
          className="editorial-panel p-5 cursor-pointer hover:bg-black/5 transition group relative"
        >
          <div className="flex items-start justify-between">
            <span className="label-secondary">DIRECTIVES</span>
            <div className="w-8 h-8 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#1a1a1a]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl font-bold text-[#1a1a1a]">
              18 ACTIVE
            </div>
            <div className="font-mono text-[11px] text-amber-600 font-bold mt-1">
              2 Critical Pending
            </div>
          </div>
        </div>

        {/* Metric 3: Active Plugins */}
        <div
          onClick={() => {
            playUiSound("beep");
            onSelectPage("plugins");
          }}
          className="editorial-panel p-5 cursor-pointer hover:bg-black/5 transition group relative"
        >
          <div className="flex items-start justify-between">
            <span className="label-secondary">ACTIVE PLUGINS</span>
            <div className="w-8 h-8 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
              <Puzzle className="w-4 h-4 text-[#1a1a1a]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl font-bold text-[#1a1a1a]">
              8 / 12
            </div>
            <div className="font-mono text-[11px] text-[#555] font-bold mt-1">
              StarkNet Connected
            </div>
          </div>
        </div>

        {/* Metric 4: Known Dossiers */}
        <div
          onClick={() => {
            playUiSound("beep");
            onOpenResearch();
          }}
          className="editorial-panel p-5 cursor-pointer hover:bg-black/5 transition group relative"
        >
          <div className="flex items-start justify-between">
            <span className="label-secondary">KNOWN DOSSIERS</span>
            <div className="w-8 h-8 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#1a1a1a]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl font-bold text-[#1a1a1a]">
              14 TARGETS
            </div>
            <div className="font-mono text-[11px] text-[#00a8bb] font-bold mt-1">
              4 Biometrics Match
            </div>
          </div>
        </div>
      </div>

      {/* Subsystem Health Indicators Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#1a1a1a] fill-[#00E5FF]" />
            <h2 className="font-mono text-sm font-bold tracking-wider text-[#1a1a1a] uppercase">
              Subsystem Health Indicators
            </h2>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a] text-[10px]">
              6/6 ONLINE
            </span>
          </div>
        </div>

        {/* 6 Subsystem Cards Grid (3 cols x 2 rows) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="editorial-panel p-5 space-y-3 bg-[#F2F2EF] hover:border-black transition"
            >
              {/* Header: Icon, Name & Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
                    {getServiceIcon(svc.id)}
                  </div>
                  <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                    {svc.name}
                  </span>
                </div>
                <span className="flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 bg-black text-[#00E5FF] border border-[#1a1a1a]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
                  ONLINE
                </span>
              </div>

              {/* Subsystem Details Description */}
              <p className="text-xs text-[#555] font-sans">
                {svc.details}
              </p>

              {/* Latency & Load Metrics */}
              <div className="pt-2 border-t border-dashed border-[#1a1a1a]/30 flex items-center justify-between font-mono text-[11px] text-[#444]">
                <span>
                  LATENCY: <strong className="text-black">{svc.latencyMs}ms</strong>
                </span>
                <span>
                  LOAD: <strong className="text-black">{svc.loadPercent}%</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
