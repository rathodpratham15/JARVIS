import { useCallback, useRef, useState } from 'react'
import { apiFetch } from '../utils/api'

export interface CUStep {
  step: number
  action: Record<string, unknown>
  result: string
  screenshot?: string
  timestamp: string
}

export interface CUTask {
  id: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  created_at: string
  finished_at: string | null
  steps: CUStep[]
  final_result: string | null
  error: string | null
}

const POLL_MS = 1500

export function useComputerUse() {
  const [task, setTask] = useState<CUTask | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const poll = useCallback((id: string) => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/computer-use/${id}`)
        if (!res.ok) return
        const data: CUTask = await res.json()
        setTask(data)
        if (data.status === 'done' || data.status === 'failed') {
          stopPoll()
        }
      } catch {
        // silently ignore
      }
    }, POLL_MS)
  }, [stopPoll])

  const submit = useCallback(async (goal: string) => {
    setSubmitting(true)
    setTask(null)
    stopPoll()
    try {
      const res = await apiFetch('/api/computer-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start task')
      poll(data.task_id)
      setTask({
        id: data.task_id,
        goal,
        status: 'pending',
        created_at: new Date().toISOString(),
        finished_at: null,
        steps: [],
        final_result: null,
        error: null,
      })
    } finally {
      setSubmitting(false)
    }
  }, [poll, stopPoll])

  const cancel = useCallback(async () => {
    if (!task) return
    stopPoll()
    await apiFetch(`/api/computer-use/${task.id}`, { method: 'DELETE' }).catch(() => {})
    setTask(prev => prev ? { ...prev, status: 'failed', error: 'Cancelled.' } : null)
  }, [task, stopPoll])

  const reset = useCallback(() => {
    stopPoll()
    setTask(null)
  }, [stopPoll])

  return { task, submitting, submit, cancel, reset }
}
