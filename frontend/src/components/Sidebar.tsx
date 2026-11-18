import React from "react";
import {
  SquarePen,
  MessageSquare,
  Search,
  Eye,
  Mic2,
  Users,
  BookUser,
  Settings,
  LogOut,
} from "lucide-react";
import { PageId, ChatMessage } from "../types";

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  chatMessages: ChatMessage[];
  onNewChat: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: { username?: string; email?: string; role?: string } | null;
  onLogout?: () => void;
}

function recentConversations(messages: ChatMessage[]): string[] {
  const titles: string[] = [];
  for (const msg of messages) {
    if (msg.sender === "user" && msg.text.trim()) {
      const title = msg.text.slice(0, 40) + (msg.text.length > 40 ? "…" : "");
      if (!titles.includes(title)) titles.push(title);
    }
  }
  return titles.reverse().slice(0, 15);
}

const TOP_NAV = [
  { id: "chat" as PageId,   label: "New chat",    icon: <SquarePen className="w-[18px] h-[18px]" /> },
  { id: "research" as PageId, label: "Search chats", icon: <Search className="w-[18px] h-[18px]" /> },
  { id: "vision" as PageId, label: "Vision",       icon: <Eye className="w-[18px] h-[18px]" /> },
  { id: "voice" as PageId,  label: "Voice mode",   icon: <Mic2 className="w-[18px] h-[18px]" /> },
];

const BOTTOM_NAV = [
  { id: "contacts" as PageId,    label: "Contacts",    icon: <Users className="w-[18px] h-[18px]" /> },
  { id: "discoveries" as PageId, label: "My Contacts", icon: <BookUser className="w-[18px] h-[18px]" /> },
  { id: "settings" as PageId,    label: "Settings",    icon: <Settings className="w-[18px] h-[18px]" /> },
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
  const conversations = recentConversations(chatMessages);

  const handleNav = (id: PageId) => {
    if (id === "chat") onNewChat();
    else onSelectPage(id);
    onCloseMobile();
  };

  const NavItem = ({ id, label, icon }: { id: PageId; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => handleNav(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        currentPage === id && id !== "chat"
          ? "bg-white/10 text-white"
          : "text-[#b4b4b4] hover:bg-white/8 hover:text-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const Content = () => (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <button
          onClick={() => { onSelectPage("chat"); onCloseMobile(); }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-[15px] tracking-wide">J.A.R.V.I.S.</span>
        </button>
        {/* Panel toggle placeholder */}
        <button className="p-1.5 hover:bg-white/8 rounded-lg text-[#b4b4b4] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>
          </svg>
        </button>
      </div>

      {/* Top nav */}
      <div className="px-2 space-y-0.5 shrink-0">
        {TOP_NAV.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}
      </div>

      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto px-2 mt-4 min-h-0">
        {conversations.length > 0 && (
          <>
            <p className="px-3 py-1 text-xs font-medium text-[#8e8ea0]">Today</p>
            <div className="space-y-0.5">
              {conversations.map((title, i) => (
                <button
                  key={i}
                  onClick={() => { onSelectPage("chat"); onCloseMobile(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#b4b4b4] hover:bg-white/8 hover:text-white transition-colors truncate"
                >
                  {title}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="px-2 pt-2 pb-1 border-t border-white/8 shrink-0 space-y-0.5">
        {BOTTOM_NAV.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}
      </div>

      {/* User row */}
      {currentUser && (
        <div className="px-3 py-3 border-t border-white/8 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {(currentUser.username ?? "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{currentUser.username ?? "User"}</p>
              {currentUser.email && (
                <p className="text-xs text-[#8e8ea0] truncate">{currentUser.email}</p>
              )}
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1.5 hover:bg-white/8 rounded-lg text-[#8e8ea0] hover:text-white transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 bg-[#171717] h-screen sticky top-0">
        <Content />
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
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px] bg-[#171717] flex flex-col transform transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Content />
      </aside>
    </>
  );
};
