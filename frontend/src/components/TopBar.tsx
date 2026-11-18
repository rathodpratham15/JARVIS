import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AudioLines,
  Brain,
  Check,
  ChevronDown,
  Menu,
  ScanFace,
} from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';
import type { PersonalityMode } from '../types/jarvis';

const PERSONALITIES: Array<{
  id: PersonalityMode;
  label: string;
  description: string;
}> = [
  { id: 'Standard', label: 'Standard', description: 'Balanced, conversational' },
  { id: 'Tactical', label: 'Tactical', description: 'Direct, brief, action-oriented' },
  { id: 'Formal', label: 'Formal', description: 'Professional, structured' },
  { id: 'Concise', label: 'Concise', description: 'One to two sentences max' },
];

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    settings,
    memories,
    setMobileDrawerOpen,
    setPersonalityMode,
    openSettings,
    setVoiceOpen,
    setVisionOpen,
  } = useJarvisStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const memoryTooltip = settings.memoryEnabled
    ? `Memory active — ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} loaded into this conversation.`
    : 'Memory is currently paused. Click to manage memory settings.';

  const pageTitle =
    location.pathname === '/contacts'
      ? 'Contacts'
      : location.pathname === '/my-contacts'
        ? 'My Contacts'
        : location.pathname === '/scheduled'
          ? 'Scheduled'
          : location.pathname === '/library'
            ? 'Library'
            : null;

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-3 sm:px-5 border-b border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#212121]">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open navigation"
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {pageTitle ? (
          <div className="flex items-center gap-3">
            <h2 className="font-display font-semibold text-base text-[#171717] dark:text-[#F5F5F5] whitespace-nowrap">
              {pageTitle}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-[#6366f1] hover:underline whitespace-nowrap cursor-pointer"
            >
              Back to chat
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>JARVIS</span>
              <span className="text-[#717171] dark:text-[#A1A1AA] font-normal">
                · {settings.personalityMode}
              </span>
              <ChevronDown className="w-4 h-4 text-[#717171] dark:text-[#A1A1AA]" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
                <div className="absolute left-0 top-11 z-30 w-72 rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-xl p-1.5">
                  <div className="px-3 py-1.5 text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA]">
                    Personality mode
                  </div>
                  {PERSONALITIES.map((mode) => {
                    const active = settings.personalityMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          void setPersonalityMode(mode.id);
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-black/5 dark:bg-white/10'
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
                            {mode.label}
                          </div>
                          <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                            {mode.description}
                          </div>
                        </div>
                        {active && <Check className="w-4 h-4 text-[#6366f1] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => openSettings('memory')}
          title={memoryTooltip}
          aria-label={memoryTooltip}
          className={`flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
            settings.memoryEnabled
              ? 'text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
              : 'text-[#717171] dark:text-[#A1A1AA] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Brain
            className={`w-4 h-4 ${settings.memoryEnabled ? 'text-[#6366f1]' : 'text-current'}`}
          />
          <span className="hidden sm:inline tabular-nums">
            {settings.memoryEnabled ? `${memories.length}` : 'Off'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          title="Open Voice mode"
          aria-label="Open Voice mode"
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <AudioLines className="w-4 h-4" />
          <span className="hidden sm:inline">Voice</span>
        </button>

        <button
          type="button"
          onClick={() => setVisionOpen(true)}
          title="Open Vision camera"
          aria-label="Open Vision camera"
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <ScanFace className="w-4 h-4" />
          <span className="hidden sm:inline">Vision</span>
        </button>
      </div>
    </header>
  );
}
