import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { HudPanel, MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  keywords: string[];
  enabled: boolean;
}

export default function Plugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);

  useEffect(() => {
    fetch('/api/plugins')
      .then((r) => r.json())
      .then((r) => setPlugins(r.plugins ?? []))
      .catch(() => {});
  }, []);

  const toggle = async (name: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    try {
      const res = await fetch(`/api/plugins/${name}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      const { enabled } = await res.json();
      setPlugins((ps) => ps.map((p) => (p.name === name ? { ...p, enabled } : p)));
      hudToast.info(`${name.toUpperCase()} ${enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch {
      hudToast.error('TOGGLE FAILED');
    }
  };

  return (
    <div data-testid="plugins-page">
      <PageHeader overline="Module Management" title="PLUGINS" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plugins.map((p, i) => (
          <HudPanel
            key={p.name}
            active={p.enabled}
            className="jv-fadeup"
            style={{
              animationDelay: `${i * 50}ms`,
              borderColor: p.enabled ? '#00b4d8' : 'rgba(0,180,255,0.1)',
            }}
            data-testid={`plugin-${p.name}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-orbitron text-base tracking-wide text-[#cae8ff]">{p.name}</span>
                  <span className="font-hud-mono text-[10px] text-[#4a7fa0]">v{p.version}</span>
                </div>
                <p className="text-sm text-[#9fc4e0] mt-2">{p.description}</p>
                <MonoLabel className="block mt-3">by {p.author}</MonoLabel>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.keywords.map((k) => (
                    <span
                      key={k}
                      className="font-hud-mono text-[9px] px-1.5 py-0.5 border border-[rgba(0,180,255,0.2)] text-[#4a7fa0]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              <Switch
                checked={p.enabled}
                onCheckedChange={() => toggle(p.name, p.enabled)}
                data-testid={`plugin-toggle-${p.name}`}
                className="data-[state=checked]:bg-[#00b4d8]"
              />
            </div>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}
