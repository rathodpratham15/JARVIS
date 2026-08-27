import React, { useState } from "react";
import { Search, X, Building, User, Sparkles, Shield, AlertCircle, ArrowRight } from "lucide-react";
import { ResearchDossier } from "../types";
import { playUiSound } from "../utils/audio";

interface ResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunResearch: (targetName: string, targetType: "person" | "company") => Promise<ResearchDossier>;
}

export const ResearchModal: React.FC<ResearchModalProps> = ({
  isOpen,
  onClose,
  onRunResearch,
}) => {
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] = useState<"person" | "company">("company");
  const [isResearching, setIsResearching] = useState(false);
  const [dossier, setDossier] = useState<ResearchDossier | null>(null);

  if (!isOpen) return null;

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim() || isResearching) return;

    playUiSound("scan");
    setIsResearching(true);

    try {
      const res = await onRunResearch(targetName, targetType);
      setDossier(res);
      playUiSound("success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl p-6 bg-[#111318] border border-zinc-800 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto font-mono text-black">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00E5FF] text-black border border-transparent">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-heading font-black uppercase text-black">
                TARGET INTELLIGENCE & RESEARCH PIPELINE
              </h3>
              <p className="text-[11px] font-mono font-bold text-zinc-400">
                Grounded web synthesis & corporate dossier builder
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 border border-zinc-800 hover:bg-zinc-800 text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleResearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2 p-2 bg-[#0d0f12] border border-zinc-800">
              <input
                type="text"
                required
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Enter Target Name... (e.g. 'Hammer Industries', 'Nick Fury', 'Roxxon Energy')"
                className="w-full bg-transparent border-none text-white placeholder-zinc-500 text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#0d0f12] p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setTargetType("company")}
                className={`px-3 py-1.5 text-xs font-mono font-bold border transition ${
                  targetType === "company"
                    ? "bg-[#00E5FF] text-black border-transparent"
                    : "text-zinc-400 border-transparent hover:text-white"
                }`}
              >
                COMPANY
              </button>
              <button
                type="button"
                onClick={() => setTargetType("person")}
                className={`px-3 py-1.5 text-xs font-mono font-bold border transition ${
                  targetType === "person"
                    ? "bg-[#00E5FF] text-black border-transparent"
                    : "text-zinc-400 border-transparent hover:text-white"
                }`}
              >
                PERSON
              </button>
            </div>

            <button
              type="submit"
              disabled={isResearching || !targetName.trim()}
              className="px-4 py-2 bg-[#00E5FF] hover:bg-[#00c5db] disabled:opacity-50 text-black border border-transparent font-mono font-black text-xs flex items-center justify-center gap-2 transition"
            >
              {isResearching ? (
                <span>SYNTHESIZING...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>COMPILE DOSSIER</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Dossier Output */}
        {dossier && (
          <div className="p-5 bg-[#0d0f12] border border-zinc-800 space-y-4 text-xs font-mono text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-heading font-black text-white">{dossier.subject}</span>
                <span className="px-2 py-0.5 bg-black text-[#00e5ff] text-[10px] font-black uppercase">
                  {dossier.kind}
                </span>
              </div>
              <span className="text-[10px] font-bold text-zinc-400">
                {dossier.sources.length} SOURCE{dossier.sources.length !== 1 ? "S" : ""}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono font-black text-zinc-300 text-[10px] uppercase">
                EXECUTIVE SUMMARY:
              </span>
              <p className="text-zinc-100 leading-relaxed bg-[#111318] p-3 border border-zinc-800">
                {dossier.summary}
              </p>
            </div>

            {Object.keys(dossier.sections).length > 0 && (
              <div className="space-y-1">
                <span className="font-mono font-black text-zinc-300 text-[10px] uppercase">
                  SECTIONS:
                </span>
                <ul className="space-y-1 pl-4 list-disc text-zinc-300 font-bold">
                  {Object.entries(dossier.sections).map(([title, content]) => (
                    <li key={title}><span className="uppercase">{title}:</span> {content}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
