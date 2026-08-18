import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../utils/api'

export interface PermissionItem {
  id: string
  label: string
  desc: string
  risk: 'low' | 'medium' | 'high'
  granted: boolean
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/permissions`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPermissions(data.permissions ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback(async (id: string, granted: boolean) => {
    const res = await fetch(`${API_BASE}/api/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, granted }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setPermissions(data.permissions ?? [])
  }, [])

  const grantAll = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/permissions/grant-all`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setPermissions(data.permissions ?? [])
  }, [])

  const revokeAll = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/permissions/revoke-all`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setPermissions(data.permissions ?? [])
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { permissions, loading, error, refresh, toggle, grantAll, revokeAll }
}
