import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { MonoLabel, ScanLoader } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';

interface ChatMessage {
  role: 'user' | 'jarvis';
  text: string;
  time: string;
  intent?: string;
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
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const time = new Date().toISOString();
    setMessages((m) => [...m, { role: 'user', text, time }]);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const { response, intent } = await res.json();
      setMessages((m) => [
        ...m,
        { role: 'jarvis', text: response, time: new Date().toISOString(), intent },
      ]);
    } finally {
      setSending(false);
    }
  };

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
              </div>
              <span className="font-hud-mono text-[9px] text-[#4a7fa0]">{fmtTime(m.time)}</span>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[78%] w-64">
              <MonoLabel className="text-[#00d4ff] block mb-1">[JARVIS]</MonoLabel>
              <div className="px-4 py-3 bg-[#071228] border border-[rgba(0,180,255,0.08)]">
                <ScanLoader />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="hud-panel flex items-center gap-3 p-2 mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a command or question..."
          data-testid="chat-input"
          className="flex-1 bg-transparent outline-none px-3 py-2 text-sm text-[#cae8ff] placeholder:text-[#4a7fa0]"
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
