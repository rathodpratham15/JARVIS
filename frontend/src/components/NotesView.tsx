import React, { useState } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Trash2,
  Pencil,
  Check,
  X,
  ArrowUpDown,
} from "lucide-react";
import { NoteEntry } from "../types";
import { playUiSound } from "../utils/audio";

interface NotesViewProps {
  notes: NoteEntry[];
  onAddNote: (note: Omit<NoteEntry, "id" | "createdAt">) => void;
  onEditNote: (id: string, title: string, content: string) => void;
  onToggleCompleteNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onAddNote,
  onEditNote,
  onToggleCompleteNote,
  onDeleteNote,
}) => {
  const [filter, setFilter] = useState<"All" | "Critical" | "High" | "Completed">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Form state for creating a note
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<NoteEntry["priority"]>("High");
  const [tagsInput, setTagsInput] = useState("");

  const filteredNotes = notes
    .filter((n) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
      }
      if (filter === "Critical") return n.priority === "Critical" && !n.completed;
      if (filter === "High") return n.priority === "High" && !n.completed;
      if (filter === "Completed") return n.completed;
      return true;
    })
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? diff : -diff;
    });

  const startEdit = (note: NoteEntry) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const submitEdit = (id: string) => {
    if (editTitle.trim()) {
      onEditNote(id, editTitle.trim(), editContent.trim());
      playUiSound("beep");
    }
    setEditingId(null);
  };

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 06</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Tactical Notes
          </h1>
          <p className="label-secondary mt-1">
            INDEXED DIRECTIVES, MISSION DOSSIERS & STRATEGIC MEMORANDUMS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#0d0f12] border border-zinc-800 font-mono text-xs font-bold text-white">
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
                <h2 className="font-serif text-2xl font-bold text-white">
                  Directives Directory
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Searchable ledger of stored directives and memos
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort toggle */}
                <button
                  onClick={() => setSortAsc(v => !v)}
                  title={sortAsc ? "Oldest first" : "Newest first"}
                  className="p-1.5 border border-zinc-800 bg-[#111318] hover:bg-[#00E5FF] transition"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
                {/* Filter Tabs */}
                <div className="flex items-center border border-zinc-800 bg-[#111318] p-0.5 overflow-x-auto">
                  {(["All", "Critical", "High", "Completed"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold transition ${
                        filter === tab
                          ? "bg-[#00E5FF] text-black"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
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
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            </div>

            <div className="border-b border-zinc-800" />

            {/* Notes List */}
            <div className="space-y-4">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800/30 bg-[#111318] font-mono text-xs text-zinc-400">
                  No directives found. Compose a new note in Panel 02.
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isEditing = editingId === note.id;
                  return (
                    <div
                      key={note.id}
                      className={`p-5 border border-zinc-800 transition space-y-3 ${note.completed ? "bg-[#111318] opacity-60" : "bg-[#111318]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button onClick={() => onToggleCompleteNote(note.id)} className="mt-1 shrink-0">
                            {note.completed
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              : <Circle className="w-4 h-4 text-white hover:text-[#00E5FF]" />}
                          </button>
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") submitEdit(note.id); if (e.key === "Escape") setEditingId(null); }}
                              className="flex-1 border border-zinc-800 bg-[#0d0f12] font-serif text-lg font-bold text-white px-2 py-0.5 outline-none"
                            />
                          ) : (
                            <h3 className={`font-serif text-lg font-bold ${note.completed ? "line-through text-zinc-500" : "text-white"}`}>
                              {note.title}
                            </h3>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-mono text-[9px] px-2 py-0.5 font-bold uppercase border border-zinc-800 ${note.priority === "Critical" ? "bg-[#1a1a1a] text-[#00E5FF]" : note.priority === "High" ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-300"}`}>
                            {note.priority}
                          </span>
                          {isEditing ? (
                            <>
                              <button onClick={() => submitEdit(note.id)} className="text-emerald-600 hover:text-emerald-800"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingId(null)} className="text-rose-500 hover:text-rose-700"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <button onClick={() => startEdit(note)} className="text-zinc-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => onDeleteNote(note.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={3}
                          className="w-full border border-zinc-800 bg-[#0d0f12] font-mono text-xs text-zinc-400 px-2 py-1.5 outline-none resize-none ml-6"
                        />
                      ) : (
                        <p className="font-mono text-xs text-zinc-400 leading-relaxed pl-6">{note.content}</p>
                      )}

                      <div className="pt-3 border-t border-zinc-800/20 flex items-center justify-between pl-6 text-[10px] font-mono text-zinc-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {note.tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.2 bg-zinc-800 border border-zinc-700 text-zinc-300">#{tag}</span>
                          ))}
                        </div>
                        <span className="text-zinc-600">{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Compose Note Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                New Directive Memo
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Record operational parameters or mission instructions
              </p>
            </div>

            <div className="border-b border-zinc-800" />

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

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Storage Metadata */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>INDEX LOCATION</span>
                <span className="font-bold text-white">LOCAL STORAGE / STARK VAULT</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>ENCRYPTION</span>
                <span className="font-bold text-white">AES-256 BIT VECTOR</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>SEMANTIC EMBEDDING</span>
                <span className="font-bold text-white">AUTOMATIC VECTOR LINK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
