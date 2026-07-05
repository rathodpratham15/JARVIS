import React, { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { StatusDot, MonoLabel } from '@/components/hud/Hud';

interface ModuleStatus {
  llm: boolean;
  voice: boolean;
  vision: boolean;
  memory: boolean;
  plugins: boolean;
  face: boolean;
}

const MODULES: { key: keyof ModuleStatus; label: string }[] = [
  { key: 'llm', label: 'LLM' },
  { key: 'voice', label: 'VOICE' },
  { key: 'vision', label: 'VISION' },
  { key: 'memory', label: 'MEM' },
  { key: 'plugins', label: 'PLUGINS' },
  { key: 'face', label: 'FACE' },
];

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const [online, setOnline] = useState(true);
  const [modules, setModules] = useState<ModuleStatus>({
    llm: false, voice: false, vision: false, memory: false, plugins: false, face: false,
  });

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (!mounted) return;
        const on = data.status === 'ok';
        // all modules = on (health endpoint doesn't break them out individually)
        setOnline(on);
        setModules({ llm: on, voice: on, vision: on, memory: on, plugins: on, face: on });
      } catch {
        if (mounted) setOnline(false);
      }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <header
      className="h-16 shrink-0 border-b border-[rgba(0,180,255,0.15)] bg-[#040d1d] flex items-center justify-between px-5"
      data-testid="top-bar"
    >
      <div className="flex items-center gap-3 md:gap-6">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 text-[#4a7fa0] hover:text-[#00d4ff] transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="relative w-3 h-3">
            <span className="absolute inset-0 rounded-full bg-[#00d4ff] jv-ring" />
            <span className="absolute inset-0 rounded-full bg-[#00d4ff]" />
          </div>
          <span
            className="font-orbitron font-bold text-lg tracking-[0.3em] text-[#cae8ff] jv-glow"
            data-testid="jarvis-logo"
          >
            J.A.R.V.I.S
          </span>
        </div>

        <div className="hidden md:flex items-center gap-4 pl-5 border-l border-[rgba(0,180,255,0.15)]">
          {MODULES.map((m) => (
            <div key={m.key} className="flex items-center gap-1.5" data-testid={`module-${m.key}`}>
              <StatusDot active={!!modules[m.key]} />
              <MonoLabel>{m.label}</MonoLabel>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <MonoLabel className="hidden sm:inline">v2.0.0</MonoLabel>
        <div
          className="flex items-center gap-2 px-3 py-1 border"
          style={{
            borderColor: online ? '#00b4d8' : '#ef4444',
            boxShadow: online
              ? '0 0 12px rgba(0,180,255,0.25)'
              : '0 0 12px rgba(239,68,68,0.25)',
          }}
          data-testid="online-indicator"
        >
          <StatusDot active={online} className={online ? '' : 'bg-[#ef4444]'} />
          <span
            className="font-hud-mono text-[11px] tracking-widest"
            style={{ color: online ? '#00d4ff' : '#ef4444' }}
          >
            {online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
};
