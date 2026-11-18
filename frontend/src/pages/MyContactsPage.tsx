import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanFace, Trash2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fileUrl } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/TopBar";
import { Avatar, EmptyState, ErrorState, PillButton } from "@/components/common";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Discovery } from "@/types/index";

function DiscoveryPanel({ item, onClose, onSaved, onDelete }: {
  item: Discovery | null;
  onClose: () => void;
  onSaved: (d: Discovery) => void;
  onDelete: (d: Discovery) => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setNotes(item?.notes || ""), [item]);
  const save = async () => {
    if (!item) return;
    setSaving(true);
    try { const { data } = await api.patch(`/discoveries/${item.id}`, { notes }); onSaved(data); toast.success("Notes saved"); }
    catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-j-main border-j-border w-full sm:max-w-md" data-testid="discovery-panel">
        <SheetTitle>{item?.name}</SheetTitle>
        <SheetDescription>{item?.role || "Identified with Vision"}</SheetDescription>
        {item && (
          <div className="mt-6 space-y-4">
            {item.photo_path ? <img src={fileUrl(item.photo_path)} alt={item.name} className="w-full aspect-square object-cover rounded-2xl" /> : <div className="flex justify-center"><Avatar name={item.name} size={96} /></div>}
            <div className="flex gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-j-surface">Last seen {formatDate(item.last_seen)}</span>
              {item.confidence != null && <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500">{Math.round(item.confidence * 100)}% match</span>}
            </div>
            <label className="block">
              <span className="text-xs text-j-muted">Notes</span>
              <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-j-surface border border-j-border px-3 py-2.5 text-sm outline-none focus:border-j-accent resize-none" />
            </label>
            <div className="flex justify-between">
              <button onClick={() => onDelete(item)} className="text-sm text-red-500 hover:underline flex items-center gap-1.5"><Trash2 className="h-4 w-4" />Remove</button>
              <PillButton variant="accent" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save</PillButton>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function MyContactsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Discovery[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState<Discovery | null>(null);

  const load = async () => {
    setState("loading");
    try { const { data } = await api.get("/discoveries"); setItems(data); setState("ready"); }
    catch { setState("error"); }
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (d: Discovery) => {
    setOpen(null);
    try { await api.delete(`/discoveries/${d.id}`); setItems((l) => l.filter((x) => x.id !== d.id)); toast.success("Removed"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="flex flex-col h-full" data-testid="my-contacts-page">
      <PageHeader title="My Contacts">
        <PillButton variant="ghost" onClick={() => navigate("/vision")}><ScanFace className="h-4 w-4" /><span className="hidden sm:inline">Open Vision</span></PillButton>
      </PageHeader>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-[900px] mx-auto px-4 py-6">
          <p className="text-sm text-j-muted mb-6">People J.A.R.V.I.S. has identified through Vision and saved.</p>
          {state === "loading" && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="aspect-[4/5] rounded-2xl bg-j-hover animate-pulse" />)}</div>}
          {state === "error" && <ErrorState text="Couldn't load your saved people." onRetry={load} testId="my-contacts-error" />}
          {state === "ready" && !items.length && (
            <EmptyState icon={ScanFace} title="No one identified yet." text="Use Vision to scan and save people." testId="my-contacts-empty"
              action={<PillButton variant="accent" onClick={() => navigate("/vision")}>Open Vision</PillButton>} />
          )}
          {state === "ready" && items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((d) => (
                <button key={d.id} onClick={() => setOpen(d)} className="text-left rounded-2xl border border-j-border overflow-hidden hover:bg-j-hover transition-colors">
                  {d.photo_path ? <img src={fileUrl(d.photo_path)} alt={d.name} className="w-full aspect-square object-cover" /> : <div className="aspect-square grid place-items-center bg-j-surface"><Avatar name={d.name} size={72} /></div>}
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-j-muted truncate">{d.role || "—"}</p>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-j-muted">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.last_seen ? new Date(d.last_seen).toLocaleDateString() : "—"}</span>
                      {d.confidence != null && <span className="text-emerald-500">{Math.round(d.confidence * 100)}%</span>}
                    </div>
                    {d.notes && <p className="text-xs text-j-muted mt-1.5 line-clamp-2">{d.notes}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <DiscoveryPanel item={open} onClose={() => setOpen(null)} onDelete={onDelete}
        onSaved={(d) => { setItems((l) => l.map((x) => (x.id === d.id ? d : x))); setOpen(d); }} />
    </div>
  );
}
