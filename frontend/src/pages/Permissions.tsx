import { ShieldCheck, ShieldOff, RefreshCw, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { HudPanel, MonoLabel } from '@/components/hud/Hud'
import { PageHeader } from '@/components/hud/PageHeader'
import { hudToast } from '@/lib/hudToast'
import { usePermissions, type PermissionItem } from '@/hooks/usePermissions'

const RISK_COLORS: Record<PermissionItem['risk'], string> = {
  low:    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  high:   'text-red-400 border-red-500/30 bg-red-500/10',
}

function PermissionCard({ item, onToggle }: { item: PermissionItem; onToggle: (id: string, granted: boolean) => Promise<void> }) {
  const handleChange = async (checked: boolean) => {
    try {
      await onToggle(item.id, checked)
      hudToast.info(`${item.label.toUpperCase()} ${checked ? 'ENABLED' : 'DISABLED'}`)
    } catch {
      hudToast.error('PERMISSION UPDATE FAILED')
    }
  }

  return (
    <HudPanel
      active={item.granted}
      className="jv-fadeup"
      style={{ borderColor: item.granted ? '#00b4d8' : 'rgba(0,180,255,0.1)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`mt-0.5 shrink-0 ${item.granted ? 'text-[#00d4ff]' : 'text-[#2a4a6a]'}`}>
            {item.granted
              ? <ShieldCheck className="w-5 h-5" />
              : <ShieldOff className="w-5 h-5" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-orbitron text-sm tracking-wide text-[#cae8ff]">{item.label}</span>
              <span className={`font-hud-mono text-[9px] px-1.5 py-0.5 border uppercase ${RISK_COLORS[item.risk]}`}>
                {item.risk} risk
              </span>
            </div>
            <p className="text-sm text-[#9fc4e0] mt-1.5">{item.desc}</p>
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          <Switch
            checked={item.granted}
            onCheckedChange={handleChange}
            className="data-[state=checked]:bg-[#00b4d8]"
          />
        </div>
      </div>
    </HudPanel>
  )
}

export default function Permissions() {
  const { permissions, loading, error, refresh, toggle, grantAll, revokeAll } = usePermissions()

  const handleGrantAll = async () => {
    try {
      await grantAll()
      hudToast.success('ALL PERMISSIONS GRANTED')
    } catch {
      hudToast.error('FAILED TO GRANT ALL')
    }
  }

  const handleRevokeAll = async () => {
    try {
      await revokeAll()
      hudToast.info('ALL PERMISSIONS REVOKED')
    } catch {
      hudToast.error('FAILED TO REVOKE ALL')
    }
  }

  const granted = permissions.filter(p => p.granted).length

  return (
    <div data-testid="permissions-page">
      <PageHeader overline="Capabilities & Access" title="PERMISSIONS" />

      {/* Summary bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <MonoLabel>
          {granted} / {permissions.length} capabilities enabled
        </MonoLabel>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            title="Refresh"
            className="text-[#4a7fa0] hover:text-[#00d4ff] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleGrantAll}
            className="font-hud-mono text-xs px-3 py-1.5 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            GRANT ALL
          </button>
          <button
            onClick={handleRevokeAll}
            className="font-hud-mono text-xs px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            REVOKE ALL
          </button>
        </div>
      </div>

      {/* Warning notice */}
      <HudPanel className="mb-6 flex items-start gap-3">
        <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <p className="font-hud-mono text-[10px] text-[#9fc4e0] leading-relaxed">
          Camera Vision and Computer Use are off by default. High-risk capabilities give JARVIS
          access to hardware or can automate desktop interactions — only enable them if you trust
          the tasks you assign. Changes take effect immediately and persist across restarts.
        </p>
      </HudPanel>

      {loading && (
        <div className="font-hud-mono text-xs text-[#4a7fa0] py-8 text-center">
          LOADING PERMISSIONS…
        </div>
      )}

      {error && (
        <div className="font-hud-mono text-xs text-red-400 py-4 text-center">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {permissions.map((item, i) => (
            <div key={item.id} style={{ animationDelay: `${i * 40}ms` }}>
              <PermissionCard item={item} onToggle={toggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
