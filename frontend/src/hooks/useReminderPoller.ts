import { useEffect, useRef } from 'react';
import { hudToast } from '@/lib/hudToast';

interface Reminder {
  id: string;
  text: string;
  due_at: string | null;
  fired: boolean;
  kind: string;
}

const POLL_INTERVAL = 30_000;

export function useReminderPoller() {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/reminders/due');
        if (!res.ok) return;
        const { reminders } = (await res.json()) as { reminders: Reminder[] };
        for (const r of reminders) {
          if (seen.current.has(r.id)) continue;
          seen.current.add(r.id);
          const label = r.kind === 'timer' ? 'TIMER' : 'REMINDER';
          hudToast.info(`${label}: ${r.text}`);
          // Tell backend it's been acknowledged
          await fetch(`/api/reminders/${r.id}`, { method: 'DELETE' });
        }
      } catch {
        // silently ignore — backend may be offline
      }
    };

    check();
    const t = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(t);
  }, []);
}
