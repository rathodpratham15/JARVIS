import React, { useState } from "react";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bot,
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

const SCHEDULE_PRESETS = [
  { label: "Every 15 minutes", value: "every 15 minutes" },
  { label: "Every 30 minutes", value: "every 30 minutes" },
  { label: "Every hour",       value: "every 1 hours" },
  { label: "Every 6 hours",    value: "every 6 hours" },
  { label: "Every day at 9am", value: "every day at 09:00" },
  { label: "Every day at 8pm", value: "every day at 20:00" },
  { label: "Every Monday",     value: "every monday at 09:00" },
  { label: "Custom…",          value: "custom" },
];

const TARGET_MODULES: ScheduleJob["targetModule"][] = [
  "Security",
  "Research",
  "Intelligence",
  "Backups",
  "Diagnostics",
  "Communications",
];

export const SchedulesView: React.FC<SchedulesViewProps> = ({
  schedules,
  onToggleSchedule,
  onRunScheduleNow,
  onDeleteSchedule,
  onCreateSchedule,
}) => {
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  const [title, setTitle]           = useState("");
  const [goal, setGoal]             = useState("");
  const [presetValue, setPresetValue] = useState(SCHEDULE_PRESETS[0].value);
  const [customExpr, setCustomExpr]   = useState("");
  const [targetModule, setTargetModule] = useState<ScheduleJob["targetModule"]>("Intelligence");

  const scheduleExpr = presetValue === "custom" ? customExpr.trim() : presetValue;

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
    if (!title.trim() || !goal.trim() || !scheduleExpr) return;
    playUiSound("beep");
    onCreateSchedule({
      title: title.trim(),
      description: goal.trim(),
      cronExpression: scheduleExpr,
      targetModule,
      enabled: true,
      nextRun: "—",
    });
    setTitle("");
    setGoal("");
    setPresetValue(SCHEDULE_PRESETS[0].value);
    setCustomExpr("");
    playUiSound("success");
  };

  const statusColor = (s: ScheduleJob["status"]) => {
    if (s === "running") return "text-amber-600";
    if (s === "success") return "text-emerald-600";
    if (s === "failed")  return "text-red-600";
    return "text-zinc-400";
  };

  const statusLabel = (job: ScheduleJob) => {
    if (job.status === "running") return "RUNNING";
    if (job.status === "success") return "DONE";
    if (job.status === "failed")  return "FAILED";
    return job.runCount ? `${job.runCount} RUNS` : "IDLE";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 05</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Background Agents
          </h1>
          <p className="label-secondary mt-1">
            AUTONOMOUS SCHEDULED AGENT ROUTINES
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#0d0f12] border border-zinc-800 font-mono text-xs font-bold text-white">
            {schedules.filter((s) => s.enabled).length} OF {schedules.length} ACTIVE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Job List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 01</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Configured Agents
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Recurring tasks that run autonomously on a schedule
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800/30 bg-[#111318] font-mono text-xs text-zinc-400">
                  No background agents configured. Create one in Panel 02.
                </div>
              ) : (
                schedules.map((job) => {
                  const isRunning = runningJobId === job.id;
                  const isExpanded = expandedId === job.id;
                  return (
                    <div
                      key={job.id}
                      className="border border-zinc-800 bg-[#111318] transition"
                    >
                      <div className="p-5 space-y-3">
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] uppercase px-2 py-0.5 bg-zinc-800 text-zinc-300 font-bold">
                              {job.targetModule}
                            </span>
                            <span className="font-mono text-xs text-zinc-400">
                              {job.cronExpression}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-[10px] font-bold ${statusColor(job.status)}`}>
                              {statusLabel(job)}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400 font-bold">
                              {job.enabled ? "ENABLED" : "DISABLED"}
                            </span>
                            <button
                              onClick={() => onToggleSchedule(job.id)}
                              className={`w-9 h-5 border border-zinc-800 transition p-0.5 flex items-center ${
                                job.enabled ? "bg-white justify-end" : "bg-zinc-700 justify-start"
                              }`}
                              title={job.enabled ? "Disable" : "Enable"}
                            >
                              <div className="w-3.5 h-3.5 bg-black" />
                            </button>
                          </div>
                        </div>

                        {/* Title & goal */}
                        <div>
                          <h3 className="font-serif text-lg font-bold text-white">
                            {job.title}
                          </h3>
                          <p className="font-mono text-xs text-zinc-400 mt-1 leading-relaxed">
                            {job.description}
                          </p>
                        </div>

                        {/* Telemetry row */}
                        <div className="pt-3 border-t border-zinc-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono">
                          <div className="text-zinc-400">
                            LAST RUN:{" "}
                            <strong className="text-white">{job.lastRun || "Never"}</strong>
                          </div>

                          <div className="flex items-center gap-2">
                            {job.lastResult && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : job.id)}
                                className="flex items-center gap-1 font-mono text-[10px] text-zinc-400 hover:text-white transition"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                <span>LAST RESULT</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleRunNow(job.id)}
                              disabled={isRunning}
                              className="editorial-btn-primary py-1.5 px-3 text-[10px]"
                            >
                              {isRunning ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>RUNNING…</span>
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
                              className="p-1.5 border border-zinc-800 bg-transparent hover:bg-red-900/20 text-white transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable result */}
                      {isExpanded && job.lastResult && (
                        <div className="px-5 pb-5 border-t border-zinc-800/20">
                          <div className="mt-3 flex items-start gap-2">
                            <Bot className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                            <p className="font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {job.lastResult}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Create Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                New Background Agent
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Schedule an autonomous agent task to run on a recurring interval
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-secondary">AGENT NAME</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.G. DAILY NEWS BRIEFING"
                  className="editorial-input"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-secondary">AGENT GOAL (TASK INSTRUCTIONS)</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="E.g. Search the web for today's top AI news and save a summary note."
                  rows={4}
                  className="editorial-input resize-none"
                  required
                />
                <p className="font-mono text-[10px] text-zinc-500">
                  This is the prompt the agent will execute autonomously.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-secondary">FREQUENCY</label>
                  <select
                    value={presetValue}
                    onChange={(e) => setPresetValue(e.target.value)}
                    className="editorial-input"
                  >
                    {SCHEDULE_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="label-secondary">CATEGORY</label>
                  <select
                    value={targetModule}
                    onChange={(e) => setTargetModule(e.target.value as any)}
                    className="editorial-input"
                  >
                    {TARGET_MODULES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {presetValue === "custom" && (
                <div className="space-y-1.5">
                  <label className="label-secondary">CUSTOM EXPRESSION</label>
                  <input
                    type="text"
                    value={customExpr}
                    onChange={(e) => setCustomExpr(e.target.value)}
                    placeholder="every 2 hours / every day at 09:00 / every monday at 10:00"
                    className="editorial-input"
                    required
                  />
                  <p className="font-mono text-[10px] text-zinc-500">
                    Syntax: "every N minutes/hours/days", "every day at HH:MM", "every [weekday] at HH:MM"
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!title.trim() || !goal.trim() || (presetValue === "custom" && !customExpr.trim())}
                className="editorial-btn-primary w-full py-3"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>REGISTER BACKGROUND AGENT</span>
              </button>
            </form>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>RUNNER ENGINE</span>
                <span className="font-bold text-white">ReAct Agent Loop</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>CONCURRENCY</span>
                <span className="font-bold text-white">4 PARALLEL WORKERS</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>MAX STEPS/RUN</span>
                <span className="font-bold text-white">8 (CONFIGURABLE)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
