import React, { useState, useEffect } from "react";
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
} from "./types";
import {
  initialServices,
  initialMemories,
  initialPlugins,
  initialFaces,
  initialSnapshots,
  initialLogs,
  initialChatMessages,
} from "./data/initialData";
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
import { AgentTaskModal } from "./components/AgentTaskModal";
import { speakJarvisText, playUiSound } from "./utils/audio";

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
    nextRun: "—",
    status: s.last_status === "running" ? "running" : s.last_status === "done" ? "success" : "idle",
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
    title: t.goal ?? t.title ?? "Task",
    status: statusMap[t.status] ?? "idle",
    progressPercent: t.status === "done" ? 100 : t.status === "running" ? 50 : 0,
    priority: "High",
    category: "Agent",
    duration: "-",
    steps: (t.steps ?? []).map((s: any, i: number) => ({
      step: s.step ?? i + 1,
      title: s.tool ?? `Step ${i + 1}`,
      status: "done" as const,
      log: s.result ?? "",
    })),
    output: t.final_answer ?? "",
    createdAt: t.created_at ?? new Date().toISOString(),
  };
}

// ── component ──────────────────────────────────────────────────────────────

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("dashboard");
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>("Stark Protocol");
  const [accentColor, setAccentColor] = useState<ThemeAccent>("brutalist");
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(false);
  const [wakeWord] = useState<string>("Hey Jarvis");

  const [services] = useState<ServiceHealth[]>(initialServices);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [schedules, setSchedules] = useState<ScheduleJob[]>([]);
  const [permissions, setPermissions] = useState<CapabilityPermission[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>(initialMemories);
  const [plugins, setPlugins] = useState<PluginItem[]>(initialPlugins);
  const [faces] = useState<DetectedFace[]>(initialFaces);
  const [snapshots] = useState<VisionSnapshot[]>(initialSnapshots);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | undefined>();
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [isAgentTaskOpen, setIsAgentTaskOpen] = useState(false);

  // ── bootstrap from backend ───────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/schedules").then(r => r.json()).then(d => {
      if (d.jobs) setSchedules(d.jobs.map(mapBackendSchedule));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/permissions").then(r => r.json()).then(d => {
      if (d.permissions) setPermissions(d.permissions.map(mapBackendPermission));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/notes").then(r => r.json()).then(d => {
      if (d.notes) setNotes(d.notes.map((n: any): NoteEntry => ({
        id: n.id, title: n.title, content: n.content,
        priority: "High", isReminder: false, completed: false,
        tags: [], createdAt: n.created_at ?? new Date().toISOString(),
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/reminders").then(r => r.json()).then(d => {
      if (d.reminders) setReminders(d.reminders.map((r: any): ReminderItem => ({
        id: r.id, title: r.title,
        targetTime: r.target_time ?? r.targetTime ?? new Date().toISOString(),
        priority: r.priority ?? "High",
        isDismissed: r.is_dismissed ?? false,
        createdAt: new Date().toISOString(),
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/tasks").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTasks(d.map(mapBackendTask));
    }).catch(() => {});
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

  const handleSendMessage = async (text: string, imageBase64?: string) => {
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
      const res = await fetch("/api/chat/stream", {
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
      if (speechEnabled && finalText) speakJarvisText(finalText);
    } catch {
      setChatMessages(prev => prev.map(m =>
        m.id === streamingId ? { ...m, text: "Apologies, Sir. Communication disruption.", isStreaming: false } : m
      ));
    }
  };

  // ── agent tasks ──────────────────────────────────────────────────────────

  const handleExecuteAgentTask = async (taskDescription: string): Promise<AgentTask> => {
    addLog("AGENT", "Autonomous Task Launched", taskDescription.slice(0, 40));
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: taskDescription }),
      });
      const data = await res.json();
      const newTask: AgentTask = {
        id: data.task_id ?? Date.now().toString(),
        title: taskDescription,
        status: "running",
        progressPercent: 0,
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

  // ── schedules ────────────────────────────────────────────────────────────

  const handleToggleSchedule = async (id: string) => {
    const job = schedules.find(s => s.id === id);
    const newEnabled = !job?.enabled;
    try {
      await fetch(`/api/schedules/${id}`, {
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
    try {
      await fetch(`/api/schedules/${id}/run`, { method: "POST" });
    } catch {}
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, lastRun: "Just now", status: "success" } : s));
    addLog("SCHEDULE", `Job Run: ${job?.title ?? id}`, "Autonomous routine executed.");
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    } catch {}
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleCreateSchedule = async (job: Omit<ScheduleJob, "id" | "lastRun" | "status">) => {
    try {
      const res = await fetch("/api/schedules", {
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
      await fetch("/api/permissions", {
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
      const res = await fetch("/api/reminders", {
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
    try { await fetch(`/api/reminders/${id}`, { method: "DELETE" }); } catch {}
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  // ── notes ────────────────────────────────────────────────────────────────

  const handleAddNote = async (note: Omit<NoteEntry, "id" | "createdAt">) => {
    try {
      const res = await fetch("/api/notes", {
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

  const handleToggleCompleteNote = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
  };

  const handleDeleteNote = async (id: string) => {
    try { await fetch(`/api/notes/${id}`, { method: "DELETE" }); } catch {}
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
      const res = await fetch("/api/memory/search", {
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
    const res = await fetch("/api/research/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetName, targetType }),
    });
    return await res.json();
  };

  return (
    <div className="min-h-screen bg-[#EBEBEA] text-[#1a1a1a] flex flex-col md:flex-row font-sans selection:bg-[#00E5FF] selection:text-black">
      <Sidebar currentPage={currentPage} onSelectPage={setCurrentPage} accentColor={accentColor} />

      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header
          currentPage={currentPage}
          onSelectPage={setCurrentPage}
          services={services}
          personalityMode={personalityMode}
          onSelectPersonality={setPersonalityMode}
          onOpenResearch={() => setIsResearchOpen(true)}
          onOpenAgentTask={() => setIsAgentTaskOpen(true)}
          speechEnabled={speechEnabled}
          onToggleSpeech={() => setSpeechEnabled(v => !v)}
          accentColor={accentColor}
          onChangeAccentColor={setAccentColor}
        />

        <StatusBar
          services={services}
          activeTasksCount={tasks.filter(t => t.status === "running").length}
          activeJobsCount={schedules.filter(s => s.enabled).length}
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
              onSelectPersonality={setPersonalityMode}
              speechEnabled={speechEnabled}
              onToggleSpeech={() => setSpeechEnabled(v => !v)}
              accentColor={accentColor}
              onChangeAccentColor={setAccentColor}
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
              onSelectPersonality={setPersonalityMode}
            />
          )}

          {currentPage === "tasks" && (
            <TasksView tasks={tasks} onExecuteAgentTask={handleExecuteAgentTask} />
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
              onSelectPersonality={setPersonalityMode}
              speechEnabled={speechEnabled}
              onToggleSpeech={() => setSpeechEnabled(v => !v)}
              accentColor={accentColor}
              onChangeAccentColor={setAccentColor}
              wakeWord={wakeWord}
              onChangeWakeWord={() => {}}
            />
          )}

          {currentPage === "voice" && (
            <VoiceView
              onProcessVoiceCommand={async t => { await handleSendMessage(t); return "Directive processed."; }}
              wakeWord={wakeWord}
              accentColor={accentColor}
            />
          )}

          {currentPage === "vision" && (
            <VisionView
              faces={faces}
              snapshots={snapshots}
              onAnalyzeOpticalFeed={async () => ({
                sceneDescription: "Optical frame analyzed.",
                threatLevel: "Nominal (0%)",
                environmentDetails: "Local environment.",
              })}
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
              onTogglePlugin={id => setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))}
            />
          )}
        </main>
      </div>

      <ResearchModal isOpen={isResearchOpen} onClose={() => setIsResearchOpen(false)} onRunResearch={handleRunResearch} />
      <AgentTaskModal isOpen={isAgentTaskOpen} onClose={() => setIsAgentTaskOpen(false)} onExecuteAgentTask={handleExecuteAgentTask} />
    </div>
  );
}
