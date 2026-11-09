import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  CalendarPlus,
  Copy,
  Check,
  Trash2,
  Users,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { apiFetch } from "../utils/api";

interface Event {
  id: string;
  name: string;
  organizer_id: string;
  organizer_name?: string;
  access_code: string;
  face_namespace: string;
  created_at: string;
  member_count?: number;
  panelist_count?: number;
}

interface Props {
  userRole?: string;
  userId?: string;
}

export const EventManagerView: React.FC<Props> = ({ userRole, userId }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Enroll panel state
  const [enrollEventId, setEnrollEventId] = useState<string | null>(null);
  const [enrollName, setEnrollName] = useState("");
  const [enrollOrg, setEnrollOrg] = useState("");
  const [enrollFiles, setEnrollFiles] = useState<FileList | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiFetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Failed"); return; }
      setNewName("");
      fetchEvents();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/events/${id}`, { method: "DELETE" });
      fetchEvents();
    } finally {
      setDeletingId(null);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleEnroll = async () => {
    if (!enrollEventId || !enrollName.trim() || !enrollFiles?.length) return;
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      const form = new FormData();
      form.append("name", enrollName.trim());
      form.append("event_id", enrollEventId);
      if (enrollOrg.trim()) form.append("organization", enrollOrg.trim());
      for (let i = 0; i < enrollFiles.length; i++) form.append("image", enrollFiles[i]);
      const res = await apiFetch("/api/face/add-person", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setEnrollMsg({ ok: true, text: `${data.name} enrolled successfully.` });
        setEnrollName("");
        setEnrollOrg("");
        setEnrollFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchEvents();
      } else {
        setEnrollMsg({ ok: false, text: data.error ?? "Enrollment failed." });
      }
    } finally {
      setEnrolling(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const isAdmin = userRole === "admin";
  const isOrganizer = userRole === "organizer" || isAdmin;

  return (
    <div className="flex-1 overflow-y-auto bg-black text-white font-mono">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-zinc-800 px-6 py-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">J.A.R.V.I.S.</p>
        <h1 className="text-white font-black text-lg tracking-wider">EVENT MANAGER</h1>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* Create new event */}
        {isOrganizer && (
          <div className="border border-zinc-800 p-4">
            <p className="text-xs font-black text-zinc-400 mb-3 tracking-wider">CREATE NEW EVENT</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="Event name, e.g. NEC Hackathon 2026"
                className="flex-1 bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs disabled:opacity-40"
              >
                <CalendarPlus className="w-4 h-4" />
                {creating ? "CREATING…" : "CREATE"}
              </button>
            </div>
            {createError && <p className="text-red-400 text-xs mt-2">{createError}</p>}
          </div>
        )}

        {/* Events list */}
        {loading ? (
          <div className="text-zinc-600 text-sm text-center py-16">LOADING EVENTS…</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <CalendarPlus className="w-10 h-10 text-zinc-700" />
            <p className="text-zinc-400 font-black text-sm">NO EVENTS YET</p>
            {isOrganizer && (
              <p className="text-zinc-600 text-xs">Create an event above to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id} className="border border-zinc-800">
                {/* Event row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    {expandedId === ev.id
                      ? <ChevronDown className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-white font-black text-sm">{ev.name}</p>
                      <p className="text-zinc-500 text-[10px]">{formatDate(ev.created_at)}{ev.organizer_name ? ` · by ${ev.organizer_name}` : ""}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {ev.member_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> {ev.panelist_count ?? 0}
                    </span>
                  </div>

                  {/* Access code pill */}
                  <button
                    onClick={() => copyCode(ev.access_code)}
                    className="flex items-center gap-1.5 px-2 py-1 border border-cyan-800 text-cyan-400 text-[10px] font-black hover:bg-cyan-900/30 transition"
                    title="Copy access code"
                  >
                    {copiedCode === ev.access_code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {ev.access_code}
                  </button>

                  {(isAdmin || ev.organizer_id === userId) && (
                    <button
                      onClick={() => handleDelete(ev.id)}
                      disabled={deletingId === ev.id}
                      className="p-1.5 text-zinc-700 hover:text-red-400 transition disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Expanded panel */}
                {expandedId === ev.id && (
                  <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
                    {/* Info */}
                    <div className="text-xs text-zinc-500 space-y-1">
                      <p><span className="text-zinc-400">ACCESS CODE</span> — Share this with attendees on the day of the event</p>
                      <p className="text-cyan-300 font-black text-lg tracking-widest">{ev.access_code}</p>
                      <p className="text-[10px]">Face namespace: <span className="text-zinc-400">{ev.face_namespace}</span></p>
                    </div>

                    {/* Enroll panelist section */}
                    {isOrganizer && (
                      <div className="border border-zinc-700 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-black text-zinc-400 tracking-wider">ENROLL PANELIST / SPEAKER</p>
                          {enrollEventId === ev.id && (
                            <button onClick={() => { setEnrollEventId(null); setEnrollMsg(null); }}>
                              <X className="w-4 h-4 text-zinc-600 hover:text-zinc-300" />
                            </button>
                          )}
                        </div>
                        {enrollEventId !== ev.id ? (
                          <button
                            onClick={() => { setEnrollEventId(ev.id); setEnrollMsg(null); }}
                            className="flex items-center gap-2 text-xs font-black text-cyan-400 hover:text-cyan-300"
                          >
                            <Upload className="w-3.5 h-3.5" /> ADD PANELIST
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={enrollName}
                              onChange={e => setEnrollName(e.target.value)}
                              placeholder="Full name *"
                              className="w-full bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                            />
                            <input
                              type="text"
                              value={enrollOrg}
                              onChange={e => setEnrollOrg(e.target.value)}
                              placeholder="Title / organization (optional)"
                              className="w-full bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                            />
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={e => setEnrollFiles(e.target.files)}
                              className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:border-0 file:text-xs file:font-black file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                            />
                            <button
                              onClick={handleEnroll}
                              disabled={enrolling || !enrollName.trim() || !enrollFiles?.length}
                              className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs disabled:opacity-40"
                            >
                              {enrolling ? "ENROLLING…" : "ENROLL"}
                            </button>
                            {enrollMsg && (
                              <p className={`text-xs ${enrollMsg.ok ? "text-green-400" : "text-red-400"}`}>
                                {enrollMsg.text}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
