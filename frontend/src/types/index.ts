export interface User {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface Settings {
  personality: "standard" | "tactical" | "formal" | "concise";
  theme: "dark" | "light" | "system";
  memory_enabled: boolean;
  tts_enabled: boolean;
  voice_id?: string;
  language?: string;
  wake_word?: string;
  wake_word_enabled?: boolean;
  integrations?: Record<string, boolean>;
}

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  archived?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_path?: string;
  feedback?: "up" | "down" | null;
  created_at?: string;
  pending?: boolean;
  temp?: boolean;
  error?: string;
  stopped?: boolean;
  previewUrl?: string;
}

export interface Memory {
  id: string;
  title: string;
  content?: string;
  category?: string;
  importance?: string;
  created_at: string;
  tags?: string[];
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  created_at?: string;
}

export interface Discovery {
  id: string;
  name: string;
  role?: string;
  face_id?: string;
  notes?: string;
  last_seen?: string;
  photo_path?: string;
  confidence?: number;
}

export type ModalState = {
  settings: boolean;
  tab: string;
  search: boolean;
  voice: boolean;
};
