import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, UserPlus, MoreHorizontal, Pencil, Trash2, Users, Phone, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/TopBar";
import { Avatar, EmptyState, ErrorState, PillButton } from "@/components/common";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Contact } from "@/types/index";

const EMPTY: Omit<Contact, "id"> = { name: "", phone: "", whatsapp: "", email: "", notes: "" };
const FIELDS = [
  { key: "name" as const, label: "Full name", type: "text" },
  { key: "phone" as const, label: "Phone", type: "tel" },
  { key: "whatsapp" as const, label: "WhatsApp", type: "tel" },
  { key: "email" as const, label: "Email", type: "email" },
];
const inputCls = "w-full h-10 rounded-xl bg-j-surface border border-j-border px-3 text-sm outline-none focus:border-j-accent transition-colors";

function ContactPanel({ contact, onClose, onSaved, onDelete }: {
  contact: Contact | "new" | null;
  onClose: () => void;
  onSaved: (c: Contact, isNew: boolean) => void;
  onDelete: (c: Contact) => void;
}) {
  const [form, setForm] = useState<Omit<Contact, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const isNew = contact === "new";
  useEffect(() => { if (contact) setForm(isNew ? EMPTY : { ...EMPTY, ...(contact as Contact) }); }, [contact, isNew]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone, whatsapp: form.whatsapp, email: form.email, notes: form.notes };
      const { data } = isNew ? await api.post("/contacts", payload) : await api.put(`/contacts/${(contact as Contact).id}`, payload);
      onSaved(data, isNew);
      toast.success(isNew ? "Contact added" : "Contact saved");
    } catch (err) { toast.error(errMsg(err)); }
    setSaving(false);
  };

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-j-main border-j-border w-full sm:max-w-md overflow-y-auto" data-testid="contact-panel">
        <SheetTitle>{isNew ? "New contact" : "Edit contact"}</SheetTitle>
        <SheetDescription className="sr-only">Contact details</SheetDescription>
        {contact && (
          <form onSubmit={save} className="mt-6 space-y-4">
            {!isNew && <div className="flex justify-center pb-2"><Avatar name={form.name} size={64} /></div>}
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-j-muted">{f.label}</span>
                <input type={f.type} value={(form as Record<string, string>)[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className={`${inputCls} mt-1.5`} data-testid={`contact-field-${f.key}`} autoFocus={f.key === "name"} />
              </label>
            ))}
            <label className="block">
              <span className="text-xs text-j-muted">Notes</span>
              <textarea rows={4} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`${inputCls} mt-1.5 h-auto py-2.5 resize-none`} data-testid="contact-field-notes" />
            </label>
            {!isNew && contact && typeof contact !== "string" && <p className="text-xs text-j-muted">Created {formatDate(contact.created_at)}</p>}
            <div className="flex items-center justify-between pt-2">
              {!isNew ? (
                <button type="button" onClick={() => onDelete(contact as Contact)} className="text-sm text-red-500 hover:underline flex items-center gap-1.5">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : <span />}
              <PillButton type="submit" variant="accent" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </PillButton>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ContactRow({ c, onOpen, onDelete }: { c: Contact; onOpen: (c: Contact) => void; onDelete: (c: Contact) => void }) {
  return (
    <div onClick={() => onOpen(c)} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-j-hover cursor-pointer">
      <Avatar name={c.name} size={38} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{c.name}</p>
        <p className="text-xs text-j-muted truncate flex items-center gap-1.5">
          {c.phone ? <><Phone className="h-3 w-3" />{c.phone}</> : c.email ? <><Mail className="h-3 w-3" />{c.email}</> : "No details"}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="h-8 w-8 grid place-items-center rounded-lg hover:bg-j-hover text-j-muted"><MoreHorizontal className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => onOpen(c)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(c)} className="text-red-500 focus:text-red-500"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Contact | "new" | null>(null);
  const [params, setParams] = useSearchParams();

  const load = async () => {
    setState("loading");
    try { const { data } = await api.get("/contacts"); setContacts(data); setState("ready"); }
    catch { setState("error"); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = params.get("open");
    if (id && contacts.length) { const c = contacts.find((x) => x.id === id); if (c) setOpen(c); setParams({}, { replace: true }); }
  }, [params, contacts, setParams]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = contacts.filter((c) => !term || [c.name, c.email, c.phone, c.whatsapp].some((v) => v?.toLowerCase().includes(term)));
    const map: Record<string, Contact[]> = {};
    filtered.forEach((c) => { const k = /[a-z]/i.test(c.name[0]) ? c.name[0].toUpperCase() : "#"; (map[k] = map[k] || []).push(c); });
    return Object.entries(map).sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  }, [contacts, q]);

  const onSaved = (c: Contact, isNew: boolean) => {
    setContacts((l) => (isNew ? [...l, c] : l.map((x) => (x.id === c.id ? c : x))).sort((a, b) => a.name.localeCompare(b.name)));
    setOpen(null);
  };
  const [confirmDel, setConfirmDel] = useState<Contact | null>(null);
  const doDelete = async () => {
    const c = confirmDel;
    setConfirmDel(null);
    setOpen(null);
    if (!c) return;
    try { await api.delete(`/contacts/${c.id}`); setContacts((l) => l.filter((x) => x.id !== c.id)); toast.success("Contact deleted"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="flex flex-col h-full" data-testid="contacts-page">
      <PageHeader title="Contacts">
        <PillButton variant="primary" onClick={() => setOpen("new")} data-testid="add-contact-button"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Add contact</span></PillButton>
      </PageHeader>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-[720px] mx-auto px-4 py-6">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-j-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts"
              className="w-full h-11 rounded-full bg-j-surface border border-j-border pl-10 pr-4 text-sm outline-none focus:border-j-accent" />
          </div>
          {state === "loading" && [...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-j-hover animate-pulse mb-2" />)}
          {state === "error" && <ErrorState text="Couldn't load contacts." onRetry={load} testId="contacts-error" />}
          {state === "ready" && !contacts.length && (
            <EmptyState icon={Users} title="No contacts yet. Add someone." text="Keep phone numbers, emails and notes for the people in your life." testId="contacts-empty"
              action={<PillButton variant="accent" onClick={() => setOpen("new")}>Add contact</PillButton>} />
          )}
          {state === "ready" && contacts.length > 0 && !groups.length && <p className="text-center text-sm text-j-muted py-10">No contacts match "{q}".</p>}
          {groups.map(([letter, items]) => (
            <section key={letter} className="mb-4">
              <p className="px-3 pb-1 text-xs font-semibold text-j-muted sticky top-0 bg-j-main py-1">{letter}</p>
              {items.map((c) => <ContactRow key={c.id} c={c} onOpen={setOpen} onDelete={setConfirmDel} />)}
            </section>
          ))}
        </div>
      </div>
      <ContactPanel contact={open} onClose={() => setOpen(null)} onSaved={onSaved} onDelete={setConfirmDel} />
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDel?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This contact will be removed permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-500 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
