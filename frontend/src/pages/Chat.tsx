import { useEffect, useRef, useState } from 'react';
import { Send, Zap, MessageSquare } from 'lucide-react';
import { MonoLabel, ScanLoader } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';

interface AgentStep {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

interface ChatMessage {
  role: 'user' | 'jarvis';
  text: string;
  time: string;
  intent?: string;
  streaming?: boolean;
  steps?: AgentStep[];     // agent mode — tool chain trace
  stoppedEarly?: boolean;
}

interface Interaction {
  id: string;
  user_input: string;
  response: string;
  intent_type: string;
  timestamp: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/history?limit=20')
      .then((r) => r.json())
      .then(({ interactions }: { interactions: Interaction[] }) => {
        const msgs: ChatMessage[] = [];
        [...interactions].reverse().forEach((it) => {
          msgs.push({ role: 'user', text: it.user_input, time: it.timestamp });
          msgs.push({ role: 'jarvis', text: it.response, time: it.timestamp, intent: it.intent_type });
        });
        setMessages(msgs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Agent mode (multi-step) ─────────────────────────────────────────────
  const sendAgent = async (text: string) => {
    const time = new Date().toISOString();
    setMessages((m) => [...m, { role: 'user', text, time }]);
    setMessages((m) => [...m, { role: 'jarvis', text: '', time: new Date().toISOString(), streaming: true }]);
    setSending(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: text }),
      });
      const data = await res.json();
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'jarvis' && last.streaming) {
          copy[copy.length - 1] = {
            ...last,
            text: data.final_answer || data.response || '',
            streaming: false,
            intent: 'agent',
            steps: data.steps ?? [],
            stoppedEarly: data.stopped_early,
          };
        }
        return copy;
      });
    } catch {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'jarvis' && last.streaming) {
          copy[copy.length - 1] = { ...last, text: 'Agent error. Please try again.', streaming: false };
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  // ── Streaming chat (single-turn) ────────────────────────────────────────
  const sendStream = async (text: string) => {
    const time = new Date().toISOString();
    setMessages((m) => [...m, { role: 'user', text, time }]);
    setMessages((m) => [...m, { role: 'jarvis', text: '', time: new Date().toISOString(), streaming: true }]);
    setSending(true);
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error('Stream unavailable');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let evt: { token?: string; done?: boolean; intent?: string };
          try { evt = JSON.parse(raw); } catch { continue; }
          if (evt.token) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === 'jarvis' && last.streaming)
                copy[copy.length - 1] = { ...last, text: last.text + evt.token };
              return copy;
            });
          }
          if (evt.done) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === 'jarvis' && last.streaming)
                copy[copy.length - 1] = { ...last, streaming: false, intent: evt.intent };
              return copy;
            });
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'jarvis' && last.streaming)
          copy[copy.length - 1] = { ...last, text: last.text || 'I encountered an error. Please try again.', streaming: false };
        return copy;
      });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    if (agentMode) sendAgent(text);
    else sendStream(text);
  };

  const Cursor = () => (
    <span className="inline-block w-[2px] h-[1em] bg-[#00d4ff] ml-0.5 align-middle"
      style={{ animation: 'jv-pulse 0.8s ease-in-out infinite' }} />
  );

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]" data-testid="chat-page">
      <div className="flex items-center justify-between mb-4">
        <PageHeader overline="Conversational Interface" title="CHAT" />
        {/* Mode toggle */}
        <button
          onClick={() => setAgentMode((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 border font-hud-mono text-[10px] tracking-widest transition-colors ${
            agentMode
              ? 'border-[#fbbf24] text-[#fbbf24] bg-[rgba(251,191,36,0.08)]'
              : 'border-[rgba(0,180,255,0.3)] text-[#4a7fa0] hover:border-[#00b4d8] hover:text-[#cae8ff]'
          }`}
          title={agentMode ? 'Switch to single-turn chat' : 'Switch to multi-step agent mode'}
        >
          {agentMode ? <Zap className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
          {agentMode ? 'AGENT' : 'CHAT'}
        </button>
      </div>

      {agentMode && (
        <div className="mb-3 px-3 py-2 border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.05)]">
          <span className="font-hud-mono text-[10px] tracking-widest text-[#fbbf24]">
            AGENT MODE — JARVIS will plan and execute multiple steps to complete complex tasks
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4" data-testid="chat-messages">
        {messages.length === 0 && (
          <div className="text-center mt-16">
            <MonoLabel>Awaiting input — how may I assist, sir?</MonoLabel>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} jv-fadeup`}>
            <div className={`max-w-[78%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {m.role === 'jarvis' && (
                <div className="flex items-center gap-2">
                  <MonoLabel className="text-[#00d4ff]">[JARVIS]</MonoLabel>
                  {m.intent && (
                    <span className={`font-hud-mono text-[9px] tracking-wider px-1.5 py-0.5 border ${
                      m.intent === 'agent'
                        ? 'border-[rgba(251,191,36,0.4)] text-[#fbbf24]'
                        : 'border-[rgba(0,180,255,0.25)] text-[#4a7fa0]'
                    }`}>
                      {m.intent}
                    </span>
                  )}
                  {m.stoppedEarly && (
                    <span className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(239,68,68,0.4)] text-[#ef4444]">
                      STEP LIMIT
                    </span>
                  )}
                </div>
              )}

              {/* Agent step trace */}
              {m.steps && m.steps.length > 0 && (
                <div className="mb-2 space-y-1 w-full">
                  {m.steps.map((s) => (
                    <div key={s.step} className="flex items-start gap-2 px-3 py-1.5 border border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.04)]">
                      <span className="font-hud-mono text-[9px] text-[#fbbf24] shrink-0 mt-0.5">
                        STEP {s.step}
                      </span>
                      <div className="min-w-0">
                        <span className="font-hud-mono text-[9px] text-[#00d4ff] tracking-widest">
                          {s.tool}
                        </span>
                        <p className="font-hud-mono text-[9px] text-[#4a7fa0] truncate mt-0.5">
                          {s.result.slice(0, 120)}{s.result.length > 120 ? '…' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={
                m.role === 'user'
                  ? 'px-4 py-2.5 border border-[#00b4d8] bg-[#06192f] text-[#cae8ff] text-sm'
                  : 'px-4 py-2.5 bg-[#071228] text-[#cae8ff] text-sm border border-[rgba(0,180,255,0.08)]'
              }>
                {m.text}
                {m.streaming && m.text && <Cursor />}
                {m.streaming && !m.text && (
                  agentMode
                    ? <span className="font-hud-mono text-[10px] text-[#fbbf24] tracking-widest">PLANNING...</span>
                    : <ScanLoader />
                )}
              </div>
              <span className="font-hud-mono text-[9px] text-[#4a7fa0]">{fmtTime(m.time)}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="hud-panel flex items-center gap-3 p-2 mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={agentMode ? 'Describe a multi-step goal...' : 'Type a command or question...'}
          data-testid="chat-input"
          disabled={sending}
          className="flex-1 bg-transparent outline-none px-3 py-2 text-sm text-[#cae8ff] placeholder:text-[#4a7fa0] disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending}
          data-testid="chat-send-button"
          className={`flex items-center gap-2 px-4 py-2 border font-hud-mono text-xs tracking-widest transition-colors disabled:opacity-40 ${
            agentMode
              ? 'bg-[rgba(251,191,36,0.1)] border-[#fbbf24] text-[#fbbf24] hover:bg-[rgba(251,191,36,0.2)]'
              : 'bg-[rgba(0,180,255,0.1)] border-[#00b4d8] text-[#00d4ff] hover:bg-[rgba(0,180,255,0.2)]'
          }`}
        >
          {agentMode ? <Zap className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          {agentMode ? 'RUN' : 'SEND'}
        </button>
      </div>
    </div>
  );
}
