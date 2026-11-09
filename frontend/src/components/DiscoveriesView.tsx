import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  User,
  Calendar,
  BookOpen,
} from "lucide-react";
import { apiFetch } from "../utils/api";

interface Discovery {
  id: string;
  name: string;
  profession?: string;
  photo_url?: string;
  event_name: string;
  scanned_at: string;
  notes?: string;
  source_namespace?: string;
}

interface EventMeta {
  event_name: string;
  count: number;
  last_scanned: string;
}

export const DiscoveriesView: React.FC = () => {
  const [grouped, setGrouped] = useState<Record<string, Discovery[]>>({});
  const [eventsMeta, setEventsMeta] = useState<EventMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ id: string; value: string } | null>(null);

  const fetchDiscoveries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/discoveries");
      if (res.ok) {
        const data = await res.json();
        setGrouped(data.grouped ?? {});
        setEventsMeta(data.events ?? []);
        setTotal(data.total ?? 0);
        // Auto-expand first event
        if (data.events?.length > 0 && expandedEvents.size === 0) {
          setExpandedEvents(new Set([data.events[0].event_name]));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDiscoveries(); }, [fetchDiscoveries]);

  const toggleEvent = (eventName: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventName)) next.delete(eventName);
      else next.add(eventName);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/discoveries/${id}`, { method: "DELETE" });
      if (res.ok) fetchDiscoveries();
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!editingNotes) return;
    await apiFetch(`/api/discoveries/${editingNotes.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editingNotes.value }),
    });
    setEditingNotes(null);
    fetchDiscoveries();
  };

  const searchLower = search.toLowerCase();

  const filteredGrouped: Record<string, Discovery[]> = search
    ? Object.fromEntries(
        (Object.entries(grouped) as [string, Discovery[]][])
          .map(([ev, people]): [string, Discovery[]] => [
            ev,
            people.filter(
              p =>
                p.name.toLowerCase().includes(searchLower) ||
                (p.profession ?? "").toLowerCase().includes(searchLower) ||
                ev.toLowerCase().includes(searchLower)
            ),
          ])
          .filter(([, people]) => people.length > 0)
      )
    : grouped;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex-1 overflow-y-auto bg-black text-white font-mono">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">J.A.R.V.I.S.</p>
            <h1 className="text-white font-black text-lg tracking-wider">MY CONTACTS</h1>
          </div>
          <span className="text-zinc-500 text-xs font-black">
            {total} {total === 1 ? "PERSON" : "PEOPLE"} · {eventsMeta.length} {eventsMeta.length === 1 ? "EVENT" : "EVENTS"}
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search contacts or events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
            LOADING CONTACTS…
          </div>
        ) : Object.keys(filteredGrouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-20 h-20 rounded-full border border-zinc-800 flex items-center justify-center">
              <Users className="w-8 h-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-zinc-400 font-black text-sm">NO CONTACTS YET</p>
              <p className="text-zinc-600 text-xs mt-1">
                {search
                  ? "No results match your search."
                  : "Scan someone and hit \"Save to My Contacts\" to build your network here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(filteredGrouped).map(([eventName, people]) => {
              const meta = eventsMeta.find(e => e.event_name === eventName);
              const expanded = expandedEvents.has(eventName);
              return (
                <div key={eventName} className="border border-zinc-800 hover:border-zinc-700 transition">
                  {/* Event header */}
                  <button
                    onClick={() => toggleEvent(eventName)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-900/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      {expanded
                        ? <ChevronDown className="w-4 h-4 text-cyan-400" />
                        : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                      <div>
                        <p className="text-white font-black text-sm tracking-wide">{eventName}</p>
                        {meta && (
                          <p className="text-zinc-500 text-[10px] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(meta.last_scanned)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-cyan-400 font-black text-xs px-2 py-0.5 border border-cyan-800">
                      {people.length} {people.length === 1 ? "PERSON" : "PEOPLE"}
                    </span>
                  </button>

                  {/* People list */}
                  {expanded && (
                    <div className="border-t border-zinc-800 divide-y divide-zinc-900">
                      {people.map(person => (
                        <div key={person.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-900/30 transition">
                          {/* Avatar */}
                          {person.photo_url ? (
                            <img
                              src={person.photo_url}
                              alt={person.name}
                              className="w-10 h-10 rounded-full object-cover border border-zinc-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center bg-zinc-900 flex-shrink-0">
                              <User className="w-5 h-5 text-zinc-600" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-sm">{person.name}</p>
                            {person.profession && (
                              <p className="text-zinc-400 text-xs">{person.profession}</p>
                            )}
                            <p className="text-zinc-600 text-[10px] mt-0.5">{formatDate(person.scanned_at)}</p>

                            {/* Notes */}
                            {editingNotes?.id === person.id ? (
                              <div className="mt-2 space-y-1">
                                <textarea
                                  value={editingNotes.value}
                                  onChange={e => setEditingNotes({ id: person.id, value: e.target.value })}
                                  rows={2}
                                  className="w-full bg-zinc-800 border border-zinc-600 text-xs text-white px-2 py-1 focus:outline-none focus:border-cyan-500 resize-none"
                                  placeholder="Add notes…"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveNotes}
                                    className="text-[10px] font-black text-cyan-400 hover:text-cyan-300"
                                  >
                                    SAVE
                                  </button>
                                  <button
                                    onClick={() => setEditingNotes(null)}
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                  >
                                    CANCEL
                                  </button>
                                </div>
                              </div>
                            ) : person.notes ? (
                              <div className="mt-1 flex items-start gap-1">
                                <BookOpen className="w-3 h-3 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <p
                                  className="text-zinc-500 text-[11px] cursor-pointer hover:text-zinc-300"
                                  onClick={() => setEditingNotes({ id: person.id, value: person.notes ?? "" })}
                                >
                                  {person.notes}
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingNotes({ id: person.id, value: "" })}
                                className="mt-1 text-[10px] text-zinc-700 hover:text-zinc-400 transition"
                              >
                                + add note
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => handleDelete(person.id)}
                            disabled={deletingId === person.id}
                            className="p-1.5 text-zinc-700 hover:text-red-400 transition disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
