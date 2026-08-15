export type PageId =
  | "chat"
  | "tasks"
  | "schedules"
  | "permissions"
  | "computer"
  | "notes"
  | "reminders"
  | "settings"
  | "dashboard"
  | "voice"
  | "vision"
  | "memory"
  | "plugins";

export type PersonalityMode = "Stark Protocol" | "Tactical" | "Formal" | "Protocol Zero";

export type ThemeAccent = "cyan" | "gold" | "crimson" | "emerald" | "cobalt" | "purple" | "light" | "brutalist";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ServiceHealth {
  id: string;
  name: string;
  status: "online" | "degraded" | "offline";
  latencyMs: number;
  loadPercent: number;
  details: string;
  iconName: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "jarvis";
  text: string;
  timestamp: string;
  memoryUsed?: boolean;
  imageAttachment?: string;
  isStreaming?: boolean;
}

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  category: "Personal" | "Project" | "Security" | "Work" | "System";
  importance: "High" | "Medium" | "Low";
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteEntry {
  id: string;
  title: string;
  content: string;
  priority: "Critical" | "High" | "Routine";
  isReminder: boolean;
  reminderTime?: string;
  completed: boolean;
  tags: string[];
  createdAt: string;
}

export interface PluginItem {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  enabled: boolean;
  status: "Active" | "Idle" | "Error";
  iconName: string;
  configKey?: string;
}

export interface DetectedFace {
  id: string;
  name: string;
  role: string;
  confidence: number;
  clearanceLevel: number;
  status: "Authorized" | "Guest" | "Restricted" | "Unknown";
  lastSeen: string;
  avatarUrl?: string;
}

export interface VisionSnapshot {
  id: string;
  timestamp: string;
  imageUrl: string;
  sceneDescription: string;
  facesCount: number;
  threatLevel: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: "CHAT" | "VISION" | "VOICE" | "MEMORY" | "PLUGIN" | "AGENT" | "SYSTEM" | "SCHEDULE" | "COMPUTER" | "SECURITY";
  title: string;
  details: string;
  severity: "info" | "success" | "warning" | "danger";
}

export interface ResearchDossier {
  targetName: string;
  targetType: "person" | "company" | "technology";
  executiveSummary: string;
  keyInsights: string[];
  riskScore: string;
  networkAffiliations: string[];
  recommendedActions: string[];
  lastUpdated: string;
}

export interface AgentStep {
  step: number;
  title: string;
  status: "pending" | "running" | "done" | "error";
  log: string;
  timestamp?: string;
}

export interface AgentTask {
  id: string;
  title: string;
  status: "idle" | "running" | "completed" | "failed";
  progressPercent: number;
  steps: AgentStep[];
  output?: string;
  createdAt: string;
  priority?: "High" | "Medium" | "Low";
  category?: string;
  duration?: string;
}

export interface ScheduleJob {
  id: string;
  title: string;
  description: string;
  cronExpression: string;
  targetModule: "Security" | "Intelligence" | "Research" | "Communications" | "Backups" | "Diagnostics";
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  status: "idle" | "running" | "success" | "failed";
}

export interface CapabilityPermission {
  id: string;
  key: "system_control" | "file_access" | "web_access" | "camera_vision" | "scheduler" | "computer_use" | "reminders";
  name: string;
  description: string;
  risk: RiskLevel;
  enabled: boolean;
  iconName: string;
  lastAudited: string;
  callsCount24h: number;
  auditLog: Array<{
    id: string;
    timestamp: string;
    action: string;
    status: "allowed" | "blocked" | "revoked";
  }>;
}

export interface ReminderItem {
  id: string;
  title: string;
  description?: string;
  dueTime?: string;
  targetTime: string;
  priority: "CRITICAL" | "HIGH" | "ROUTINE" | "Critical" | "High" | "Routine";
  status?: "upcoming" | "due" | "snoozed" | "completed";
  category?: "Stark Tech" | "Personal" | "Security" | "Operations" | string;
  soundAlert?: string;
  isDismissed?: boolean;
  isTriggered?: boolean;
  createdAt?: string;
}

export interface ComputerActionStep {
  id: string;
  timestamp: string;
  actionType: "screenshot" | "click" | "type" | "key" | "scroll" | "wait";
  coordinates?: { x: number; y: number };
  inputPayload?: string;
  details: string;
  status: "running" | "success" | "failed";
}
