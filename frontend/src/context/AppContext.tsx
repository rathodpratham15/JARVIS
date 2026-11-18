import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, storeTokens, clearTokens, getToken } from "@/lib/api";
import type { User, Settings, Conversation, Memory, ModalState } from "@/types/index";

interface AppContextValue {
  user: User | null;
  authState: "checking" | "in" | "out";
  signIn: (data: unknown) => void;
  signOut: () => Promise<void>;
  settings: Settings | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  convState: "loading" | "ready" | "error";
  refreshConversations: () => Promise<void>;
  memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
  refreshMemories: () => Promise<void>;
  modal: ModalState;
  openModal: (name: keyof ModalState | string, extra?: Partial<ModalState>) => void;
  closeModal: (name: keyof ModalState | string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentConvId: string | null;
  setCurrentConvId: React.Dispatch<React.SetStateAction<string | null>>;
  refreshKey: number;
  bumpRefresh: () => void;
}

const AppCtx = createContext<AppContextValue | null>(null);
export const useApp = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};

// Convert flat interactions from GET /api/history to Conversation[] for the sidebar
function interactionsToConversations(interactions: Array<{
  id: string; user_input: string; timestamp?: string; created_at?: string;
}>): Conversation[] {
  if (!interactions.length) return [];
  // Group into sessions: > 30 min gap = new conversation
  const GAP_MS = 30 * 60 * 1000;
  const sessions: typeof interactions[][] = [];
  let current: typeof interactions[] = [interactions[0]];
  for (let i = 1; i < interactions.length; i++) {
    const prevTs = new Date(interactions[i - 1].timestamp || interactions[i - 1].created_at || 0).getTime();
    const thisTs = new Date(interactions[i].timestamp || interactions[i].created_at || 0).getTime();
    if (Math.abs(thisTs - prevTs) > GAP_MS) {
      sessions.push(current);
      current = [interactions[i]];
    } else {
      current.push(interactions[i]);
    }
  }
  sessions.push(current);
  return sessions.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const ts = last.timestamp || last.created_at || new Date().toISOString();
    return {
      id: `hist-${first.id}`,
      title: (first.user_input || "Chat").slice(0, 60),
      created_at: first.timestamp || first.created_at || ts,
      updated_at: ts,
    } as Conversation;
  }).reverse(); // newest first
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<"checking" | "in" | "out">("checking");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convState, setConvState] = useState<"loading" | "ready" | "error">("loading");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [modal, setModal] = useState<ModalState>({ settings: false, tab: "general", search: false, voice: false });
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // On mount: check for stored JWT and verify it
  useEffect(() => {
    if (!getToken()) { setAuthState("out"); return; }
    api.get("/auth/me")
      .then(({ data }) => { setUser(data); setAuthState("in"); })
      .catch(() => { clearTokens(); setAuthState("out"); });
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      // Original backend: GET /api/history returns {interactions: [...]}
      const { data } = await api.get("/history?limit=100");
      const convs = interactionsToConversations(data.interactions || []);
      setConversations(convs);
      setConvState("ready");
    } catch {
      setConvState("error");
    }
  }, []);

  const refreshMemories = useCallback(async () => {
    try {
      const { data } = await api.get("/memories");
      setMemories(data);
    } catch { /* memories endpoint may not exist */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get("/settings").then(({ data }) => setSettings(data)).catch(() => {});
    refreshConversations();
    refreshMemories();
  }, [user, refreshConversations, refreshMemories]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => s ? { ...s, ...patch } : s);
    try {
      const { data } = await api.post("/settings", patch);
      setSettings(data);
    } catch (e) {
      toast.error(errMsg(e, "Couldn't save settings"));
    }
  }, []);

  // signIn accepts the full login response {access_token, refresh_token, user}
  // OR just a user object (for backward compat)
  const signIn = (data: unknown) => {
    const d = data as Record<string, unknown>;
    if (d.access_token && d.user) {
      storeTokens(d.access_token as string, (d.refresh_token as string) || "");
      setUser(d.user as User);
    } else {
      setUser(d as User);
    }
    setAuthState("in");
  };

  const signOut = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    clearTokens();
    setUser(null);
    setConversations([]);
    setAuthState("out");
  };

  const openModal = (name: string, extra: Partial<ModalState> = {}) =>
    setModal((m) => ({ ...m, [name]: true, ...extra }));
  const closeModal = (name: string) => setModal((m) => ({ ...m, [name]: false }));

  const value = useMemo<AppContextValue>(() => ({
    user, authState, signIn, signOut, settings, updateSettings,
    conversations, setConversations, convState, refreshConversations,
    memories, setMemories, refreshMemories,
    modal, openModal, closeModal,
    sidebarOpen, setSidebarOpen, mobileOpen, setMobileOpen,
    currentConvId, setCurrentConvId,
    refreshKey, bumpRefresh: () => setRefreshKey((k) => k + 1),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, authState, settings, updateSettings, conversations, convState, refreshConversations, memories,
    refreshMemories, modal, sidebarOpen, mobileOpen, currentConvId, refreshKey]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
