import axios from "axios";
import type { Conversation, Message } from "@/types/index";

export const API = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5050"}/api`;

// ── JWT token storage ────────────────────────────────────────────────────────
const TOKEN_KEY = "jarvis_access_token";
const REFRESH_KEY = "jarvis_refresh_token";

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

// ── Axios instance ────────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: API });

// Attach JWT before every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(`${API}/auth/refresh`, { refresh_token: refresh });
          storeTokens(data.access_token, data.refresh_token ?? refresh);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          clearTokens();
        }
      }
    }
    return Promise.reject(err);
  }
);

export const fileUrl = (path: string) => `${API}/files/${path}`;

export const errMsg = (e: unknown, fallback = "Something went wrong"): string => {
  if (e && typeof e === "object") {
    const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
    return err.response?.data?.error || err.response?.data?.detail || err.message || fallback;
  }
  return fallback;
};

// ── Streaming ────────────────────────────────────────────────────────────────
export type StreamEvent =
  | { type: "meta"; conversation_id: string; conversation: Conversation; user_message: Message }
  | { type: "delta"; content: string }
  | { type: "done"; message: Message }
  | { type: "error"; detail: string };

export async function streamChat(
  body: Record<string, unknown>,
  { signal, onEvent }: { signal?: AbortSignal; onEvent: (ev: StreamEvent) => void }
) {
  const userText = (body.message as string) || "";
  // Use existing convId or create a new client-side one
  const convId = (body.conversation_id as string) || `conv-${Date.now()}`;
  const now = new Date().toISOString();

  const res = await fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify({ message: userText }),
    signal,
  });

  if (!res.ok) {
    let detail: string | undefined;
    try { const j = await res.json(); detail = j.error || j.detail; } catch { /* non-json */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }

  // Emit meta immediately (original backend doesn't send one)
  const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: userText, conversation_id: convId, created_at: now };
  const fakeConv: Conversation = { id: convId, title: userText.slice(0, 60) || "New chat", created_at: now, updated_at: now };
  onEvent({ type: "meta", conversation_id: convId, conversation: fakeConv, user_message: userMsg });

  // Parse original backend SSE: {"token": "..."} / {"done": true, "id": "..."}
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let doneId: string | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.token !== undefined) {
        full += payload.token;
        onEvent({ type: "delta", content: payload.token });
      } else if (payload.done) {
        doneId = payload.id;
      } else if (payload.error) {
        onEvent({ type: "error", detail: payload.error });
        return;
      }
    }
  }

  const doneMsg: Message = {
    id: doneId ? `a-${doneId}` : `a-${Date.now()}`,
    role: "assistant",
    content: full,
    conversation_id: convId,
    created_at: new Date().toISOString(),
  };
  onEvent({ type: "done", message: doneMsg });
}

export async function transcribe(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("audio", blob, "audio.webm");
  const { data } = await api.post("/stt", fd);
  return data.text || "";
}

export async function uploadImage(blob: Blob, name = "image.jpg"): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, name);
  const { data } = await api.post("/uploads", fd);
  return data.path;
}
