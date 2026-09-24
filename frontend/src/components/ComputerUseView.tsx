import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Monitor,
  MousePointer,
  Play,
  Square,
  RefreshCw,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Keyboard,
  Scroll,
  Camera,
} from "lucide-react";
import { apiFetch } from "../utils/api";
import { playUiSound } from "../utils/audio";

interface CuAction {
  action: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  keys?: string[];
  direction?: string;
  clicks?: number;
  reason?: string;
  result?: string;
}

interface CuStep {
  step: number;
  screenshot?: string; // base64, only on latest step
  action: CuAction;
  result: string;
  timestamp: string;
}

interface CuTask {
  id: string;
  goal: string;
  status: "pending" | "running" | "done" | "failed";
  created_at: string;
  finished_at: string | null;
  steps: CuStep[];
  final_result: string | null;
  error: string | null;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  screenshot: <Camera className="w-3 h-3" />,
  click: <MousePointer className="w-3 h-3" />,
  double_click: <MousePointer className="w-3 h-3" />,
  type: <Keyboard className="w-3 h-3" />,
  key: <Keyboard className="w-3 h-3" />,
  hotkey: <Keyboard className="w-3 h-3" />,
  scroll: <Scroll className="w-3 h-3" />,
  done: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  fail: <XCircle className="w-3 h-3 text-rose-400" />,
};

function actionLabel(a: CuAction): string {
  switch (a.action) {
    case "click":
    case "double_click":
      return `${a.action.replace("_", " ")} at (${a.x}, ${a.y})`;
    case "type":
      return `type "${(a.text ?? "").slice(0, 40)}${(a.text ?? "").length > 40 ? "…" : ""}"`;
    case "key":
      return `press ${a.key}`;
    case "hotkey":
      return `hotkey ${(a.keys ?? []).join("+")}`;
    case "scroll":
      return `scroll ${a.direction} at (${a.x}, ${a.y})`;
    case "screenshot":
      return "take screenshot";
    case "done":
      return `done — ${a.result ?? ""}`;
    case "fail":
      return `failed — ${a.reason ?? ""}`;
    default:
      return a.action;
  }
}

const POLL_MS = 1500;

const PRESET_GOALS = [
  "Open terminal and run system diagnostics",
  "Open a browser and search for recent AI news",
  "Take a screenshot and describe what's on screen",
];

export const ComputerUseView: React.FC = () => {
  const [goal, setGoal] = useState("");
  const [activeTask, setActiveTask] = useState<CuTask | null>(null);
  const [history, setHistory] = useState<CuTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<CuTask | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchTask = useCallback(async (taskId: string) => {
    try {
      const res = await apiFetch(`/api/computer-use/${taskId}`);
      if (!res.ok) return;
      const data: CuTask = await res.json();
      setActiveTask(data);
      // Extract latest screenshot
      const lastStep = data.steps[data.steps.length - 1];
      if (lastStep?.screenshot) setLatestScreenshot(lastStep.screenshot);
      if (data.status === "done") {
        stopPolling();
        playUiSound("success");
        loadHistory();
      } else if (data.status === "failed") {
        stopPolling();
        playUiSound("beep");
        loadHistory();
      }
    } catch {
      // network error — keep polling
    }
  }, [stopPolling]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiFetch("/api/computer-use");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.tasks ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Scroll action log to bottom on new steps
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTask?.steps.length]);

  const startPolling = useCallback((taskId: string) => {
    stopPolling();
    pollingRef.current = setInterval(() => fetchTask(taskId), POLL_MS);
  }, [stopPolling, fetchTask]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleSubmit = async () => {
    const trimmed = goal.trim();
    if (!trimmed || isSubmitting) return;
    playUiSound("beep");
    setIsSubmitting(true);
    setLatestScreenshot(null);
    setSelectedHistoryTask(null);
    try {
      const res = await apiFetch("/api/computer-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const taskId: string = data.task_id;
      setActiveTask({ id: taskId, goal: trimmed, status: "pending", created_at: new Date().toISOString(), finished_at: null, steps: [], final_result: null, error: null });
      startPolling(taskId);
    } catch (e) {
      alert(`Failed to start task: ${e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeTask) return;
    stopPolling();
    await apiFetch(`/api/computer-use/${activeTask.id}`, { method: "DELETE" }).catch(() => {});
    setActiveTask((t) => t ? { ...t, status: "failed", error: "Cancelled by user." } : t);
    loadHistory();
  };

  const isRunning = activeTask?.status === "pending" || activeTask?.status === "running";

  const displayedSteps = selectedHistoryTask?.steps ?? activeTask?.steps ?? [];
  const displayedTask = selectedHistoryTask ?? activeTask;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 05</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Computer Use
          </h1>
          <p className="label-secondary mt-1">
            MULTIMODAL SCREEN PERCEPTION & SYNTHETIC MOUSE/KEYBOARD AGENT LOOP
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className={`px-2 py-1 border font-bold ${isRunning ? "border-amber-500 text-amber-400 bg-amber-500/10 animate-pulse" : activeTask?.status === "done" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : activeTask?.status === "failed" ? "border-rose-500 text-rose-400 bg-rose-500/10" : "border-zinc-700 text-zinc-400 bg-zinc-800/40"}`}>
            {isRunning ? "AGENT ACTIVE" : activeTask?.status?.toUpperCase() ?? "IDLE"}
          </span>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Viewport */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-white">Live Screen Feed</h2>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Latest screenshot captured by the agent during execution
                </p>
              </div>
              {displayedTask && (
                <span className="font-mono text-[10px] text-zinc-400 max-w-[200px] truncate">
                  GOAL: {displayedTask.goal}
                </span>
              )}
            </div>

            <div className="border-b border-zinc-800" />

            {/* Screenshot or Placeholder */}
            <div className="relative border-2 border-zinc-800 bg-[#1a1a1a] overflow-hidden">
              {/* Window title bar */}
              <div className="bg-[#2a2a2a] px-3 py-1.5 flex items-center justify-between font-mono text-[10px] border-b border-black">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className="ml-2 font-bold text-white">AGENT DISPLAY FEED</span>
                </div>
                <span className="text-zinc-500">
                  {displayedSteps.length > 0 ? `STEP ${displayedSteps.length}` : "WAITING"}
                </span>
              </div>

              {latestScreenshot || (selectedHistoryTask?.steps.find(s => s.screenshot)?.screenshot) ? (
                <img
                  src={`data:image/png;base64,${latestScreenshot ?? selectedHistoryTask?.steps.find(s => s.screenshot)?.screenshot}`}
                  alt="Agent screenshot"
                  className="w-full object-contain block"
                />
              ) : (
                <div className="bg-[#0f172a] text-cyan-400 p-6 font-mono text-xs min-h-[280px] flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-slate-400">$ awaiting agent dispatch...</div>
                    {isRunning && (
                      <div className="flex items-center gap-2 text-amber-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>agent running — screenshot will appear here</span>
                      </div>
                    )}
                    {!activeTask && (
                      <div className="text-slate-500">Submit a goal on the right to begin.</div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>JARVIS COMPUTER USE</span>
                    <span>STATUS: {isRunning ? "CAPTURING" : "STANDBY"}</span>
                  </div>
                </div>
              )}

              {isRunning && (
                <div className="absolute inset-0 pointer-events-none border-2 border-amber-500/30 animate-pulse" />
              )}
            </div>

            {/* Task result / error banner */}
            {displayedTask?.status === "done" && displayedTask.final_result && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-700 font-mono text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{displayedTask.final_result}</span>
              </div>
            )}
            {displayedTask?.status === "failed" && displayedTask.error && (
              <div className="p-3 bg-rose-950/40 border border-rose-700 font-mono text-xs text-rose-300 flex items-start gap-2">
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{displayedTask.error}</span>
              </div>
            )}
          </div>

          {/* Task History */}
          {history.length > 0 && (
            <div className="editorial-panel space-y-4">
              <div>
                <div className="overline-cyan">PANEL 03</div>
                <h2 className="font-serif text-xl font-bold text-white">Task History</h2>
              </div>
              <div className="border-b border-zinc-800" />
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedHistoryTask(selectedHistoryTask?.id === t.id ? null : t);
                      setLatestScreenshot(null);
                    }}
                    className={`w-full text-left p-2.5 border font-mono text-[11px] transition flex items-center justify-between gap-2 ${selectedHistoryTask?.id === t.id ? "border-cyan-500 bg-cyan-950/30 text-white" : "border-zinc-800 bg-[#111318] hover:bg-zinc-800 text-zinc-300"}`}
                  >
                    <span className="truncate">{t.goal}</span>
                    <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold ${t.status === "done" ? "bg-emerald-900 text-emerald-300" : t.status === "failed" ? "bg-rose-900 text-rose-300" : "bg-amber-900 text-amber-300"}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls + Action Log */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-white">Agent Dispatch</h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Submit a natural language goal — the agent will control your desktop
              </p>
            </div>
            <div className="border-b border-zinc-800" />

            {/* Goal Input */}
            <div className="space-y-3">
              <label className="label-secondary">NATURAL LANGUAGE GOAL</label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSubmit(); }}
                placeholder='E.g. "Open terminal and run ls -la"'
                rows={3}
                disabled={isRunning}
                className="editorial-input resize-none disabled:opacity-50"
              />

              {isRunning ? (
                <button onClick={handleCancel} className="editorial-btn-primary w-full py-3 bg-rose-950 border-rose-700 hover:bg-rose-900">
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>CANCEL TASK</span>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!goal.trim() || isSubmitting}
                  className="editorial-btn-primary w-full py-3"
                >
                  {isSubmitting ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>DISPATCHING...</span></>
                  ) : (
                    <><Play className="w-3.5 h-3.5 fill-current" /><span>EXECUTE GOAL</span></>
                  )}
                </button>
              )}
            </div>

            <div className="border-b border-dashed border-zinc-800/30" />

            {/* Preset Goals */}
            <div className="space-y-2.5">
              <span className="label-secondary">PRESET GOALS</span>
              <div className="space-y-2">
                {PRESET_GOALS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setGoal(p)}
                    disabled={isRunning}
                    className="w-full text-left p-2.5 bg-[#111318] hover:bg-zinc-700 border border-zinc-800 font-mono text-[11px] text-white transition disabled:opacity-40"
                  >
                    "{p}"
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-zinc-800/30" />

            {/* Action Log */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-secondary">ACTION LOG</span>
                <span className="font-mono text-[10px] text-zinc-400">{displayedSteps.length} STEPS</span>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 font-mono text-xs">
                {displayedSteps.length === 0 && (
                  <div className="text-zinc-600 text-[11px] py-2">No steps yet — submit a goal to begin.</div>
                )}
                {displayedSteps.map((step) => (
                  <div key={step.step} className="p-2.5 bg-[#111318] border border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 text-[10px] font-bold">#{step.step}</span>
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-700 text-white text-[9px] font-bold uppercase">
                          {ACTION_ICON[step.action.action] ?? <Terminal className="w-3 h-3" />}
                          {step.action.action}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(step.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                    <p className="text-[11px] text-white leading-tight">{actionLabel(step.action)}</p>
                    {step.action.reason && (
                      <p className="text-[10px] text-zinc-500 leading-tight italic">{step.action.reason}</p>
                    )}
                    {step.result && step.result !== "Screenshot taken." && (
                      <p className="text-[10px] text-zinc-400">{step.result}</p>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>

          {/* Stats panel */}
          <div className="p-3 bg-[#111318] border border-zinc-800 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px]">
            <div className="flex items-center gap-2">
              <span className="label-secondary">VISION MODEL</span>
              <span className="font-bold text-white">LLAMA 3.2 VISION</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="label-secondary">MAX STEPS</span>
              <span className="font-bold text-white">20</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span className="font-bold text-white">POLL: 1.5s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
