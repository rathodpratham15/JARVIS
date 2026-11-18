import axios from "axios";
import type { Conversation, Message } from "@/types/index";

export const API = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8001"}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });
export const fileUrl = (path: string) => `${API}/files/${path}`;
export const errMsg = (e: unknown, fallback = "Something went wrong"): string => {
  if (e && typeof e === "object") {
    const err = e as { response?: { data?: { detail?: string } }; message?: string };
    return err.response?.data?.detail || err.message || fallback;
  }
  return fallback;
};

export type StreamEvent =
  | { type: "meta"; conversation_id: string; conversation: Conversation; user_message: Message }
  | { type: "delta"; content: string }
  | { type: "done"; message: Message }
  | { type: "error"; detail: string };

export async function streamChat(
  body: Record<string, unknown>,
  { signal, onEvent }: { signal?: AbortSignal; onEvent: (ev: StreamEvent) => void }
) {
  const res = await fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try { detail = (await res.json()).detail; } catch { /* non-json */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as StreamEvent);
    }
  }
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
