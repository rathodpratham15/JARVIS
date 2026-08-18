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
      <div className="w-full max-w-2xl p-6 bg-white border-2 border-black space-y-5 shadow-[6px_6px_0px_#000000] max-h-[90vh] overflow-y-auto font-mono text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00e5ff] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-heading font-black uppercase text-black">
                AUTONOMOUS BACKGROUND AGENT WORKFLOW
              </h3>
              <p className="text-[11px] font-mono font-bold text-black/70">
                Deconstruct multi-step directives into execution logs
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 border border-black hover:bg-slate-100">
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
              className="w-full p-3 bg-[#f3f3ee] border-2 border-black text-black text-xs font-mono font-bold focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isRunning || !taskDescription.trim()}
              className="px-5 py-2.5 bg-[#00e5ff] hover:bg-[#00c5db] disabled:opacity-50 text-black font-mono font-black text-xs flex items-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000000] transition"
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
          <div className="p-5 bg-[#f3f3ee] border-2 border-black space-y-4 text-xs font-mono text-black shadow-[3px_3px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 font-mono">
              <span className="text-black font-heading font-black">EXECUTION STEPS COMPLETE</span>
              <span className="px-2 py-0.5 bg-black text-[#00e5ff] font-black text-[10px]">
                STATUS: DONE
              </span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {agentResult.steps &&
                agentResult.steps.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_#000000] flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-black block">{s.title}</span>
                      <span className="text-black/70 font-mono text-[10px]">{s.log}</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="space-y-1">
              <span className="font-mono font-black text-black text-[10px] uppercase">
                FINAL SYNTHESIS OUTPUT:
              </span>
              <p className="text-black leading-relaxed bg-white p-3 border-2 border-black shadow-[2px_2px_0px_#000000]">
                {agentResult.output}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
