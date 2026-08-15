import React, { useState } from "react";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { ScheduleJob } from "../types";
import { playUiSound } from "../utils/audio";

interface SchedulesViewProps {
  schedules: ScheduleJob[];
  onToggleSchedule: (id: string) => void;
  onRunScheduleNow: (id: string) => Promise<void>;
  onDeleteSchedule: (id: string) => void;
  onCreateSchedule: (job: Omit<ScheduleJob, "id" | "lastRun" | "status">) => void;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({
  schedules,
  onToggleSchedule,
  onRunScheduleNow,
  onDeleteSchedule,
  onCreateSchedule,
}) => {
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cronExpression, setCronExpression] = useState("Every 15 minutes");
  const [targetModule, setTargetModule] = useState<ScheduleJob["targetModule"]>("Security");

  const cronPresets = [
    "Every 15 minutes",
    "Hourly at :00",
    "Daily at 06:00 EST",
    "Daily at 02:00 EST",
    "Weekly on Sunday 04:00",
  ];

  const targetModules: ScheduleJob["targetModule"][] = [
    "Security",
    "Arc Reactor",
    "Intelligence",
    "Backups",
    "Diagnostics",
    "Communications",
  ];

  const handleRunNow = async (id: string) => {
    playUiSound("beep");
    setRunningJobId(id);
    try {
      await onRunScheduleNow(id);
      playUiSound("success");
    } finally {
      setTimeout(() => setRunningJobId(null), 1200);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    playUiSound("beep");
    onCreateSchedule({
      title: title.trim(),
      description: description.trim() || `Autonomous routine scheduled for ${targetModule}.`,
      cronExpression,
      targetModule,
      enabled: true,
      nextRun: "In 15 minutes",
    });

    setTitle("");
    setDescription("");
    playUiSound("success");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 03</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Schedules
          </h1>
          <p className="label-secondary mt-1">
            AUTONOMOUS PERIODIC JOBS & RECURRENT CRON ORCHESTRATION
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#F2F2EF] border border-[#1a1a1a] font-mono text-xs font-bold text-[#1a1a1a]">
            {schedules.filter((s) => s.enabled).length} OF {schedules.length} ACTIVE
          </div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Scheduled Jobs List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                  Configured Cron Jobs
                </h2>
                <p className="text-xs text-[#555] font-sans mt-0.5">
                  Autonomous background routines scheduled across StarkNet
                </p>
              </div>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {/* Jobs List */}
            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#1a1a1a]/30 bg-[#EBEBEA] font-mono text-xs text-[#555]">
                  No scheduled jobs configured. Create a routine in Panel 02.
                </div>
              ) : (
                schedules.map((job) => {
                  const isRunning = runningJobId === job.id;
                  return (
                    <div
                      key={job.id}
                      className="p-5 border border-[#1a1a1a] bg-[#EBEBEA] space-y-3 transition"
                    >
                      {/* Job Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] uppercase px-2 py-0.5 bg-[#1a1a1a] text-[#00E5FF] font-bold">
                            {job.targetModule}
                          </span>
                          <span className="font-mono text-xs text-[#555]">
                            {job.cronExpression}
                          </span>
                        </div>

                        {/* Enable/Disable Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#555] font-bold">
                            {job.enabled ? "ENABLED" : "DISABLED"}
                          </span>
                          <button
                            onClick={() => onToggleSchedule(job.id)}
                            className={`w-9 h-5 border border-[#1a1a1a] transition p-0.5 flex items-center ${
                              job.enabled ? "bg-[#00E5FF] justify-end" : "bg-[#ccc] justify-start"
                            }`}
                            title={job.enabled ? "Disable Routine" : "Enable Routine"}
                          >
                            <div className="w-3.5 h-3.5 bg-black" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="font-serif text-lg font-bold text-[#1a1a1a]">
                          {job.title}
                        </h3>
                        <p className="font-mono text-xs text-[#555] mt-1 leading-relaxed">
                          {job.description}
                        </p>
                      </div>

                      {/* Telemetry Row */}
                      <div className="pt-3 border-t border-[#1a1a1a]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono">
                        <div className="space-y-0.5 text-[#555]">
                          <div>LAST RUN: <strong className="text-[#1a1a1a]">{job.lastRun || "Never"}</strong></div>
                          <div>NEXT EXECUTION: <strong className="text-[#1a1a1a]">{job.nextRun}</strong></div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRunNow(job.id)}
                            disabled={isRunning}
                            className="editorial-btn-primary py-1.5 px-3 text-[10px]"
                          >
                            {isRunning ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>RUNNING...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                <span>RUN NOW</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => onDeleteSchedule(job.id)}
                            className="p-1.5 border border-[#1a1a1a] bg-transparent hover:bg-rose-100 text-[#1a1a1a] transition"
                            title="Delete Schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Create Schedule Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                New Schedule Job
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Register recurring autonomous routines with custom frequency
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-secondary">ROUTINE TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.G. MALIBU WORKSHOP SENSOR AUDIT..."
                  className="editorial-input"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-secondary">DESCRIPTION & PURPOSE</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specify task instructions, logging criteria, or threat thresholds..."
                  rows={3}
                  className="editorial-input resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-secondary">FREQUENCY PRESET</label>
                  <select
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    className="editorial-input"
                  >
                    {cronPresets.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="label-secondary">TARGET MODULE</label>
                  <select
                    value={targetModule}
                    onChange={(e) => setTargetModule(e.target.value as any)}
                    className="editorial-input"
                  >
                    {targetModules.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!title.trim()}
                className="editorial-btn-primary w-full py-3"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>REGISTER SCHEDULED JOB</span>
              </button>
            </form>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Cron Engine Telemetry */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>DISPATCH ENGINE</span>
                <span className="font-bold text-[#1a1a1a]">STARK AUTONOMOUS CRON v4</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>TIME DRIFT ACCURACY</span>
                <span className="font-bold text-[#1a1a1a]">&lt; 2.4 ms (ATOMIC)</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>CONCURRENCY LIMIT</span>
                <span className="font-bold text-[#1a1a1a]">16 ASYNC THREADS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
