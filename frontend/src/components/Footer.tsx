import React, { useEffect, useState } from 'react';
import { StatusDot } from '@/components/hud/Hud';

export const Footer: React.FC = () => {
  const [nominal, setNominal] = useState(true);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (mounted) setNominal(data.status === 'ok');
      } catch {
        if (mounted) setNominal(false);
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
    <footer
      className="h-9 shrink-0 border-t border-[rgba(0,180,255,0.15)] bg-[#040d1d] flex items-center justify-between px-5"
      data-testid="footer"
    >
      <span className="font-hud-mono text-[10px] tracking-widest text-[#4a7fa0]">
        J.A.R.V.I.S v2.0.0
      </span>
      <div className="flex items-center gap-2">
        <StatusDot active={nominal} className={nominal ? '' : 'bg-[#ef4444]'} />
        <span
          className="font-hud-mono text-[10px] tracking-widest"
          style={{ color: nominal ? '#4a7fa0' : '#ef4444' }}
        >
          {nominal ? 'SYS NOMINAL' : 'SYS FAULT'}
        </span>
      </div>
    </footer>
  );
};
