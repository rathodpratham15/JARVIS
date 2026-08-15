import { useState } from 'react'
import { Play, Trash2, Clock, Plus, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { HudPanel, MonoLabel } from '@/components/hud/Hud'
import { PageHeader } from '@/components/hud/PageHeader'
import { hudToast } from '@/lib/hudToast'
import { useSchedules } from '@/hooks/useSchedules'

const EXAMPLES = [
  'every 30 minutes',
  'every 2 hours',
  'every day at 09:00',
  'every monday at 08:00',
  'every friday at 17:00',
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface CreateFormProps {
  onClose: () => void
  onCreate: (payload: { name: string; goal: string; schedule_expr: string; enabled: boolean }) => Promise<unknown>
}

function CreateForm({ onClose, onCreate }: CreateFormProps) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [expr, setExpr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !goal.trim() || !expr.trim()) return
    setSubmitting(true)
    try {
      await onCreate({ name: name.trim(), goal: goal.trim(), schedule_expr: expr.trim(), enabled: true })
      hudToast.success('SCHEDULE CREATED')
      onClose()
    } catch (err: any) {
      hudToast.error(err.message || 'CREATE FAILED')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <HudPanel className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <MonoLabel>New Scheduled Job</MonoLabel>
        <button onClick={onClose} className="text-[#4a7fa0] hover:text-[#cae8ff] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <MonoLabel className="block mb-1">Job Name</MonoLabel>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Morning Briefing"
            className="w-full bg-[#040d1d] border border-[rgba(0,180,255,0.2)] text-[#cae8ff] text-sm px-3 py-2 focus:outline-none focus:border-[#00d4ff] placeholder-[#2a4a6a]"
          />
        </div>
        <div>
          <MonoLabel className="block mb-1">Goal</MonoLabel>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Search the web for today's top tech news and save a summary as a note"
            rows={3}
            className="w-full bg-[#040d1d] border border-[rgba(0,180,255,0.2)] text-[#cae8ff] text-sm px-3 py-2 focus:outline-none focus:border-[#00d4ff] placeholder-[#2a4a6a] resize-none"
          />
        </div>
        <div>
          <MonoLabel className="block mb-1">Schedule</MonoLabel>
          <input
            value={expr}
            onChange={e => setExpr(e.target.value)}
            placeholder="every day at 09:00"
            className="w-full bg-[#040d1d] border border-[rgba(0,180,255,0.2)] text-[#cae8ff] text-sm px-3 py-2 focus:outline-none focus:border-[#00d4ff] placeholder-[#2a4a6a]"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => setExpr(ex)}
                className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#00d4ff] hover:border-[#00d4ff] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="font-hud-mono text-xs px-4 py-2 border border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#cae8ff] transition-colors"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !goal.trim() || !expr.trim()}
            className="font-hud-mono text-xs px-4 py-2 bg-[#00d4ff] text-[#040d1d] font-bold disabled:opacity-40 hover:bg-[#00b4d8] transition-colors"
          >
            {submitting ? 'CREATING…' : 'CREATE JOB'}
          </button>
        </div>
      </form>
    </HudPanel>
  )
}

export default function Schedules() {
  const { jobs, loading, error, create, toggle, remove, runNow } = useSchedules()
  const [showForm, setShowForm] = useState(false)

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggle(id, !enabled)
      hudToast.info(`JOB ${!enabled ? 'ENABLED' : 'DISABLED'}`)
    } catch {
      hudToast.error('TOGGLE FAILED')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      await remove(id)
      hudToast.info(`${name.toUpperCase()} REMOVED`)
    } catch {
      hudToast.error('DELETE FAILED')
    }
  }

  const handleRunNow = async (id: string, name: string) => {
    try {
      const taskId = await runNow(id)
      hudToast.success(`${name.toUpperCase()} TRIGGERED → ${taskId.slice(0, 8)}`)
    } catch {
      hudToast.error('TRIGGER FAILED')
    }
  }

  return (
    <div data-testid="schedules-page">
      <PageHeader overline="Autonomous Execution" title="SCHEDULES" />

      <div className="flex items-center justify-between mb-4">
        <MonoLabel>{jobs.length} job{jobs.length !== 1 ? 's' : ''} configured</MonoLabel>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 font-hud-mono text-xs px-3 py-1.5 border border-[rgba(0,180,255,0.3)] text-[#00d4ff] hover:bg-[rgba(0,180,255,0.08)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          NEW JOB
        </button>
      </div>

      {showForm && (
        <CreateForm onClose={() => setShowForm(false)} onCreate={create} />
      )}

      {loading && (
        <div className="font-hud-mono text-xs text-[#4a7fa0] py-8 text-center">
          LOADING SCHEDULES…
        </div>
      )}

      {error && (
        <div className="font-hud-mono text-xs text-red-400 py-4 text-center">{error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <HudPanel className="text-center py-10">
          <Clock className="w-8 h-8 text-[#2a4a6a] mx-auto mb-3" />
          <p className="text-sm text-[#4a7fa0]">No scheduled jobs yet.</p>
          <p className="font-hud-mono text-[10px] text-[#2a4a6a] mt-1">
            Create a job to have JARVIS run tasks autonomously.
          </p>
        </HudPanel>
      )}

      <div className="space-y-3">
        {jobs.map((job, i) => (
          <HudPanel
            key={job.id}
            active={job.enabled}
            className="jv-fadeup"
            style={{
              animationDelay: `${i * 40}ms`,
              borderColor: job.enabled ? '#00b4d8' : 'rgba(0,180,255,0.1)',
            }}
            data-testid={`job-${job.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-orbitron text-sm tracking-wide text-[#cae8ff]">{job.name}</span>
                  <span className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(0,180,255,0.2)] text-[#00d4ff]">
                    {job.schedule_expr}
                  </span>
                  {!job.enabled && (
                    <span className="font-hud-mono text-[9px] text-[#4a7fa0]">PAUSED</span>
                  )}
                </div>

                <p className="text-sm text-[#9fc4e0] mt-2 line-clamp-2">{job.goal}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  <div>
                    <MonoLabel className="block">Last Run</MonoLabel>
                    <span className="font-hud-mono text-[10px] text-[#9fc4e0]">{formatDate(job.last_run)}</span>
                  </div>
                  <div>
                    <MonoLabel className="block">Runs</MonoLabel>
                    <span className="font-hud-mono text-[10px] text-[#9fc4e0]">{job.run_count}</span>
                  </div>
                  {job.last_status && (
                    <div>
                      <MonoLabel className="block">Status</MonoLabel>
                      <span className={`font-hud-mono text-[10px] ${job.last_status === 'submitted' ? 'text-[#00d4ff]' : 'text-[#9fc4e0]'}`}>
                        {job.last_status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 shrink-0">
                <Switch
                  checked={job.enabled}
                  onCheckedChange={() => handleToggle(job.id, job.enabled)}
                  className="data-[state=checked]:bg-[#00b4d8]"
                  data-testid={`toggle-${job.id}`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRunNow(job.id, job.name)}
                    title="Run now"
                    className="text-[#4a7fa0] hover:text-[#00d4ff] transition-colors"
                    data-testid={`run-${job.id}`}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id, job.name)}
                    title="Delete job"
                    className="text-[#4a7fa0] hover:text-red-400 transition-colors"
                    data-testid={`delete-${job.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </HudPanel>
        ))}
      </div>
    </div>
  )
}
