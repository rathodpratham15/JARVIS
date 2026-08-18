// All initial data is empty — App.tsx loads everything from the backend API
import {
  ServiceHealth,
  MemoryEntry,
  NoteEntry,
  PluginItem,
  DetectedFace,
  VisionSnapshot,
  ActivityLog,
  ChatMessage,
} from "../types";

export const initialServices: ServiceHealth[] = [];
export const initialMemories: MemoryEntry[] = [];
export const initialNotes: NoteEntry[] = [];
export const initialPlugins: PluginItem[] = [];
export const initialFaces: DetectedFace[] = [];
export const initialSnapshots: VisionSnapshot[] = [];
export const initialLogs: ActivityLog[] = [];
export const initialChatMessages: ChatMessage[] = [];
