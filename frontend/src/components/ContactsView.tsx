import React, { useState } from "react";
import {
  User,
  Phone,
  MessageCircle,
  Mail,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
} from "lucide-react";
import { Contact } from "../types";
import { playUiSound } from "../utils/audio";

interface ContactsViewProps {
  contacts: Contact[];
  onAdd: (c: Omit<Contact, "id" | "created_at" | "updated_at">) => Promise<void>;
  onUpdate: (id: string, c: Partial<Contact>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY_FORM = { name: "", phone: "", whatsapp: "", email: "", notes: "" };

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      playUiSound("success");
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Contact) => {
    setEditId(c.id);
    setEditForm({
      name: c.name,
      phone: c.phone || "",
      whatsapp: c.whatsapp || "",
      email: c.email || "",
      notes: c.notes || "",
    });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await onUpdate(id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        whatsapp: editForm.whatsapp.trim() || undefined,
        email: editForm.email.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      playUiSound("success");
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete contact "${name}"?`)) return;
    playUiSound("beep");
    await onDelete(id);
  };

  const field = (
    label: string,
    key: keyof typeof EMPTY_FORM,
    formState: typeof EMPTY_FORM,
    setFormState: (f: typeof EMPTY_FORM) => void,
    placeholder?: string
  ) => (
    <div className="space-y-1">
      <label className="label-secondary">{label}</label>
      <input
        type="text"
        value={formState[key]}
        onChange={(e) => setFormState({ ...formState, [key]: e.target.value })}
        placeholder={placeholder}
        className="editorial-input"
      />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 06</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Contacts
          </h1>
          <p className="label-secondary mt-1">
            ADDRESS BOOK — JARVIS RESOLVES NAMES AUTOMATICALLY
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#0d0f12] border border-zinc-800 font-mono text-xs font-bold text-white">
            {contacts.length} CONTACTS
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); }}
            className="editorial-btn-primary py-2 px-4 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD CONTACT</span>
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="editorial-panel space-y-4">
          <div>
            <div className="overline-cyan">NEW CONTACT</div>
            <h2 className="font-serif text-2xl font-bold text-white">Add Contact</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Once saved, say "send WhatsApp to <span className="text-white">{form.name || "name"}</span>" and JARVIS will resolve the number automatically.
            </p>
          </div>
          <div className="border-b border-zinc-800" />
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("NAME *", "name", form, setForm, "E.g. Mom, John Smith")}
              {field("PHONE (SMS)", "phone", form, setForm, "+14155552671")}
              {field("WHATSAPP", "whatsapp", form, setForm, "+14155552671")}
              {field("EMAIL", "email", form, setForm, "john@example.com")}
            </div>
            {field("NOTES", "notes", form, setForm, "Optional notes")}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!form.name.trim() || saving}
                className="editorial-btn-primary py-2 px-4 text-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? "SAVING…" : "SAVE CONTACT"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="editorial-btn py-2 px-4 text-xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>CANCEL</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="editorial-input pl-9"
        />
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-800/30 bg-[#111318] font-mono text-xs text-zinc-400">
          {search ? `No contacts matching "${search}"` : "No contacts yet. Add one above."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="editorial-panel space-y-3">
              {editId === c.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  {field("NAME", "name", editForm, setEditForm)}
                  {field("PHONE", "phone", editForm, setEditForm, "+14155552671")}
                  {field("WHATSAPP", "whatsapp", editForm, setEditForm, "+14155552671")}
                  {field("EMAIL", "email", editForm, setEditForm)}
                  {field("NOTES", "notes", editForm, setEditForm)}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(c.id)}
                      disabled={saving}
                      className="editorial-btn-primary py-1.5 px-3 text-[10px]"
                    >
                      <Check className="w-3 h-3" />
                      <span>{saving ? "SAVING…" : "SAVE"}</span>
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="editorial-btn py-1.5 px-3 text-[10px]"
                    >
                      <X className="w-3 h-3" />
                      <span>CANCEL</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-zinc-400" />
                      </div>
                      <h3 className="font-serif text-lg font-bold text-white leading-tight">{c.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1.5 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-1.5 border border-zinc-800 hover:bg-red-900/20 text-zinc-400 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    {c.phone && (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span className="text-white">{c.phone}</span>
                        <span className="text-[10px] text-zinc-600">SMS</span>
                      </div>
                    )}
                    {c.whatsapp && (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <MessageCircle className="w-3 h-3 shrink-0" />
                        <span className="text-white">{c.whatsapp}</span>
                        <span className="text-[10px] text-zinc-600">WHATSAPP</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="text-white">{c.email}</span>
                      </div>
                    )}
                    {c.notes && (
                      <div className="flex items-start gap-2 text-zinc-400 pt-1">
                        <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="text-zinc-300 leading-relaxed">{c.notes}</span>
                      </div>
                    )}
                    {!c.phone && !c.whatsapp && !c.email && (
                      <span className="text-zinc-600 italic">No contact details yet</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
