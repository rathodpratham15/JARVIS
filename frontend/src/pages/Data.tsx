import { useEffect, useState } from 'react';
import { Search, Trash2, Plus, Clock, Play, Power, PowerOff, Zap } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { HudPanel, MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

type Tab = 'MEMORY' | 'NOTES' | 'SCHEDULE';

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

// ── Schedule tab ───────────────────────────────────────────────────────────
interface ScheduledJob {
  id: string;
  name: string;
  goal: string;
  schedule_expr: string;
  enabled: boolean;
  created_at: string;
  last_run: string | null;
  run_count: number;
  last_result: string | null;
  last_status: string | null;
}

const EXAMPLE_SCHEDULES = [
  'every 30 minutes',
  'every 2 hours',
  'every day at 09:00',
  'every day at 18:00',
  'every monday at 10:00',
  'every friday at 17:00',
];

function ScheduleTab() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [expr, setExpr] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetch('/api/schedules').then((r) => r.json()).then((r) => setJobs(r.jobs ?? [])).catch(() => {});

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !goal.trim() || !expr.trim()) {
      hudToast.error('NAME, GOAL, AND SCHEDULE REQUIRED');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), goal: goal.trim(), schedule_expr: expr.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { hudToast.error(data.error ?? 'CREATE FAILED'); return; }
      setName(''); setGoal(''); setExpr('');
      await load();
      hudToast.success('JOB SCHEDULED');
    } catch { hudToast.error('CREATE FAILED'); }
    finally { setCreating(false); }
  };

  const toggle = async (job: ScheduledJob) => {
    try {
      const res = await fetch(`/api/schedules/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      if (!res.ok) { hudToast.error('TOGGLE FAILED'); return; }
      await load();
      hudToast.info(job.enabled ? 'JOB DISABLED' : 'JOB ENABLED');
    } catch { hudToast.error('TOGGLE FAILED'); }
  };

  const runNow = async (job: ScheduledJob) => {
    try {
      const res = await fetch(`/api/schedules/${job.id}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { hudToast.error('RUN FAILED'); return; }
      await load();
      hudToast.success(`TASK QUEUED — ${data.task_id?.slice(0, 8)}`);
    } catch { hudToast.error('RUN FAILED'); }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      await load();
      hudToast.info('JOB REMOVED');
    } catch { hudToast.error('DELETE FAILED'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create form */}
      <HudPanel className="h-fit">
        <MonoLabel className="flex items-center gap-2 mb-4">
          <Clock className="w-3.5 h-3.5" /> New Scheduled Job
        </MonoLabel>

        <MonoLabel className="block mb-1">Job Name</MonoLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning briefing"
          className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] mb-3" />

        <MonoLabel className="block mb-1">Goal</MonoLabel>
        <Textarea value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="Search for today's AI news and save a summary note" rows={4}
          className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] resize-none mb-3" />

        <MonoLabel className="block mb-1">Schedule</MonoLabel>
        <Input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="every day at 09:00"
          className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] mb-2" />

        {/* Quick-pick chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {EXAMPLE_SCHEDULES.map((s) => (
            <button key={s} onClick={() => setExpr(s)}
              className={`px-2 py-1 font-hud-mono text-[9px] tracking-wider border transition-colors ${
                expr === s
                  ? 'border-[#00d4ff] text-[#00d4ff] bg-[rgba(0,212,255,0.08)]'
                  : 'border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#9fc4e0] hover:border-[rgba(0,180,255,0.4)]'
              }`}>
              {s}
            </button>
          ))}
        </div>

        <button onClick={create} disabled={creating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] disabled:opacity-40">
          <Plus className="w-4 h-4" /> SCHEDULE
        </button>
      </HudPanel>

      {/* Job list */}
      <div className="lg:col-span-2 space-y-3">
        {jobs.length === 0 && (
          <HudPanel>
            <p className="text-sm text-[#4a7fa0]">No scheduled jobs yet. Create one to have JARVIS act autonomously.</p>
          </HudPanel>
        )}
        {jobs.map((job, i) => (
          <HudPanel key={job.id} className={`jv-fadeup ${!job.enabled ? 'opacity-50' : ''}`}
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-orbitron text-sm text-[#cae8ff] truncate">{job.name}</span>
                  <span className={`font-hud-mono text-[9px] px-1.5 py-0.5 border shrink-0 ${
                    job.enabled
                      ? 'border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                      : 'border-[rgba(74,127,160,0.3)] text-[#4a7fa0]'
                  }`}>
                    {job.enabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>

                <p className="text-sm text-[#9fc4e0] mb-2 line-clamp-2">{job.goal}</p>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 font-hud-mono text-[10px] text-[#00d4ff]">
                    <Zap className="w-3 h-3" /> {job.schedule_expr}
                  </span>
                  {job.last_run && (
                    <span className="font-hud-mono text-[10px] text-[#4a7fa0]">
                      last: {fmtTime(job.last_run)}
                    </span>
                  )}
                  <span className="font-hud-mono text-[10px] text-[#4a7fa0]">
                    runs: {job.run_count}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => runNow(job)} title="Run now"
                  className="p-1.5 border border-[rgba(0,180,255,0.3)] text-[#4a7fa0] hover:border-[#00b4d8] hover:text-[#00d4ff] transition-colors">
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggle(job)} title={job.enabled ? 'Disable' : 'Enable'}
                  className={`p-1.5 border transition-colors ${
                    job.enabled
                      ? 'border-[rgba(34,197,94,0.3)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.1)]'
                      : 'border-[rgba(74,127,160,0.3)] text-[#4a7fa0] hover:text-[#9fc4e0]'
                  }`}>
                  {job.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => remove(job.id)} title="Delete"
                  className="p-1.5 border border-[rgba(239,68,68,0.2)] text-[#4a7fa0] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
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
        {(['MEMORY', 'NOTES', 'SCHEDULE'] as Tab[]).map((t) => (
          <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>
      {tab === 'MEMORY' && <MemoryTab />}
      {tab === 'NOTES' && <NotesTab />}
      {tab === 'SCHEDULE' && <ScheduleTab />}
    </div>
  );
}
