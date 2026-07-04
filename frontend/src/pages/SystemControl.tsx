import { useEffect, useState } from 'react';
import { Rocket, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HudPanel, MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface PendingAction {
  action_id: string;
  action: string;
  target: string;
  requested_at: string;
}

interface ActionHistoryItem {
  id: string;
  action: string;
  target: string;
  status: string;
  timestamp: string;
}

type SystemInfoMap = Record<string, string>;

const fmtTime = (iso: string) => new Date(iso).toLocaleString();
const STATUS_COLOR: Record<string, string> = {
  completed: '#22c55e',
  denied: '#ef4444',
  pending: '#fbbf24',
};

export default function SystemControl() {
  const [appName, setAppName] = useState('');
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [history, setHistory] = useState<ActionHistoryItem[]>([]);
  const [info, setInfo] = useState<SystemInfoMap | null>(null);

  const refreshPending = () =>
    fetch('/api/system/pending-confirmations')
      .then((r) => r.json())
      .then((r) => setPending(r.pending ?? []))
      .catch(() => {});

  const refreshHistory = () =>
    fetch('/api/system/action-history')
      .then((r) => r.json())
      .then((r) => setHistory(r.history ?? []))
      .catch(() => {});

  useEffect(() => {
    refreshPending();
    refreshHistory();
    fetch('/api/system/info')
      .then((r) => r.json())
      .then((r) => setInfo(r.info ?? null))
      .catch(() => {});
    const t = setInterval(refreshPending, 5000);
    return () => clearInterval(t);
  }, []);

  const launch = async () => {
    if (!appName.trim()) return;
    try {
      await fetch('/api/system/open-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: appName.trim() }),
      });
      setAppName('');
      await refreshPending();
      hudToast.info('CONFIRMATION REQUIRED');
    } catch {
      hudToast.error('LAUNCH FAILED');
    }
  };

  const confirm = async (id: string, ok: boolean) => {
    try {
      await fetch('/api/system/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: id, confirmed: ok }),
      });
      await Promise.all([refreshPending(), refreshHistory()]);
      hudToast[ok ? 'success' : 'error'](ok ? 'ACTION APPROVED' : 'ACTION DENIED');
    } catch {
      hudToast.error('CONFIRM FAILED');
    }
  };

  return (
    <div data-testid="system-page">
      <PageHeader overline="Action Authorization" title="SYSTEM CONTROL" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <HudPanel data-testid="open-app-panel">
          <MonoLabel className="block mb-3">Open Application</MonoLabel>
          <div className="flex gap-3">
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && launch()}
              placeholder="e.g. Calculator, Browser..."
              data-testid="open-app-input"
              className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0]"
            />
            <button
              onClick={launch}
              data-testid="open-app-button"
              className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] whitespace-nowrap"
            >
              <Rocket className="w-4 h-4" /> LAUNCH
            </button>
          </div>
        </HudPanel>

        <HudPanel data-testid="pending-panel">
          <MonoLabel className="block mb-3">Pending Actions</MonoLabel>
          {pending.length === 0 && (
            <p className="text-sm text-[#4a7fa0]">No actions awaiting confirmation.</p>
          )}
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.action_id}
                className="flex items-center justify-between gap-3 p-2 border border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.05)] jv-fadeup"
              >
                <span className="text-sm text-[#cae8ff]">
                  <span className="font-hud-mono text-[10px] text-[#fbbf24] mr-2">{p.action}</span>
                  {p.target}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => confirm(p.action_id, true)}
                    data-testid={`approve-${p.action_id}`}
                    className="p-1.5 border border-[#22c55e] text-[#22c55e] hover:bg-[rgba(34,197,94,0.1)]"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => confirm(p.action_id, false)}
                    data-testid={`deny-${p.action_id}`}
                    className="p-1.5 border border-[#ef4444] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </HudPanel>
      </div>

      <HudPanel className="mb-6" data-testid="system-info-panel">
        <MonoLabel className="block mb-4">System Information</MonoLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {info &&
            Object.entries(info).map(([k, v]) => (
              <div key={k}>
                <MonoLabel className="block mb-1">{k.replace(/_/g, ' ')}</MonoLabel>
                <span className="font-hud-mono text-sm text-[#00d4ff]">{v}</span>
              </div>
            ))}
        </div>
      </HudPanel>

      <MonoLabel className="block mb-3">Action History</MonoLabel>
      <div className="space-y-2" data-testid="action-history">
        {history.length === 0 && <MonoLabel>No actions logged.</MonoLabel>}
        {history.map((h) => (
          <HudPanel key={h.id} className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-[#cae8ff]">
              <span className="font-hud-mono text-[10px] text-[#4a7fa0] mr-2">{h.action}</span>
              {h.target}
            </span>
            <div className="flex items-center gap-4 shrink-0">
              <span
                className="font-hud-mono text-[10px] tracking-widest"
                style={{ color: STATUS_COLOR[h.status] || '#4a7fa0' }}
              >
                {h.status.toUpperCase()}
              </span>
              <span className="font-hud-mono text-[10px] text-[#4a7fa0]">{fmtTime(h.timestamp)}</span>
            </div>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}
