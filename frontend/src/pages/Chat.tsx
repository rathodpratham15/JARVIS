import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';

interface ChatMessage {
  role: 'user' | 'jarvis';
  text: string;
  time: string;
  intent?: string;
  streaming?: boolean;
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

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const time = new Date().toISOString();
    setMessages((m) => [...m, { role: 'user', text, time }]);
    setInput('');
    setSending(true);

    // Add a placeholder JARVIS message that we'll stream into
    setMessages((m) => [
      ...m,
      { role: 'jarvis', text: '', time: new Date().toISOString(), streaming: true },
    ]);

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
              if (last?.role === 'jarvis' && last.streaming) {
                copy[copy.length - 1] = { ...last, text: last.text + evt.token };
              }
              return copy;
            });
          }

          if (evt.done) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === 'jarvis' && last.streaming) {
                copy[copy.length - 1] = { ...last, streaming: false, intent: evt.intent };
              }
              return copy;
            });
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      // On any error, mark the streaming message as done
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'jarvis' && last.streaming) {
          copy[copy.length - 1] = {
            ...last,
            text: last.text || 'I encountered an error. Please try again.',
            streaming: false,
          };
        }
        return copy;
      });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  // Blinking cursor for the actively streaming message
  const Cursor = () => (
    <span
      className="inline-block w-[2px] h-[1em] bg-[#00d4ff] ml-0.5 align-middle"
      style={{ animation: 'jv-pulse 0.8s ease-in-out infinite' }}
    />
  );

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]" data-testid="chat-page">
      <PageHeader overline="Conversational Interface" title="CHAT" />

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
                    <span className="font-hud-mono text-[9px] tracking-wider px-1.5 py-0.5 border border-[rgba(0,180,255,0.25)] text-[#4a7fa0]">
                      {m.intent}
                    </span>
                  )}
                </div>
              )}
              <div
                className={
                  m.role === 'user'
                    ? 'px-4 py-2.5 border border-[#00b4d8] bg-[#06192f] text-[#cae8ff] text-sm'
                    : 'px-4 py-2.5 bg-[#071228] text-[#cae8ff] text-sm border border-[rgba(0,180,255,0.08)]'
                }
              >
                {m.text}
                {m.streaming && <Cursor />}
                {m.streaming && !m.text && (
                  <span className="font-hud-mono text-[10px] text-[#4a7fa0] tracking-widest">
                    PROCESSING
                  </span>
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
          placeholder="Type a command or question..."
          data-testid="chat-input"
          disabled={sending}
          className="flex-1 bg-transparent outline-none px-3 py-2 text-sm text-[#cae8ff] placeholder:text-[#4a7fa0] disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending}
          data-testid="chat-send-button"
          className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] transition-colors disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" /> SEND
        </button>
      </div>
    </div>
  );
}
