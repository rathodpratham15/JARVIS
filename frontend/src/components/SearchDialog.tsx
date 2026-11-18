import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/common";

export default function SearchDialog() {
  const { modal, openModal, closeModal, conversations } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ conversations: { conversation_id: string; title: string; snippet?: string }[]; contacts: { id: string; name: string; phone?: string; email?: string }[] } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => { if (!modal.search) { setQ(""); setRes(null); setState("idle"); } }, [modal.search]);

  useEffect(() => {
    if (!q.trim()) { setRes(null); setState("idle"); return undefined; }
    setState("loading");
    const t = setTimeout(async () => {
      try { const { data } = await api.get("/search", { params: { q } }); setRes(data); setState("ready"); }
      catch { setState("error"); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openModal("search"); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (path: string) => { closeModal("search"); navigate(path); };
  const rowCls = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-j-hover text-left";
  const recent = conversations.slice(0, 6);

  return (
    <Dialog open={modal.search} onOpenChange={(o) => (o ? openModal("search") : closeModal("search"))}>
      <DialogContent className="max-w-xl p-0 gap-0 rounded-2xl overflow-hidden bg-j-main border-j-border top-[12%] translate-y-0 [&>button]:hidden" data-testid="search-dialog">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-j-border">
          <Search className="h-4 w-4 text-j-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats and contacts…"
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-j-muted" data-testid="search-input" />
          {state === "loading" && <Loader2 className="h-4 w-4 animate-spin text-j-muted" />}
        </div>
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2" data-testid="search-results">
          {state === "idle" && (
            <>
              <p className="px-3 py-2 text-xs text-j-muted">Recent chats</p>
              {!recent.length && <p className="px-3 py-2 text-sm text-j-muted">No chats yet.</p>}
              {recent.map((c) => (
                <button key={c.id} onClick={() => go(`/c/${c.id}`)} className={rowCls}><MessageSquare className="h-4 w-4 text-j-muted shrink-0" /><span className="truncate text-sm">{c.title}</span></button>
              ))}
            </>
          )}
          {state === "error" && <p className="px-3 py-6 text-center text-sm text-j-muted">Search failed. Try again.</p>}
          {state === "ready" && res && !res.conversations.length && !res.contacts.length && (
            <p className="px-3 py-6 text-center text-sm text-j-muted" data-testid="search-empty">No results for "{q}".</p>
          )}
          {state === "ready" && res && res.conversations.length > 0 && (
            <>
              <p className="px-3 py-2 text-xs text-j-muted">Chats</p>
              {res.conversations.map((c) => (
                <button key={c.conversation_id} onClick={() => go(`/c/${c.conversation_id}`)} className={rowCls} data-testid={`search-result-chat-${c.conversation_id}`}>
                  <MessageSquare className="h-4 w-4 text-j-muted shrink-0" />
                  <div className="min-w-0"><p className="truncate text-sm">{c.title}</p>{c.snippet && <p className="truncate text-xs text-j-muted">{c.snippet}</p>}</div>
                </button>
              ))}
            </>
          )}
          {state === "ready" && res && res.contacts.length > 0 && (
            <>
              <p className="px-3 py-2 text-xs text-j-muted">Contacts</p>
              {res.contacts.map((c) => (
                <button key={c.id} onClick={() => go(`/contacts?open=${c.id}`)} className={rowCls} data-testid={`search-result-contact-${c.id}`}>
                  <Avatar name={c.name} size={28} />
                  <div className="min-w-0"><p className="truncate text-sm">{c.name}</p><p className="truncate text-xs text-j-muted">{c.phone || c.email}</p></div>
                </button>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
