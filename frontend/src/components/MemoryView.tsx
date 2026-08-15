import React, { useState } from "react";
import {
  Database,
  Search,
  Plus,
  Tag,
  Trash2,
  Bookmark,
  Sparkles,
  Filter,
  Star,
  X,
} from "lucide-react";
import { MemoryEntry } from "../types";
import { playUiSound } from "../utils/audio";

interface MemoryViewProps {
  memories: MemoryEntry[];
  onAddMemory: (entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">) => void;
  onDeleteMemory: (id: string) => void;
  onSearchSemanticMemory: (query: string) => Promise<string>;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  memories,
  onAddMemory,
  onDeleteMemory,
  onSearchSemanticMemory,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryEntry["category"]>("Project");
  const [newImportance, setNewImportance] = useState<MemoryEntry["importance"]>("Medium");
  const [newTagInput, setNewTagInput] = useState("");

  const categories = ["All", "Project", "Personal", "Security", "Stark Industries", "System"];

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchSummary(null);
      return;
    }
    setIsSearching(true);
    playUiSound("scan");

    try {
      const summary = await onSearchSemanticMemory(searchQuery);
      setSearchSummary(summary);
      playUiSound("success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredMemories = memories.filter((m) => {
    const matchesCat = selectedCategory === "All" || m.category === selectedCategory;
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tagsArr = newTagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onAddMemory({
      title: newTitle,
      content: newContent,
      category: newCategory,
      importance: newImportance,
      tags: tagsArr.length > 0 ? tagsArr : ["Directive"],
    });

    playUiSound("success");
    setNewTitle("");
    setNewContent("");
    setNewTagInput("");
    setShowAddModal(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-mono text-black">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border-2 border-black shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00e5ff] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-black tracking-wide">
              SEMANTIC VECTOR MEMORY INDEX
            </h2>
            <p className="text-xs font-mono font-bold text-black/70">
              {memories.length} Active Embeddings • Long-term conversational & directive recall
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#00e5ff] text-black font-black font-mono text-xs flex items-center justify-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000000] transition"
        >
          <Plus className="w-4 h-4" />
          <span>STORE NEW MEMORY NODE</span>
        </button>
      </div>

      {/* Semantic Search Bar */}
      <div className="p-4 bg-white border-2 border-black space-y-3 shadow-[3px_3px_0px_#000000]">
        <div className="flex items-center gap-2 bg-[#f3f3ee] p-2 border-2 border-black">
          <Search className="w-5 h-5 text-black pl-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search semantic memory index... (e.g. 'vibranium', 'Pepper birthday', 'arc reactor')"
            className="flex-1 bg-transparent border-none text-black placeholder-black/40 text-xs sm:text-sm font-mono font-bold focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-3 py-1.5 bg-[#00e5ff] text-black font-mono font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000000] transition hover:translate-x-[-1px] hover:translate-y-[-1px]"
          >
            {isSearching ? "SEARCHING..." : "SEMANTIC QUERY"}
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-black" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-mono font-bold border-2 border-black transition whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[#00e5ff] text-black shadow-[2px_2px_0px_#000000]"
                  : "bg-white text-black hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* AI Semantic Summary Result */}
      {searchSummary && (
        <div className="p-4 bg-[#f3f3ee] border-2 border-black text-xs text-black font-mono space-y-1 shadow-[3px_3px_0px_#000000]">
          <div className="flex items-center gap-2 font-black text-black">
            <Sparkles className="w-4 h-4 text-[#00c5db]" />
            <span>J.A.R.V.I.S. SEMANTIC SUMMARY</span>
          </div>
          <p className="leading-relaxed bg-white p-3 border-2 border-black">{searchSummary}</p>
        </div>
      )}

      {/* Memory Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.map((mem) => (
          <div
            key={mem.id}
            className="p-5 bg-white border-2 border-black transition space-y-3 shadow-[3px_3px_0px_#000000] hover:shadow-[5px_5px_0px_#000000] flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-heading font-black text-sm text-black">
                  {mem.title}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-black border border-black uppercase whitespace-nowrap ${
                    mem.importance === "High"
                      ? "bg-rose-500 text-white"
                      : "bg-[#00e5ff] text-black"
                  }`}
                >
                  {mem.importance} PRIORITY
                </span>
              </div>

              <p className="text-xs text-black/80 font-mono leading-relaxed">
                {mem.content}
              </p>
            </div>

            <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between text-[11px] font-mono text-black/70">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.2 bg-[#f3f3ee] text-black border border-black font-bold text-[10px]">
                  {mem.category}
                </span>
                {mem.tags.map((t, idx) => (
                  <span key={idx} className="text-[10px] font-bold text-black/60">
                    #{t}
                  </span>
                ))}
              </div>

              <button
                onClick={() => onDeleteMemory(mem.id)}
                className="p-1 text-black/60 hover:text-rose-600 transition"
                title="Delete Memory Node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Memory Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 bg-white border-2 border-black space-y-4 shadow-[6px_6px_0px_#000000] text-black font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="text-base font-heading font-black uppercase text-black flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                <span>STORE NEW SEMANTIC MEMORY</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 border border-black hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-black">DIRECTIVE TITLE</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Mark 85 Nanotech Shield Frequency"
                  className="w-full p-2.5 bg-[#f3f3ee] border-2 border-black text-black text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-black">MEMORY CONTENT</label>
                <textarea
                  required
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter detailed facts, instructions, or parameters to store in semantic memory..."
                  className="w-full p-2.5 bg-[#f3f3ee] border-2 border-black text-black text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-black">CATEGORY</label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full p-2 bg-[#f3f3ee] border-2 border-black text-black text-xs font-mono font-bold focus:outline-none"
                  >
                    <option value="Project">Project</option>
                    <option value="Personal">Personal</option>
                    <option value="Security">Security</option>
                    <option value="Stark Industries">Stark Industries</option>
                    <option value="System">System</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-black">IMPORTANCE</label>
                  <select
                    value={newImportance}
                    onChange={(e: any) => setNewImportance(e.target.value)}
                    className="w-full p-2 bg-[#f3f3ee] border-2 border-black text-black text-xs font-mono font-bold focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-black">TAGS (comma-separated)</label>
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Mark85, Defense, Energy"
                  className="w-full p-2.5 bg-[#f3f3ee] border-2 border-black text-black text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border-2 border-black text-black text-xs font-mono font-bold"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00e5ff] border-2 border-black text-black font-mono font-black text-xs shadow-[2px_2px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000000]"
                >
                  SAVE NODE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
