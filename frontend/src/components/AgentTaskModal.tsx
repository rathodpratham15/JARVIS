import React, { useState } from "react";
import { Play, X, Sparkles, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { AgentTask } from "../types";
import { playUiSound } from "../utils/audio";

interface AgentTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteAgentTask: (taskDescription: string) => Promise<AgentTask>;
}

export const AgentTaskModal: React.FC<AgentTaskModalProps> = ({
  isOpen,
  onClose,
  onExecuteAgentTask,
}) => {
  const [taskDescription, setTaskDescription] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentTask | null>(null);

  if (!isOpen) return null;

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDescription.trim() || isRunning) return;

    playUiSound("scan");
    setIsRunning(true);

    try {
      const res = await onExecuteAgentTask(taskDescription);
      setAgentResult(res);
      playUiSound("success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl p-6 bg-[#111318] border border-zinc-800 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto font-mono text-black">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00E5FF] text-black border border-transparent">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-heading font-black uppercase text-white">
                AUTONOMOUS BACKGROUND AGENT WORKFLOW
              </h3>
              <p className="text-[11px] font-mono font-bold text-zinc-400">
                Deconstruct multi-step directives into execution logs
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 border border-zinc-800 hover:bg-zinc-800 text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleRun} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-mono font-bold text-black">
              ENTER AUTONOMOUS DIRECTIVE FOR J.A.R.V.I.S:
            </label>
            <textarea
              required
              rows={3}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="e.g. Search for today's AI news, summarize the top 5 stories, and save a note."
              className="w-full p-3 bg-[#0d0f12] border border-zinc-800 text-white text-xs font-mono font-bold focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isRunning || !taskDescription.trim()}
              className="px-5 py-2.5 bg-[#00E5FF] hover:bg-[#00c5db] disabled:opacity-50 text-black font-mono font-black text-xs flex items-center gap-2 border border-transparent transition"
            >
              {isRunning ? (
                <span>AGENT RUNNING...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>EXECUTE AUTONOMOUS TASK</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Agent Steps Execution Log */}
        {agentResult && (
          <div className="p-5 bg-[#0d0f12] border border-zinc-800 space-y-4 text-xs font-mono text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 font-mono">
              <span className="text-white font-heading font-black">EXECUTION STEPS COMPLETE</span>
              <span className="px-2 py-0.5 bg-black text-[#00e5ff] font-black text-[10px]">
                STATUS: DONE
              </span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {agentResult.steps &&
                agentResult.steps.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#111318] border border-zinc-800 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">{s.title}</span>
                      <span className="text-zinc-400 font-mono text-[10px]">{s.log}</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="space-y-1">
              <span className="font-mono font-black text-zinc-300 text-[10px] uppercase">
                FINAL SYNTHESIS OUTPUT:
              </span>
              <p className="text-zinc-100 leading-relaxed bg-[#111318] p-3 border border-zinc-800">
                {agentResult.output}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
