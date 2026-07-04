import { useEffect, useState } from 'react';
import { Search, Trash2, Plus } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { HudPanel, MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

type Tab = 'MEMORY' | 'NOTES';

function TabBtn({ label, active, onClick }: { label: Tab; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 font-hud-mono text-xs tracking-widest border-b-2 transition-colors ${
        active ? 'border-[#00d4ff] text-[#00d4ff]' : 'border-transparent text-[#4a7fa0] hover:text-[#cae8ff]'
      }`}
    >
      {label}
    </button>
  );
}

// ── Memory tab ─────────────────────────────────────────────────────────────
interface Interaction {
  id: string; user_input: string; response: string; intent_type: string; timestamp: string;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString();

function MemoryTab() {
  const [items, setItems] = useState<Interaction[]>([]);
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState('all');
  const [intents, setIntents] = useState<string[]>([]);

  const load = async () => {
    try {
      const url = query.trim()
        ? `/api/search?q=${encodeURIComponent(query.trim())}`
        : '/api/history?limit=50';
      const res = await fetch(url);
      const data = await res.json();
      const interactions: Interaction[] = data.interactions ?? data.results ?? [];
      setItems(interactions);
      setIntents([...new Set<string>(interactions.map((i) => i.intent_type).filter(Boolean))]);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = intent === 'all' ? items : items.filter((i) => i.intent_type === intent);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="hud-panel flex items-center gap-2 p-2 flex-1">
          <Search className="w-4 h-4 text-[#4a7fa0] ml-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory archive..."
            className="flex-1 bg-transparent outline-none text-sm text-[#cae8ff] placeholder:text-[#4a7fa0]"
          />
          <button type="submit" className="px-3 py-1.5 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-[11px] tracking-widest hover:bg-[rgba(0,180,255,0.1)]">
            SEARCH
          </button>
        </form>
        <Select value={intent} onValueChange={setIntent}>
          <SelectTrigger className="w-full sm:w-52 bg-[#071228] border-[rgba(0,180,255,0.2)] font-hud-mono text-xs">
            <SelectValue placeholder="Filter intent" />
          </SelectTrigger>
          <SelectContent className="bg-[#071228] border-[rgba(0,180,255,0.2)] text-[#cae8ff]">
            <SelectItem value="all">All intents</SelectItem>
            {intents.map((it) => <SelectItem key={it} value={it}>{it}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && <MonoLabel>No interactions found.</MonoLabel>}
        {filtered.map((it) => (
          <div key={it.id} className="space-y-2 jv-fadeup">
            <div className="flex justify-end">
              <div className="max-w-[78%] px-4 py-2.5 border border-[#00b4d8] bg-[#06192f] text-sm text-[#cae8ff]">{it.user_input}</div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[78%]">
                <div className="flex items-center gap-2 mb-1">
                  <MonoLabel className="text-[#00d4ff]">[JARVIS]</MonoLabel>
                  <span className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(0,180,255,0.25)] text-[#4a7fa0]">{it.intent_type}</span>
                  <span className="font-hud-mono text-[9px] text-[#4a7fa0]">{fmtTime(it.timestamp)}</span>
                </div>
                <div className="px-4 py-2.5 bg-[#071228] border border-[rgba(0,180,255,0.08)] text-sm text-[#cae8ff]">{it.response}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notes tab ──────────────────────────────────────────────────────────────
interface Note { id: string; title: string; content: string; created_at: string; }

function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = () =>
    fetch('/api/dashboard/notes').then((r) => r.json()).then((r) => setNotes(r.notes ?? [])).catch(() => {});

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!content.trim()) { hudToast.error('CONTENT REQUIRED'); return; }
    try {
      await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), title: title.trim() }),
      });
      setTitle(''); setContent('');
      await load();
      hudToast.success('NOTE SAVED');
    } catch { hudToast.error('SAVE FAILED'); }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/dashboard/notes?id=${id}`, { method: 'DELETE' });
      await load();
      hudToast.info('NOTE DELETED');
    } catch { hudToast.error('DELETE FAILED'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <HudPanel className="h-fit">
        <MonoLabel className="block mb-3">New Note</MonoLabel>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
          className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] mb-3" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your note..." rows={5}
          className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] resize-none" />
        <button onClick={add}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)]">
          <Plus className="w-4 h-4" /> SAVE NOTE
        </button>
      </HudPanel>

      <div className="lg:col-span-2 space-y-3">
        {notes.length === 0 && <MonoLabel>No notes recorded.</MonoLabel>}
        {notes.map((n, i) => (
          <HudPanel key={n.id} className="jv-fadeup flex items-start justify-between gap-4" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="min-w-0">
              <div className="font-orbitron text-sm tracking-wide text-[#cae8ff]">
                {n.title || n.content.slice(0, 40) + (n.content.length > 40 ? '…' : '')}
              </div>
              {n.title && <p className="text-sm text-[#9fc4e0] mt-1.5">{n.content}</p>}
              <MonoLabel className="block mt-2">{fmtTime(n.created_at)}</MonoLabel>
            </div>
            <button onClick={() => remove(n.id)} className="shrink-0 text-[#4a7fa0] hover:text-[#ef4444] transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Data() {
  const [tab, setTab] = useState<Tab>('MEMORY');
  return (
    <div data-testid="data-page">
      <PageHeader overline="Storage & Retrieval" title="DATA" />
      <div className="flex border-b border-[rgba(0,180,255,0.15)] mb-6">
        {(['MEMORY', 'NOTES'] as Tab[]).map((t) => (
          <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>
      {tab === 'MEMORY' && <MemoryTab />}
      {tab === 'NOTES' && <NotesTab />}
    </div>
  );
}
