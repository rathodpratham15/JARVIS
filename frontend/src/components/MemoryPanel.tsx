import { useEffect, useState } from "react";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { api, errMsg } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Memory } from "@/types/index";

const CATEGORIES = ["Personal", "Project", "Security", "Work", "System"];
const IMPORTANCE = ["High", "Medium", "Low"];
const IMP_STYLE: Record<string, string> = {
  High: "bg-red-500/15 text-red-500",
  Medium: "bg-amber-500/15 text-amber-500",
  Low: "bg-zinc-500/15 text-j-muted",
};

function AddMemory({ onAdded }: { onAdded: (m: Memory) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Personal");
  const [importance, setImportance] = useState("Medium");
  const [saving, setSaving] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post("/memories", { title, category, importance });
      onAdded(data);
      setTitle("");
    } catch (err) { toast.error(errMsg(err)); }
    setSaving(false);
  };
  const sel = "h-9 rounded-lg bg-j-surface border border-j-border px-2 text-sm outline-none";
  return (
    <form onSubmit={add} className="flex flex-wrap gap-2" data-testid="memory-add-form">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add something to remember…"
        className="flex-1 min-w-[180px] h-9 rounded-lg bg-j-surface border border-j-border px-3 text-sm outline-none focus:border-j-accent" data-testid="memory-add-input" />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={sel} data-testid="memory-add-category">
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <select value={importance} onChange={(e) => setImportance(e.target.value)} className={sel} data-testid="memory-add-importance">
        {IMPORTANCE.map((c) => <option key={c}>{c}</option>)}
      </select>
      <button disabled={saving || !title.trim()} className="h-9 w-9 rounded-lg bg-j-accent text-black grid place-items-center disabled:opacity-40" data-testid="memory-add-button">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </button>
    </form>
  );
}

export default function MemoryPanel() {
  const { settings, updateSettings, memories, setMemories } = useApp();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [confirmClear, setConfirmClear] = useState(false);

  const load = async () => {
    setState("loading");
    try { const { data } = await api.get("/memories"); setMemories(data); setState("ready"); }
    catch { setState("error"); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const remove = async (m: Memory) => {
    setMemories((l) => l.filter((x) => x.id !== m.id));
    try { await api.delete(`/memories/${m.id}`); } catch (e) { toast.error(errMsg(e)); load(); }
  };
  const clearAll = async () => {
    setConfirmClear(false);
    try { await api.delete("/memories"); setMemories([]); toast.success("All memories cleared"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6" data-testid="memory-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Reference saved memories</p>
          <p className="text-xs text-j-muted mt-0.5">J.A.R.V.I.S. saves useful details from chats and uses them in every conversation.</p>
        </div>
        <Switch checked={settings?.memory_enabled !== false} onCheckedChange={(v) => updateSettings({ memory_enabled: v })} data-testid="memory-toggle" />
      </div>
      <AddMemory onAdded={(m) => setMemories((l) => [m, ...l])} />
      <div className="rounded-xl border border-j-border divide-y divide-j-border max-h-[340px] overflow-y-auto scrollbar-thin" data-testid="memory-list">
        {state === "loading" && <div className="p-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-j-muted" /></div>}
        {state === "error" && <div className="p-6 text-center text-sm text-j-muted">Couldn't load memories. <button onClick={load} className="underline" data-testid="memory-retry">Retry</button></div>}
        {state === "ready" && !memories.length && <p className="p-6 text-center text-sm text-j-muted" data-testid="memory-empty">No memories yet. They'll appear as you chat.</p>}
        {state === "ready" && memories.map((m) => (
          <div key={m.id} className="group flex items-start gap-3 px-4 py-3" data-testid={`memory-item-${m.id}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{m.title}</p>
              <div className="flex gap-1.5 mt-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-j-surface text-j-muted">{m.category}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${IMP_STYLE[m.importance || "Medium"]}`}>{m.importance}</span>
              </div>
            </div>
            <button onClick={() => remove(m)} className="h-8 w-8 grid place-items-center rounded-lg text-j-muted hover:text-red-500 hover:bg-j-hover" data-testid={`memory-delete-${m.id}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setConfirmClear(true)} disabled={!memories.length}
        className="h-9 px-4 rounded-full border border-red-500/40 text-red-500 text-sm hover:bg-red-500/10 disabled:opacity-40" data-testid="memory-clear-all">
        Clear all memories
      </button>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all memories?</AlertDialogTitle>
            <AlertDialogDescription>J.A.R.V.I.S. will forget everything it has saved about you. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll} className="bg-red-600 hover:bg-red-500 text-white" data-testid="memory-clear-confirm">Clear all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
