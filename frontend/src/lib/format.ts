import type { Conversation } from "@/types/index";

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export function groupConversations(list: Conversation[]): [string, Conversation[]][] {
  const groups: Record<string, Conversation[]> = {
    Today: [], Yesterday: [], "Previous 7 days": [], "Previous 30 days": [], Older: [],
  };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 86400000;
  for (const c of list) {
    const t = new Date(c.updated_at).getTime();
    if (t >= start.getTime()) groups.Today.push(c);
    else if (t >= start.getTime() - day) groups.Yesterday.push(c);
    else if (t >= start.getTime() - 7 * day) groups["Previous 7 days"].push(c);
    else if (t >= start.getTime() - 30 * day) groups["Previous 30 days"].push(c);
    else groups.Older.push(c);
  }
  return Object.entries(groups).filter(([, items]) => items.length);
}

export const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

export const stripMarkdown = (t = "") =>
  t.replace(/```[\s\S]*?```/g, " ").replace(/[#*_`>|~]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
