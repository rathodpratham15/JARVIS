export type PersonalityMode = 'Standard' | 'Tactical' | 'Formal' | 'Concise';

export type ThemeMode = 'dark' | 'light' | 'system';

export type MemoryCategory = 'Personal' | 'Project' | 'Security' | 'Work' | 'System';

export type MemoryImportance = 'High' | 'Medium' | 'Low';

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface SourceLink {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
  sources?: SourceLink[];
  feedback?: 'up' | 'down' | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  personalityMode?: PersonalityMode;
  messageCount: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  personalityMode?: PersonalityMode;
  messages: ChatMessage[];
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  notes: string;
  role?: string;
  photoUrl?: string;
  source: 'manual' | 'vision';
  lastSeen?: string;
  confidence?: number;
  personId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrolledPerson {
  id: string;
  name: string;
  role: string;
  notes: string;
  photoUrl: string;
  createdAt: string;
  lastSeen?: string;
  lastConfidence?: number;
}

export interface FaceIdentifyResult {
  matched: boolean;
  faceDetected: boolean;
  personId?: string;
  name?: string;
  role?: string;
  confidence: number;
  notes: string;
  photoUrl?: string;
  capturedDataUrl?: string;
}

export interface GoogleIntegrationStatus {
  connected: boolean;
  email?: string;
  lastSynced?: string;
}

export interface AppSettings {
  theme: ThemeMode;
  language: string;
  personalityMode: PersonalityMode;
  voice: string;
  wakeWord: string;
  memoryEnabled: boolean;
  integrations: {
    calendar: GoogleIntegrationStatus;
    gmail: GoogleIntegrationStatus;
    drive: GoogleIntegrationStatus;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  signedIn: boolean;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface PendingConfirm {
  action_id: string;
  tool: string;
  description: string;
}
