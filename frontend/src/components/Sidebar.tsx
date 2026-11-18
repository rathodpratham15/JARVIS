import React from "react";
import {
  SquarePen,
  MessageSquare,
  Users,
  BookUser,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { PageId, ChatMessage } from "../types";

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  chatMessages: ChatMessage[];
  onNewChat: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: { username?: string; role?: string } | null;
  onLogout?: () => void;
}

function groupMessagesBySession(messages: ChatMessage[]): { title: string; timestamp: string }[] {
  const sessions: { title: string; timestamp: string }[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.sender === "user" && msg.text.trim()) {
      sessions.push({
        title: msg.text.slice(0, 48) + (msg.text.length > 48 ? "…" : ""),
        timestamp: msg.timestamp,
      });
      // Skip to next user message
      i++;
      while (i < messages.length && messages[i].sender !== "user") i++;
    } else {
      i++;
    }
  }
  return sessions.reverse().slice(0, 20);
}

const NAV_ITEMS: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "contacts", label: "Contacts", icon: <Users className="w-4 h-4" /> },
  { id: "discoveries", label: "My Contacts", icon: <BookUser className="w-4 h-4" /> },
  { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  chatMessages,
  onNewChat,
  mobileOpen,
  onCloseMobile,
  currentUser,
  onLogout,
}) => {
  const sessions = groupMessagesBySession(chatMessages);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onSelectPage("chat")}
            className="flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-wide">J.A.R.V.I.S.</span>
          </button>
          <button
            onClick={onNewChat}
            title="New chat"
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length > 0 && (
          <>
            <p className="px-2 py-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Recent</p>
            <div className="space-y-0.5">
              {sessions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { onSelectPage("chat"); onCloseMobile(); }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors truncate group flex items-center gap-1 ${
                    i === 0 && currentPage === "chat"
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <span className="truncate flex-1">{s.title}</span>
                  {i === 0 && currentPage === "chat" && (
                    <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="px-2 pb-2 pt-1 border-t border-white/5 shrink-0 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => { onSelectPage(item.id); onCloseMobile(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
              currentPage === item.id
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* User / logout */}
        {currentUser && (
          <div className="mt-1 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                {(currentUser.username ?? "U")[0].toUpperCase()}
              </div>
              <span className="text-xs text-zinc-400 truncate flex-1">{currentUser.username ?? "User"}</span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#161617] border-r border-white/5 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <div
        onClick={onCloseMobile}
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 transition-opacity ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#161617] border-r border-white/5 flex flex-col transform transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
};
