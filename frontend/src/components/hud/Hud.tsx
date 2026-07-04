import React from 'react';
import { cn } from '@/lib/utils';

interface HudPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const HudPanel: React.FC<HudPanelProps> = ({ active = false, className, children, ...props }) => (
  <div
    className={cn('hud-panel p-5', active && 'hud-panel-active', className)}
    {...props}
  >
    {children}
  </div>
);

interface StatusDotProps {
  active?: boolean;
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ active = false, className }) => (
  <span
    className={cn(
      'inline-block w-2 h-2 rounded-full',
      active ? 'bg-[#00d4ff] jv-pulse' : 'bg-[#1e3a5f]',
      className
    )}
  />
);

interface MonoLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  className?: string;
}

export const MonoLabel: React.FC<MonoLabelProps> = ({ children, className, ...props }) => (
  <span className={cn('mono-label', className)} {...props}>
    {children}
  </span>
);

interface SectionDividerProps {
  label?: string;
  className?: string;
}

export const SectionDivider: React.FC<SectionDividerProps> = ({ label, className }) => (
  <div className={cn('flex items-center gap-3 my-4', className)}>
    {label && <MonoLabel className="shrink-0">{label}</MonoLabel>}
    <div className="h-px flex-1 bg-[rgba(0,180,255,0.12)]" />
  </div>
);

interface ScanLoaderProps {
  className?: string;
}

export const ScanLoader: React.FC<ScanLoaderProps> = ({ className }) => (
  <div
    className={cn(
      'relative h-0.5 w-full overflow-hidden bg-[rgba(0,180,255,0.1)] jv-loadscan',
      className
    )}
  />
);

interface StatBlockProps {
  value: string | number;
  label: string;
  accent?: string;
  testid?: string;
}

export const StatBlock: React.FC<StatBlockProps> = ({ value, label, accent = '#00d4ff', testid }) => (
  <HudPanel className="text-center py-6" data-testid={testid}>
    <div
      className="font-orbitron font-bold text-4xl jv-glow"
      style={{ color: accent }}
    >
      {value}
    </div>
    <MonoLabel className="mt-2 block">{label}</MonoLabel>
  </HudPanel>
);
