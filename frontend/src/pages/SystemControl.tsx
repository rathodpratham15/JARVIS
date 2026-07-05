import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Rocket, Check, X, Monitor, MousePointer, Keyboard, RefreshCw,
  Type, ZapOff,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HudPanel, MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

// ── types ─────────────────────────────────────────────────────────────────

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

// ── helpers ────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) => new Date(iso).toLocaleString();

const STATUS_COLOR: Record<string, string> = {
  completed: '#22c55e',
  denied: '#ef4444',
  pending: '#fbbf24',
};

const QUICK_HOTKEYS: Array<{ label: string; keys: string[] }> = [
  { label: 'Copy', keys: ['command', 'c'] },
  { label: 'Paste', keys: ['command', 'v'] },
  { label: 'Undo', keys: ['command', 'z'] },
  { label: 'Select All', keys: ['command', 'a'] },
  { label: 'Screenshot', keys: ['command', 'shift', '4'] },
  { label: 'Spotlight', keys: ['command', 'space'] },
  { label: 'Tab', keys: ['tab'] },
  { label: 'Escape', keys: ['escape'] },
  { label: 'Enter', keys: ['enter'] },
];

// ── Desktop Control panel ─────────────────────────────────────────────────

function DesktopControl() {
  const [screenshot, setScreenshot] = useState<{ image: string; width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [pressKey, setPressKey] = useState('');
  const [lastAction, setLastAction] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScreenshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/os/screenshot');
      if (!res.ok) {
        const err = await res.json();
        hudToast.error(err.error ?? 'SCREENSHOT FAILED');
        return;
      }
      const data = await res.json();
      setScreenshot(data);
    } catch {
      hudToast.error('SCREENSHOT FAILED');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreenshot();
  }, [fetchScreenshot]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchScreenshot, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchScreenshot]);

  const doAction = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/os/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { hudToast.error(data.error ?? 'ACTION FAILED'); return; }
      setLastAction(data.result ?? '');
    } catch {
      hudToast.error('ACTION FAILED');
    }
  };

  // Click on screenshot image → translate to real screen coords and click
  const handleImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!screenshot || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = screenshot.width / rect.width;
    const scaleY = screenshot.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    doAction({ action: 'click', x, y });
    setLastAction(`Clicking (${x}, ${y})…`);
  };

  const handleType = () => {
    if (!typeText.trim()) return;
    doAction({ action: 'type', text: typeText });
    setTypeText('');
  };

  const handlePress = () => {
    if (!pressKey.trim()) return;
    doAction({ action: 'press', key: pressKey.trim().toLowerCase() });
    setPressKey('');
  };

  const handleHotkey = (keys: string[]) => {
    doAction({ action: 'hotkey', keys });
  };

  return (
    <div className="space-y-4">
      {/* Screenshot viewer */}
      <HudPanel>
        <div className="flex items-center justify-between mb-3">
          <MonoLabel className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5" /> Live Desktop
            {screenshot && (
              <span className="text-[#4a7fa0]">
                — {screenshot.width}×{screenshot.height}
              </span>
            )}
          </MonoLabel>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 font-hud-mono text-[10px] tracking-widest border transition-colors ${
                autoRefresh
                  ? 'border-[#00d4ff] text-[#00d4ff] bg-[rgba(0,212,255,0.1)]'
                  : 'border-[rgba(0,180,255,0.2)] text-[#4a7fa0] hover:text-[#cae8ff]'
              }`}
            >
              <ZapOff className="w-3 h-3" />
              {autoRefresh ? 'AUTO ON' : 'AUTO OFF'}
            </button>
            <button
              onClick={fetchScreenshot}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-[10px] tracking-widest hover:bg-[rgba(0,180,255,0.2)] disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          </div>
        </div>

        {loading && !screenshot && (
          <div className="flex items-center justify-center h-40 text-[#4a7fa0] font-hud-mono text-xs tracking-widest">
            CAPTURING…
          </div>
        )}

        {screenshot && (
          <div className="relative group">
            <img
              ref={imgRef}
              src={`data:image/png;base64,${screenshot.image}`}
              alt="Desktop screenshot"
              onClick={handleImgClick}
              className="w-full border border-[rgba(0,180,255,0.15)] cursor-crosshair hover:border-[rgba(0,212,255,0.4)] transition-colors"
              style={{ imageRendering: 'auto' }}
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="font-hud-mono text-[9px] text-[#00d4ff] bg-[rgba(2,8,23,0.8)] px-2 py-1 border border-[rgba(0,180,255,0.3)]">
                CLICK TO CONTROL
              </span>
            </div>
          </div>
        )}

        {lastAction && (
          <p className="mt-2 font-hud-mono text-[10px] text-[#22c55e] tracking-wider jv-fadeup">
            ✓ {lastAction}
          </p>
        )}
      </HudPanel>

      {/* Input controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type text */}
        <HudPanel>
          <MonoLabel className="flex items-center gap-2 mb-3">
            <Type className="w-3.5 h-3.5" /> Type Text
          </MonoLabel>
          <div className="flex gap-2">
            <Input
              value={typeText}
              onChange={(e) => setTypeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleType()}
              placeholder="Text to type at cursor…"
              className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0]"
            />
            <button
              onClick={handleType}
              className="px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-[10px] tracking-widest hover:bg-[rgba(0,180,255,0.2)] whitespace-nowrap"
            >
              TYPE
            </button>
          </div>
        </HudPanel>

        {/* Press key */}
        <HudPanel>
          <MonoLabel className="flex items-center gap-2 mb-3">
            <Keyboard className="w-3.5 h-3.5" /> Press Key
          </MonoLabel>
          <div className="flex gap-2">
            <Input
              value={pressKey}
              onChange={(e) => setPressKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePress()}
              placeholder="enter, escape, tab, space…"
              className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0]"
            />
            <button
              onClick={handlePress}
              className="px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-[10px] tracking-widest hover:bg-[rgba(0,180,255,0.2)] whitespace-nowrap"
            >
              PRESS
            </button>
          </div>
        </HudPanel>
      </div>

      {/* Quick hotkeys */}
      <HudPanel>
        <MonoLabel className="block mb-3">Quick Hotkeys</MonoLabel>
        <div className="flex flex-wrap gap-2">
          {QUICK_HOTKEYS.map((hk) => (
            <button
              key={hk.label}
              onClick={() => handleHotkey(hk.keys)}
              className="px-3 py-1.5 border border-[rgba(0,180,255,0.25)] text-[#9fc4e0] font-hud-mono text-[10px] tracking-widest hover:border-[#00b4d8] hover:text-[#00d4ff] hover:bg-[rgba(0,180,255,0.08)] transition-colors"
            >
              {hk.label}
            </button>
          ))}
        </div>
      </HudPanel>
    </div>
  );
}

// ── App Launcher + existing panels ────────────────────────────────────────

export default function SystemControl() {
  const [appName, setAppName] = useState('');
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [history, setHistory] = useState<ActionHistoryItem[]>([]);
  const [info, setInfo] = useState<SystemInfoMap | null>(null);
  const [tab, setTab] = useState<'desktop' | 'apps'>('desktop');

  const refreshPending = () =>
    fetch('/api/system/pending-confirmations')
      .then((r) => r.json())
      .then((r) => setPending(r.pending ?? r.confirmations ?? []))
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
      <PageHeader overline="Desktop Automation" title="SYSTEM CONTROL" />

      {/* Tab toggle */}
      <div className="flex gap-0 mb-6 border-b border-[rgba(0,180,255,0.15)]">
        {(['desktop', 'apps'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2 font-hud-mono text-xs tracking-widest border-b-2 transition-colors ${
              tab === t
                ? 'border-[#00d4ff] text-[#00d4ff]'
                : 'border-transparent text-[#4a7fa0] hover:text-[#cae8ff]'
            }`}
          >
            {t === 'desktop' ? (
              <span className="flex items-center gap-2"><MousePointer className="w-3.5 h-3.5" />DESKTOP</span>
            ) : (
              <span className="flex items-center gap-2"><Rocket className="w-3.5 h-3.5" />APP LAUNCHER</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'desktop' && <DesktopControl />}

      {tab === 'apps' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <HudPanel data-testid="system-info-panel">
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
      )}
    </div>
  );
}
