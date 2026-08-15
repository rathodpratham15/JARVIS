import React, { useState } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Trash2,
  Tag,
  AlertCircle,
  Sparkles,
  Bookmark,
} from "lucide-react";
import { NoteEntry } from "../types";
import { playUiSound } from "../utils/audio";

interface NotesViewProps {
  notes: NoteEntry[];
  onAddNote: (note: Omit<NoteEntry, "id" | "createdAt">) => void;
  onToggleCompleteNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onAddNote,
  onToggleCompleteNote,
  onDeleteNote,
}) => {
  const [filter, setFilter] = useState<"All" | "Critical" | "High" | "Completed">("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state for creating a note
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<NoteEntry["priority"]>("High");
  const [tagsInput, setTagsInput] = useState("");

  const filteredNotes = notes.filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      if (!matchText) return false;
    }
    if (filter === "Critical") return n.priority === "Critical" && !n.completed;
    if (filter === "High") return n.priority === "High" && !n.completed;
    if (filter === "Completed") return n.completed;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    playUiSound("beep");
    const tagsArr = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onAddNote({
      title: title.trim(),
      content: content.trim(),
      priority,
      isReminder: false,
      completed: false,
      tags: tagsArr.length > 0 ? tagsArr : ["Directive"],
    });

    setTitle("");
    setContent("");
    setTagsInput("");
    playUiSound("success");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 06</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Tactical Notes
          </h1>
          <p className="label-secondary mt-1">
            INDEXED DIRECTIVES, MISSION DOSSIERS & STRATEGIC MEMORANDUMS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#F2F2EF] border border-[#1a1a1a] font-mono text-xs font-bold text-[#1a1a1a]">
            {notes.filter((n) => !n.completed).length} ACTIVE DIRECTIVES
          </div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Notes List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                  Directives Directory
                </h2>
                <p className="text-xs text-[#555] font-sans mt-0.5">
                  Searchable ledger of stored directives and memos
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center border border-[#1a1a1a] bg-[#EBEBEA] p-0.5">
                {(["All", "Critical", "High", "Completed"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold transition ${
                      filter === tab
                        ? "bg-[#00E5FF] text-black"
                        : "text-[#555] hover:text-[#1a1a1a]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH DIRECTIVES OR TAGS..."
                className="editorial-input pl-9"
              />
              <Search className="w-4 h-4 text-[#555] absolute left-3 top-3" />
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {/* Notes List */}
            <div className="space-y-4">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#1a1a1a]/30 bg-[#EBEBEA] font-mono text-xs text-[#555]">
                  No directives found. Compose a new note in Panel 02.
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-5 border border-[#1a1a1a] transition space-y-3 ${
                      note.completed ? "bg-[#EBEBEA] opacity-60" : "bg-[#EBEBEA]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => onToggleCompleteNote(note.id)}
                        className="flex items-start gap-2.5 text-left group"
                      >
                        {note.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-[#1a1a1a] group-hover:text-[#00E5FF] mt-0.5 shrink-0" />
                        )}
                        <div>
                          <h3
                            className={`font-serif text-lg font-bold ${
                              note.completed ? "line-through text-[#666]" : "text-[#1a1a1a]"
                            }`}
                          >
                            {note.title}
                          </h3>
                        </div>
                      </button>

                      <span
                        className={`font-mono text-[9px] px-2 py-0.5 font-bold uppercase border border-[#1a1a1a] ${
                          note.priority === "Critical"
                            ? "bg-[#1a1a1a] text-[#00E5FF]"
                            : note.priority === "High"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-white text-[#1a1a1a]"
                        }`}
                      >
                        {note.priority}
                      </span>
                    </div>

                    <p className="font-mono text-xs text-[#555] leading-relaxed pl-6">
                      {note.content}
                    </p>

                    <div className="pt-3 border-t border-[#1a1a1a]/20 flex items-center justify-between pl-6 text-[10px] font-mono text-[#555]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 bg-white border border-[#1a1a1a] text-[#1a1a1a]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1 text-[#555] hover:text-rose-600 transition"
                        title="Delete Directive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Compose Note Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                New Directive Memo
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Record operational parameters or mission instructions
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-secondary">DIRECTIVE TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.G. MARK 85 NANOTECH ALLOY FORMULATION..."
                  className="editorial-input"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-secondary">DETAILS & SPECIFICATIONS</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Record tactical analysis, calculations, or engineering notes..."
                  rows={4}
                  className="editorial-input resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-secondary">PRIORITY</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="editorial-input"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Routine">Routine</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="label-secondary">TAGS (COMMA-SEPARATED)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Armor, Defense, Research"
                    className="editorial-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!title.trim() || !content.trim()}
                className="editorial-btn-primary w-full py-3"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>SAVE DIRECTIVE NOTE</span>
              </button>
            </form>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Storage Metadata */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>INDEX LOCATION</span>
                <span className="font-bold text-[#1a1a1a]">LOCAL STORAGE / STARK VAULT</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>ENCRYPTION</span>
                <span className="font-bold text-[#1a1a1a]">AES-256 BIT VECTOR</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>SEMANTIC EMBEDDING</span>
                <span className="font-bold text-[#1a1a1a]">AUTOMATIC VECTOR LINK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
