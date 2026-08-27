import React from "react";
import { ServiceHealth } from "../types";

interface StatusBarProps {
  services?: ServiceHealth[];
  activeTasksCount?: number;
  activeJobsCount?: number;
  permissionsGranted?: number;
  permissionsTotal?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  services = [],
  activeTasksCount = 0,
  activeJobsCount = 0,
  permissionsGranted = 0,
  permissionsTotal = 0,
}) => {
  const isOnline = services.length === 0 || services.some(s => s.status === "online");

  return (
    <div className="w-full bg-[#111318] border-b border-zinc-800 select-none">
      {/* Mobile: single compact row */}
      <div className="md:hidden flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
          <span className="font-mono text-[10px] font-bold text-zinc-300">{isOnline ? "ONLINE" : "DEGRADED"}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
          <span><strong className="text-zinc-300">{activeTasksCount}</strong> TASKS</span>
          <span><strong className="text-zinc-300">{activeJobsCount}</strong> JOBS</span>
          <span><strong className="text-zinc-300">{permissionsGranted}</strong>/{permissionsTotal || "—"} PERMS</span>
        </div>
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden md:grid max-w-7xl mx-auto grid-cols-4 divide-x divide-zinc-800">
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block">SYSTEM STATUS</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-ping" : "bg-red-500"}`} />
            <span className="font-mono text-xs font-bold text-zinc-300">{isOnline ? "ONLINE" : "DEGRADED"}</span>
          </div>
        </div>
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block">AGENT THREADS &amp; JOBS</span>
          <span className="font-mono text-xs font-bold text-zinc-300 mt-0.5 block">{activeTasksCount} ACTIVE &bull; {activeJobsCount} SCHEDULED</span>
        </div>
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block">ACTIVE SCHEDULES</span>
          <span className="font-mono text-xs font-bold text-zinc-300 mt-0.5 block">{activeJobsCount} ENABLED</span>
        </div>
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block">PERMISSIONS</span>
          <span className="font-mono text-xs font-bold text-zinc-300 mt-0.5 block">{permissionsGranted} / {permissionsTotal > 0 ? permissionsTotal : "—"} GRANTED</span>
        </div>
      </div>
    </div>
  );
};
