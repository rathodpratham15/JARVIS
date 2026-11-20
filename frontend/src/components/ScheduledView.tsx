import { useEffect, useState } from 'react';
import { Bell, Clock, Plus, Play, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { apiFetch } from '../utils/auth';

interface Reminder {
  id: string;
  text: string;
  due_at: string | null;
  fired: boolean;
  created_at: string;
}

interface ScheduledJob {
  id: string;
  name: string;
  goal: string;
  schedule_expr: string;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ScheduledView() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', goal: '', schedule_expr: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, jRes] = await Promise.all([
        apiFetch('/api/reminders'),
        apiFetch('/api/schedules'),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setReminders(d.reminders ?? []);
      }
      if (jRes.ok) {
        const d = await jRes.json();
        setJobs(d.jobs ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const deleteReminder = async (id: string) => {
    await apiFetch(`/api/reminders/${id}`, { method: 'DELETE' });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const deleteJob = async (id: string) => {
    await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const toggleJob = async (job: ScheduledJob) => {
    const res = await apiFetch(`/api/schedules/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !job.enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
    }
  };

  const runJobNow = async (id: string) => {
    await apiFetch(`/api/schedules/${id}/run`, { method: 'POST' });
  };

  const createJob = async () => {
    if (!newJob.name || !newJob.goal || !newJob.schedule_expr) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to create job.');
        return;
      }
      const d = await res.json();
      setJobs((prev) => [d.job, ...prev]);
      setNewJob({ name: '', goal: '', schedule_expr: '' });
      setShowNewJob(false);
    } finally {
      setSaving(false);
    }
  };

  const pendingReminders = reminders.filter((r) => !r.fired);
  const firedReminders = reminders.filter((r) => r.fired);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#717171] dark:text-[#A1A1AA] text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">
      {/* ── Reminders ───────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-[#6366f1]" />
          <h2 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Reminders</h2>
          <span className="ml-auto text-xs text-[#717171] dark:text-[#A1A1AA]">
            {pendingReminders.length} pending
          </span>
        </div>

        {pendingReminders.length === 0 ? (
          <p className="text-sm text-[#717171] dark:text-[#A1A1AA] italic">
            No reminders. Ask JARVIS — "Remind me to…"
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingReminders.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-4 py-3"
              >
                <Bell className="w-4 h-4 text-[#6366f1] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#171717] dark:text-[#F5F5F5]">{r.text}</p>
                  {r.due_at && (
                    <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-0.5">
                      Due: {formatTime(r.due_at)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void deleteReminder(r.id)}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#717171] dark:text-[#A1A1AA] cursor-pointer"
                  aria-label="Delete reminder"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {firedReminders.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-[#717171] dark:text-[#A1A1AA] cursor-pointer select-none">
              {firedReminders.length} past reminder{firedReminders.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {firedReminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-[#E5E5E5] dark:border-white/10 px-4 py-2.5 opacity-50"
                >
                  <p className="flex-1 text-sm line-through">{r.text}</p>
                  <button
                    type="button"
                    onClick={() => void deleteReminder(r.id)}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ── Scheduled Jobs ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#6366f1]" />
          <h2 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Scheduled Jobs</h2>
          <button
            type="button"
            onClick={() => setShowNewJob((v) => !v)}
            className="ml-auto flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#5558e6] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New job
          </button>
        </div>

        {showNewJob && (
          <div className="mb-4 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] p-4 flex flex-col gap-3">
            <input
              type="text"
              placeholder="Job name (e.g. Morning briefing)"
              value={newJob.name}
              onChange={(e) => setNewJob((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:border-[#6366f1]/60"
            />
            <input
              type="text"
              placeholder="Goal (e.g. Summarise my emails and calendar)"
              value={newJob.goal}
              onChange={(e) => setNewJob((p) => ({ ...p, goal: e.target.value }))}
              className="w-full rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:border-[#6366f1]/60"
            />
            <input
              type="text"
              placeholder='Schedule (e.g. "every day at 8am" or "0 8 * * *")'
              value={newJob.schedule_expr}
              onChange={(e) => setNewJob((p) => ({ ...p, schedule_expr: e.target.value }))}
              className="w-full rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:border-[#6366f1]/60"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowNewJob(false); setError(null); }}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#E5E5E5] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createJob()}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs bg-[#6366f1] hover:bg-[#5558e6] text-white disabled:opacity-40 cursor-pointer"
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {jobs.length === 0 ? (
          <p className="text-sm text-[#717171] dark:text-[#A1A1AA] italic">
            No scheduled jobs yet. Create one to run JARVIS tasks automatically.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`rounded-xl border px-4 py-3 ${
                  job.enabled
                    ? 'border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A]'
                    : 'border-[#E5E5E5] dark:border-white/5 bg-[#F4F4F4] dark:bg-[#232323] opacity-60'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">{job.name}</p>
                    <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-0.5 truncate">{job.goal}</p>
                    <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-1 font-mono">
                      {job.schedule_expr}
                      {job.next_run && ` · next: ${formatTime(job.next_run)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void runJobNow(job.id)}
                      title="Run now"
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#717171] dark:text-[#A1A1AA] cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleJob(job)}
                      title={job.enabled ? 'Disable' : 'Enable'}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#717171] dark:text-[#A1A1AA] cursor-pointer"
                    >
                      {job.enabled
                        ? <ToggleRight className="w-4 h-4 text-[#6366f1]" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteJob(job.id)}
                      title="Delete"
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#717171] dark:text-[#A1A1AA] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
