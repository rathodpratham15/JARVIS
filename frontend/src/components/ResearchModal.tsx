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
      <div className="w-full max-w-2xl p-6 bg-white border-2 border-black space-y-5 shadow-[6px_6px_0px_#000000] max-h-[90vh] overflow-y-auto font-mono text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00e5ff] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-heading font-black uppercase text-black">
                TARGET INTELLIGENCE & RESEARCH PIPELINE
              </h3>
              <p className="text-[11px] font-mono font-bold text-black/70">
                Grounded web synthesis & corporate dossier builder
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 border border-black hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleResearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2 p-2 bg-[#f3f3ee] border-2 border-black">
              <input
                type="text"
                required
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Enter Target Name... (e.g. 'Hammer Industries', 'Nick Fury', 'Roxxon Energy')"
                className="w-full bg-transparent border-none text-black placeholder-black/40 text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#f3f3ee] p-1 border-2 border-black">
              <button
                type="button"
                onClick={() => setTargetType("company")}
                className={`px-3 py-1.5 text-xs font-mono font-bold border transition ${
                  targetType === "company"
                    ? "bg-[#00e5ff] text-black border-black shadow-[1px_1px_0px_#000000]"
                    : "text-black/70 border-transparent hover:text-black"
                }`}
              >
                COMPANY
              </button>
              <button
                type="button"
                onClick={() => setTargetType("person")}
                className={`px-3 py-1.5 text-xs font-mono font-bold border transition ${
                  targetType === "person"
                    ? "bg-[#00e5ff] text-black border-black shadow-[1px_1px_0px_#000000]"
                    : "text-black/70 border-transparent hover:text-black"
                }`}
              >
                PERSON
              </button>
            </div>

            <button
              type="submit"
              disabled={isResearching || !targetName.trim()}
              className="px-4 py-2 bg-[#00e5ff] hover:bg-[#00c5db] disabled:opacity-50 text-black border-2 border-black font-mono font-black text-xs flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000000] transition"
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
          <div className="p-5 bg-[#f3f3ee] border-2 border-black space-y-4 text-xs font-mono text-black shadow-[3px_3px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-heading font-black text-black">{dossier.subject}</span>
                <span className="px-2 py-0.5 bg-black text-[#00e5ff] text-[10px] font-black uppercase">
                  {dossier.kind}
                </span>
              </div>
              <span className="text-[10px] font-bold text-black/70">
                {dossier.sources.length} SOURCE{dossier.sources.length !== 1 ? "S" : ""}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono font-black text-black text-[10px] uppercase">
                EXECUTIVE SUMMARY:
              </span>
              <p className="text-black leading-relaxed bg-white p-3 border-2 border-black shadow-[2px_2px_0px_#000000]">
                {dossier.summary}
              </p>
            </div>

            {Object.keys(dossier.sections).length > 0 && (
              <div className="space-y-1">
                <span className="font-mono font-black text-black text-[10px] uppercase">
                  SECTIONS:
                </span>
                <ul className="space-y-1 pl-4 list-disc text-black font-bold">
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
