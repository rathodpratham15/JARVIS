import React, { useState, useEffect } from "react";
import {
  Cpu,
  Mic,
  Eye,
  Database,
  MessageSquare,
  FileText,
  Clock,
  Bell,
  Search,
  Play,
  ArrowRight,
  Zap,
  Volume2,
  VolumeX,
  ChevronDown,
  Activity,
  Puzzle,
} from "lucide-react";
import {
  ServiceHealth,
  ActivityLog,
  AgentTask,
  PageId,
  PersonalityMode,
  ThemeAccent,
} from "../types";
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
  messagesCount?: number;
  notesCount?: number;
  schedulesCount?: number;
  tasksCompletedCount?: number;
  tasksRunningCount?: number;
  remindersCount?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  services,
  logs = [],
  onSelectPage,
  onOpenResearch,
  onOpenAgentTask,
  personalityMode = "Standard",
  onSelectPersonality,
  speechEnabled = false,
  onToggleSpeech,
  messagesCount = 0,
  notesCount = 0,
  schedulesCount = 0,
  tasksCompletedCount = 0,
  tasksRunningCount = 0,
  remindersCount = 0,
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

  const getServiceIcon = (id: string) => {
    switch (id) {
      case "llm": return <Cpu className="w-4 h-4 text-[#1a1a1a]" />;
      case "voice": return <Mic className="w-4 h-4 text-[#1a1a1a]" />;
      case "vision": return <Eye className="w-4 h-4 text-[#1a1a1a]" />;
      case "memory": return <Database className="w-4 h-4 text-[#1a1a1a]" />;
      case "plugins": return <Puzzle className="w-4 h-4 text-[#1a1a1a]" />;
      default: return <Activity className="w-4 h-4 text-[#1a1a1a]" />;
    }
  };

  const personalities: PersonalityMode[] = ["Standard", "Tactical", "Formal", "Concise"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Clock */}
          <div className="px-3 py-1.5 bg-[#EBEBEA] border border-[#1a1a1a] font-mono text-xs font-bold text-[#1a1a1a] tracking-wider">
            {currentTime || "—"}
          </div>

          {/* Personality Selector */}
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
                      onClick={() => { onSelectPersonality(mode); setPersonalityDropdownOpen(false); playUiSound("beep"); }}
                      className={`w-full text-left px-2.5 py-1.5 transition ${personalityMode === mode ? "bg-[#00E5FF] text-black font-bold" : "text-[#1a1a1a] hover:bg-black/5"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Speech Toggle */}
          {onToggleSpeech && (
            <button
              onClick={() => { onToggleSpeech(); playUiSound("beep"); }}
              className="p-1.5 bg-[#EBEBEA] border border-[#1a1a1a] hover:bg-black/5 transition"
              title={speechEnabled ? "Voice Output Active" : "Voice Output Muted"}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4 text-[#00E5FF]" /> : <VolumeX className="w-4 h-4 text-[#888]" />}
            </button>
          )}

          <button onClick={() => { playUiSound("beep"); onOpenResearch(); }} className="editorial-btn-outline text-xs">
            <Search className="w-3.5 h-3.5" />
            <span>RESEARCH</span>
          </button>

          <button onClick={() => { playUiSound("power"); onOpenAgentTask(); }} className="editorial-btn-primary text-xs">
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>LAUNCH TASK</span>
          </button>
        </div>
      </div>

      {/* Status + Quick Actions */}
      <div className="editorial-panel p-6 sm:p-8 bg-[#F2F2EF] border border-[#1a1a1a]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: System status summary */}
          <div className="lg:col-span-9 space-y-4">
            <div className="inline-block px-2.5 py-1 bg-black text-[#00E5FF] font-mono text-[10px] font-bold tracking-widest border border-[#1a1a1a] uppercase">
              PRIMARY TELEMETRY: {services.length > 0 && services.every(s => s.status === "online") ? "ALL SYSTEMS OPERATIONAL" : services.length === 0 ? "CONNECTING…" : "DEGRADED"}
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1a1a1a]">
              J.A.R.V.I.S. Command Center
            </h2>
            <p className="text-sm text-[#444] leading-relaxed">
              {tasksRunningCount > 0
                ? `${tasksRunningCount} agent task${tasksRunningCount > 1 ? "s" : ""} running. ${tasksCompletedCount} completed total.`
                : tasksCompletedCount > 0
                ? `All agents idle. ${tasksCompletedCount} task${tasksCompletedCount > 1 ? "s" : ""} completed.`
                : "AI assistant online. No active agent tasks."}
              {remindersCount > 0 ? ` ${remindersCount} reminder${remindersCount > 1 ? "s" : ""} pending.` : ""}
            </p>

            {/* Live subsystem health */}
            {services.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center gap-2 p-2 bg-[#EBEBEA] border border-[#1a1a1a]">
                    {getServiceIcon(svc.id)}
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] font-bold text-[#1a1a1a] truncate">{svc.name}</div>
                      <div className={`font-mono text-[9px] font-bold ${svc.status === "online" ? "text-[#00a8bb]" : "text-red-500"}`}>
                        {svc.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="lg:col-span-3 flex flex-col gap-2.5">
            {[
              { label: "VOICE MODE", icon: <Mic className="w-4 h-4" />, page: "voice" as PageId },
              { label: "VISION FEED", icon: <Eye className="w-4 h-4" />, page: "vision" as PageId },
            ].map(({ label, icon, page }) => (
              <button
                key={page}
                onClick={() => { playUiSound("beep"); onSelectPage(page); }}
                className="w-full p-3 bg-[#EBEBEA] hover:bg-[#00E5FF] text-[#1a1a1a] hover:text-black font-mono text-xs font-bold border border-[#1a1a1a] transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">{icon}<span>{label}</span></div>
                <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
            <button
              onClick={() => { playUiSound("beep"); onOpenResearch(); }}
              className="w-full p-3 bg-[#EBEBEA] hover:bg-[#00E5FF] text-[#1a1a1a] hover:text-black font-mono text-xs font-bold border border-[#1a1a1a] transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5"><Search className="w-4 h-4" /><span>RESEARCH</span></div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Real stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "MESSAGES", value: messagesCount, icon: <MessageSquare className="w-4 h-4" />, page: "chat" as PageId, sub: null },
          { label: "TASKS DONE", value: tasksCompletedCount, icon: <Activity className="w-4 h-4" />, page: "tasks" as PageId, sub: tasksRunningCount > 0 ? `${tasksRunningCount} running` : null },
          { label: "NOTES", value: notesCount, icon: <FileText className="w-4 h-4" />, page: "notes" as PageId, sub: null },
          { label: "REMINDERS", value: remindersCount, icon: <Bell className="w-4 h-4" />, page: "reminders" as PageId, sub: null },
        ].map(({ label, value, icon, page, sub }) => (
          <div
            key={label}
            onClick={() => { playUiSound("beep"); onSelectPage(page); }}
            className="editorial-panel p-5 cursor-pointer hover:bg-black/5 transition"
          >
            <div className="flex items-start justify-between">
              <span className="label-secondary">{label}</span>
              <div className="w-8 h-8 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
                {icon}
              </div>
            </div>
            <div className="mt-3 font-serif text-3xl font-bold text-[#1a1a1a]">
              {value}
            </div>
            {sub && (
              <div className="mt-1 font-mono text-[10px] font-bold text-[#00a8bb]">{sub.toUpperCase()}</div>
            )}
          </div>
        ))}
      </div>

      {/* Subsystem Health */}
      {services.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#1a1a1a] fill-[#00E5FF]" />
              <h2 className="font-mono text-sm font-bold tracking-wider text-[#1a1a1a] uppercase">
                Subsystem Health
              </h2>
            </div>
            <span className="px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a] font-mono text-[10px]">
              {services.filter(s => s.status === "online").length}/{services.length} ONLINE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map(svc => (
              <div key={svc.id} className="editorial-panel p-5 space-y-3 bg-[#F2F2EF] hover:border-black transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-center">
                      {getServiceIcon(svc.id)}
                    </div>
                    <span className="font-mono text-xs font-bold text-[#1a1a1a]">{svc.name}</span>
                  </div>
                  <span className={`flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 border border-[#1a1a1a] ${svc.status === "online" ? "bg-black text-[#00E5FF]" : "bg-red-600 text-white"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${svc.status === "online" ? "bg-[#00E5FF] animate-pulse" : "bg-white"}`} />
                    {svc.status.toUpperCase()}
                  </span>
                </div>
                {svc.latencyMs > 0 && (
                  <div className="pt-2 border-t border-dashed border-[#1a1a1a]/30 font-mono text-[11px] text-[#444]">
                    LATENCY: <strong className="text-black">{svc.latencyMs}ms</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Log */}
      {logs.length > 0 && (
        <div className="space-y-3">
          <div className="border-b border-[#1a1a1a] pb-3">
            <h2 className="font-mono text-sm font-bold tracking-wider text-[#1a1a1a] uppercase">
              Recent Activity
            </h2>
          </div>
          <div className="space-y-1">
            {logs.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-center gap-3 p-2 font-mono text-[11px] border-b border-[#1a1a1a]/10">
                <span className="text-[#555] shrink-0">{log.timestamp}</span>
                <span className="px-1.5 py-0.5 bg-[#EBEBEA] border border-[#1a1a1a]/30 text-[9px] font-bold shrink-0">{log.type}</span>
                <span className="text-[#1a1a1a] font-bold shrink-0">{log.title}</span>
                <span className="text-[#555] truncate">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
