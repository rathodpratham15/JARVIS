import React from "react";
import { ServiceHealth } from "../types";

interface StatusBarProps {
  services?: ServiceHealth[];
  activeTasksCount?: number;
  activeJobsCount?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  services = [],
  activeTasksCount = 1,
  activeJobsCount = 4,
}) => {
  return (
    <div className="w-full bg-[#F2F2EF] border-b border-[#1a1a1a] select-none">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#1a1a1a]">
        {/* Cell 01: System Status */}
        <div className="p-3 sm:px-6 sm:py-2.5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider">
              SYSTEM STATUS
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] border border-[#1a1a1a] animate-ping" />
              <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                ONLINE (99.8% EFFICIENCY)
              </span>
            </div>
          </div>
        </div>

        {/* Cell 02: Active Agent Threads */}
        <div className="p-3 sm:px-6 sm:py-2.5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider">
              AGENT THREADS & JOBS
            </span>
            <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5">
              {activeTasksCount} ACTIVE • {activeJobsCount} SCHEDULED
            </span>
          </div>
        </div>

        {/* Cell 03: Arc Reactor Telemetry */}
        <div className="p-3 sm:px-6 sm:py-2.5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider">
              ARC REACTOR POWER
            </span>
            <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5">
              1.42 GW • 98.7% HARMONIC
            </span>
          </div>
        </div>

        {/* Cell 04: Security Clearance */}
        <div className="p-3 sm:px-6 sm:py-2.5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[#555] uppercase tracking-wider">
              OPERATOR CLEARANCE
            </span>
            <span className="font-mono text-xs font-bold text-[#1a1a1a] mt-0.5">
              LEVEL 5 ADMIN (A. STARK)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
