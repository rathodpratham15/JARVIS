import { useEffect, useMemo, useState } from 'react';
import { ScanFace, Search, Trash2, X } from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';
import type { Contact } from '../types/jarvis';

export function MyContactsPage() {
  const {
    contacts,
    selectedContactId,
    setSelectedContactId,
    setVisionOpen,
    updateContact,
    deleteContact,
  } = useJarvisStore();

  const visionContacts = useMemo(
    () => contacts.filter((c) => c.source === 'vision'),
    [contacts]
  );

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visionContacts;
    return visionContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.role || '').toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
    );
  }, [visionContacts, query]);

  const openDetail = (contact: Contact) => {
    setSelected(contact);
    setNotesDraft(contact.notes || '');
    setPhoneDraft(contact.phone || '');
    setEmailDraft(contact.email || '');
  };

  useEffect(() => {
    if (selectedContactId) {
      const found = visionContacts.find((c) => c.id === selectedContactId);
      if (found) {
        openDetail(found);
        setSelectedContactId(null);
      }
    }
  }, [selectedContactId, visionContacts, setSelectedContactId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await updateContact(selected.id, {
        notes: notesDraft,
        phone: phoneDraft,
        email: emailDraft,
      });
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#717171] dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people identified via Vision..."
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] pl-10 pr-4 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#717171] dark:placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>
          <button
            type="button"
            onClick={() => setVisionOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <ScanFace className="w-4 h-4" />
            <span>Open Vision</span>
          </button>
        </div>

        {visionContacts.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-center">
            <img
              src="/src/assets/images/empty_vision_illustration_1795023370232.jpg"
              alt="Vision face recognition illustration"
              referrerPolicy="no-referrer"
              className="w-40 h-40 rounded-2xl object-cover mb-5 border border-[#E5E5E5] dark:border-white/10"
            />
            <p className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
              No one identified yet. Use Vision to scan and save people.
            </p>
            <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-1 max-w-xs">
              People recognized through the Vision camera appear here with last seen timestamps and confidence scores.
            </p>
            <button
              type="button"
              onClick={() => setVisionOpen(true)}
              className="mt-5 px-4 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium cursor-pointer"
            >
              Scan with Vision
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#717171] dark:text-[#A1A1AA]">
            No Vision contacts match "{query}".
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E5] dark:divide-white/10 rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717]">
            {filtered.map((person) => (
              <div
                key={person.id}
                onClick={() => openDetail(person)}
                className="flex items-start justify-between gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt={person.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[#E5E5E5] dark:border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#6366f1]/15 text-[#6366f1] flex items-center justify-center text-sm font-semibold shrink-0">
                      {person.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <span className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        {person.name}
                      </span>
                      {person.role && (
                        <span className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                          {person.role}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-0.5 tabular-nums">
                      {typeof person.confidence === 'number' && (
                        <span>{person.confidence}% confidence</span>
                      )}
                      {person.lastSeen && (
                        <span>
                          {typeof person.confidence === 'number' ? ' · ' : ''}
                          Last seen {new Date(person.lastSeen).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {person.notes && (
                      <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-1.5 line-clamp-2">
                        {person.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail / Edit Drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative z-50 w-full max-w-md h-full bg-[#FFFFFF] dark:bg-[#171717] border-l border-[#E5E5E5] dark:border-white/10 flex flex-col shadow-2xl">
            <div className="h-14 px-5 flex items-center justify-between border-b border-[#E5E5E5] dark:border-white/10 shrink-0">
              <h3 className="font-display font-semibold text-base">{selected.name}</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSave(e)}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {selected.photoUrl && (
                <img
                  src={selected.photoUrl}
                  alt={selected.name}
                  className="w-24 h-24 rounded-2xl object-cover border border-[#E5E5E5] dark:border-white/10"
                />
              )}

              <div className="text-xs text-[#717171] dark:text-[#A1A1AA] space-y-1 tabular-nums">
                {selected.role && <div>Role: {selected.role}</div>}
                {typeof selected.confidence === 'number' && (
                  <div>Match confidence: {selected.confidence}%</div>
                )}
                {selected.lastSeen && (
                  <div>Last seen: {new Date(selected.lastSeen).toLocaleString()}</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Vision notes
                </label>
                <textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div className="pt-4 flex items-center justify-between gap-3 border-t border-[#E5E5E5] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    void deleteContact(selected.id);
                    setSelected(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="px-4 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium cursor-pointer"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
