import React from 'react';
import { MonoLabel } from '@/components/hud/Hud';

interface PageHeaderProps {
  overline?: string;
  title: string;
  status?: React.ReactNode;
  testid?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ overline, title, status, testid }) => (
  <div className="mb-6 jv-fadeup" data-testid={testid}>
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        {overline && <MonoLabel className="block mb-2">{overline}</MonoLabel>}
        <h1 className="font-orbitron font-bold text-3xl sm:text-4xl tracking-wider text-[#cae8ff] jv-glow">
          {title}
        </h1>
      </div>
      {status}
    </div>
    <div className="h-px w-full bg-[rgba(0,180,255,0.12)] mt-5" />
  </div>
);

interface StatusBadgeProps {
  ok: boolean;
  okText: string;
  failText: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ ok, okText, failText }) => (
  <span
    className="font-hud-mono text-xs tracking-widest px-4 py-2 border inline-flex items-center"
    style={{
      color: ok ? '#00d4ff' : '#ef4444',
      borderColor: ok ? '#00b4d8' : '#ef4444',
      boxShadow: ok ? '0 0 14px rgba(0,180,255,0.2)' : '0 0 14px rgba(239,68,68,0.2)',
    }}
  >
    [ {ok ? okText : failText} ]
  </span>
);
