import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../utils/api'

export interface ScheduledJob {
  id: string
  name: string
  goal: string
  schedule_expr: string
  enabled: boolean
  created_at: string
  last_run: string | null
  run_count: number
  last_result: string | null
  last_status: string | null
}

export function useSchedules() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/schedules')
      const data = await res.json()
      setJobs(data.jobs ?? [])
      setError(null)
    } catch {
      setError('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(async (payload: {
    name: string
    goal: string
    schedule_expr: string
    enabled: boolean
  }): Promise<ScheduledJob> => {
    const res = await apiFetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create schedule')
    setJobs(prev => [data.job, ...prev])
    return data.job
  }, [])

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    const res = await apiFetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to toggle')
    setJobs(prev => prev.map(j => j.id === id ? data : j))
  }, [])

  const remove = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete')
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  const runNow = useCallback(async (id: string): Promise<string> => {
    const res = await apiFetch(`/api/schedules/${id}/run`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to trigger')
    return data.task_id
  }, [])

  return { jobs, loading, error, refresh, create, toggle, remove, runNow }
}
