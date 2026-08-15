import { useState } from 'react'
import { Monitor, Play, Square, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { HudPanel, MonoLabel } from '@/components/hud/Hud'
import { PageHeader } from '@/components/hud/PageHeader'
import { hudToast } from '@/lib/hudToast'
import { useComputerUse, type CUStep } from '@/hooks/useComputerUse'

const EXAMPLES = [
  'Open Spotify and play something',
  'Take a screenshot and describe what is on screen',
  'Open a new browser tab and go to news.ycombinator.com',
  'Find and close any open calculator windows',
]

const ACTION_LABELS: Record<string, string> = {
  click: 'Click',
  double_click: 'Double-click',
  type: 'Type',
  key: 'Key press',
  hotkey: 'Hotkey',
  scroll: 'Scroll',
  screenshot: 'Screenshot',
  done: 'Done',
  fail: 'Failed',
}

function ActionBadge({ action }: { action: Record<string, unknown> }) {
  const type = action.action as string
  const label = ACTION_LABELS[type] ?? type
  const color = type === 'done' ? 'text-emerald-400 border-emerald-500/30'
    : type === 'fail' ? 'text-red-400 border-red-500/30'
    : 'text-[#00d4ff] border-[rgba(0,180,255,0.3)]'
  return (
    <span className={`font-hud-mono text-[9px] px-1.5 py-0.5 border ${color}`}>
      {label.toUpperCase()}
    </span>
  )
}

function StepRow({ s, isLast }: { s: CUStep; isLast: boolean }) {
  const [open, setOpen] = useState(isLast)
  const action = s.action

  return (
    <div className="border border-[rgba(0,180,255,0.12)] bg-[rgba(0,10,30,0.4)]">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[rgba(0,180,255,0.04)] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-hud-mono text-[10px] text-[#4a7fa0] w-5 shrink-0">
          {String(s.step).padStart(2, '0')}
        </span>
        <ActionBadge action={action} />
        <span className="font-hud-mono text-[10px] text-[#9fc4e0] flex-1 truncate">
          {action.reason as string || action.result as string || s.result}
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-[#4a7fa0] shrink-0" />
               : <ChevronRight className="w-3 h-3 text-[#4a7fa0] shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[rgba(0,180,255,0.08)]">
          <div className="pt-2">
            <MonoLabel className="block mb-1">Result</MonoLabel>
            <p className="font-hud-mono text-[10px] text-[#cae8ff]">{s.result}</p>
          </div>
          {s.screenshot && (
            <div>
              <MonoLabel className="block mb-1">Screen at this step</MonoLabel>
              <img
                src={`data:image/png;base64,${s.screenshot}`}
                alt={`Step ${s.step} screenshot`}
                className="w-full rounded border border-[rgba(0,180,255,0.15)] max-h-64 object-contain bg-black"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[#4a7fa0]',
    running: 'bg-[#00d4ff] animate-pulse',
    done: 'bg-emerald-400',
    failed: 'bg-red-400',
  }
  return <span className={`w-2 h-2 rounded-full ${map[status] ?? 'bg-[#4a7fa0]'}`} />
}

export default function ComputerUse() {
  const { task, submitting, submit, cancel, reset } = useComputerUse()
  const [goal, setGoal] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim()) return
    try {
      await submit(goal.trim())
    } catch (err: unknown) {
      hudToast.error(err instanceof Error ? err.message : 'Failed to start task')
    }
  }

  const isActive = task && (task.status === 'pending' || task.status === 'running')

  return (
    <div data-testid="computer-use-page">
      <PageHeader overline="Device Control" title="COMPUTER USE" />

      {/* Goal input */}
      {!task && (
        <HudPanel className="mb-6">
          <MonoLabel className="block mb-3">What should JARVIS do?</MonoLabel>
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Switch YouTube Music to Playlist 2"
              rows={3}
              className="w-full bg-[#040d1d] border border-[rgba(0,180,255,0.2)] text-[#cae8ff] text-sm px-3 py-2 focus:outline-none focus:border-[#00d4ff] placeholder-[#2a4a6a] resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setGoal(ex)}
                  className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#00d4ff] hover:border-[#00d4ff] transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !goal.trim()}
                className="flex items-center gap-2 font-hud-mono text-xs px-4 py-2 bg-[#00d4ff] text-[#040d1d] font-bold disabled:opacity-40 hover:bg-[#00b4d8] transition-colors"
              >
                <Play className="w-3 h-3" />
                {submitting ? 'STARTING…' : 'RUN'}
              </button>
            </div>
          </form>
        </HudPanel>
      )}

      {/* Active / completed task */}
      {task && (
        <div className="space-y-4">
          {/* Task header */}
          <HudPanel>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <StatusDot status={task.status} />
                  <span className="font-hud-mono text-[10px] tracking-widest text-[#4a7fa0]">
                    {task.status.toUpperCase()}
                  </span>
                  <span className="font-hud-mono text-[10px] text-[#2a4a6a]">
                    {task.steps.length} step{task.steps.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-[#cae8ff]">{task.goal}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {isActive && (
                  <button
                    onClick={cancel}
                    className="flex items-center gap-1 font-hud-mono text-[10px] px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Square className="w-3 h-3" />
                    STOP
                  </button>
                )}
                {!isActive && (
                  <button
                    onClick={reset}
                    className="flex items-center gap-1 font-hud-mono text-[10px] px-2 py-1 border border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#00d4ff] hover:border-[#00d4ff] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    NEW TASK
                  </button>
                )}
              </div>
            </div>

            {/* Final result */}
            {task.final_result && (
              <div className="mt-3 pt-3 border-t border-[rgba(0,180,255,0.1)]">
                <MonoLabel className="block mb-1">Result</MonoLabel>
                <p className="text-sm text-emerald-400">{task.final_result}</p>
              </div>
            )}
            {task.error && (
              <div className="mt-3 pt-3 border-t border-[rgba(0,180,255,0.1)]">
                <MonoLabel className="block mb-1">Error</MonoLabel>
                <p className="text-sm text-red-400">{task.error}</p>
              </div>
            )}
          </HudPanel>

          {/* Live screen preview (latest screenshot) */}
          {task.steps.length > 0 && (() => {
            const last = task.steps[task.steps.length - 1]
            return last.screenshot ? (
              <HudPanel>
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-3.5 h-3.5 text-[#4a7fa0]" />
                  <MonoLabel>Live Screen</MonoLabel>
                  {isActive && (
                    <span className="font-hud-mono text-[9px] text-[#00d4ff] animate-pulse">UPDATING</span>
                  )}
                </div>
                <img
                  src={`data:image/png;base64,${last.screenshot}`}
                  alt="Current screen"
                  className="w-full rounded border border-[rgba(0,180,255,0.15)] object-contain bg-black"
                />
              </HudPanel>
            ) : null
          })()}

          {/* Step history */}
          {task.steps.length > 0 && (
            <div>
              <MonoLabel className="block mb-2">Step History</MonoLabel>
              <div className="space-y-1">
                {task.steps.map((s, i) => (
                  <StepRow key={s.step} s={s} isLast={i === task.steps.length - 1} />
                ))}
              </div>
            </div>
          )}

          {/* Waiting indicator */}
          {isActive && task.steps.length === 0 && (
            <HudPanel className="text-center py-8">
              <div className="font-hud-mono text-xs text-[#4a7fa0] animate-pulse">
                JARVIS IS LOOKING AT YOUR SCREEN…
              </div>
            </HudPanel>
          )}
        </div>
      )}
    </div>
  )
}
