import type {
  AppSettings,
  Contact,
  ConversationSummary,
  Conversation,
  EnrolledPerson,
  FaceIdentifyResult,
  MemoryCategory,
  MemoryImportance,
  MemoryItem,
  MessageAttachment,
  PersonalityMode,
  SourceLink,
  UserProfile,
} from '../types/jarvis';

export const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5050') + '/api';

const TOKEN_KEY = 'jarvis_access_token';
const REFRESH_KEY = 'jarvis_refresh_token';
const SETTINGS_KEY = 'jarvis_settings';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const storeTokens = (access: string, refresh: string) => {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
};
export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

export function getTokenPayload(): Record<string, unknown> | null {
  const token = getToken();
  if (!token) return null;
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    const refresh = getRefreshToken();
    if (refresh) {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (r.ok) {
        const data = await r.json() as { access_token: string; refresh_token?: string };
        storeTokens(data.access_token, data.refresh_token ?? refresh);
        headers.set('Authorization', `Bearer ${data.access_token}`);
        res = await fetch(url, { ...init, headers });
      } else {
        clearTokens();
      }
    }
  }
  return res;
}

// ─── Interaction → Conversation helpers ────────────────────────────────────

interface RawInteraction {
  id: string;
  user_input: string;
  response: string;
  timestamp: string;
  conversation_id?: string;
}

function groupInteractionsToConversations(
  interactions: RawInteraction[]
): ConversationSummary[] {
  if (!interactions.length) return [];

  // Group by conversation_id when available; fall back to 30-min time-gap for
  // legacy rows that pre-date the conversation_id column.
  const byConvId = new Map<string, RawInteraction[]>();

  const sorted = [...interactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const inter of sorted) {
    // Use conversation_id if present; otherwise fall back to a time-gap key
    if (inter.conversation_id) {
      const bucket = byConvId.get(inter.conversation_id) ?? [];
      bucket.push(inter);
      byConvId.set(inter.conversation_id, bucket);
    } else {
      // Legacy: find a bucket whose last entry is within 30 min
      let placed = false;
      for (const bucket of byConvId.values()) {
        const last = bucket[bucket.length - 1];
        if (!last.conversation_id) {
          const gap = new Date(inter.timestamp).getTime() - new Date(last.timestamp).getTime();
          if (gap <= 30 * 60 * 1000) {
            bucket.push(inter);
            placed = true;
            break;
          }
        }
      }
      if (!placed) {
        byConvId.set(inter.id, [inter]);
      }
    }
  }

  return Array.from(byConvId.entries()).map(([convId, group]) => ({
    id: convId,
    title:
      group[0].user_input.slice(0, 60) + (group[0].user_input.length > 60 ? '…' : ''),
    createdAt: group[0].timestamp,
    updatedAt: group[group.length - 1].timestamp,
    messageCount: group.length * 2,
  })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function groupInteractionsToConversation(
  id: string,
  interactions: RawInteraction[]
): Conversation | null {
  const groups = groupInteractionsToConversations(interactions);
  const summary = groups.find((g) => g.id === id);
  if (!summary) return null;

  const sorted = [...interactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Collect all interactions belonging to this conversation
  const group = sorted.filter(
    (i) => (i.conversation_id ?? i.id) === id
  );

  // Legacy fallback: if none matched by conversation_id, use 30-min gap from first match
  if (!group.length) {
    const startIdx = sorted.findIndex((i) => i.id === id);
    if (startIdx < 0) return null;
    group.push(sorted[startIdx]);
    for (let i = startIdx + 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].timestamp).getTime();
      const curr = new Date(sorted[i].timestamp).getTime();
      if (curr - prev > 30 * 60 * 1000) break;
      group.push(sorted[i]);
    }
  }

  const messages = group.flatMap((inter) => [
    {
      id: `${inter.id}-user`,
      role: 'user' as const,
      content: inter.user_input,
      createdAt: inter.timestamp,
    },
    {
      id: `${inter.id}-assistant`,
      role: 'assistant' as const,
      content: inter.response,
      createdAt: inter.timestamp,
    },
  ]);

  return {
    id,
    title: summary.title,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    messages,
  };
}

// ─── Default settings ──────────────────────────────────────────────────────

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

function loadLocalSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// ─── Main API object ───────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || 'Login failed');
    return res.json() as Promise<{ access_token: string; refresh_token: string; user: UserProfile }>;
  },

  async signup(name: string, email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || 'Signup failed');
    return res.json() as Promise<{ access_token: string; refresh_token: string; user: UserProfile }>;
  },

  async me(): Promise<UserProfile> {
    const res = await apiFetch('/auth/me');
    if (!res.ok) throw new Error('Not authenticated');
    return res.json() as Promise<UserProfile>;
  },

  async logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {/* ignore */});
    clearTokens();
  },

  // ── Settings (localStorage-backed) ───────────────────────────────────────
  getSettings(): Promise<AppSettings> {
    return Promise.resolve(loadLocalSettings());
  },

  saveSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = loadLocalSettings();
    const next: AppSettings = {
      ...current,
      ...updates,
      integrations: { ...current.integrations, ...(updates.integrations ?? {}) },
    };
    saveLocalSettings(next);
    return Promise.resolve(next);
  },

  // ── History ───────────────────────────────────────────────────────────────
  async getHistory(limit = 100): Promise<ConversationSummary[]> {
    const res = await apiFetch(`/history?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json() as { interactions?: RawInteraction[] } | RawInteraction[];
    const interactions: RawInteraction[] = Array.isArray(data)
      ? (data as RawInteraction[])
      : ((data as { interactions?: RawInteraction[] }).interactions ?? []);
    return groupInteractionsToConversations(interactions);
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await apiFetch(`/history?limit=500`);
    if (!res.ok) throw new Error('Failed to load conversation');
    const data = await res.json() as { interactions?: RawInteraction[] } | RawInteraction[];
    const interactions: RawInteraction[] = Array.isArray(data)
      ? (data as RawInteraction[])
      : ((data as { interactions?: RawInteraction[] }).interactions ?? []);
    const conv = groupInteractionsToConversation(id, interactions);
    if (!conv) throw new Error('Conversation not found');
    return conv;
  },

  async updateConversation(id: string, _data: { title?: string; archived?: boolean }): Promise<Conversation> {
    // Stub — Flask backend may not have this endpoint
    return this.getConversation(id);
  },

  async deleteConversation(id: string): Promise<{ ok: boolean }> {
    const res = await apiFetch(`/history/${id}`, { method: 'DELETE' }).catch(() => null);
    return { ok: res?.ok ?? false };
  },

  async sendFeedback(
    _conversationId: string,
    _messageId: string,
    _feedback: 'up' | 'down' | null
  ): Promise<{ ok: boolean }> {
    // Stub
    return { ok: true };
  },

  // ── Memories ──────────────────────────────────────────────────────────────
  async getMemories(): Promise<MemoryItem[]> {
    const res = await apiFetch('/memories');
    if (!res.ok) return [];
    return res.json() as Promise<MemoryItem[]>;
  },

  async createMemory(data: {
    title: string;
    content: string;
    category: MemoryCategory;
    importance: MemoryImportance;
  }): Promise<MemoryItem> {
    const res = await apiFetch('/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create memory');
    return res.json() as Promise<MemoryItem>;
  },

  async deleteMemory(id: string): Promise<{ ok: boolean }> {
    const res = await apiFetch(`/memories/${id}`, { method: 'DELETE' });
    return res.ok ? { ok: true } : { ok: false };
  },

  async clearMemories(): Promise<{ ok: boolean }> {
    const res = await apiFetch('/memories', { method: 'DELETE' });
    return res.ok ? { ok: true } : { ok: false };
  },

  // ── Contacts ──────────────────────────────────────────────────────────────
  async getContacts(_source?: 'manual' | 'vision'): Promise<Contact[]> {
    const res = await apiFetch('/contacts');
    if (!res.ok) return [];
    return res.json() as Promise<Contact[]>;
  },

  async createContact(data: Partial<Contact>): Promise<Contact> {
    const res = await apiFetch('/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create contact');
    return res.json() as Promise<Contact>;
  },

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    const res = await apiFetch(`/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update contact');
    return res.json() as Promise<Contact>;
  },

  async deleteContact(id: string): Promise<{ ok: boolean }> {
    const res = await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
    return { ok: res.ok };
  },

  // ── Face recognition (stubs) ──────────────────────────────────────────────
  getEnrolledFaces(): Promise<EnrolledPerson[]> {
    return Promise.resolve([]);
  },

  addEnrolledPerson(_formData: FormData): Promise<EnrolledPerson> {
    return Promise.reject(new Error('Face enrollment not available'));
  },

  deleteEnrolledPerson(_id: string): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  },

  identifyFace(_formData: FormData): Promise<FaceIdentifyResult> {
    return Promise.reject(new Error('Face identification not available'));
  },

  // ── Audio ─────────────────────────────────────────────────────────────────
  async transcribeAudio(blob: Blob): Promise<{ transcript: string }> {
    const fd = new FormData();
    fd.append('audio', blob, 'audio.webm');
    const res = await apiFetch('/voice/transcribe', { method: 'POST', body: fd });
    const data = await res.json() as { text?: string; transcript?: string };
    return { transcript: data.text ?? data.transcript ?? '' };
  },

  async synthesizeSpeech(_params: {
    text: string;
    voice?: string;
    personalityMode?: PersonalityMode;
  }): Promise<{ audioBase64: string; mimeType: string }> {
    // Stub — returns empty so caller falls back to browser speechSynthesis
    throw new Error('TTS not available; using browser fallback');
  },

  // ── Chat (SSE stream) ─────────────────────────────────────────────────────
  async streamChat(
    params: {
      conversationId?: string;
      message: string;
      attachments?: MessageAttachment[];
      personalityMode?: PersonalityMode;
      replaceFromMessageId?: string;
    },
    handlers: {
      signal?: AbortSignal;
      onInit?: (data: { conversationId: string; userMessageId: string; title: string }) => void;
      onToken: (text: string) => void;
      onDone?: (data: {
        conversationId: string;
        assistantMessageId: string;
        sources?: SourceLink[];
        memoriesAdded?: MemoryItem[];
      }) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const token = getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: params.message,
        conversation_id: params.conversationId,
        personality_mode: params.personalityMode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      signal: handlers.signal,
    });

    if (!res.ok) {
      let errText = `Stream failed (${res.status})`;
      try {
        const json = await res.json() as { error?: string };
        if (json.error) errText = json.error;
      } catch {
        // ignore
      }
      throw new Error(errText);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const decoder = new TextDecoder();
    let buffer = '';
    let convId = params.conversationId ?? '';
    let assistantId = `assistant-${Date.now()}`;
    let seenInit = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const block of lines) {
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
            // also handle jarvis-google-main format
            type?: string;
            text?: string;
            conversationId?: string;
            assistantMessageId?: string;
            userMessageId?: string;
            title?: string;
            sources?: SourceLink[];
            memoriesAdded?: MemoryItem[];
          };

          // Handle both formats: Flask {token, done} and jarvis-google {type: "token"}
          if (payload.type === 'init' || (!seenInit && (payload.conversationId || payload.conversation_id))) {
            seenInit = true;
            convId = payload.conversationId ?? payload.conversation_id ?? convId;
            handlers.onInit?.({
              conversationId: convId,
              userMessageId: payload.userMessageId ?? '',
              title: payload.title ?? 'New chat',
            });
          } else if (payload.token || payload.type === 'token') {
            const text = payload.token ?? payload.text ?? '';
            if (text) handlers.onToken(text);
          } else if (payload.done === true || payload.type === 'done') {
            const resolvedConvId = payload.conversation_id ?? payload.conversationId ?? convId;
            assistantId = payload.id ?? payload.assistantMessageId ?? assistantId;
            handlers.onDone?.({
              conversationId: resolvedConvId,
              assistantMessageId: assistantId,
              sources: payload.sources,
              memoriesAdded: payload.memoriesAdded,
            });
          } else if (payload.error || payload.type === 'error') {
            handlers.onError?.(payload.error ?? 'Unknown streaming error');
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
  },

  // ── Search ────────────────────────────────────────────────────────────────
  async search(q: string): Promise<{
    conversations: Array<{ id: string; title: string; updatedAt: string; snippet: string }>;
    contacts: Contact[];
  }> {
    const res = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return { conversations: [], contacts: [] };
    return res.json() as Promise<{
      conversations: Array<{ id: string; title: string; updatedAt: string; snippet: string }>;
      contacts: Contact[];
    }>;
  },

  // ── Tool confirm ──────────────────────────────────────────────────────────
  async confirmTool(action_id: string, confirmed: boolean): Promise<{ response?: string }> {
    const res = await apiFetch('/chat/confirm-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_id, confirmed }),
    });
    return res.json() as Promise<{ response?: string }>;
  },
};
