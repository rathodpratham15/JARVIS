import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import type { User, Settings, Conversation, Memory, ModalState } from "@/types/index";

interface AppContextValue {
  user: User | null;
  authState: "checking" | "in" | "out";
  signIn: (u: User) => void;
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

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) return;
    api.get("/auth/me")
      .then(({ data }) => { setUser(data); setAuthState("in"); })
      .catch(() => setAuthState("out"));
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/conversations");
      setConversations(data);
      setConvState("ready");
    } catch {
      setConvState("error");
    }
  }, []);

  const refreshMemories = useCallback(async () => {
    try {
      const { data } = await api.get("/memories");
      setMemories(data);
    } catch { /* surfaced in memory panel */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get("/settings").then(({ data }) => setSettings(data)).catch(() => toast.error("Couldn't load settings"));
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

  const signIn = (u: User) => { setUser(u); setAuthState("in"); };
  const signOut = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
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
