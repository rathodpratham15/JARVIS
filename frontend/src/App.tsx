import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  PageId,
  PersonalityMode,
  ThemeAccent,
  ServiceHealth,
  ChatMessage,
  MemoryEntry,
  NoteEntry,
  PluginItem,
  DetectedFace,
  VisionSnapshot,
  ActivityLog,
  ResearchDossier,
  AgentTask,
  ScheduleJob,
  CapabilityPermission,
  ReminderItem,
  AppNotification,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { StatusBar } from "./components/StatusBar";
import { ChatView } from "./components/ChatView";
import { TasksView } from "./components/TasksView";
import { SchedulesView } from "./components/SchedulesView";
import { PermissionsView } from "./components/PermissionsView";
import { ComputerUseView } from "./components/ComputerUseView";
import { NotesView } from "./components/NotesView";
import { RemindersView } from "./components/RemindersView";
import { SettingsView } from "./components/SettingsView";
import { DashboardView } from "./components/DashboardView";
import { VoiceView } from "./components/VoiceView";
import { VisionView } from "./components/VisionView";
import { MemoryView } from "./components/MemoryView";
import { PluginsView } from "./components/PluginsView";
import { ResearchModal } from "./components/ResearchModal";
import { ResearchView } from "./components/ResearchView";
import { AgentTaskModal } from "./components/AgentTaskModal";
import { speakJarvisText, playUiSound, unlockAudioContext, setTtsBackendEnabled } from "./utils/audio";
import { requestNotificationPermission, showBrowserNotification } from "./utils/notifications";
import { isLoggedIn, getStoredUser, getAccessToken, clearTokens, logout as authLogout, fetchAuthConfig } from "./utils/auth";
import { LoginView } from "./components/LoginView";
import { LandingPage } from "./components/LandingPage";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { API_BASE, apiFetch } from "./utils/api";

// ── helpers ────────────────────────────────────────────────────────────────

function mapBackendSchedule(s: any): ScheduleJob {
  return {
    id: s.id,
    title: s.name ?? s.title ?? "Untitled",
    description: s.goal ?? s.description ?? "",
    cronExpression: s.schedule_expr ?? s.cronExpression ?? "every day at 09:00",
    targetModule: "Intelligence",
    enabled: s.enabled ?? true,
    lastRun: s.last_run ? new Date(s.last_run).toLocaleString() : undefined,
    lastResult: s.last_result ?? undefined,
    runCount: s.run_count ?? 0,
    nextRun: "—",
    status: s.last_status === "running" ? "running" : s.last_status === "done" ? "success" : s.last_status === "failed" ? "failed" : "idle",
  };
}

function mapBackendPermission(p: any): CapabilityPermission {
  const riskMap: Record<string, "LOW" | "MEDIUM" | "HIGH"> = {
    low: "LOW", medium: "MEDIUM", high: "HIGH",
  };
  return {
    id: p.id,
    key: p.id as CapabilityPermission["key"],
    name: p.name,
    description: p.description ?? "",
    risk: riskMap[p.risk_level?.toLowerCase()] ?? "MEDIUM",
    enabled: p.enabled,
    iconName: p.id,
    lastAudited: new Date().toISOString(),
    callsCount24h: 0,
    auditLog: [],
  };
}

function mapBackendTask(t: any): AgentTask {
  const statusMap: Record<string, AgentTask["status"]> = {
    pending: "idle", running: "running", done: "completed", failed: "failed",
  };
  return {
    id: t.id,
    title: t.label ?? t.goal ?? t.title ?? "Task",
    status: statusMap[t.status] ?? "idle",
    progressPercent: (() => {
      if (t.status === "done") return 100;
      if (t.status === "failed" || t.status === "cancelled") return 0;
      const steps = t.steps?.length ?? 0;
      const max = t.max_steps ?? 8;
      if (t.status === "pending") return 10;
      if (steps === 0) return 20;  // running but no step completed yet
      return Math.min(30 + Math.round((steps / max) * 60), 90);
    })(),
    priority: "High",
    category: "Agent",
    duration: "-",
    steps: (t.steps ?? []).map((s: any, i: number) => ({
      step: s.step ?? i + 1,
      title: s.tool ?? `Step ${i + 1}`,
      status: "done" as const,
      log: s.result ?? "",
      args: s.args ?? {},
    })),
    output: t.final_answer ?? "",
    createdAt: t.created_at ?? new Date().toISOString(),
  };
}

// ── component ──────────────────────────────────────────────────────────────

// Map URL path ↔ PageId
const PATH_TO_PAGE: Record<string, PageId> = {
  "/dashboard": "dashboard", "/chat": "chat",
  "/voice": "voice", "/vision": "vision", "/tasks": "tasks",
  "/schedules": "schedules", "/permissions": "permissions",
  "/computer": "computer", "/notes": "notes", "/reminders": "reminders",
  "/settings": "settings", "/memory": "memory", "/plugins": "plugins",
  "/research": "research",
};
const PAGE_TO_PATH: Record<PageId, string> = {
  dashboard: "/dashboard", chat: "/chat", voice: "/voice", vision: "/vision",
  tasks: "/tasks", schedules: "/schedules", permissions: "/permissions",
  computer: "/computer", notes: "/notes", reminders: "/reminders",
  settings: "/settings", memory: "/memory", plugins: "/plugins",
  research: "/research",
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth: check on mount; listen for token expiry events
  const [authRequired, setAuthRequired] = useState(false);
  const [authChecking, setAuthChecking] = useState(true); // true until auth state is known
  const [authedUser, setAuthedUser] = useState(getStoredUser);

  useEffect(() => {
    fetchAuthConfig().then(async cfg => {
      setTtsBackendEnabled(cfg.tts_backend_enabled ?? false);
      if (!cfg.auth_enabled) { setAuthChecking(false); return; }
      setAuthRequired(true);
      const token = getAccessToken();
      if (!token) { setAuthedUser(null); setAuthChecking(false); return; }
      try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) { clearTokens(); setAuthedUser(null); }
        else {
          const me = await res.json();
          if (!getStoredUser()) {
            localStorage.setItem("jarvis_user", JSON.stringify({ id: me.id, username: me.username, role: me.role ?? "user" }));
          }
          setAuthedUser(getStoredUser());
        }
      } catch {
        clearTokens(); setAuthedUser(null);
      } finally {
        setAuthChecking(false);
      }
    });
  }, []);

  // Navigate to /dashboard once user is confirmed authenticated on a public path
  const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback"];
  useEffect(() => {
    if (authedUser && PUBLIC_PATHS.includes(location.pathname)) {
      navigate("/dashboard", { replace: true });
    }
  }, [authedUser, location.pathname]);

  useEffect(() => {
    const handler = () => {
      clearTokens();
      setAuthedUser(null);
      setAuthRequired(true);
    };
    window.addEventListener("jarvis:unauthenticated", handler);
    return () => window.removeEventListener("jarvis:unauthenticated", handler);
  }, []);


  const [currentPage, setCurrentPageState] = useState<PageId>(
    PATH_TO_PAGE[location.pathname] ?? "dashboard"
  );

  // Sync URL → state when user navigates with browser back/forward
  useEffect(() => {
    const page = PATH_TO_PAGE[location.pathname] ?? "dashboard";
    setCurrentPageState(page);
  }, [location.pathname]);

  // Unlock AudioContext on first user click so ElevenLabs TTS works in Chat
  // without needing to visit Voice mode first.
  useEffect(() => {
    const handler = () => { unlockAudioContext(); document.removeEventListener("click", handler); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Sync state → URL when app navigates internally
  const setCurrentPage = useCallback((page: PageId) => {
    setCurrentPageState(page);
    navigate(PAGE_TO_PATH[page] ?? "/dashboard");
  }, [navigate]);
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>("Standard");
  const [accentColor, setAccentColor] = useState<ThemeAccent>("brutalist");
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(false);
  const [wakeWord] = useState<string>("Hey Jarvis");

  // Load persisted settings on mount
  useEffect(() => {
    apiFetch(`/api/settings`)
      .then(r => r.json())
      .then(d => {
        const s = d.settings ?? {};
        if (s.personality_mode) setPersonalityMode(s.personality_mode as PersonalityMode);
        if (s.accent_color) setAccentColor(s.accent_color as ThemeAccent);
        if (typeof s.speech_enabled === "boolean") setSpeechEnabled(s.speech_enabled);
      })
      .catch(() => {});
  }, []);

  const persistSettings = useCallback((patch: Record<string, unknown>) => {
    apiFetch(`/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem("jarvis-sidebar-collapsed") === "true"
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("jarvis-sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleSetPersonality = useCallback((mode: PersonalityMode) => {
    setPersonalityMode(mode);
    persistSettings({ personality_mode: mode });
  }, [persistSettings]);

  const handleSetAccentColor = useCallback((color: ThemeAccent) => {
    setAccentColor(color);
    persistSettings({ accent_color: color });
  }, [persistSettings]);

  const handleToggleSpeech = useCallback(() => {
    setSpeechEnabled(v => {
      persistSettings({ speech_enabled: !v });
      return !v;
    });
  }, [persistSettings]);

  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [schedules, setSchedules] = useState<ScheduleJob[]>([]);
  const [permissions, setPermissions] = useState<CapabilityPermission[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [snapshots] = useState<VisionSnapshot[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | undefined>();
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [isAgentTaskOpen, setIsAgentTaskOpen] = useState(false);

  // Track previous schedule statuses to detect done/failed transitions
  const prevScheduleStatusRef = useRef<Record<string, string>>({});

  // ── bootstrap from backend ───────────────────────────────────────────────

  useEffect(() => {
    apiFetch(`/api/health`)
      .then(r => r.json())
      .then(d => {
        const svcMap = d.services ?? {};
        setServices([
          { id: "llm", name: "LLM Core", status: svcMap.llm?.status ?? "online", latencyMs: svcMap.llm?.latencyMs ?? 0, loadPercent: svcMap.llm?.loadPercent ?? 0, details: "", iconName: "Cpu" },
          { id: "voice", name: "Voice Engine", status: svcMap.voice?.status ?? "online", latencyMs: svcMap.voice?.latencyMs ?? 0, loadPercent: 0, details: "", iconName: "Mic" },
          { id: "vision", name: "Vision", status: svcMap.vision?.status ?? "online", latencyMs: svcMap.vision?.latencyMs ?? 0, loadPercent: 0, details: "", iconName: "Eye" },
          { id: "memory", name: "Memory", status: svcMap.memory?.status ?? "online", latencyMs: svcMap.memory?.latencyMs ?? 0, loadPercent: 0, details: "", iconName: "Database" },
        ]);
      })
      .catch(() => {
        setServices([{ id: "llm", name: "LLM Core", status: "offline", latencyMs: 0, loadPercent: 0, details: "", iconName: "Cpu" }]);
      });
  }, []);

  useEffect(() => {
    // Backend returns {interactions: [{id, user_input, response, timestamp, ...}]}
    // Each interaction expands into 2 chat messages: user + jarvis
    apiFetch(`/api/history?limit=30`)
      .then(r => r.json())
      .then(d => {
        const interactions: any[] = d.interactions ?? [];
        const msgs: ChatMessage[] = [];
        interactions.forEach((m: any) => {
          const ts = m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
          if (m.user_input) {
            msgs.push({ id: `${m.id}-u`, sender: "user", text: m.user_input, timestamp: ts });
          }
          if (m.response) {
            msgs.push({ id: `${m.id}-j`, sender: "jarvis", text: m.response, timestamp: ts });
          }
        });
        setChatMessages(msgs);
      })
      .catch(() => {});
  }, []);

  // Request browser notification permission once on first load
  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    const fetchSchedules = () => {
      apiFetch(`/api/schedules`).then(r => r.json()).then(d => {
        if (!d.jobs) return;
        const jobs: ScheduleJob[] = d.jobs.map(mapBackendSchedule);
        setSchedules(jobs);

        // Detect transitions: running → done or failed
        const prev = prevScheduleStatusRef.current;
        jobs.forEach(job => {
          const prevStatus = prev[job.id];
          const nowStatus = job.status;
          if (prevStatus === "running" && (nowStatus === "success" || nowStatus === "failed")) {
            const isSuccess = nowStatus === "success";
            const title = isSuccess
              ? `Agent complete: ${job.title}`
              : `Agent failed: ${job.title}`;
            const body = job.lastResult
              ? job.lastResult.slice(0, 120) + (job.lastResult.length > 120 ? "…" : "")
              : isSuccess ? "Task completed successfully." : "Task encountered an error.";

            showBrowserNotification(title, body, job.id);

            setNotifications(prev => [{
              id: `${job.id}-${Date.now()}`,
              title,
              body,
              type: (isSuccess ? "success" : "error") as AppNotification["type"],
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              read: false,
              page: "schedules" as const,
            }, ...prev].slice(0, 50));
          }
          prev[job.id] = nowStatus;
        });
        prevScheduleStatusRef.current = prev;
      }).catch(() => {});
    };

    fetchSchedules();
    const interval = setInterval(fetchSchedules, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    apiFetch(`/api/permissions`).then(r => r.json()).then(d => {
      if (d.permissions) setPermissions(d.permissions.map(mapBackendPermission));
    }).catch(() => {});
  }, []);

  const fetchNotes = useCallback(() => {
    apiFetch(`/api/notes`).then(r => r.json()).then(d => {
      if (d.notes) setNotes(d.notes.map((n: any): NoteEntry => ({
        id: n.id, title: n.title, content: n.content,
        priority: "High", isReminder: false, completed: false,
        tags: [], createdAt: n.created_at ?? new Date().toISOString(),
      })));
    }).catch(() => {});
  }, []);

  const fetchReminders = useCallback(() => {
    apiFetch(`/api/reminders`).then(r => r.json()).then(d => {
      if (d.reminders) setReminders(d.reminders.map((r: any): ReminderItem => ({
        id: r.id, title: r.title,
        targetTime: r.target_time ?? r.targetTime ?? new Date().toISOString(),
        priority: r.priority ?? "High",
        isDismissed: r.is_dismissed ?? false,
        createdAt: new Date().toISOString(),
      })));
    }).catch(() => {});
  }, []);

  // Initial fetch
  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  // Cross-device sync: poll /api/sync/status every 60s, re-fetch collections
  // whose timestamp advanced since last check (catches edits from other devices).
  useEffect(() => {
    let lastNotes = "";
    let lastReminders = "";
    const tick = () => {
      apiFetch("/api/sync/status").then(r => r.json()).then(s => {
        if (s.notes && s.notes !== lastNotes) { lastNotes = s.notes; fetchNotes(); }
        if (s.reminders && s.reminders !== lastReminders) { lastReminders = s.reminders; fetchReminders(); }
      }).catch(() => {});
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [fetchNotes, fetchReminders]);

  const refreshPlugins = useCallback(() => {
    apiFetch(`/api/plugins`).then(r => r.json()).then(d => {
      if (d.plugins) setPlugins(d.plugins.map((p: any): PluginItem => ({
        id: p.name,
        name: p.name,
        description: p.description ?? "",
        category: p.author ?? "Custom",
        version: p.version ?? "0.1.0",
        enabled: p.enabled ?? true,
        status: p.enabled ? "Active" : "Idle",
        iconName: "Puzzle",
        author: p.author,
        keywords: p.keywords ?? [],
        priority: p.priority ?? 100,
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => { refreshPlugins(); }, [refreshPlugins]);

  useEffect(() => {
    const fetchTasks = () => {
      apiFetch(`/api/tasks`)
        .then(r => r.json())
        .then(d => {
          const list: any[] = Array.isArray(d) ? d : (d.tasks ?? []);
          setTasks(list.map(mapBackendTask));
        })
        .catch(() => {});
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── plugin handlers ──────────────────────────────────────────────────────

  const handleTogglePlugin = useCallback(async (name: string) => {
    const plugin = plugins.find(p => p.name === name);
    const newEnabled = !plugin?.enabled;
    try {
      await apiFetch(`/api/plugins/${encodeURIComponent(name)}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
    } catch {}
    setPlugins(prev => prev.map(p => p.name === name ? { ...p, enabled: newEnabled, status: newEnabled ? "Active" : "Idle" } : p));
  }, [plugins]);

  const handleInstallPlugin = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch(`/api/plugins/install`, { method: "POST", body: form });
      const data = await res.json();
      if (data.plugins) setPlugins(data.plugins.map((p: any): PluginItem => ({
        id: p.name, name: p.name, description: p.description ?? "",
        category: p.author ?? "Custom", version: p.version ?? "0.1.0",
        enabled: p.enabled ?? true, status: p.enabled ? "Active" : "Idle",
        iconName: "Puzzle", author: p.author, keywords: p.keywords ?? [], priority: p.priority ?? 100,
      })));
      return data.installed ?? [];
    } catch {
      return [];
    }
  }, []);

  const handleDeletePlugin = useCallback(async (name: string) => {
    try {
      const res = await apiFetch(`/api/plugins/${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.plugins) setPlugins(data.plugins.map((p: any): PluginItem => ({
        id: p.name, name: p.name, description: p.description ?? "",
        category: p.author ?? "Custom", version: p.version ?? "0.1.0",
        enabled: p.enabled ?? true, status: p.enabled ? "Active" : "Idle",
        iconName: "Puzzle", author: p.author, keywords: p.keywords ?? [], priority: p.priority ?? 100,
      })));
    } catch {}
  }, []);

  // ── notification helpers ─────────────────────────────────────────────────

  const handleMarkAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const handleNotificationClick = useCallback((n: AppNotification) => {
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  }, []);

  // ── log helper ──────────────────────────────────────────────────────────

  const addLog = (
    type: ActivityLog["type"],
    title: string,
    details: string,
    severity: ActivityLog["severity"] = "info"
  ) => {
    setLogs(prev => [{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      type, title, details, severity,
    }, ...prev]);
  };

  // ── chat (SSE streaming) ─────────────────────────────────────────────────

  const handleSendMessage = async (text: string, imageBase64?: string, suppressAutoSpeak = false): Promise<string> => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      imageAttachment: imageBase64,
    };
    setChatMessages(prev => [...prev, userMsg]);
    addLog("CHAT", "User Command", text.slice(0, 50));

    const streamingId = (Date.now() + 1).toString();
    setChatMessages(prev => [...prev, {
      id: streamingId,
      sender: "jarvis",
      text: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
    }]);

    let finalText = "";
    try {
      const res = await apiFetch(`/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Stream unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let evt: { token?: string; done?: boolean };
          try { evt = JSON.parse(raw); } catch { continue; }
          if (evt.token) {
            finalText += evt.token;
            setChatMessages(prev => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.id === streamingId) copy[copy.length - 1] = { ...last, text: last.text + evt.token! };
              return copy;
            });
          }
          if (evt.done) {
            setChatMessages(prev => prev.map(m => m.id === streamingId ? { ...m, isStreaming: false } : m));
          }
        }
      }
      addLog("CHAT", "J.A.R.V.I.S. Response", finalText.slice(0, 50), "success");
      if (speechEnabled && finalText && !suppressAutoSpeak) speakJarvisText(finalText);
    } catch {
      setChatMessages(prev => prev.map(m =>
        m.id === streamingId ? { ...m, text: "Apologies, Sir. Communication disruption.", isStreaming: false } : m
      ));
    }
    return finalText;
  };

  // ── agent tasks ──────────────────────────────────────────────────────────

  const handleExecuteAgentTask = async (taskDescription: string): Promise<AgentTask> => {
    addLog("AGENT", "Autonomous Task Launched", taskDescription.slice(0, 40));
    try {
      const res = await apiFetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: taskDescription }),
      });
      const data = await res.json();
      const newTask: AgentTask = {
        id: data.task_id ?? Date.now().toString(),
        title: taskDescription,
        status: "running",
        progressPercent: 30,
        priority: "High",
        category: "Autonomous Agent",
        duration: "-",
        steps: [],
        output: "",
        createdAt: new Date().toISOString(),
      };
      setTasks(prev => [newTask, ...prev]);
      setActiveAgentTask(newTask);
      return newTask;
    } catch {
      const fallback: AgentTask = {
        id: Date.now().toString(),
        title: taskDescription,
        status: "failed",
        progressPercent: 0,
        priority: "Medium",
        category: "Agent",
        duration: "-",
        steps: [],
        output: "Failed to contact backend.",
        createdAt: new Date().toISOString(),
      };
      setTasks(prev => [fallback, ...prev]);
      return fallback;
    }
  };

  const handleDeleteTask = async (id: string) => {
    try { await apiFetch(`/api/tasks/${id}`, { method: "DELETE" }); } catch {}
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleRenameTask = async (id: string, label: string) => {
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
    } catch {}
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title: label } : t));
  };

  // ── schedules ────────────────────────────────────────────────────────────

  const handleToggleSchedule = async (id: string) => {
    const job = schedules.find(s => s.id === id);
    const newEnabled = !job?.enabled;
    try {
      await apiFetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
    } catch {}
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: newEnabled } : s));
    addLog("SCHEDULE", `Job ${newEnabled ? "Enabled" : "Disabled"}`, job?.title ?? id);
  };

  const handleRunScheduleNow = async (id: string) => {
    const job = schedules.find(s => s.id === id);
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: "running" as const } : s));
    try {
      await apiFetch(`/api/schedules/${id}/run`, { method: "POST" });
    } catch {}
    addLog("SCHEDULE", `Job Run: ${job?.title ?? id}`, "Autonomous routine dispatched.");
    // Poll for result after a brief delay then refresh the full list
    setTimeout(() => {
      apiFetch(`/api/schedules`).then(r => r.json()).then(d => {
        if (d.jobs) setSchedules(d.jobs.map(mapBackendSchedule));
      }).catch(() => {});
    }, 3000);
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await apiFetch(`/api/schedules/${id}`, { method: "DELETE" });
    } catch {}
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleCreateSchedule = async (job: Omit<ScheduleJob, "id" | "lastRun" | "status">) => {
    try {
      const res = await apiFetch(`/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: job.title,
          goal: job.description,
          schedule_expr: job.cronExpression,
          enabled: job.enabled,
        }),
      });
      const data = await res.json();
      const newJob: ScheduleJob = { ...job, id: data.job?.id ?? Date.now().toString(), lastRun: undefined, status: "idle" };
      setSchedules(prev => [newJob, ...prev]);
      addLog("SCHEDULE", "New Schedule Registered", job.title);
    } catch {
      const newJob: ScheduleJob = { ...job, id: Date.now().toString(), lastRun: undefined, status: "idle" };
      setSchedules(prev => [newJob, ...prev]);
    }
  };

  // ── permissions ──────────────────────────────────────────────────────────

  const handleTogglePermission = async (id: string) => {
    const perm = permissions.find(p => p.id === id);
    const newVal = !perm?.enabled;
    try {
      await apiFetch(`/api/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: { [id]: newVal } }),
      });
    } catch {}
    setPermissions(prev => prev.map(p => p.id === id ? { ...p, enabled: newVal } : p));
    addLog("SECURITY", `Capability ${newVal ? "Granted" : "Revoked"}`, perm?.name ?? id);
  };

  // ── reminders ────────────────────────────────────────────────────────────

  const handleAddReminder = async (item: Omit<ReminderItem, "id" | "isTriggered">) => {
    try {
      const res = await apiFetch(`/api/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, target_time: item.targetTime, priority: item.priority }),
      });
      const data = await res.json();
      const newRem: ReminderItem = { ...item, id: data.reminder?.id ?? Date.now().toString(), createdAt: new Date().toISOString() };
      setReminders(prev => [newRem, ...prev]);
      addLog("SYSTEM", "Alarm Armed", item.title);
    } catch {
      setReminders(prev => [{ ...item, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...prev]);
    }
  };

  const handleDismissReminder = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, isDismissed: true } : r));
  };

  const handleSnoozeReminder = (id: string, minutes: number) => {
    setReminders(prev => prev.map(r => {
      if (r.id === id) {
        const base = new Date(r.targetTime).getTime() || Date.now();
        return { ...r, targetTime: new Date(base + minutes * 60000).toISOString().slice(0, 16), isDismissed: false };
      }
      return r;
    }));
  };

  const handleDeleteReminder = async (id: string) => {
    try { await apiFetch(`/api/reminders/${id}`, { method: "DELETE" }); } catch {}
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  // ── notes ────────────────────────────────────────────────────────────────

  const handleAddNote = async (note: Omit<NoteEntry, "id" | "createdAt">) => {
    try {
      const res = await apiFetch(`/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: note.title, content: note.content }),
      });
      const data = await res.json();
      const newNote: NoteEntry = { ...note, id: data.note?.id ?? Date.now().toString(), createdAt: new Date().toISOString() };
      setNotes(prev => [newNote, ...prev]);
      addLog("SYSTEM", "Note Created", note.title);
    } catch {
      setNotes(prev => [{ ...note, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...prev]);
    }
  };

  const handleEditNote = async (id: string, title: string, content: string) => {
    try {
      await apiFetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
    } catch {}
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title, content } : n));
  };

  const handleToggleCompleteNote = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
  };

  const handleDeleteNote = async (id: string) => {
    try { await apiFetch(`/api/notes/${id}`, { method: "DELETE" }); } catch {}
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  // ── memories ─────────────────────────────────────────────────────────────

  const handleAddMemory = (entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">) => {
    setMemories(prev => [{
      ...entry,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, ...prev]);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleSearchSemanticMemory = async (query: string): Promise<string> => {
    try {
      const res = await apiFetch(`/api/memory/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      return data.summary ?? `Searched "${query}" in memory.`;
    } catch {
      return `Search for "${query}" — backend unavailable.`;
    }
  };

  // ── research ─────────────────────────────────────────────────────────────

  const handleRunResearch = async (targetName: string, targetType: "person" | "company"): Promise<ResearchDossier> => {
    addLog("AGENT", "Intelligence Crawler Initiated", `Target: ${targetName}`);
    const res = await apiFetch(`/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: targetName, kind: targetType }),
    });
    return await res.json();
  };

  if (location.pathname === "/privacy-policy") {
    return <PrivacyPolicy />;
  }

  // Landing page — always public
  if (location.pathname === "/") {
    return <LandingPage onEnter={() => navigate("/login")} />;
  }

  const handleLoginSuccess = () => {
    setAuthedUser(getStoredUser());
    setAuthRequired(false);
    setAuthChecking(false);
    // navigation is driven by the authedUser useEffect above
  };

  // SSO callback — consume tokens then go to dashboard
  if (location.pathname === "/auth/callback") {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Login / signup routes
  if (location.pathname === "/login") {
    return <LoginView onLoginSuccess={handleLoginSuccess} initialMode="login" />;
  }
  if (location.pathname === "/signup") {
    return <LoginView onLoginSuccess={handleLoginSuccess} initialMode="signup" />;
  }

  // Protected routes — wait for auth check, then redirect if unauthenticated
  if (authChecking) return null;
  if (authRequired && !authedUser) {
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white flex flex-row font-sans selection:bg-[#00E5FF] selection:text-black">
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        accentColor={accentColor}
        runningTasksCount={tasks.filter(t => t.status === "running").length}
        activeSchedulesCount={schedules.filter(s => s.enabled).length}
        permissionsCount={permissions.length}
        dueRemindersCount={reminders.filter(r => !r.isDismissed).length}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentPage={currentPage}
          onSelectPage={setCurrentPage}
          services={services}
          personalityMode={personalityMode}
          onSelectPersonality={handleSetPersonality}
          onOpenResearch={() => setIsResearchOpen(true)}
          speechEnabled={speechEnabled}
          onToggleSpeech={handleToggleSpeech}
          accentColor={accentColor}
          onChangeAccentColor={handleSetAccentColor}
          onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onNotificationClick={handleNotificationClick}
          currentUser={authedUser}
          onLogout={async () => {
            await authLogout();
            setAuthedUser(null);
            setAuthRequired(true);
          }}
        />

        <StatusBar
          services={services}
          activeTasksCount={tasks.filter(t => t.status === "running").length}
          activeJobsCount={schedules.filter(s => s.enabled).length}
          permissionsGranted={permissions.filter(p => p.enabled).length}
          permissionsTotal={permissions.length}
        />

        <main className="flex-1 overflow-y-auto">
          {currentPage === "dashboard" && (
            <DashboardView
              services={services}
              logs={logs}
              activeAgentTask={activeAgentTask}
              onSelectPage={setCurrentPage}
              onOpenResearch={() => setIsResearchOpen(true)}
              onOpenAgentTask={() => setIsAgentTaskOpen(true)}
              personalityMode={personalityMode}
              onSelectPersonality={handleSetPersonality}
              speechEnabled={speechEnabled}
              onToggleSpeech={handleToggleSpeech}
              accentColor={accentColor}
              onChangeAccentColor={handleSetAccentColor}
              messagesCount={chatMessages.length}
              notesCount={notes.length}
              schedulesCount={schedules.length}
              tasksCompletedCount={tasks.filter(t => t.status === "completed").length}
              tasksRunningCount={tasks.filter(t => t.status === "running").length}
              remindersCount={reminders.filter(r => !r.isDismissed).length}
            />
          )}

          {currentPage === "chat" && (
            <ChatView
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onClearHistory={() => setChatMessages([])}
              onSaveToMemory={(title, content) => handleAddMemory({ title, content, category: "Project", importance: "High", tags: ["ChatRecall"] })}
              onSaveToNote={(title, content) => handleAddNote({ title, content, priority: "High", isReminder: false, completed: false, tags: ["ChatDirective"] })}
              personalityMode={personalityMode}
              memoriesCount={memories.length}
              onSelectPersonality={handleSetPersonality}
            />
          )}

          {currentPage === "tasks" && (
            <TasksView
              tasks={tasks}
              onExecuteAgentTask={handleExecuteAgentTask}
              onDeleteTask={handleDeleteTask}
              onRenameTask={handleRenameTask}
            />
          )}

          {currentPage === "schedules" && (
            <SchedulesView
              schedules={schedules}
              onToggleSchedule={handleToggleSchedule}
              onRunScheduleNow={handleRunScheduleNow}
              onDeleteSchedule={handleDeleteSchedule}
              onCreateSchedule={handleCreateSchedule}
            />
          )}

          {currentPage === "permissions" && (
            <PermissionsView permissions={permissions} onTogglePermission={handleTogglePermission} />
          )}

          {currentPage === "computer" && <ComputerUseView />}

          {currentPage === "notes" && (
            <NotesView
              notes={notes}
              onAddNote={handleAddNote}
              onEditNote={handleEditNote}
              onToggleCompleteNote={handleToggleCompleteNote}
              onDeleteNote={handleDeleteNote}
            />
          )}

          {currentPage === "reminders" && (
            <RemindersView
              reminders={reminders}
              onAddReminder={handleAddReminder}
              onDismissReminder={handleDismissReminder}
              onSnoozeReminder={handleSnoozeReminder}
              onDeleteReminder={handleDeleteReminder}
            />
          )}

          {currentPage === "settings" && (
            <SettingsView
              personalityMode={personalityMode}
              onSelectPersonality={handleSetPersonality}
              speechEnabled={speechEnabled}
              onToggleSpeech={handleToggleSpeech}
              accentColor={accentColor}
              onChangeAccentColor={handleSetAccentColor}
              wakeWord={wakeWord}
              onChangeWakeWord={() => {}}
            />
          )}

          {currentPage === "voice" && (
            <VoiceView
              onProcessVoiceCommand={async t => await handleSendMessage(t, undefined, true)}
              wakeWord={wakeWord}
              accentColor={accentColor}
            />
          )}

          {currentPage === "vision" && (
            <VisionView
              faces={faces}
              snapshots={snapshots}
              onAnalyzeOpticalFeed={async (imageBase64?: string, onSceneUpdate?: (r: any) => void) => {
                if (!imageBase64) return { sceneDescription: "No image captured.", threatLevel: "Unknown", environmentDetails: "" };

                // Convert base64 data URL to Blob
                const [, b64] = imageBase64.split(",");
                const bytes = atob(b64);
                const arr = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                const blob = new Blob([arr], { type: "image/jpeg" });

                // ① Face recognition — await it (fast, ~200ms)
                const faceForm = new FormData();
                faceForm.append("image", blob, "frame.jpg");
                const faceRes = await apiFetch(`/api/face/identify`, { method: "POST", body: faceForm })
                  .then(async r => ({ ok: r.ok, status: r.status, data: await r.json() }))
                  .catch(() => ({ ok: false, status: 0, data: {} }));
                const face = faceRes.data;

                if (faceRes.status === 503) {
                  // Face recognition not available on this server (e.g. dlib not installed)
                  setFaces([]);
                } else if (face.matched && face.person) {
                  const p = face.person;
                  setFaces([{
                    id: p.id ?? "match-1",
                    name: p.name ?? "Unknown",
                    role: p.role ?? p.profession ?? "",
                    clearanceLevel: 1,
                    status: "Authorized",
                    confidence: Math.round((face.confidence ?? 0) * 100),
                    lastSeen: new Date().toLocaleTimeString(),
                    avatarUrl: p.image_url ?? undefined,
                  }]);
                } else {
                  setFaces([]);
                }

                // ② Scene analysis — fire in background, don't block (slow, ~10-25s)
                const sceneForm = new FormData();
                sceneForm.append("image", blob, "frame.jpg");
                apiFetch(`/api/vision/analyze`, { method: "POST", body: sceneForm })
                  .then(async r => {
                    if (r.status === 503) throw new Error("Scene analysis not available on this server");
                    if (!r.ok) throw new Error(`Server error ${r.status}`);
                    return r.json();
                  })
                  .then(scene => {
                    onSceneUpdate?.({
                      sceneDescription: scene.results?.description ?? scene.results?.scene_description ?? scene.description ?? "Scene analyzed.",
                      threatLevel: "Nominal (0%)",
                      environmentDetails: scene.results?.scene_type ?? scene.scene_type ?? "general",
                    });
                  })
                  .catch(err => {
                    onSceneUpdate?.({ sceneDescription: err.message });
                  });

                // Return immediately with face result; scene arrives via callback
                return {
                  sceneDescription: "",
                  threatLevel: "Nominal (0%)",
                  environmentDetails: "",
                  faceMatch: face.matched ? face.person?.name : null,
                  facePerson: face.matched ? face.person : null,
                };
              }}
              accentColor={accentColor}
            />
          )}

          {currentPage === "memory" && (
            <MemoryView
              memories={memories}
              onAddMemory={handleAddMemory}
              onDeleteMemory={handleDeleteMemory}
              onSearchSemanticMemory={handleSearchSemanticMemory}
            />
          )}

          {currentPage === "plugins" && (
            <PluginsView
              plugins={plugins}
              onTogglePlugin={handleTogglePlugin}
              onInstallPlugin={handleInstallPlugin}
              onDeletePlugin={handleDeletePlugin}
            />
          )}

          {currentPage === "research" && <ResearchView />}
        </main>
      </div>

      <ResearchModal isOpen={isResearchOpen} onClose={() => setIsResearchOpen(false)} onRunResearch={handleRunResearch} />
      <AgentTaskModal isOpen={isAgentTaskOpen} onClose={() => setIsAgentTaskOpen(false)} onExecuteAgentTask={handleExecuteAgentTask} />
    </div>
  );
}
