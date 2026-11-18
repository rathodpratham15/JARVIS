import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, CalendarDays, NotebookPen, Globe, AlarmClock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { api, streamChat } from "@/lib/api";
import TopBar from "@/components/TopBar";
import Composer from "@/components/chat/Composer";
import { UserMessage, AssistantMessage } from "@/components/chat/Messages";
import { ErrorState, PillButton } from "@/components/common";
import type { Message } from "@/types/index";

const SUGGESTIONS = [
  { icon: CalendarDays, text: "What's on my calendar today?" },
  { icon: NotebookPen, text: "Summarize my recent notes and reminders." },
  { icon: Globe, text: "Search the web for top AI news today." },
  { icon: AlarmClock, text: "Set a reminder for tomorrow morning." },
];

function Welcome({ onSend }: { onSend: (p: { text: string; imagePath?: string; previewUrl?: string }) => void }) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 pb-6">
      <div className="w-full max-w-[680px]">
        <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight text-center mb-8">How can I help?</h1>
        <Composer onSend={onSend} autoFocus />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
          {SUGGESTIONS.map(({ icon: Icon, text }, i) => (
            <button key={text} onClick={() => onSend({ text })} style={{ animationDelay: `${120 + i * 60}ms` }}
              className="flex items-center gap-3 text-left rounded-2xl border border-j-border px-4 py-3 text-sm text-j-muted hover:text-j-text hover:bg-j-hover transition-colors">
              <Icon className="h-4 w-4 shrink-0" /> {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { convId } = useParams<{ convId?: string }>();
  const navigate = useNavigate();
  const { settings, setConversations, refreshConversations, refreshMemories, setCurrentConvId, refreshKey } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadState, setLoadState] = useState<"ready" | "loading" | "error" | "notfound">("ready");
  const [streaming, setStreaming] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const skipRef = useRef<string | null>(null);
  const convIdRef = useRef<string | undefined>(convId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const lastReqRef = useRef<{ body: Record<string, unknown>; gotMeta: boolean } | null>(null);

  const load = useCallback(async (cid: string, silent = false) => {
    if (!silent) setLoadState("loading");
    try {
      // Original backend: GET /api/history returns flat interactions, not per-conversation
      // We show all recent history when a "conversation" is loaded
      const { data } = await api.get("/history?limit=100");
      if (convIdRef.current !== cid) return;
      // Convert flat interactions to message pairs
      const msgs: { id: string; role: "user" | "assistant"; content: string; conversation_id: string; created_at: string }[] = [];
      for (const interaction of (data.interactions || [])) {
        const ts = interaction.timestamp || interaction.created_at || new Date().toISOString();
        msgs.push({ id: `u-${interaction.id}`, role: "user", content: interaction.user_input || "", conversation_id: cid, created_at: ts });
        msgs.push({ id: `a-${interaction.id}`, role: "assistant", content: interaction.response || "", conversation_id: cid, created_at: ts });
      }
      setMessages(msgs);
      setLoadState("ready");
    } catch {
      if (!silent) setLoadState("error");
    }
  }, []);

  useEffect(() => {
    convIdRef.current = convId;
    setCurrentConvId(convId || null);
    if (convId && skipRef.current === convId) { skipRef.current = null; return; }
    abortRef.current?.abort();
    stickRef.current = true;
    if (!convId) { setMessages([]); setLoadState("ready"); return; }
    load(convId);
  }, [convId, refreshKey, load, setCurrentConvId]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = bottom;
    setAtBottom(bottom);
  };
  const scrollToBottom = () => {
    stickRef.current = true;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  const updatePending = (fn: (m: Message) => Message) => setMessages((ms) => ms.map((m) => (m.id === "pending" ? fn(m) : m)));

  const run = async (body: Record<string, unknown>) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    stickRef.current = true;
    lastReqRef.current = { body, gotMeta: false };
    const cidAtStart = convIdRef.current;
    try {
      await streamChat(
        { ...body, conversation_id: convIdRef.current || null, personality: settings?.personality || "standard" },
        {
          signal: ctrl.signal,
          onEvent: (ev) => {
            if (ev.type === "meta") {
              if (lastReqRef.current) lastReqRef.current.gotMeta = true;
              if (!convIdRef.current) {
                convIdRef.current = ev.conversation_id;
                skipRef.current = ev.conversation_id;
                setConversations((l) => [ev.conversation, ...l.filter((c) => c.id !== ev.conversation_id)]);
                navigate(`/c/${ev.conversation_id}`);
              }
              setMessages((ms) => ms.map((m) => (m.temp ? { ...ev.user_message, previewUrl: m.previewUrl } : m)));
            } else if (ev.type === "delta") {
              updatePending((m) => ({ ...m, content: m.content + ev.content }));
            } else if (ev.type === "done") {
              setMessages((ms) => ms.map((m) => (m.id === "pending" ? ev.message : m)));
            } else if (ev.type === "error") {
              updatePending((m) => ({ ...m, id: `err-${Date.now()}`, pending: false, error: ev.detail }));
            }
          },
        },
      );
      refreshConversations();
      setTimeout(refreshMemories, 8000);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setMessages((ms) => ms.flatMap((m) => (m.id !== "pending" ? [m] : m.content ? [{ ...m, id: `stopped-${Date.now()}`, pending: false, stopped: true }] : [])));
        const cid = convIdRef.current || cidAtStart;
        if (cid) setTimeout(() => convIdRef.current === cid && load(cid, true), 1500);
      } else {
        updatePending((m) => ({ ...m, id: `err-${Date.now()}`, pending: false, error: err.message || "Something went wrong." }));
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setStreaming(false);
    }
  };

  const pending: Message = { id: "pending", role: "assistant", content: "", pending: true };

  const send = ({ text, imagePath, previewUrl }: { text: string; imagePath?: string; previewUrl?: string }) => {
    if (streaming) return;
    setMessages((ms) => [...ms, { id: `temp-${Date.now()}`, temp: true, role: "user", content: text, image_path: imagePath, previewUrl }, pending]);
    run({ message: text, image_path: imagePath || null });
  };

  const regenerate = () => {
    setMessages((ms) => {
      const lastUser = ms.map((m) => m.role).lastIndexOf("user");
      return [...ms.slice(0, lastUser + 1), pending];
    });
    run({ regenerate: true });
  };

  const edit = (msg: Message, text: string) => {
    setMessages((ms) => {
      const idx = ms.findIndex((m) => m.id === msg.id);
      return [...ms.slice(0, idx), { ...msg, id: `temp-${Date.now()}`, temp: true, content: text }, pending];
    });
    run({ edit_message_id: msg.id, message: text });
  };

  const retry = () => {
    const last = lastReqRef.current;
    setMessages((ms) => [...ms.filter((m) => !m.error), pending]);
    run(last?.gotMeta || !last ? { regenerate: true } : last.body);
  };

  const setFeedback = (mid: string, value: "up" | "down" | null) =>
    setMessages((ms) => ms.map((m) => (m.id === mid ? { ...m, feedback: value } : m)));

  const welcome = !convId && messages.length === 0;
  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="flex flex-col h-full" data-testid="chat-page">
      <TopBar />
      {welcome ? (
        <>
          <Welcome onSend={send} />
          <p className="text-center text-xs text-j-muted py-2.5">J.A.R.V.I.S. can make mistakes. Verify important information.</p>
        </>
      ) : (
        <>
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto scrollbar-thin" data-testid="message-list">
            {loadState === "loading" && (
              <div className="max-w-[680px] mx-auto px-4 py-8 space-y-8">
                <div className="ml-auto h-10 w-1/2 rounded-3xl bg-j-hover animate-pulse" />
                <div className="space-y-2.5"><div className="h-4 w-11/12 rounded bg-j-hover animate-pulse" /><div className="h-4 w-4/5 rounded bg-j-hover animate-pulse" /></div>
              </div>
            )}
            {loadState === "error" && <ErrorState text="Couldn't load this chat." onRetry={() => convId && load(convId)} testId="chat-load-error" />}
            {loadState === "notfound" && (
              <div className="py-20 text-center">
                <p className="text-j-muted text-sm mb-4">This chat doesn't exist or was deleted.</p>
                <PillButton variant="ghost" onClick={() => navigate("/")}>Start a new chat</PillButton>
              </div>
            )}
            {loadState === "ready" && (
              <div className="max-w-[680px] mx-auto px-4 pt-4 pb-10 space-y-8">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <UserMessage key={m.id} msg={m} onEdit={edit} disabled={streaming} />
                  ) : (
                    <AssistantMessage key={m.id} msg={m} streaming={streaming} isLast={i === lastAssistantIdx && !streaming}
                      onRegenerate={regenerate} onRetry={retry} onFeedback={setFeedback} />
                  ),
                )}
              </div>
            )}
          </div>
          <div className="relative px-3 md:px-4">
            {!atBottom && (
              <button onClick={scrollToBottom}
                className="absolute -top-12 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-j-main border border-j-border shadow-lg grid place-items-center hover:bg-j-surface">
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
            <div className="max-w-[680px] mx-auto">
              <Composer onSend={send} onStop={() => abortRef.current?.abort()} streaming={streaming} autoFocus />
            </div>
            <p className="text-center text-xs text-j-muted py-2.5">J.A.R.V.I.S. can make mistakes. Verify important information.</p>
          </div>
        </>
      )}
    </div>
  );
}
