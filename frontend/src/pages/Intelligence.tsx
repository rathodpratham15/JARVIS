import { useEffect, useState } from 'react';
import { Search, Plus, BookOpen, User, Building2, Globe } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { HudPanel, MonoLabel, ScanLoader, SectionDivider } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

type Tab = 'EMOTION' | 'RESEARCH' | 'KNOWLEDGE';

const EMOTION_COLORS: Record<string, string> = {
  Happy: '#22c55e', Calm: '#00d4ff', Excited: '#fbbf24',
  Sad: '#3b82f6', Angry: '#ef4444', Anxious: '#a855f7', Neutral: '#4a7fa0',
};

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

// ── Emotion tab ────────────────────────────────────────────────────────────
interface EmotionResult {
  emotion: string; sentiment: string; confidence: number;
  scores?: Record<string, number>; text?: string; timestamp?: string;
}

function EmotionTab() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmotionResult | null>(null);
  const [history, setHistory] = useState<EmotionResult[]>([]);

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString();

  const analyze = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/analyze-emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data: EmotionResult = await res.json();
      setResult(data);
      setHistory((h) => [{ ...data, text: text.trim(), timestamp: new Date().toISOString() }, ...h.slice(0, 9)]);
    } finally {
      setLoading(false);
    }
  };

  const dominantColor = result ? EMOTION_COLORS[result.emotion] || '#00d4ff' : '#00d4ff';
  const sortedScores = result?.scores ? Object.entries(result.scores).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HudPanel>
          <MonoLabel className="block mb-3">Input Text</MonoLabel>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
            placeholder="Enter text to analyze emotional tone..."
            className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] resize-none" />
          <button onClick={analyze} disabled={loading}
            className="mt-3 px-5 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] disabled:opacity-40">
            ANALYZE
          </button>
        </HudPanel>
        <HudPanel active={!!result}>
          <MonoLabel className="block mb-3">Result</MonoLabel>
          {loading && <ScanLoader />}
          {!loading && !result && <p className="text-sm text-[#4a7fa0]">Enter text and run analysis.</p>}
          {result && !loading && (
            <div className="jv-fadeup">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-orbitron text-4xl jv-glow" style={{ color: dominantColor }}>{result.emotion}</span>
                <span className="font-hud-mono text-[10px] tracking-widest px-2 py-0.5 border" style={{ color: dominantColor, borderColor: dominantColor }}>
                  {result.sentiment.toUpperCase()}
                </span>
              </div>
              <MonoLabel className="block mb-1">Confidence — {Math.round(result.confidence * 100)}%</MonoLabel>
              <div className="h-2 bg-[rgba(0,180,255,0.1)] w-full mb-5">
                <div className="h-2" style={{ width: `${result.confidence * 100}%`, background: dominantColor, boxShadow: `0 0 8px ${dominantColor}` }} />
              </div>
              {sortedScores.length > 0 && (
                <>
                  <MonoLabel className="block mb-3">Emotion Spectrum</MonoLabel>
                  <div className="space-y-2">
                    {sortedScores.map(([emo, val]) => (
                      <div key={emo} className="flex items-center gap-3">
                        <span className="font-hud-mono text-[10px] w-16 text-[#9fc4e0]">{emo}</span>
                        <div className="flex-1 h-1.5 bg-[rgba(0,180,255,0.08)]">
                          <div className="h-1.5" style={{ width: `${val * 100}%`, background: EMOTION_COLORS[emo] || '#4a7fa0' }} />
                        </div>
                        <span className="font-hud-mono text-[10px] w-8 text-right text-[#4a7fa0]">{Math.round(val * 100)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </HudPanel>
      </div>
      <MonoLabel className="block mb-3">Recent Analyses</MonoLabel>
      <div className="space-y-3">
        {history.length === 0 && <MonoLabel>No analyses yet.</MonoLabel>}
        {history.map((h, i) => (
          <HudPanel key={i} className="flex items-center justify-between gap-4 py-3">
            <p className="text-sm text-[#9fc4e0] truncate flex-1">{h.text}</p>
            <span className="font-orbitron text-sm shrink-0" style={{ color: EMOTION_COLORS[h.emotion] || '#00d4ff' }}>{h.emotion}</span>
            <span className="font-hud-mono text-[10px] text-[#4a7fa0] shrink-0">{h.timestamp ? fmtTime(h.timestamp) : ''}</span>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}

// ── Research tab ───────────────────────────────────────────────────────────
type ResearchKind = 'person' | 'company' | 'topic';

interface ResearchProfile {
  subject: string;
  kind: string;
  summary: string;
  sections: Record<string, string>;
  sources: Array<{ title: string; url: string; snippet: string }>;
}

function ResearchTab() {
  const [subject, setSubject] = useState('');
  const [company, setCompany] = useState('');
  const [kind, setKind] = useState<ResearchKind>('person');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ResearchProfile | null>(null);

  const kindIcons: Record<ResearchKind, typeof User> = { person: User, company: Building2, topic: Globe };
  const KindIcon = kindIcons[kind];

  const run = async () => {
    if (!subject.trim() || loading) return;
    setLoading(true);
    setProfile(null);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), kind, company: company.trim() }),
      });
      if (!res.ok) { hudToast.error('RESEARCH FAILED'); return; }
      setProfile(await res.json());
    } catch { hudToast.error('RESEARCH ERROR'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <HudPanel>
        <MonoLabel className="block mb-4">Research Subject</MonoLabel>
        {/* Kind toggle */}
        <div className="flex gap-2 mb-3">
          {(['person', 'company', 'topic'] as ResearchKind[]).map((k) => {
            const Icon = kindIcons[k];
            return (
              <button key={k} onClick={() => setKind(k)}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-hud-mono text-[10px] tracking-widest border transition-colors ${
                  kind === k ? 'border-[#00b4d8] text-[#00d4ff] bg-[rgba(0,180,255,0.1)]' : 'border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#cae8ff]'
                }`}>
                <Icon className="w-3 h-3" />{k.toUpperCase()}
              </button>
            );
          })}
        </div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder={kind === 'person' ? 'Full name...' : kind === 'company' ? 'Company name...' : 'Topic...'}
          className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono mb-2" />
        {kind === 'person' && (
          <input value={company} onChange={(e) => setCompany(e.target.value)}
            placeholder="Company / organisation (optional — helps disambiguation)"
            className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono mb-3" />
        )}
        <button onClick={run} disabled={loading || !subject.trim()}
          className="flex items-center gap-2 px-4 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)] disabled:opacity-40">
          <Search className="w-4 h-4" />{loading ? 'RESEARCHING...' : 'RESEARCH'}
        </button>
      </HudPanel>

      {loading && <HudPanel><MonoLabel className="block mb-3">Aggregating public information...</MonoLabel><ScanLoader /></HudPanel>}

      {profile && !loading && (
        <div className="space-y-4 jv-fadeup">
          <HudPanel active>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 border border-[#00b4d8] flex items-center justify-center bg-[rgba(0,180,255,0.08)]">
                <KindIcon className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div>
                <div className="font-orbitron text-lg text-[#cae8ff]">{profile.subject}</div>
                <MonoLabel>{profile.kind.toUpperCase()}</MonoLabel>
              </div>
            </div>
            <p className="text-sm text-[#9fc4e0] leading-relaxed">{profile.summary}</p>
          </HudPanel>

          {Object.entries(profile.sections).map(([section, content]) =>
            content && content.toLowerCase() !== '...' ? (
              <HudPanel key={section}>
                <MonoLabel className="block mb-2">{section}</MonoLabel>
                <p className="text-sm text-[#cae8ff] leading-relaxed">{content}</p>
              </HudPanel>
            ) : null
          )}

          {profile.sources.length > 0 && (
            <HudPanel>
              <MonoLabel className="block mb-3">Sources ({profile.sources.length})</MonoLabel>
              <div className="space-y-2">
                {profile.sources.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="font-hud-mono text-[9px] text-[#fbbf24] shrink-0 mt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="font-hud-mono text-[10px] text-[#00d4ff] hover:underline truncate block">
                        {s.title || s.url}
                      </a>
                      <p className="text-[10px] text-[#4a7fa0] truncate">{s.snippet}</p>
                    </div>
                  </div>
                ))}
              </div>
            </HudPanel>
          )}
        </div>
      )}
    </div>
  );
}

// ── Knowledge tab ──────────────────────────────────────────────────────────
interface KBEntry { id: string; title: string; content: string; tags: string[]; }

function KnowledgeTab() {
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
      if (res.ok) setEntries((await res.json()).results ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { hudToast.error('TITLE AND CONTENT REQUIRED'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/knowledge/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }),
      });
      if (res.ok) { hudToast.success('ENTRY SAVED'); setTitle(''); setContent(''); setTags(''); load(query); }
      else hudToast.error('SAVE FAILED');
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <HudPanel>
        <MonoLabel className="block mb-4">Add Entry</MonoLabel>
        <form onSubmit={handleAdd} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
            className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content..." rows={5}
            className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono resize-none" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)"
            className="w-full bg-[#0d1f3c] border border-[rgba(0,180,255,0.2)] px-3 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono" />
          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)] disabled:opacity-40">
            <Plus className="w-4 h-4" />{saving ? 'SAVING...' : 'SAVE ENTRY'}
          </button>
        </form>
      </HudPanel>

      <div className="lg:col-span-2 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); load(query); }} className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search knowledge base..."
            className="flex-1 bg-[#071228] border border-[rgba(0,180,255,0.2)] px-4 py-2 text-sm text-[#cae8ff] placeholder-[#4a7fa0] focus:outline-none focus:border-[#00b4d8] font-hud-mono" />
          <button type="submit" className="flex items-center gap-2 px-4 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)]">
            <Search className="w-4 h-4" /> SEARCH
          </button>
        </form>
        {loading && <ScanLoader />}
        {!loading && entries.length === 0 && (
          <HudPanel><div className="flex flex-col items-center gap-3 py-8 text-center"><BookOpen className="w-8 h-8 text-[#4a7fa0]" /><MonoLabel>No entries found</MonoLabel></div></HudPanel>
        )}
        <div className="space-y-3">
          {entries.map((entry) => (
            <HudPanel key={entry.id} className="jv-fadeup">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-orbitron text-sm text-[#cae8ff]">{entry.title}</div>
                {entry.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="font-hud-mono text-[9px] tracking-widest px-2 py-0.5 border border-[rgba(0,180,255,0.3)] text-[#00d4ff]">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <SectionDivider />
              <p className="text-sm text-[#9fc4e0] leading-relaxed whitespace-pre-wrap">{entry.content}</p>
            </HudPanel>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Intelligence() {
  const [tab, setTab] = useState<Tab>('RESEARCH');
  return (
    <div data-testid="intelligence-page">
      <PageHeader overline="Analysis & Information" title="INTELLIGENCE" />
      <div className="flex border-b border-[rgba(0,180,255,0.15)] mb-6">
        {(['RESEARCH', 'EMOTION', 'KNOWLEDGE'] as Tab[]).map((t) => (
          <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>
      {tab === 'RESEARCH' && <ResearchTab />}
      {tab === 'EMOTION' && <EmotionTab />}
      {tab === 'KNOWLEDGE' && <KnowledgeTab />}
    </div>
  );
}
