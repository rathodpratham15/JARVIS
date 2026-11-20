import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';
import type { Contact } from '../types/jarvis';

export function ContactsPage() {
  const {
    contacts,
    selectedContactId,
    setSelectedContactId,
    createContact,
    updateContact,
    deleteContact,
  } = useJarvisStore();

  const manualContacts = useMemo(
    () => contacts.filter((c) => c.source === 'manual'),
    [contacts]
  );

  const [query, setQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? manualContacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.notes.toLowerCase().includes(q)
        )
      : manualContacts;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [manualContacts, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filtered) {
      const letter = (c.name.trim()[0] || '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      const arr = map.get(key) || [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const openForCreate = () => {
    setEditingContact(null);
    setName('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setNotes('');
    setPanelOpen(true);
  };

  const openForEdit = (contact: Contact) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone);
    setWhatsapp(contact.whatsapp);
    setEmail(contact.email);
    setNotes(contact.notes);
    setMenuOpenId(null);
    setPanelOpen(true);
  };

  useEffect(() => {
    if (selectedContactId) {
      const found = manualContacts.find((c) => c.id === selectedContactId);
      if (found) {
        openForEdit(found);
        setSelectedContactId(null);
      }
    }
  }, [selectedContactId, manualContacts, setSelectedContactId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingContact) {
        await updateContact(editingContact.id, {
          name,
          phone,
          whatsapp,
          email,
          notes,
        });
      } else {
        await createContact({
          name,
          phone,
          whatsapp,
          email,
          notes,
          source: 'manual',
        });
      }
      setPanelOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteContact(id);
    setPanelOpen(false);
    setMenuOpenId(null);
  };

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : fullName.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Top bar controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#717171] dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts by name, phone, or email..."
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] pl-10 pr-4 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#717171] dark:placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>
          <button
            type="button"
            onClick={openForCreate}
            className="px-4 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add contact</span>
          </button>
        </div>

        {/* Empty state */}
        {manualContacts.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-center">
            <img
              src="/src/assets/images/empty_contacts_illustration_1795023432213.jpg"
              alt="Contacts directory illustration"
              referrerPolicy="no-referrer"
              className="w-40 h-40 rounded-2xl object-cover mb-5 border border-[#E5E5E5] dark:border-white/10"
            />
            <p className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
              No contacts yet. Add someone.
            </p>
            <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-1 max-w-xs">
              Store phone numbers, WhatsApp, emails, and personal notes for quick lookup.
            </p>
            <button
              type="button"
              onClick={openForCreate}
              className="mt-5 px-4 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium cursor-pointer"
            >
              Add contact
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#717171] dark:text-[#A1A1AA]">
            No contacts match "{query}".
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([letter, items]) => (
              <div key={letter}>
                <div className="px-2 pb-1.5 text-xs font-semibold text-[#717171] dark:text-[#A1A1AA]">
                  {letter}
                </div>
                <div className="divide-y divide-[#E5E5E5] dark:divide-white/10 rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717]">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => openForEdit(c)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer relative"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#6366f1]/15 text-[#6366f1] flex items-center justify-center text-xs font-semibold shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5] truncate">
                            {c.name}
                          </div>
                          <div className="text-xs text-[#717171] dark:text-[#A1A1AA] truncate">
                            {[c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}
                          </div>
                        </div>
                      </div>

                      <div
                        className="relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setMenuOpenId(menuOpenId === c.id ? null : c.id)
                          }
                          aria-label="Contact options"
                          className="p-2 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpenId === c.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-9 z-30 w-32 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-lg py-1">
                              <button
                                type="button"
                                onClick={() => openForEdit(c)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(c.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slide-in Contact Detail / Edit Panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setPanelOpen(false)}
          />
          <div className="relative z-50 w-full max-w-md h-full bg-[#FFFFFF] dark:bg-[#171717] border-l border-[#E5E5E5] dark:border-white/10 flex flex-col shadow-2xl">
            <div className="h-14 px-5 flex items-center justify-between border-b border-[#E5E5E5] dark:border-white/10 shrink-0">
              <h3 className="font-display font-semibold text-base">
                {editingContact ? 'Contact details' : 'New contact'}
              </h3>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSave(e)}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Context, reminders, or meeting notes..."
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              {editingContact && (
                <div className="text-xs text-[#717171] dark:text-[#A1A1AA] pt-1">
                  Added {new Date(editingContact.createdAt).toLocaleDateString()}
                </div>
              )}

              <div className="pt-4 flex items-center justify-between gap-3 border-t border-[#E5E5E5] dark:border-white/10">
                {editingContact ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(editingContact.id)}
                    className="px-3.5 py-2 rounded-xl text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
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
