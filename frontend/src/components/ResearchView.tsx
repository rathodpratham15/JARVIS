import React, { useState } from "react";
import { Search, User, Building2, BookOpen, ExternalLink, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ResearchDossier } from "../types";
import { apiFetch } from "../utils/api";

type ResearchKind = "person" | "company" | "topic";

const KIND_OPTIONS: { value: ResearchKind; label: string; icon: React.ReactNode }[] = [
  { value: "person",  label: "Person",  icon: <User className="w-3.5 h-3.5" /> },
  { value: "company", label: "Company", icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "topic",   label: "Topic",   icon: <BookOpen className="w-3.5 h-3.5" /> },
];

export const ResearchView: React.FC = () => {
  const [subject, setSubject]   = useState("");
  const [company, setCompany]   = useState("");
  const [kind, setKind]         = useState<ResearchKind>("person");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [dossier, setDossier]   = useState<ResearchDossier | null>(null);
  const [history, setHistory]   = useState<ResearchDossier[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || loading) return;
    setLoading(true);
    setError(null);
    setDossier(null);
    try {
      const res = await apiFetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          kind,
          ...(kind === "person" && company.trim() ? { company: company.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const data: ResearchDossier = await res.json();
      setDossier(data);
      setHistory(prev => [data, ...prev.slice(0, 9)]);
    } catch (err: any) {
      setError(err.message ?? "Research failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="editorial-panel space-y-4">
        <div>
          <div className="overline-cyan">PANEL 01</div>
          <h1 className="font-serif text-3xl font-bold text-white">Research</h1>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Parallel web synthesis — people, companies, topics
          </p>
        </div>
        <div className="border-b border-zinc-800" />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kind selector */}
          <div className="flex gap-2">
            {KIND_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKind(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border font-mono text-xs font-bold transition ${
                  kind === opt.value
                    ? "bg-[#1a1a1a] text-[#00E5FF] border-zinc-800"
                    : "bg-[#111318] text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {opt.icon}
                {opt.label.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="label-secondary">
                {kind === "person" ? "PERSON NAME" : kind === "company" ? "COMPANY NAME" : "TOPIC"}
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="editorial-input"
                placeholder={
                  kind === "person" ? "e.g. Jensen Huang" :
                  kind === "company" ? "e.g. Anthropic" :
                  "e.g. Large Language Models"
                }
                required
              />
            </div>
            {kind === "person" && (
              <div className="w-48 space-y-1">
                <label className="label-secondary">COMPANY <span className="text-zinc-500">(optional)</span></label>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="editorial-input"
                  placeholder="e.g. NVIDIA"
                />
              </div>
            )}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !subject.trim()}
                className="editorial-btn-primary flex items-center gap-2 py-2.5 px-5 disabled:opacity-50"
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Search className="w-3.5 h-3.5" />
                }
                <span>{loading ? "RESEARCHING…" : "COMPILE DOSSIER"}</span>
              </button>
            </div>
          </div>
        </form>

        {error && (
          <p className="font-mono text-xs text-red-400 border border-red-900 bg-red-900/20 px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="editorial-panel space-y-4 animate-pulse">
          <div className="h-4 bg-zinc-700 w-1/3" />
          <div className="h-3 bg-zinc-700 w-full" />
          <div className="h-3 bg-zinc-700 w-4/5" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-zinc-700" />)}
          </div>
        </div>
      )}

      {/* Results */}
      {dossier && !loading && (
        <div className="editorial-panel space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="overline-cyan">
                {dossier.kind.toUpperCase()} DOSSIER
              </div>
              <h2 className="font-serif text-2xl font-bold text-white">{dossier.subject}</h2>
            </div>
            <span className="px-2 py-1 font-mono text-[10px] font-bold border border-zinc-800 text-zinc-400">
              {dossier.sources.length} SOURCE{dossier.sources.length !== 1 ? "S" : ""}
            </span>
          </div>

          <div className="border-b border-zinc-800" />

          {/* Summary */}
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Executive Summary
            </div>
            <p className="font-sans text-sm text-white leading-relaxed bg-[#111318] border border-zinc-800 p-4">
              {dossier.summary}
            </p>
          </div>

          {/* Sections grid */}
          {Object.keys(dossier.sections).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(dossier.sections).map(([title, content]) => (
                <div key={title} className="border border-zinc-800 p-4 space-y-2">
                  <div className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-1.5">
                    {title}
                  </div>
                  <p className="font-sans text-xs text-zinc-300 leading-relaxed">{content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sources */}
          {dossier.sources.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setExpanded(expanded === "sources" ? null : "sources")}
                className="flex items-center gap-2 font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-white transition"
              >
                {expanded === "sources" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {dossier.sources.length} Sources
              </button>
              {expanded === "sources" && (
                <div className="space-y-2">
                  {dossier.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 border border-zinc-800 hover:border-zinc-800 transition group"
                    >
                      <span className="font-mono text-[10px] text-zinc-500 mt-0.5 shrink-0">[{i + 1}]</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-bold text-white group-hover:text-[#00C4D4] transition truncate">
                          {src.title}
                        </div>
                        <div className="font-sans text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{src.snippet}</div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="editorial-panel space-y-4">
          <div>
            <div className="overline-cyan">PANEL 02</div>
            <h2 className="font-serif text-xl font-bold text-white">Recent Dossiers</h2>
          </div>
          <div className="border-b border-zinc-800" />
          <div className="space-y-2">
            {history.slice(1).map((d, i) => (
              <button
                key={i}
                onClick={() => setDossier(d)}
                className="w-full flex items-center justify-between p-3 border border-zinc-800 hover:border-zinc-800 transition text-left"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-white">{d.subject}</span>
                  <span className="ml-2 font-mono text-[10px] text-zinc-500">{d.kind}</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500">{d.sources.length} sources</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
