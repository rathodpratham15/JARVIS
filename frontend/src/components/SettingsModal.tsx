import { useEffect, useState } from 'react';
import {
  Brain,
  Calendar,
  Check,
  ChevronDown,
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
  const [googleExpanded, setGoogleExpanded] = useState(false);

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
    if (!window.confirm('This will disconnect all Google services (Calendar, Gmail, Drive). Continue?')) return;
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
                  Connect your Google account to give JARVIS access to your workspace services.
                </p>

                {/* Single Google connection row */}
                <div className="rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Google logo */}
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center shrink-0 border border-[#E5E5E5] dark:border-white/10">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Google</div>
                        <div className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                          {settings.integrations.gmail.connected
                            ? (settings.integrations.gmail.email
                                ? `Connected as ${settings.integrations.gmail.email}`
                                : 'Connected')
                            : 'Calendar · Gmail · Drive · Contacts'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Expand/collapse to show services */}
                      {settings.integrations.gmail.connected && (
                        <button
                          type="button"
                          onClick={() => setGoogleExpanded(v => !v)}
                          className="p-1.5 rounded-lg text-[#717171] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${googleExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={googleLoading}
                        onClick={settings.integrations.gmail.connected ? handleGoogleDisconnect : handleGoogleConnect}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 ${
                          settings.integrations.gmail.connected
                            ? 'border border-[#E5E5E5] dark:border-white/15 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                            : 'bg-[#6366f1] hover:bg-[#5558e6] text-white'
                        }`}
                      >
                        {settings.integrations.gmail.connected ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Connected</span>
                          </>
                        ) : (
                          <span>{googleLoading ? 'Connecting…' : 'Connect'}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable services list */}
                  {googleExpanded && settings.integrations.gmail.connected && (
                    <div className="border-t border-[#E5E5E5] dark:border-white/10 px-4 py-3 space-y-2.5">
                      <p className="text-[11px] text-[#717171] dark:text-[#A1A1AA] uppercase tracking-wide font-medium">Included services</p>
                      {([
                        { key: 'calendar', label: 'Google Calendar', desc: 'Events & reminders', icon: Calendar },
                        { key: 'gmail',    label: 'Gmail',           desc: 'Email summarisation', icon: Mail },
                        { key: 'drive',    label: 'Google Drive',    desc: 'Documents & files', icon: FolderOpen },
                      ] as const).map(({ key, label, desc, icon: Icon }) => (
                        <div key={key} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            settings.integrations[key].connected
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-[#E5E5E5] dark:bg-white/10 text-[#717171]'
                          }`}>
                            <Icon className="w-3 h-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium">{label}</span>
                            <span className="text-xs text-[#717171] dark:text-[#A1A1AA]"> — {desc}</span>
                          </div>
                          {settings.integrations[key].connected && (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
