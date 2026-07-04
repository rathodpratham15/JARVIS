import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';

interface Interaction {
  id: string;
  user_input: string;
  response: string;
  intent_type: string;
  timestamp: string;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString();

export default function Memory() {
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
      const { interactions } = await res.json();
      setItems(interactions ?? []);
      setIntents([...new Set<string>((interactions ?? []).map((i: Interaction) => i.intent_type))]);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const filtered = intent === 'all' ? items : items.filter((i) => i.intent_type === intent);

  return (
    <div data-testid="memory-page">
      <PageHeader overline="Interaction Archive" title="MEMORY EXPLORER" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={onSearch} className="hud-panel flex items-center gap-2 p-2 flex-1">
          <Search className="w-4 h-4 text-[#4a7fa0] ml-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory archive..."
            data-testid="memory-search-input"
            className="flex-1 bg-transparent outline-none text-sm text-[#cae8ff] placeholder:text-[#4a7fa0]"
          />
          <button
            type="submit"
            data-testid="memory-search-button"
            className="px-3 py-1.5 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-[11px] tracking-widest hover:bg-[rgba(0,180,255,0.1)]"
          >
            SEARCH
          </button>
        </form>
        <Select value={intent} onValueChange={setIntent}>
          <SelectTrigger
            className="w-full sm:w-52 bg-[#071228] border-[rgba(0,180,255,0.2)] font-hud-mono text-xs"
            data-testid="memory-intent-filter"
          >
            <SelectValue placeholder="Filter intent" />
          </SelectTrigger>
          <SelectContent className="bg-[#071228] border-[rgba(0,180,255,0.2)] text-[#cae8ff]">
            <SelectItem value="all">All intents</SelectItem>
            {intents.map((it) => (
              <SelectItem key={it} value={it}>
                {it}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4" data-testid="memory-list">
        {filtered.length === 0 && <MonoLabel>No interactions found.</MonoLabel>}
        {filtered.map((it) => (
          <div key={it.id} className="space-y-2 jv-fadeup">
            <div className="flex justify-end">
              <div className="max-w-[78%] px-4 py-2.5 border border-[#00b4d8] bg-[#06192f] text-sm text-[#cae8ff]">
                {it.user_input}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[78%]">
                <div className="flex items-center gap-2 mb-1">
                  <MonoLabel className="text-[#00d4ff]">[JARVIS]</MonoLabel>
                  <span className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(0,180,255,0.25)] text-[#4a7fa0]">
                    {it.intent_type}
                  </span>
                  <span className="font-hud-mono text-[9px] text-[#4a7fa0]">{fmtTime(it.timestamp)}</span>
                </div>
                <div className="px-4 py-2.5 bg-[#071228] border border-[rgba(0,180,255,0.08)] text-sm text-[#cae8ff]">
                  {it.response}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
