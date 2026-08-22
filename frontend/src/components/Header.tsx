import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  Menu,
  Bell,
  CheckCheck,
  AlertCircle,
  Info,
} from "lucide-react";
import { PageId, PersonalityMode, ServiceHealth, ThemeAccent, AppNotification } from "../types";
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
  notifications?: AppNotification[];
  onMarkAllRead?: () => void;
  onNotificationClick?: (n: AppNotification) => void;
}

const typeIcon = (type: AppNotification["type"]) => {
  if (type === "success") return <CheckCheck className="w-3 h-3 text-emerald-500 shrink-0" />;
  if (type === "error")   return <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />;
  return                         <Info className="w-3 h-3 text-[#00E5FF] shrink-0" />;
};

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onSelectPage,
  personalityMode,
  onSelectPersonality,
  onOpenResearch,
  speechEnabled,
  onToggleSpeech,
  onToggleMobileSidebar,
  notifications = [],
  onMarkAllRead,
  onNotificationClick,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [personalityDropdownOpen, setPersonalityDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

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

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  const handleBellOpen = () => {
    setBellOpen(prev => !prev);
  };

  const handleMarkAll = () => {
    onMarkAllRead?.();
  };

  const personalities: PersonalityMode[] = ["Standard", "Tactical", "Formal", "Concise"];

  return (
    <header className="w-full bg-[#F2F2EF] border-b border-[#1a1a1a] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        {/* Left */}
        <div className="flex items-center gap-3">
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
            <span className="font-mono text-[10px] text-[#555] uppercase">SYS CLOCK</span>
            <span className="font-mono text-[11px] font-bold text-[#1a1a1a] bg-[#EBEBEA] px-2 py-0.5 border border-[#1a1a1a]/40">
              {currentTime || "00:00:00 UTC"}
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Personality dropdown */}
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
                    onClick={() => { onSelectPersonality(mode); setPersonalityDropdownOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-mono transition flex items-center justify-between ${
                      personalityMode === mode
                        ? "bg-[#00E5FF] text-black font-bold"
                        : "text-[#1a1a1a] hover:bg-black/5"
                    }`}
                  >
                    <span>{mode}</span>
                    {personalityMode === mode && <span className="w-1.5 h-1.5 bg-black" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={handleBellOpen}
              className={`relative h-8 w-8 border border-[#1a1a1a] flex items-center justify-center transition ${
                bellOpen ? "bg-[#00E5FF] text-black" : "bg-[#EBEBEA] text-[#555] hover:text-[#1a1a1a]"
              }`}
              title="Notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white font-mono text-[9px] font-bold flex items-center justify-center border border-[#F2F2EF]">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-[#F2F2EF] border border-[#1a1a1a] shadow-xl z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] bg-[#EBEBEA]">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                    Notifications {unread > 0 && `(${unread} new)`}
                  </span>
                  {unread > 0 && (
                    <button
                      onClick={handleMarkAll}
                      className="font-mono text-[9px] text-[#555] hover:text-[#1a1a1a] underline transition"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center font-mono text-[11px] text-[#555]">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          onNotificationClick?.(n);
                          if (n.page) onSelectPage(n.page);
                          setBellOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 border-b border-[#1a1a1a]/10 flex items-start gap-2.5 transition hover:bg-black/5 ${
                          !n.read ? "bg-[#EBEBEA]" : ""
                        }`}
                      >
                        <span className="mt-0.5">{typeIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-mono text-[11px] leading-snug truncate ${!n.read ? "font-bold text-[#1a1a1a]" : "text-[#333]"}`}>
                            {n.title}
                          </p>
                          <p className="font-mono text-[10px] text-[#555] mt-0.5 leading-snug line-clamp-2">
                            {n.body}
                          </p>
                          <p className="font-mono text-[9px] text-[#999] mt-1">{n.timestamp}</p>
                        </div>
                        {!n.read && <span className="w-1.5 h-1.5 bg-[#00E5FF] border border-[#1a1a1a] shrink-0 mt-1" />}
                      </button>
                    ))
                  )}
                </div>
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
              speechEnabled ? "bg-[#00E5FF] text-black" : "bg-[#EBEBEA] text-[#555] hover:text-[#1a1a1a]"
            }`}
            title={speechEnabled ? "Voice Output Active" : "Voice Output Muted"}
          >
            {speechEnabled ? <Volume2 className="w-3.5 h-3.5 text-black" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
