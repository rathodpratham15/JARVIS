import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Brain, Plug, User, AudioLines, Calendar, Mail, HardDrive, Loader2, Play, ArchiveRestore, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { api, errMsg } from "@/lib/api";
import { speak } from "@/lib/media";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import MemoryPanel from "@/components/MemoryPanel";
import { Avatar, PillButton } from "@/components/common";
import { PERSONALITIES } from "@/components/TopBar";
import { wakeWordSupported } from "@/components/useWakeWord";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "voice", label: "Voice", icon: AudioLines },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "account", label: "Account", icon: User },
];
const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm, warm" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", desc: "Deep, steady" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", desc: "Friendly, clear" },
  { id: "EXAVITQu4vr4xnZDxMaL", name: "Bella", desc: "Soft, bright" },
];
const LANGUAGES = ["English", "Spanish", "French", "German", "Hindi", "Portuguese", "Japanese", "Arabic"];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-j-border last:border-0">
      <div className="min-w-0"><p className="text-sm">{label}</p>{hint && <p className="text-xs text-j-muted mt-0.5">{hint}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
const selectCls = "h-9 rounded-lg bg-j-surface border border-j-border px-3 text-sm outline-none focus:border-j-accent";

function ArchivedChats() {
  const { refreshConversations } = useApp();
  const navigate = useNavigate();
  const [list, setList] = useState<{ id: string; title: string }[] | null>(null);
  useEffect(() => { api.get("/conversations?archived=true").then(({ data }) => setList(data)).catch(() => setList([])); }, []);
  const restore = async (c: { id: string; title: string }) => {
    try { await api.patch(`/conversations/${c.id}`, { archived: false }); setList((l) => l!.filter((x) => x.id !== c.id)); refreshConversations(); toast.success("Chat restored"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  if (!list) return <Loader2 className="h-4 w-4 animate-spin text-j-muted" />;
  if (!list.length) return <p className="text-xs text-j-muted" data-testid="archived-empty">No archived chats.</p>;
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin" data-testid="archived-list">
      {list.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate(`/c/${c.id}`)} className="truncate flex-1 text-left hover:underline">{c.title}</button>
          <button onClick={() => restore(c)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-j-hover text-j-muted"><ArchiveRestore className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

function General() {
  const { settings, updateSettings } = useApp();
  if (!settings) return null;
  return (
    <div>
      <Row label="Theme">
        <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as "dark" | "light" | "system" })} className={selectCls}>
          <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
        </select>
      </Row>
      <Row label="Language" hint="J.A.R.V.I.S. replies in this language">
        <select value={settings.language || "English"} onChange={(e) => updateSettings({ language: e.target.value })} className={selectCls}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
      </Row>
      <Row label="Default personality">
        <select value={settings.personality} onChange={(e) => updateSettings({ personality: e.target.value as "standard" | "tactical" | "formal" | "concise" })} className={selectCls}>
          {PERSONALITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Row>
      <div className="py-4"><p className="text-sm mb-3">Archived chats</p><ArchivedChats /></div>
    </div>
  );
}

function Voice() {
  const { settings, updateSettings } = useApp();
  const [status, setStatus] = useState<{ available: boolean; error?: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => { api.get("/tts/status").then(({ data }) => setStatus(data)).catch(() => setStatus({ available: false })); }, []);
  const preview = async () => {
    if (!settings) return;
    setPreviewing(true);
    await api.post("/settings", { voice_id: settings.voice_id }).catch(() => {});
    const r = await speak("Hello, I'm J.A.R.V.I.S. How can I help you today?").catch(() => null);
    if (r?.engine === "browser") toast.message("ElevenLabs is unavailable — played your browser's voice.");
    setPreviewing(false);
  };
  if (!settings) return null;
  return (
    <div>
      <div className={`rounded-xl px-4 py-3 text-xs mb-2 ${status?.available ? "bg-emerald-500/10 text-emerald-400" : "bg-j-surface text-j-muted"}`}>
        {status === null ? "Checking voice service…" : status.available ? "ElevenLabs voice is ready." : `ElevenLabs voice is unavailable. Browser voice will be used.`}
      </div>
      <Row label="Voice">
        <div className="flex items-center gap-2">
          <select value={settings.voice_id || ""} onChange={(e) => updateSettings({ voice_id: e.target.value })} className={selectCls}>
            {VOICES.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>)}
          </select>
          <button onClick={preview} disabled={previewing} className="h-9 w-9 rounded-lg border border-j-border grid place-items-center hover:bg-j-hover">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </Row>
      <Row label="Wake word" hint="Say this phrase to open voice mode">
        <input defaultValue={settings.wake_word || "Hey Jarvis"}
          onBlur={(e) => e.target.value.trim() && e.target.value !== settings.wake_word && updateSettings({ wake_word: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={`${selectCls} w-40`} />
      </Row>
      <Row label="Listen for wake word" hint={wakeWordSupported() ? "Uses your browser's speech recognition" : "Not supported in this browser"}>
        <Switch checked={!!settings.wake_word_enabled} disabled={!wakeWordSupported()} onCheckedChange={(v) => updateSettings({ wake_word_enabled: v })} />
      </Row>
    </div>
  );
}

const INTEGRATIONS = [
  { id: "google_calendar", name: "Google Calendar", icon: Calendar, desc: "Events and schedule" },
  { id: "gmail", name: "Gmail", icon: Mail, desc: "Read and draft email" },
  { id: "google_drive", name: "Google Drive", icon: HardDrive, desc: "Search your files" },
];

function Integrations() {
  const { settings, updateSettings } = useApp();
  if (!settings) return null;
  const toggle = (id: string) => {
    const next = !settings.integrations?.[id];
    updateSettings({ integrations: { ...settings.integrations, [id]: next } });
    toast.success(next ? "Marked as connected" : "Disconnected");
  };
  return (
    <div>
      <p className="text-xs text-j-muted mb-2">Connection status only — integration features coming soon.</p>
      {INTEGRATIONS.map(({ id, name, icon: Icon, desc }) => {
        const on = settings.integrations?.[id];
        return (
          <div key={id} className="flex items-center gap-3 py-4 border-b border-j-border last:border-0">
            <div className="h-10 w-10 rounded-xl bg-j-surface grid place-items-center"><Icon className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{name}</p>
              <p className="text-xs text-j-muted flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-500"}`} />
                {on ? "Connected" : "Not connected"} · {desc}
              </p>
            </div>
            <PillButton variant={on ? "ghost" : "primary"} onClick={() => toggle(id)}>{on ? "Disconnect" : "Connect"}</PillButton>
          </div>
        );
      })}
    </div>
  );
}

function Account() {
  const { user, signOut, closeModal } = useApp();
  const [terms, setTerms] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-3 py-4 border-b border-j-border">
        <Avatar name={user?.name} src={user?.picture} size={44} />
        <div className="min-w-0"><p className="text-sm font-medium truncate">{user?.name}</p><p className="text-xs text-j-muted truncate">{user?.email}</p></div>
      </div>
      <Row label="Terms of use"><PillButton variant="ghost" onClick={() => setTerms((t) => !t)}>{terms ? "Hide" : "View"}</PillButton></Row>
      {terms && (
        <div className="text-xs text-j-muted leading-relaxed space-y-2 pb-4">
          <p>J.A.R.V.I.S. is a personal assistant. Responses are generated by AI and may be inaccurate — verify important information.</p>
          <p>Your chats, contacts and memories are stored privately and only you can see them. You can delete them at any time.</p>
          <p>Don't use J.A.R.V.I.S. for unlawful purposes, or to identify people without their consent.</p>
        </div>
      )}
      <Row label="Sign out of this device">
        <PillButton variant="ghost" onClick={() => { closeModal("settings"); signOut(); }}>Sign out</PillButton>
      </Row>
    </div>
  );
}

export default function SettingsModal() {
  const { modal, openModal, closeModal, settings } = useApp();
  const tab = modal.tab;
  const BodyMap: Record<string, React.ComponentType> = { general: General, voice: Voice, memory: MemoryPanel, integrations: Integrations, account: Account };
  const Body = BodyMap[tab] || General;
  return (
    <Dialog open={modal.settings} onOpenChange={(o) => (o ? openModal("settings") : closeModal("settings"))}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] p-0 gap-0 rounded-2xl overflow-hidden bg-j-main border-j-border [&>button]:hidden" data-testid="settings-modal">
        <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px]">
          <div className="md:w-52 shrink-0 md:border-r border-b md:border-b-0 border-j-border p-2 md:p-3 flex flex-wrap md:flex-nowrap md:flex-col gap-0.5">
            <div className="hidden md:flex items-center justify-between px-2 pb-3">
              <DialogTitle className="text-base">Settings</DialogTitle>
            </div>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => openModal("settings", { tab: id })}
                className={`flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === id ? "bg-j-hover font-medium" : "hover:bg-j-hover text-j-muted hover:text-j-text"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center justify-between px-6 h-14 border-b border-j-border">
              <p className="font-medium">{TABS.find((t) => t.id === tab)?.label}</p>
              <button onClick={() => closeModal("settings")} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-j-hover"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-2">
              {settings ? <Body /> : <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-j-muted" /></div>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
