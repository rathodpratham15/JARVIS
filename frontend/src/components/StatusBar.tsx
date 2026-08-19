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
    <div className="w-full bg-[#F2F2EF] border-b border-[#1a1a1a] select-none">
      {/* Mobile: single compact row */}
      <div className="md:hidden flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full border border-[#1a1a1a] shrink-0 ${isOnline ? "bg-[#00E5FF] animate-pulse" : "bg-red-500"}`} />
          <span className="font-mono text-[10px] font-bold text-[#1a1a1a]">{isOnline ? "ONLINE" : "DEGRADED"}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-[#555]">
          <span><strong className="text-[#1a1a1a]">{activeTasksCount}</strong> TASKS</span>
          <span><strong className="text-[#1a1a1a]">{activeJobsCount}</strong> JOBS</span>
          <span><strong className="text-[#1a1a1a]">{permissionsGranted}</strong>/{permissionsTotal || "—"} PERMS</span>
        </div>
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden md:grid max-w-7xl mx-auto grid-cols-4 divide-x divide-[#1a1a1a]">
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">SYSTEM STATUS</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 rounded-full border border-[#1a1a1a] ${isOnline ? "bg-[#00E5FF] animate-ping" : "bg-red-500"}`} />
            <span className="font-mono text-xs font-bold text-[#1a1a1a]">{isOnline ? "ONLINE" : "DEGRADED"}</span>
          </div>
        </div>
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">AGENT THREADS &amp; JOBS</span>
          <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5 block">{activeTasksCount} ACTIVE &bull; {activeJobsCount} SCHEDULED</span>
        </div>
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">ACTIVE SCHEDULES</span>
          <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5 block">{activeJobsCount} ENABLED</span>
        </div>
        <div className="px-6 py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">PERMISSIONS</span>
          <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5 block">{permissionsGranted} / {permissionsTotal > 0 ? permissionsTotal : "—"} GRANTED</span>
        </div>
      </div>
    </div>
  );
};
