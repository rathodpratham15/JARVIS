import { Clock } from 'lucide-react';

export function ScheduledView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#717171] dark:text-[#A1A1AA]">
      <Clock className="w-10 h-10 opacity-30" />
      <p className="text-sm">Scheduled tasks — coming soon</p>
    </div>
  );
}
