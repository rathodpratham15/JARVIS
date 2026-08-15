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

function playAlarm(kind: 'timer' | 'reminder') {
  try {
    const ctx = new AudioContext();
    // Two-tone chime: high beep then lower beep
    const tones = kind === 'timer'
      ? [{ freq: 880, start: 0 }, { freq: 660, start: 0.18 }, { freq: 880, start: 0.36 }]
      : [{ freq: 660, start: 0 }, { freq: 880, start: 0.2 }, { freq: 660, start: 0.4 }, { freq: 880, start: 0.6 }];

    tones.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.15);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.16);
    });

    // Close context after tones finish
    setTimeout(() => ctx.close(), (tones[tones.length - 1].start + 0.3) * 1000);
  } catch {
    // AudioContext unavailable — silently skip
  }
}

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
          playAlarm(r.kind === 'timer' ? 'timer' : 'reminder');
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
