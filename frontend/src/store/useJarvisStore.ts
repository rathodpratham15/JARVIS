import { create } from 'zustand';
import { api, storeTokens, clearTokens, getToken, getRefreshToken, getTokenPayload } from '../lib/api';
import type {
  AppSettings,
  ChatMessage,
  Contact,
  ConversationSummary,
  EnrolledPerson,
  MemoryCategory,
  MemoryImportance,
  MemoryItem,
  MessageAttachment,
  PersonalityMode,
  PendingConfirm,
  Project,
  ThemeMode,
  UserProfile,
} from '../types/jarvis';

export type SettingsTab = 'general' | 'memory' | 'integrations' | 'account';

const PROJECTS_KEY = 'jarvis_projects';

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // ignore
  }
}

interface JarvisState {
  initialized: boolean;
  user: UserProfile | null;
  settings: AppSettings;
  history: ConversationSummary[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  memories: MemoryItem[];
  contacts: Contact[];
  enrolledFaces: EnrolledPerson[];

  // Projects
  projects: Project[];
  addProject: (name: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  // Onboarding
  userDisplayName: string;
  setUserDisplayName: (name: string) => void;

  // Tool confirmation
  pendingConfirm: PendingConfirm | null;
  setPendingConfirm: (c: PendingConfirm | null) => void;
  resolveConfirm: (response: string | null) => void;

  // Streaming state
  streamStatus: 'idle' | 'waiting' | 'streaming' | 'error';
  streamError: string | null;
  abortController: AbortController | null;

  // Audio / TTS playback state
  speakingMessageId: string | null;
  ttsLoadingId: string | null;
  activeAudio: HTMLAudioElement | null;

  // UI state
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  searchOpen: boolean;
  voiceOpen: boolean;
  visionOpen: boolean;
  selectedContactId: string | null;

  // Actions
  bootstrap: () => Promise<void>;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSearchOpen: (open: boolean) => void;
  setVoiceOpen: (open: boolean) => void;
  setVisionOpen: (open: boolean) => void;
  setSelectedContactId: (id: string | null) => void;

  applyTheme: (theme: ThemeMode) => void;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  setPersonalityMode: (mode: PersonalityMode) => Promise<void>;

  startNewChat: () => void;
  loadConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  refreshHistory: () => Promise<void>;

  sendMessage: (
    text: string,
    attachments?: MessageAttachment[],
    options?: { replaceFromMessageId?: string }
  ) => Promise<void>;
  stopGeneration: () => void;
  regenerateLastResponse: (assistantMessageId: string) => Promise<void>;
  editUserMessage: (messageId: string, newContent: string) => Promise<void>;
  setFeedback: (messageId: string, feedback: 'up' | 'down' | null) => Promise<void>;

  speakMessage: (messageId: string, text: string) => Promise<void>;
  stopSpeaking: () => void;

  refreshMemories: () => Promise<void>;
  addMemory: (data: {
    title: string;
    content: string;
    category: MemoryCategory;
    importance: MemoryImportance;
  }) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearAllMemories: () => Promise<void>;

  refreshContacts: () => Promise<void>;
  createContact: (data: Partial<Contact>) => Promise<Contact>;
  updateContact: (id: string, data: Partial<Contact>) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;

  refreshEnrolledFaces: () => Promise<void>;
  deleteEnrolledFace: (id: string) => Promise<void>;

  appendVoiceTurn: (userText: string, assistantText: string, conversationId: string) => void;

  signOut: () => Promise<void>;
  signIn: (name: string, email: string, password?: string) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'English (US)',
  personalityMode: 'Standard',
  voice: 'Kore',
  wakeWord: 'Hey Jarvis',
  memoryEnabled: true,
  integrations: {
    calendar: { connected: false },
    gmail: { connected: false },
    drive: { connected: false },
  },
};

export const useJarvisStore = create<JarvisState>((set, get) => ({
  initialized: false,
  user: null,
  settings: DEFAULT_SETTINGS,
  history: [],
  activeConversationId: null,
  messages: [],
  memories: [],
  contacts: [],
  enrolledFaces: [],

  projects: loadProjects(),
  userDisplayName: '',
  pendingConfirm: null,

  streamStatus: 'idle',
  streamError: null,
  abortController: null,

  speakingMessageId: null,
  ttsLoadingId: null,
  activeAudio: null,

  sidebarCollapsed:
    typeof window !== 'undefined'
      ? window.innerWidth < 1024 && window.innerWidth >= 768
      : false,
  mobileDrawerOpen: false,
  settingsOpen: false,
  settingsTab: 'general',
  searchOpen: false,
  voiceOpen: false,
  visionOpen: false,
  selectedContactId: null,

  // ── Projects ───────────────────────────────────────────────────────────────
  addProject: (name) => {
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().projects, project];
    saveProjects(updated);
    set({ projects: updated });
  },

  deleteProject: (id) => {
    const updated = get().projects.filter((p) => p.id !== id);
    saveProjects(updated);
    set({ projects: updated });
  },

  renameProject: (id, name) => {
    const updated = get().projects.map((p) =>
      p.id === id ? { ...p, name: name.trim() } : p
    );
    saveProjects(updated);
    set({ projects: updated });
  },

  setUserDisplayName: (name) => set({ userDisplayName: name }),

  setPendingConfirm: (c) => set({ pendingConfirm: c }),

  resolveConfirm: (response) => {
    // Replace the placeholder with the actual response (confirmed) or a
    // cancellation notice (denied). Never leave "I need your confirmation…".
    const replacement = response ?? 'Action cancelled.';
    set((state) => {
      let messages = state.messages;
      const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === 'assistant');
      if (lastAssistantIdx !== -1) {
        const idx = messages.length - 1 - lastAssistantIdx;
        messages = messages.map((m, i) =>
          i === idx ? { ...m, content: replacement } : m
        );
      }
      return { pendingConfirm: null, messages };
    });
    void get().refreshHistory();
  },

  // ── Theme ──────────────────────────────────────────────────────────────────
  applyTheme: (theme) => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  },

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  bootstrap: async () => {
    try {
      const token = getToken();
      if (!token) {
        set({ initialized: true });
        return;
      }

      const [settings] = await Promise.all([api.getSettings()]);
      get().applyTheme(settings.theme);
      set({ settings });

      try {
        const user = await api.me();
        const payload = getTokenPayload();
        const displayName = (payload?.display_name as string | undefined) || '';
        set({ user, userDisplayName: displayName });
      } catch {
        // Token invalid — user needs to sign in
        set({ initialized: true });
        return;
      }

      const [history, memories, contacts] = await Promise.all([
        api.getHistory(100),
        api.getMemories(),
        api.getContacts(),
      ]);

      set({ initialized: true, history, memories, contacts });
    } catch {
      set({ initialized: true });
    }
  },

  // ── UI toggles ─────────────────────────────────────────────────────────────
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
  openSettings: (tab = 'general') => set({ settingsOpen: true, settingsTab: tab }),
  closeSettings: () => set({ settingsOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setVoiceOpen: (open) => set({ voiceOpen: open }),
  setVisionOpen: (open) => set({ visionOpen: open }),
  setSelectedContactId: (id) => set({ selectedContactId: id }),

  // ── Settings ───────────────────────────────────────────────────────────────
  updateSettings: async (updates) => {
    const prev = get().settings;
    const optimistic: AppSettings = {
      ...prev,
      ...updates,
      integrations: {
        ...prev.integrations,
        ...(updates.integrations ?? {}),
      },
    };
    set({ settings: optimistic });
    if (updates.theme) get().applyTheme(updates.theme);
    const saved = await api.saveSettings(optimistic);
    set({ settings: saved });
  },

  setPersonalityMode: async (mode) => {
    await get().updateSettings({ personalityMode: mode });
  },

  // ── History ────────────────────────────────────────────────────────────────
  refreshHistory: async () => {
    const history = await api.getHistory(100);
    set({ history });
  },

  startNewChat: () => {
    get().stopGeneration();
    set({
      activeConversationId: null,
      messages: [],
      streamStatus: 'idle',
      streamError: null,
      mobileDrawerOpen: false,
    });
  },

  loadConversation: async (id) => {
    get().stopGeneration();
    set({
      activeConversationId: id,
      streamStatus: 'idle',
      streamError: null,
      mobileDrawerOpen: false,
    });
    const conv = await api.getConversation(id);
    set({ messages: conv.messages });
  },

  appendVoiceTurn: (userText, assistantText, conversationId) => {
    const now = new Date().toISOString();
    const uid = `voice-user-${Date.now()}`;
    const aid = `voice-assistant-${Date.now()}`;
    set((state) => ({
      activeConversationId: conversationId,
      messages: [
        ...state.messages,
        { id: uid, role: 'user' as const, content: userText, createdAt: now },
        { id: aid, role: 'assistant' as const, content: assistantText, createdAt: now },
      ],
    }));
  },

  renameConversation: async (id, title) => {
    await api.updateConversation(id, { title });
    await get().refreshHistory();
  },

  archiveConversation: async (id) => {
    await api.updateConversation(id, { archived: true });
    if (get().activeConversationId === id) {
      set({ activeConversationId: null, messages: [] });
    }
    await get().refreshHistory();
  },

  deleteConversation: async (id) => {
    await api.deleteConversation(id);
    if (get().activeConversationId === id) {
      set({ activeConversationId: null, messages: [] });
    }
    await get().refreshHistory();
  },

  // ── Send message (SSE) ─────────────────────────────────────────────────────
  sendMessage: async (text, attachments = [], options) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    get().stopGeneration();
    const controller = new AbortController();

    const now = new Date().toISOString();
    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;

    let baseMessages = get().messages;
    if (options?.replaceFromMessageId) {
      const idx = baseMessages.findIndex((m) => m.id === options.replaceFromMessageId);
      if (idx !== -1) baseMessages = baseMessages.slice(0, idx);
    }

    const userMessage: ChatMessage = {
      id: tempUserId,
      role: 'user',
      content: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: now,
    };

    const assistantPlaceholder: ChatMessage = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
    };

    set({
      messages: [...baseMessages, userMessage, assistantPlaceholder],
      streamStatus: 'waiting',
      streamError: null,
      abortController: controller,
    });

    let resolvedConvId = get().activeConversationId ?? undefined;
    let currentAssistantId = tempAssistantId;

    const STREAM_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5050') + '/api/chat/stream';
    const streamBody = JSON.stringify({
      message: trimmed,
      conversation_id: resolvedConvId,
      personality_mode: get().settings.personalityMode,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const _makeStreamHeaders = (): Record<string, string> => {
      const h: Record<string, string> = { 'Content-Type': 'application/json' };
      const t = getToken();
      if (t) h['Authorization'] = `Bearer ${t}`;
      return h;
    };

    try {
      let res = await fetch(STREAM_URL, {
        method: 'POST',
        headers: _makeStreamHeaders(),
        body: streamBody,
        signal: controller.signal,
      });

      // On 401, try to refresh the JWT and retry once
      if (res.status === 401) {
        const refresh = getRefreshToken();
        if (refresh) {
          const r = await fetch(
            (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5050') + '/api/auth/refresh',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refresh }),
            }
          );
          if (r.ok) {
            const data = await r.json() as { access_token: string; refresh_token?: string };
            storeTokens(data.access_token, data.refresh_token ?? refresh);
            res = await fetch(STREAM_URL, {
              method: 'POST',
              headers: _makeStreamHeaders(),
              body: streamBody,
              signal: controller.signal,
            });
          } else {
            clearTokens();
          }
        }
      }

      if (!res.ok) {
        let errText = `Error ${res.status}`;
        try {
          const j = await res.json() as { error?: string };
          if (j.error) errText = j.error;
        } catch {
          // ignore
        }
        throw new Error(errText);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      let buffer = '';

      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const block of chunks) {
          const line = block.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              token?: string;
              done?: boolean;
              id?: string;
              conversation_id?: string;
              confirm?: boolean;
              action_id?: string;
              tool?: string;
              description?: string;
              error?: string;
            };

            if (payload.token) {
              set((state) => ({
                streamStatus: 'streaming',
                messages: state.messages.map((m) =>
                  m.id === currentAssistantId
                    ? { ...m, content: m.content + payload.token }
                    : m
                ),
              }));
            } else if (payload.done === true) {
              const newConvId = payload.conversation_id ?? resolvedConvId ?? '';
              const newAssistantId = payload.id ?? currentAssistantId;
              set((state) => ({
                activeConversationId: newConvId || state.activeConversationId,
                streamStatus: 'idle',
                abortController: null,
                messages: state.messages.map((m) =>
                  m.id === currentAssistantId ? { ...m, id: newAssistantId } : m
                ),
              }));
              currentAssistantId = newAssistantId;
              void get().refreshHistory();
              break outer;
            } else if (payload.confirm && payload.action_id) {
              get().setPendingConfirm({
                action_id: payload.action_id,
                tool: payload.tool ?? '',
                description: payload.description ?? '',
              });
            } else if (payload.error) {
              set({
                streamStatus: 'error',
                streamError: payload.error,
                abortController: null,
              });
              break outer;
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        set({ streamStatus: 'idle', abortController: null });
        void get().refreshHistory();
        return;
      }
      set({
        streamStatus: 'error',
        streamError: err instanceof Error ? err.message : 'Unable to reach assistant.',
        abortController: null,
      });
    }
  },

  stopGeneration: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
      set({ abortController: null, streamStatus: 'idle' });
    }
  },

  regenerateLastResponse: async (assistantMessageId) => {
    const msgs = get().messages;
    const assistantIdx = msgs.findIndex((m) => m.id === assistantMessageId);
    if (assistantIdx <= 0) return;
    const userMsg = msgs[assistantIdx - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    await get().sendMessage(userMsg.content, userMsg.attachments ?? [], {
      replaceFromMessageId: userMsg.id,
    });
  },

  editUserMessage: async (messageId, newContent) => {
    const msgs = get().messages;
    const userMsg = msgs.find((m) => m.id === messageId);
    if (!userMsg) return;
    await get().sendMessage(newContent, userMsg.attachments ?? [], {
      replaceFromMessageId: messageId,
    });
  },

  setFeedback: async (messageId, feedback) => {
    const convId = get().activeConversationId;
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, feedback } : m
      ),
    }));
    if (convId) {
      await api.sendFeedback(convId, messageId, feedback);
    }
  },

  // ── TTS ────────────────────────────────────────────────────────────────────
  stopSpeaking: () => {
    const audio = get().activeAudio;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    set({ speakingMessageId: null, ttsLoadingId: null, activeAudio: null });
  },

  speakMessage: async (messageId, text) => {
    const currentlySpeaking = get().speakingMessageId;
    get().stopSpeaking();
    if (currentlySpeaking === messageId) return;

    set({ ttsLoadingId: messageId });
    try {
      const { audioBase64, mimeType } = await api.synthesizeSpeech({
        text,
        voice: get().settings.voice,
        personalityMode: get().settings.personalityMode,
      });
      if (get().ttsLoadingId !== messageId) return;
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audio.onended = () => set({ speakingMessageId: null, activeAudio: null });
      audio.onerror = () => set({ speakingMessageId: null, activeAudio: null });
      set({ speakingMessageId: messageId, ttsLoadingId: null, activeAudio: audio });
      await audio.play();
    } catch {
      set({ ttsLoadingId: null });
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const clean = text.replace(/[#*_`>~]/g, '');
        const utter = new SpeechSynthesisUtterance(clean);
        utter.onend = () => set({ speakingMessageId: null });
        utter.onerror = () => set({ speakingMessageId: null });
        set({ speakingMessageId: messageId });
        window.speechSynthesis.speak(utter);
      }
    }
  },

  // ── Memories ───────────────────────────────────────────────────────────────
  refreshMemories: async () => {
    const memories = await api.getMemories();
    set({ memories });
  },

  addMemory: async (data) => {
    const item = await api.createMemory(data);
    set((state) => ({ memories: [item, ...state.memories] }));
  },

  deleteMemory: async (id) => {
    await api.deleteMemory(id);
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
  },

  clearAllMemories: async () => {
    await api.clearMemories();
    set({ memories: [] });
  },

  // ── Contacts ───────────────────────────────────────────────────────────────
  refreshContacts: async () => {
    const contacts = await api.getContacts();
    set({ contacts });
  },

  createContact: async (data) => {
    const created = await api.createContact(data);
    await get().refreshContacts();
    return created;
  },

  updateContact: async (id, data) => {
    const updated = await api.updateContact(id, data);
    await get().refreshContacts();
    return updated;
  },

  deleteContact: async (id) => {
    await api.deleteContact(id);
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));
  },

  // ── Enrolled faces (stubbed) ───────────────────────────────────────────────
  refreshEnrolledFaces: async () => {
    const enrolledFaces = await api.getEnrolledFaces();
    set({ enrolledFaces });
  },

  deleteEnrolledFace: async (id) => {
    await api.deleteEnrolledPerson(id);
    set((state) => ({ enrolledFaces: state.enrolledFaces.filter((f) => f.id !== id) }));
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  signOut: async () => {
    get().stopGeneration();
    get().stopSpeaking();
    await api.logout();
    clearTokens();
    set({
      user: null,
      messages: [],
      activeConversationId: null,
      history: [],
      memories: [],
      contacts: [],
    });
  },

  signIn: async (name, email, password) => {
    if (password !== undefined) {
      // New Flask backend: login with email + password
      const { access_token, refresh_token, user } = await api.login(email, password);
      storeTokens(access_token, refresh_token);
      set({ user });
    } else {
      // Legacy path (name + email only) — try to sign in without password
      // This path is kept for compatibility but shouldn't normally be reached
      const { access_token, refresh_token, user } = await api.login(email, name);
      storeTokens(access_token, refresh_token);
      set({ user });
    }
    // Load data after sign-in
    const [history, memories, contacts] = await Promise.all([
      api.getHistory(100),
      api.getMemories(),
      api.getContacts(),
    ]);
    set({ history, memories, contacts });
  },
}));
