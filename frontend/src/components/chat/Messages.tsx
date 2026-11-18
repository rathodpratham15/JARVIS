import { useState } from "react";
import { Copy, Check, Pencil, Volume2, Square, ThumbsUp, ThumbsDown, RefreshCw, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/chat/Markdown";
import { IconTip } from "@/components/common";
import { api, fileUrl, errMsg } from "@/lib/api";
import { speak, stopSpeaking } from "@/lib/media";
import type { Message } from "@/types/index";

function ActionButton({ label, onClick, children, active, testId }: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  testId?: string;
}) {
  return (
    <IconTip label={label} side="bottom">
      <button onClick={onClick} data-testid={testId}
        className={`h-8 w-8 grid place-items-center rounded-lg hover:bg-j-hover transition-colors ${active ? "text-j-text" : "text-j-muted hover:text-j-text"}`}>
        {children}
      </button>
    </IconTip>
  );
}

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return [copied, copy];
}

export function UserMessage({ msg, onEdit, disabled }: {
  msg: Message;
  onEdit: (msg: Message, text: string) => void;
  disabled: boolean;
}) {
  const [copied, copy] = useCopy();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const img = msg.previewUrl || (msg.image_path && fileUrl(msg.image_path));

  if (editing) {
    return (
      <div className="flex justify-end fade-up" data-testid="user-message-editing">
        <div className="w-full max-w-[85%] rounded-3xl bg-j-surface p-3">
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
            className="w-full bg-transparent outline-none resize-none text-[15.5px] p-1" data-testid="edit-message-input" />
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => { setEditing(false); setDraft(msg.content); }} className="h-8 px-3.5 rounded-full text-sm border border-j-border hover:bg-j-hover" data-testid="edit-cancel-button">Cancel</button>
            <button onClick={() => { setEditing(false); onEdit(msg, draft); }} disabled={!draft.trim()} className="h-8 px-3.5 rounded-full text-sm bg-j-text text-j-main disabled:opacity-40" data-testid="edit-send-button">Send</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex flex-col items-end fade-up" data-testid="user-message">
      {img && <img src={img} alt="Attachment" className="mb-2 max-h-64 max-w-[70%] rounded-2xl object-cover border border-j-border" data-testid="user-message-image" />}
      {msg.content && (
        <div className="max-w-[85%] rounded-3xl bg-j-surface px-4 py-2.5 whitespace-pre-wrap text-[15.5px] leading-relaxed break-words">{msg.content}</div>
      )}
      <div className="flex gap-0.5 mt-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionButton label={copied ? "Copied" : "Copy"} onClick={() => copy(msg.content)} testId="user-message-copy">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </ActionButton>
        {!disabled && msg.id && !msg.temp && (
          <ActionButton label="Edit message" onClick={() => setEditing(true)} testId="user-message-edit"><Pencil className="h-4 w-4" /></ActionButton>
        )}
      </div>
    </div>
  );
}

function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const toggle = async () => {
    if (state !== "idle") { stopSpeaking(); setState("idle"); return; }
    setState("loading");
    try {
      const r = await speak(text, { onStart: () => setState("playing") });
      if (r?.engine === "browser") toast.message("ElevenLabs voice unavailable — used your browser's voice instead.");
    } catch { toast.error("Voice playback is unavailable."); }
    setState("idle");
  };
  return (
    <ActionButton label={state === "idle" ? "Read aloud" : "Stop"} onClick={toggle} active={state !== "idle"} testId="assistant-speak-button">
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "playing" ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-4 w-4" />}
    </ActionButton>
  );
}

function AssistantActions({ msg, isLast, onRegenerate, onFeedback }: {
  msg: Message;
  isLast: boolean;
  onRegenerate: () => void;
  onFeedback: (id: string, value: "up" | "down" | null) => void;
}) {
  const [copied, copy] = useCopy();
  const fb = async (value: "up" | "down") => {
    const next = msg.feedback === value ? null : value;
    onFeedback(msg.id, next);
    try { await api.post(`/messages/${msg.id}/feedback`, { value: next }); if (next) toast.success("Thanks for the feedback"); }
    catch (e) { onFeedback(msg.id, msg.feedback ?? null); toast.error(errMsg(e)); }
  };
  return (
    <div className="flex gap-0.5 mt-2 -ml-1.5" data-testid="assistant-actions">
      <ActionButton label={copied ? "Copied" : "Copy"} onClick={() => copy(msg.content)} testId="assistant-copy-button">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </ActionButton>
      <SpeakButton text={msg.content} />
      <ActionButton label="Good response" onClick={() => fb("up")} active={msg.feedback === "up"} testId="assistant-thumbs-up">
        <ThumbsUp className={`h-4 w-4 ${msg.feedback === "up" ? "fill-current" : ""}`} />
      </ActionButton>
      <ActionButton label="Bad response" onClick={() => fb("down")} active={msg.feedback === "down"} testId="assistant-thumbs-down">
        <ThumbsDown className={`h-4 w-4 ${msg.feedback === "down" ? "fill-current" : ""}`} />
      </ActionButton>
      {isLast && (
        <ActionButton label="Regenerate" onClick={onRegenerate} testId="assistant-regenerate-button"><RefreshCw className="h-4 w-4" /></ActionButton>
      )}
    </div>
  );
}

export function AssistantMessage({ msg, isLast, streaming, onRegenerate, onRetry, onFeedback }: {
  msg: Message;
  isLast: boolean;
  streaming: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
  onFeedback: (id: string, value: "up" | "down" | null) => void;
}) {
  const waiting = msg.pending && !msg.content && !msg.error;
  return (
    <div className="flex gap-3.5 fade-up" data-testid="assistant-message">
      <div className="h-7 w-7 shrink-0 rounded-lg bg-j-accent grid place-items-center mt-0.5">
        <MessageSquare className="h-3.5 w-3.5 text-black" />
      </div>
      <div className="min-w-0 flex-1">
        {waiting && <div className="dot-bounce flex gap-1.5 h-7 items-center" data-testid="assistant-loading"><span /><span /><span /></div>}
        {msg.content && (
          <div className={msg.pending && streaming ? "stream-cursor" : ""} data-testid="assistant-message-content">
            <Markdown content={msg.content} />
          </div>
        )}
        {msg.stopped && <p className="text-xs text-j-muted mt-2">Stopped generating.</p>}
        {msg.error && (
          <div className="flex items-center gap-3 mt-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm" data-testid="assistant-error">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="flex-1">{msg.error}</span>
            <button onClick={onRetry} className="h-7 px-3 rounded-full border border-j-border hover:bg-j-hover text-xs font-medium" data-testid="assistant-retry-button">Retry</button>
          </div>
        )}
        {!msg.pending && !msg.error && msg.content && (
          <AssistantActions msg={msg} isLast={isLast} onRegenerate={onRegenerate} onFeedback={onFeedback} />
        )}
      </div>
    </div>
  );
}
