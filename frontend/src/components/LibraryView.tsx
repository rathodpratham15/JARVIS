import { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, Trash2, X } from 'lucide-react';
import { apiFetch } from '../utils/auth';

interface Note {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  created_at: string;
}

type Tab = 'notes' | 'knowledge';

export function LibraryView() {
  const [tab, setTab] = useState<Tab>('notes');

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteLoading, setNoteLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Knowledge state
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbQuery, setKbQuery] = useState('');
  const [kbSearching, setKbSearching] = useState(false);
  const [newKb, setNewKb] = useState({ title: '', content: '', tags: '' });
  const [showKbForm, setShowKbForm] = useState(false);
  const [savingKb, setSavingKb] = useState(false);

  const loadNotes = async () => {
    setNoteLoading(true);
    try {
      const res = await apiFetch('/api/notes');
      if (res.ok) {
        const d = await res.json();
        setNotes(d.notes ?? []);
      }
    } finally {
      setNoteLoading(false);
    }
  };

  const loadKnowledge = async (q = '') => {
    setKbLoading(true);
    try {
      const url = q ? `/api/knowledge/search?q=${encodeURIComponent(q)}` : '/api/knowledge/search';
      const res = await apiFetch(url);
      if (res.ok) {
        const d = await res.json();
        setEntries(d.results ?? []);
      }
    } finally {
      setKbLoading(false);
    }
  };

  useEffect(() => { void loadNotes(); }, []);
  useEffect(() => { void loadKnowledge(); }, []);

  const addNote = async () => {
    const content = newNote.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      const res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const d = await res.json();
        setNotes((prev) => [d.note, ...prev]);
        setNewNote('');
      }
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (id: string) => {
    await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const addKnowledge = async () => {
    if (!newKb.title || !newKb.content) return;
    setSavingKb(true);
    try {
      const tags = newKb.tags ? newKb.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const res = await apiFetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newKb.title, content: newKb.content, tags }),
      });
      if (res.ok) {
        const d = await res.json();
        setEntries((prev) => [d.entry, ...prev]);
        setNewKb({ title: '', content: '', tags: '' });
        setShowKbForm(false);
      }
    } finally {
      setSavingKb(false);
    }
  };

  const searchKb = async () => {
    setKbSearching(true);
    try { await loadKnowledge(kbQuery); }
    finally { setKbSearching(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#E5E5E5] dark:border-white/10">
        {(['notes', 'knowledge'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t
                ? 'border-[#6366f1] text-[#6366f1]'
                : 'border-transparent text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5]'
            }`}
          >
            {t === 'notes' ? 'Notes' : 'Knowledge Base'}
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <section>
          {/* Add note */}
          <div className="mb-5 flex gap-2">
            <textarea
              rows={2}
              placeholder="Jot down a note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) void addNote(); }}
              className="flex-1 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#A1A1AA] resize-none focus:outline-none focus:border-[#6366f1]/60"
            />
            <button
              type="button"
              onClick={() => void addNote()}
              disabled={savingNote || !newNote.trim()}
              className="self-end px-3 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {noteLoading ? (
            <p className="text-sm text-[#717171] dark:text-[#A1A1AA]">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-[#717171] dark:text-[#A1A1AA] italic">
              No notes yet. You can also ask JARVIS to remember something.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-4 py-3 flex items-start gap-3"
                >
                  <BookOpen className="w-4 h-4 text-[#6366f1] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {note.title && (
                      <p className="text-xs font-semibold text-[#717171] dark:text-[#A1A1AA] mb-0.5">{note.title}</p>
                    )}
                    <p className="text-sm text-[#171717] dark:text-[#F5F5F5] whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[11px] text-[#A1A1AA] mt-1">
                      {new Date(note.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#717171] dark:text-[#A1A1AA] transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'knowledge' && (
        <section>
          {/* Search + Add */}
          <div className="mb-5 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="text"
                placeholder="Search knowledge base…"
                value={kbQuery}
                onChange={(e) => setKbQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void searchKb(); }}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:border-[#6366f1]/60"
              />
            </div>
            <button
              type="button"
              onClick={() => void searchKb()}
              disabled={kbSearching}
              className="px-3 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 text-sm text-[#717171] dark:text-[#A1A1AA] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowKbForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {showKbForm && (
            <div className="mb-5 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] p-4 flex flex-col gap-3">
              <input
                type="text"
                placeholder="Title"
                value={newKb.title}
                onChange={(e) => setNewKb((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]/60 text-[#171717] dark:text-[#F5F5F5]"
              />
              <textarea
                rows={3}
                placeholder="Content"
                value={newKb.content}
                onChange={(e) => setNewKb((p) => ({ ...p, content: e.target.value }))}
                className="w-full rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#6366f1]/60 text-[#171717] dark:text-[#F5F5F5]"
              />
              <input
                type="text"
                placeholder="Tags (comma-separated, optional)"
                value={newKb.tags}
                onChange={(e) => setNewKb((p) => ({ ...p, tags: e.target.value }))}
                className="w-full rounded-lg border border-[#E5E5E5] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]/60 text-[#171717] dark:text-[#F5F5F5]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowKbForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-[#E5E5E5] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void addKnowledge()}
                  disabled={savingKb || !newKb.title || !newKb.content}
                  className="px-3 py-1.5 rounded-lg text-xs bg-[#6366f1] hover:bg-[#5558e6] text-white disabled:opacity-40 cursor-pointer"
                >
                  {savingKb ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {kbLoading ? (
            <p className="text-sm text-[#717171] dark:text-[#A1A1AA]">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[#717171] dark:text-[#A1A1AA] italic">
              No entries yet. Add facts JARVIS should remember permanently.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">{entry.title}</p>
                  <p className="text-sm text-[#717171] dark:text-[#A1A1AA] mt-1">{entry.content}</p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-[#6366f1]/10 text-[#6366f1]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
