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
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#1a1a1a]">
        {/* Cell 01: System Status */}
        <div className="p-3 sm:px-6 sm:py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">
            SYSTEM STATUS
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 rounded-full border border-[#1a1a1a] ${isOnline ? "bg-[#00E5FF] animate-ping" : "bg-red-500"}`} />
            <span className="font-mono text-xs font-bold text-[#1a1a1a]">
              {isOnline ? "ONLINE" : "DEGRADED"}
            </span>
          </div>
        </div>

        {/* Cell 02: Agent Threads & Jobs */}
        <div className="p-3 sm:px-6 sm:py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">
            AGENT THREADS &amp; JOBS
          </span>
          <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5 block">
            {activeTasksCount} ACTIVE &bull; {activeJobsCount} SCHEDULED
          </span>
        </div>

        {/* Cell 03: Active Schedules */}
        <div className="p-3 sm:px-6 sm:py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">
            ACTIVE SCHEDULES
          </span>
          <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5 block">
            {activeJobsCount} ENABLED
          </span>
        </div>

        {/* Cell 04: Permissions */}
        <div className="p-3 sm:px-6 sm:py-2.5">
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider block">
            PERMISSIONS
          </span>
          <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5 block">
            {permissionsGranted} / {permissionsTotal > 0 ? permissionsTotal : "—"} GRANTED
          </span>
        </div>
      </div>
    </div>
  );
};
