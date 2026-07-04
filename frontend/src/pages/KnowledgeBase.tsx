import { useState, useEffect } from 'react';
import { Search, Plus, BookOpen } from 'lucide-react';
import { HudPanel, MonoLabel, ScanLoader, SectionDivider } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface KBEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at?: string;
}

export default function KnowledgeBase() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const url = q ? `/api/knowledge/search?q=${encodeURIComponent(q)}` : '/api/knowledge/search';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.results ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(query);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      hudToast.error('TITLE AND CONTENT REQUIRED');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        hudToast.success('ENTRY SAVED');
        setTitle('');
        setContent('');
        setTags('');
        load(query);
      } else {
        hudToast.error('SAVE FAILED');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="knowledge-page">
      <PageHeader overline="Information Repository" title="KNOWLEDGE BASE" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add entry */}
        <HudPanel className="lg:col-span-1">
          <MonoLabel className="block mb-4">Add Entry</MonoLabel>
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Content..."
              rows={5}
              className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono resize-none"
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)] disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> {saving ? 'SAVING...' : 'SAVE ENTRY'}
            </button>
          </form>
        </HudPanel>

        {/* Search + results */}
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search knowledge base..."
              className="flex-1 bg-[#071228] border border-[rgba(0,180,255,0.2)] px-4 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono"
            />
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)]"
            >
              <Search className="w-4 h-4" /> SEARCH
            </button>
          </form>

          {loading && <ScanLoader />}

          {!loading && entries.length === 0 && (
            <HudPanel>
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <BookOpen className="w-8 h-8 text-[#4a7fa0]" />
                <MonoLabel>No entries found</MonoLabel>
              </div>
            </HudPanel>
          )}

          <div className="space-y-3">
            {entries.map((entry) => (
              <HudPanel key={entry.id} className="jv-fadeup">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-orbitron text-sm text-[#cae8ff]">{entry.title}</div>
                  {entry.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-hud-mono text-[9px] tracking-widest px-2 py-0.5 border border-[rgba(0,180,255,0.3)] text-[#00d4ff]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <SectionDivider />
                <p className="text-sm text-[#9fc4e0] leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>
              </HudPanel>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
