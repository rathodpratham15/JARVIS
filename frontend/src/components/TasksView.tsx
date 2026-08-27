import React, { useState } from "react";
import {
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AgentTask, AgentStep } from "../types";
import { playUiSound } from "../utils/audio";
import { API_BASE } from "../utils/api";

const PAGE_SIZE = 5;

interface TasksViewProps {
  tasks: AgentTask[];
  onExecuteAgentTask: (description: string) => Promise<AgentTask>;
  onDeleteTask: (id: string) => void;
  onRenameTask: (id: string, label: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onExecuteAgentTask,
  onDeleteTask,
  onRenameTask,
}) => {
  const [filter, setFilter] = useState<"all" | "running" | "completed" | "idle">("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(tasks[0]?.id || null);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [page, setPage] = useState(0);

  const stepAction = (step: { title: string; args?: Record<string, any> }): string => {
    const a = step.args ?? {};
    switch (step.title) {
      case "search_web":      return `Searched for: "${a.query ?? ""}"`;
      case "save_note":       return `Saved note (${String(a.text ?? "").length} chars)`;
      case "get_weather":     return `Checked weather for: ${a.location ?? ""}`;
      case "set_reminder":    return `Set reminder: "${a.message ?? a.title ?? ""}"`;
      case "list_notes":      return "Listed saved notes";
      case "delete_note":     return `Deleted note: ${a.note_id ?? ""}`;
      case "open_app":        return `Opened app: ${a.app_name ?? ""}`;
      case "take_screenshot": return "Took screenshot";
      default:                return step.title.replace(/_/g, " ");
    }
  };

  const templates = [
    "Search the web for today's top AI news and save a summary note",
    "Research the latest developments in quantum computing and summarize findings",
    "Find the top 5 trending GitHub repositories this week and save a note",
    "Search for recent news about a company and write a brief report",
  ];

  const filteredTasks = tasks.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });
  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const pagedTasks = filteredTasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const startRename = (task: AgentTask) => {
    setRenamingId(task.id);
    setRenameValue(task.title);
  };

  const submitRename = async (id: string) => {
    const label = renameValue.trim();
    if (label) onRenameTask(id, label);
    setRenamingId(null);
  };

  const handleLaunch = async (customDesc?: string) => {
    const desc = (customDesc || newTaskInput).trim();
    if (!desc || isExecuting) return;

    playUiSound("beep");
    setIsExecuting(true);
    setNewTaskInput("");

    try {
      const newTask = await onExecuteAgentTask(desc);
      setExpandedTaskId(newTask.id);
      playUiSound("success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusBadge = (status: AgentTask["status"]) => {
    switch (status) {
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#00E5FF] text-black font-mono text-[10px] font-bold border border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
            RUNNING
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            COMPLETED
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-900/30 text-red-400 font-mono text-[10px] font-bold border border-red-900">
            <AlertCircle className="w-3 h-3 text-red-400" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#111318] text-zinc-400 font-mono text-[10px] font-bold border border-zinc-800">
            <Clock className="w-3 h-3 text-zinc-400" />
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 02</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Agent Tasks
          </h1>
          <p className="label-secondary mt-1">
            AUTONOMOUS BACKGROUND MULTI-STEP AGENT ORCHESTRATION & DECOMPOSITION
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleLaunch(templates[0])}
            disabled={isExecuting}
            className="editorial-btn-primary"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>LAUNCH RECON TASK</span>
          </button>
        </div>
      </div>

      {/* 2-Column Grid — Launch Directive left, Execution Queue right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Execution Queue — appears second on desktop */}
        <div className="lg:col-span-7 lg:order-2 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="overline-cyan">PANEL 02</div>
                <h2 className="font-serif text-2xl font-bold text-white">
                  Execution Queue
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Deconstructed agent plans with live step-by-step logs
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center border border-zinc-800 bg-[#111318] p-0.5 overflow-x-auto">
                {(["all", "running", "completed", "idle"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold transition ${
                      filter === f
                        ? "bg-[#00E5FF] text-black"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Tasks List */}
            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800/30 bg-[#111318] font-mono text-xs text-zinc-400">
                  No tasks matching status filter "{filter}".
                </div>
              ) : (
                pagedTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  const isRenaming = renamingId === task.id;
                  return (
                    <div
                      key={task.id}
                      className="border border-zinc-800 bg-[#111318] transition"
                    >
                      {/* Task Header Row */}
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div
                          className="space-y-1 flex-1 cursor-pointer"
                          onClick={() => !isRenaming && setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-zinc-400 font-bold">
                              ID: {task.id.slice(0, 8)}…
                            </span>
                            {task.category && (
                              <span className="font-mono text-[9px] px-1.5 py-0.2 bg-zinc-800 border border-zinc-700 text-zinc-300">
                                {task.category}
                              </span>
                            )}
                          </div>
                          {isRenaming ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") submitRename(task.id); if (e.key === "Escape") setRenamingId(null); }}
                                className="flex-1 border border-zinc-800 bg-[#0d0f12] font-serif text-lg font-bold text-white px-2 py-0.5 outline-none"
                              />
                              <button onClick={() => submitRename(task.id)} className="text-emerald-600 hover:text-emerald-800"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setRenamingId(null)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <h3 className="font-serif text-lg font-bold text-white">
                              {task.title}
                            </h3>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {getStatusBadge(task.status)}
                          <button
                            onClick={e => { e.stopPropagation(); startRename(task); }}
                            title="Rename"
                            className="p-1 text-zinc-400 hover:text-white transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); onDeleteTask(task.id); }}
                            title="Delete"
                            className="p-1 text-zinc-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1 bg-zinc-800 border-y border-zinc-900">
                        <div
                          className="h-full bg-[#00E5FF] transition-all duration-500"
                          style={{ width: `${task.progressPercent ?? 0}%` }}
                        />
                      </div>

                      {/* Expanded Steps Breakdown */}
                      {isExpanded && (
                        <div className="p-4 bg-[#0d0f12] border-t border-zinc-800 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="label-secondary text-[10px]">
                              DECONSTRUCTED EXECUTION STEPS ({task.steps.length})
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400">
                              CREATED: {new Date(task.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          {/* Steps List */}
                          <div className="space-y-2">
                            {task.steps.map((step) => (
                              <div
                                key={step.step}
                                className="p-3 bg-[#111318] border border-zinc-800 space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-[#1a1a1a] text-[#00E5FF]">
                                      STEP 0{step.step}
                                    </span>
                                    <span className="font-mono text-xs font-bold text-white">
                                      {stepAction(step)}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">
                                    {step.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Final Output Dossier */}
                          {task.output && (
                            <div className="p-3.5 bg-[#00E5FF]/10 border border-zinc-800 space-y-1">
                              <span className="overline-cyan text-[10px]">
                                AGENT SYNTHESIS OUTPUT
                              </span>
                              <p className="font-mono text-xs text-white font-medium leading-relaxed">
                                {task.output}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 border border-zinc-800 bg-[#111318] text-white disabled:opacity-30 hover:bg-[#00E5FF] transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-[10px] text-zinc-400">
                  PAGE {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 border border-zinc-800 bg-[#111318] text-white disabled:opacity-30 hover:bg-[#00E5FF] transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Launch Autonomous Task Panel (5 cols) */}
        {/* Launch Directive — appears first on desktop */}
        <div className="lg:col-span-5 lg:order-1 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 01</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Launch Directive
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Dispatch an autonomous agent loop with Gemini reasoning
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Input Form */}
            <div className="space-y-3">
              <label className="label-secondary">
                TASK DIRECTIVE DESCRIPTION
              </label>
              <textarea
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                placeholder="Describe a goal for J.A.R.V.I.S. (e.g. 'Search for today's AI news and save a summary note')..."
                rows={4}
                className="editorial-input resize-none"
              />
              <button
                onClick={() => handleLaunch()}
                disabled={!newTaskInput.trim() || isExecuting}
                className="editorial-btn-primary w-full py-3"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>DECONSTRUCTING & EXECUTING...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>DISPATCH AGENT LOOP</span>
                  </>
                )}
              </button>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Preset Mission Templates */}
            <div className="space-y-3">
              <label className="label-secondary">
                PRESET STARK MISSION TEMPLATES
              </label>
              <div className="space-y-2">
                {templates.map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNewTaskInput(tpl);
                    }}
                    className="w-full text-left p-3 bg-[#111318] hover:bg-[#00E5FF] hover:text-black border border-zinc-800 font-mono text-[11px] text-white transition font-medium"
                  >
                    "{tpl}"
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Architecture Telemetry */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>AGENT ENGINE</span>
                <span className="font-bold text-white">GEMINI MULTI-STEP REASONER</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>MAX STEPS</span>
                <span className="font-bold text-white">4 SEQUENTIAL SUBROUTINES</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>EXECUTION MODE</span>
                <span className="font-bold text-white">AUTONOMOUS DECOMPOSE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
