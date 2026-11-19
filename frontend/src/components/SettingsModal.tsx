import { useEffect, useState } from 'react';
import {
  Brain,
  Calendar,
  Check,
  FolderOpen,
  LogOut,
  Mail,
  Plus,
  Settings,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useJarvisStore, type SettingsTab } from '../store/useJarvisStore';
import type {
  MemoryCategory,
  MemoryImportance,
  PersonalityMode,
  ThemeMode,
} from '../types/jarvis';

const CATEGORIES: MemoryCategory[] = ['Personal', 'Project', 'Security', 'Work', 'System'];
const IMPORTANCES: MemoryImportance[] = ['High', 'Medium', 'Low'];
const VOICES = [
  { id: 'Kore', label: 'Kore — Clear, balanced' },
  { id: 'Charon', label: 'Charon — Calm, deep' },
  { id: 'Puck', label: 'Puck — Warm, upbeat' },
  { id: 'Fenrir', label: 'Fenrir — Crisp, steady' },
  { id: 'Zephyr', label: 'Zephyr — Bright, natural' },
];

export function SettingsModal() {
  const {
    settingsOpen,
    settingsTab,
    openSettings,
    closeSettings,
    settings,
    updateSettings,
    memories,
    addMemory,
    deleteMemory,
    clearAllMemories,
    user,
    signOut,
  } = useJarvisStore();

  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemCategory, setNewMemCategory] = useState<MemoryCategory>('Personal');
  const [newMemImportance, setNewMemImportance] = useState<MemoryImportance>('Medium');
  const [addingMemory, setAddingMemory] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Load real Google OAuth status from backend on mount
  useEffect(() => {
    if (!settingsOpen) return;
    const token = localStorage.getItem('jarvis_access_token');
    if (!token) return;
    fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5050'}/api/google/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        void updateSettings({
          integrations: {
            calendar: { connected: !!data.calendar, email: data.email },
            gmail: { connected: !!data.gmail, email: data.email },
            drive: { connected: !!data.drive, email: data.email },
          },
        });
      })
      .catch(() => {});
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'integrations', label: 'Integrations', icon: Calendar },
    { id: 'account', label: 'Account', icon: User },
  ];

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle.trim() || !newMemContent.trim()) return;
    setAddingMemory(true);
    try {
      await addMemory({
        title: newMemTitle.trim(),
        content: newMemContent.trim(),
        category: newMemCategory,
        importance: newMemImportance,
      });
      setNewMemTitle('');
      setNewMemContent('');
    } finally {
      setAddingMemory(false);
    }
  };

  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5050';

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const token = localStorage.getItem('jarvis_access_token');
      const res = await fetch(`${BACKEND}/api/google/connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setGoogleLoading(true);
    try {
      const token = localStorage.getItem('jarvis_access_token');
      await fetch(`${BACKEND}/api/google/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      void updateSettings({
        integrations: {
          calendar: { connected: false },
          gmail: { connected: false },
          drive: { connected: false },
        },
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
        onClick={closeSettings}
      />
      <div className="relative z-10 w-full max-w-2xl h-[82vh] max-h-[640px] rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#212121] text-[#171717] dark:text-[#F5F5F5] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-[#E5E5E5] dark:border-white/10 shrink-0">
          <h2 className="font-display font-semibold text-base">Settings</h2>
          <button
            type="button"
            onClick={closeSettings}
            aria-label="Close settings"
            className="p-1.5 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body split: left nav + right panel */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          <nav className="sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-[#E5E5E5] dark:border-white/10 p-2 flex sm:flex-col gap-1 overflow-x-auto bg-[#F9F9F9] dark:bg-[#171717]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = settingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openSettings(tab.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-black/8 dark:bg-[#2A2A2A] font-medium text-[#171717] dark:text-[#F5F5F5]'
                      : 'text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {settingsTab === 'general' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Theme</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                      Choose appearance mode
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F4F4] dark:bg-[#2A2A2A]">
                    {(['dark', 'light', 'system'] as ThemeMode[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => void updateSettings({ theme: t })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                          settings.theme === t
                            ? 'bg-[#FFFFFF] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] shadow-sm'
                            : 'text-[#717171] dark:text-[#A1A1AA]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5E5] dark:border-white/10">
                  <div>
                    <div className="text-sm font-medium">Language</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                      Preferred assistant language
                    </div>
                  </div>
                  <select
                    value={settings.language}
                    onChange={(e) => void updateSettings({ language: e.target.value })}
                    className="rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  >
                    <option value="English (US)">English (US)</option>
                    <option value="English (UK)">English (UK)</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Japanese">Japanese</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5E5] dark:border-white/10">
                  <div>
                    <div className="text-sm font-medium">Personality mode</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                      Default response style
                    </div>
                  </div>
                  <select
                    value={settings.personalityMode}
                    onChange={(e) =>
                      void updateSettings({
                        personalityMode: e.target.value as PersonalityMode,
                      })
                    }
                    className="rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Tactical">Tactical</option>
                    <option value="Formal">Formal</option>
                    <option value="Concise">Concise</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5E5] dark:border-white/10">
                  <div>
                    <div className="text-sm font-medium">Voice</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                      Voice synthesis persona
                    </div>
                  </div>
                  <select
                    value={settings.voice}
                    onChange={(e) => void updateSettings({ voice: e.target.value })}
                    className="rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5E5E5] dark:border-white/10">
                  <div>
                    <div className="text-sm font-medium">Wake word</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                      Phrase used for voice triggers
                    </div>
                  </div>
                  <input
                    type="text"
                    value={settings.wakeWord}
                    onChange={(e) => void updateSettings({ wakeWord: e.target.value })}
                    className="w-40 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  />
                </div>
              </div>
            )}

            {settingsTab === 'memory' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Persistent memory</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                      Automatically remember facts and preferences across conversations
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.memoryEnabled}
                    onClick={() =>
                      void updateSettings({ memoryEnabled: !settings.memoryEnabled })
                    }
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                      settings.memoryEnabled
                        ? 'bg-[#6366f1]'
                        : 'bg-[#E5E5E5] dark:bg-[#3A3A3A]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.memoryEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Add Memory Form */}
                <form
                  onSubmit={(e) => void handleAddMemory(e)}
                  className="rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] p-3.5 space-y-3"
                >
                  <div className="text-xs font-medium text-[#717171] dark:text-[#A1A1AA]">
                    Add a memory manually
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newMemTitle}
                      onChange={(e) => setNewMemTitle(e.target.value)}
                      placeholder="Short title"
                      className="sm:col-span-1 rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                    />
                    <select
                      value={newMemCategory}
                      onChange={(e) =>
                        setNewMemCategory(e.target.value as MemoryCategory)
                      }
                      className="rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-2.5 py-1.5 text-xs focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newMemImportance}
                      onChange={(e) =>
                        setNewMemImportance(e.target.value as MemoryImportance)
                      }
                      className="rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-2.5 py-1.5 text-xs focus:outline-none"
                    >
                      {IMPORTANCES.map((imp) => (
                        <option key={imp} value={imp}>
                          {imp} priority
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMemContent}
                      onChange={(e) => setNewMemContent(e.target.value)}
                      placeholder="What should JARVIS remember?"
                      className="flex-1 rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                    />
                    <button
                      type="submit"
                      disabled={addingMemory || !newMemTitle.trim() || !newMemContent.trim()}
                      className="px-3 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#5558e6] text-white text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </form>

                {/* Memory List Header */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs font-medium text-[#717171] dark:text-[#A1A1AA] tabular-nums">
                    Saved memories ({memories.length})
                  </div>
                  {memories.length > 0 && (
                    confirmClearAll ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-500">Clear all?</span>
                        <button
                          type="button"
                          onClick={() => {
                            void clearAllMemories();
                            setConfirmClearAll(false);
                          }}
                          className="text-red-500 font-medium underline cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearAll(false)}
                          className="text-[#717171] dark:text-[#A1A1AA] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(true)}
                        className="text-xs text-red-500 hover:underline cursor-pointer"
                      >
                        Clear all
                      </button>
                    )
                  )}
                </div>

                {memories.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#717171] dark:text-[#A1A1AA]">
                    No memories saved yet. JARVIS learns key preferences and details automatically as you chat.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E5E5] dark:divide-white/10 rounded-xl border border-[#E5E5E5] dark:border-white/10">
                    {memories.map((mem) => (
                      <div
                        key={mem.id}
                        className="flex items-start justify-between gap-3 p-3.5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
                            {mem.title}
                          </div>
                          <div className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-0.5">
                            {mem.content}
                          </div>
                          <div className="text-[11px] text-[#717171] dark:text-[#A1A1AA] mt-1">
                            {mem.category} · {mem.importance} importance
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteMemory(mem.id)}
                          aria-label={`Delete ${mem.title}`}
                          className="p-1.5 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-red-500 hover:bg-red-500/10 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {settingsTab === 'integrations' && (
              <div className="space-y-4">
                <p className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                  Connect your Google workspace services so JARVIS knows which accounts are linked for scheduling, email, and files.
                </p>

                <div className="divide-y divide-[#E5E5E5] dark:divide-white/10 rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717]">
                  {(
                    [
                      {
                        key: 'calendar',
                        name: 'Google Calendar',
                        desc: 'Read upcoming events and schedule reminders',
                        icon: Calendar,
                      },
                      {
                        key: 'gmail',
                        name: 'Gmail',
                        desc: 'Summarize threads and draft email replies',
                        icon: Mail,
                      },
                      {
                        key: 'drive',
                        name: 'Google Drive',
                        desc: 'Search documents and reference personal notes',
                        icon: FolderOpen,
                      },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const status = settings.integrations[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-4 p-4"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#6366f1]/10 text-[#6366f1] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{item.name}</div>
                            <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                              {status.connected
                                ? `Connected (${status.email || user?.email})`
                                : item.desc}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={googleLoading}
                          onClick={status.connected ? handleGoogleDisconnect : handleGoogleConnect}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 ${
                            status.connected
                              ? 'border border-[#E5E5E5] dark:border-white/15 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                              : 'bg-[#6366f1] hover:bg-[#5558e6] text-white'
                          }`}
                        >
                          {status.connected ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Connected</span>
                            </>
                          ) : (
                            <span>{googleLoading ? 'Connecting…' : 'Connect'}</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {settingsTab === 'account' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717]">
                  <div className="w-11 h-11 rounded-full bg-[#6366f1]/15 text-[#6366f1] flex items-center justify-center text-sm font-semibold shrink-0">
                    {user?.initials || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{user?.name}</div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA] truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E5E5] dark:border-white/10 divide-y divide-[#E5E5E5] dark:divide-white/10">
                  <div className="p-4">
                    <button
                      type="button"
                      onClick={() => setShowTerms((v) => !v)}
                      className="w-full flex items-center justify-between text-sm font-medium cursor-pointer"
                    >
                      <span>Terms of use</span>
                      <span className="text-xs text-[#6366f1]">
                        {showTerms ? 'Hide' : 'View'}
                      </span>
                    </button>
                    {showTerms && (
                      <p className="mt-3 text-xs text-[#717171] dark:text-[#A1A1AA] leading-relaxed">
                        JARVIS is a personal AI workspace. Conversations, contacts,
                        enrolled Vision profiles, and memories are stored for your personal
                        assistant sessions. Always verify critical information independently.
                      </p>
                    )}
                  </div>

                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Sign out</div>
                      <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                        Lock this session on this browser
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeSettings();
                        void signOut();
                      }}
                      className="px-4 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 hover:bg-red-500/10 hover:text-red-500 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
