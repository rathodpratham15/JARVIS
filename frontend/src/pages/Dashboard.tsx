import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Mic, Eye, ScanFace, Database, Plug,
  MessageSquare, StickyNote, Activity,
} from 'lucide-react';
import { HudPanel, StatusDot, MonoLabel, StatBlock } from '@/components/hud/Hud';
import { PageHeader, StatusBadge } from '@/components/hud/PageHeader';

interface ModuleHealth {
  llm?: boolean;
  voice?: boolean;
  vision?: boolean;
  face?: boolean;
  memory?: boolean;
  plugins?: boolean;
}

interface DashboardStats {
  interactions?: number;
  notes?: number;
  plugins?: number;
  people?: number;
}

const MODULE_CARDS = [
  { key: 'llm' as keyof ModuleHealth, label: 'LLM Service', icon: Cpu },
  { key: 'voice' as keyof ModuleHealth, label: 'Voice Processing', icon: Mic },
  { key: 'vision' as keyof ModuleHealth, label: 'Vision Engine', icon: Eye },
  { key: 'face' as keyof ModuleHealth, label: 'Face Recognition', icon: ScanFace },
  { key: 'memory' as keyof ModuleHealth, label: 'Memory Database', icon: Database },
  { key: 'plugins' as keyof ModuleHealth, label: 'Plugin System', icon: Plug },
];

const QUICK_ACTIONS = [
  { label: 'Start Chat', desc: 'Converse with JARVIS', icon: MessageSquare, to: '/chat' },
  { label: 'New Note', desc: 'Capture a thought', icon: StickyNote, to: '/notes' },
  { label: 'Run Analysis', desc: 'Emotion & sentiment', icon: Activity, to: '/emotion-analysis' },
  { label: 'Manage Plugins', desc: 'Toggle modules', icon: Plug, to: '/plugins' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleHealth>({});
  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [healthRes, statsRes] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/dashboard/stats'),
        ]);
        const health = await healthRes.json();
        const statsData = await statsRes.json();
        if (!mounted) return;
        const on = health.status === 'ok';
        setOnline(on);
        setModules(health.modules || {});
        setStats(statsData);
      } catch {
        if (mounted) setOnline(false);
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        overline="Operational Status"
        title="SYSTEM OVERVIEW"
        status={<StatusBadge ok={online} okText="ALL SYSTEMS GO" failText="BACKEND OFFLINE" />}
        testid="dashboard-header"
      />

      <MonoLabel className="block mb-3">System Health</MonoLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {MODULE_CARDS.map((m, i) => {
          const Icon = m.icon;
          const active = !!modules[m.key];
          return (
            <HudPanel
              key={m.key}
              active={active}
              className="flex items-center justify-between jv-fadeup"
              style={{ animationDelay: `${i * 60}ms` }}
              data-testid={`health-${m.key}`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" style={{ color: active ? '#00d4ff' : '#4a7fa0' }} />
                <span className="font-hud-mono text-xs tracking-wider text-[#cae8ff]">{m.label}</span>
              </div>
              <StatusDot active={active} />
            </HudPanel>
          );
        })}
      </div>

      <MonoLabel className="block mb-3">Quick Actions</MonoLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {QUICK_ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              data-testid={`quick-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
              className="hud-panel p-5 text-left transition-all duration-200 hover:border-[#00b4d8] hover:shadow-[0_0_24px_rgba(0,180,255,0.15)] jv-fadeup"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Icon className="w-6 h-6 text-[#00d4ff] mb-3" />
              <div className="font-orbitron text-sm tracking-wide text-[#cae8ff]">{a.label}</div>
              <div className="font-hud-mono text-[10px] text-[#4a7fa0] mt-1">{a.desc}</div>
            </button>
          );
        })}
      </div>

      <MonoLabel className="block mb-3">Metrics</MonoLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBlock value={stats?.interactions ?? '—'} label="Interactions" testid="stat-interactions" />
        <StatBlock value={stats?.notes ?? '—'} label="Notes" accent="#fbbf24" testid="stat-notes" />
        <StatBlock value={stats?.plugins ?? '—'} label="Active Plugins" testid="stat-plugins" />
        <StatBlock value={stats?.people ?? '—'} label="Known People" accent="#fbbf24" testid="stat-people" />
      </div>
    </div>
  );
}
