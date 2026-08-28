import React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Clock,
  ShieldCheck,
  Monitor,
  FileText,
  Bell,
  Settings,
  Mic,
  Eye,
  Search,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { PageId } from "../types";

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  accentColor?: string;
  runningTasksCount?: number;
  activeSchedulesCount?: number;
  permissionsCount?: number;
  dueRemindersCount?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  runningTasksCount = 0,
  activeSchedulesCount = 0,
  permissionsCount = 0,
  dueRemindersCount = 0,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: PageId;
    label: string;
    icon: React.ReactNode;
    code: string;
    badge?: string;
  }> = [
    { id: "dashboard", label: "Dashboard", code: "00", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "chat", label: "Chat Core", code: "01", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "voice", label: "Voice Mode", code: "02", icon: <Mic className="w-4 h-4" /> },
    { id: "vision", label: "Vision Matrix", code: "03", icon: <Eye className="w-4 h-4" /> },
    {
      id: "tasks", label: "Tasks", code: "04", icon: <CheckSquare className="w-4 h-4" />,
      badge: runningTasksCount > 0 ? `${runningTasksCount} RUN` : undefined,
    },
    {
      id: "schedules", label: "Schedules", code: "05", icon: <Clock className="w-4 h-4" />,
      badge: activeSchedulesCount > 0 ? `${activeSchedulesCount} ACT` : undefined,
    },
    {
      id: "permissions", label: "Permissions", code: "06", icon: <ShieldCheck className="w-4 h-4" />,
      badge: permissionsCount > 0 ? `${permissionsCount} CAP` : undefined,
    },
    { id: "computer", label: "Computer Use", code: "07", icon: <Monitor className="w-4 h-4" /> },
    { id: "notes", label: "Directives", code: "08", icon: <FileText className="w-4 h-4" /> },
    {
      id: "reminders", label: "Reminders", code: "09", icon: <Bell className="w-4 h-4" />,
      badge: dueRemindersCount > 0 ? `${dueRemindersCount} DUE` : undefined,
    },
    { id: "research", label: "Research", code: "11", icon: <Search className="w-4 h-4" /> },
    { id: "contacts", label: "Contacts", code: "13", icon: <Users className="w-4 h-4" /> },
    { id: "settings", label: "Settings", code: "14", icon: <Settings className="w-4 h-4" /> },
  ];

  const ExpandedItem = ({
    item,
    onNavigate,
  }: {
    item: (typeof navItems)[number];
    onNavigate: () => void;
  }) => {
    const isActive = currentPage === item.id;
    return (
      <button
        onClick={onNavigate}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono transition text-left rounded-sm ${
          isActive
            ? "bg-zinc-800 text-white font-bold border border-zinc-700"
            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] opacity-50 font-bold shrink-0">{item.code}</span>
          <span className={`shrink-0 ${isActive ? "text-white" : "text-zinc-500"}`}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge && (
          <span
            className={`text-[9px] px-1.5 py-0.5 border font-mono font-bold shrink-0 ml-1 ${
              isActive
                ? "bg-zinc-600 text-white border-transparent"
                : "bg-zinc-800 text-zinc-400 border-zinc-700"
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const CollapsedItem = ({ item }: { item: (typeof navItems)[number] }) => {
    const isActive = currentPage === item.id;
    return (
      <button
        onClick={() => onSelectPage(item.id)}
        title={item.label}
        className={`relative w-full flex items-center justify-center py-2.5 transition rounded-sm ${
          isActive
            ? "bg-zinc-800 text-white"
            : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100"
        }`}
      >
        {item.icon}
        {item.badge && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <aside
        style={{ width: collapsed ? "3.5rem" : "14rem", transition: "width 200ms ease" }}
        className="hidden lg:flex flex-col bg-[#0d0f12] border-r border-zinc-800 select-none shrink-0 overflow-hidden"
      >
        {/* Brand */}
        <div className="border-b border-zinc-800 bg-[#111318] shrink-0">
          {collapsed ? (
            <div className="flex items-center justify-center h-[68px]">
              <div className="w-2 h-2 bg-emerald-400 animate-pulse rounded-full" />
            </div>
          ) : (
            <div className="p-5">
              <div className="overline-cyan whitespace-nowrap">OPERATIONAL OS</div>
              <div className="font-serif text-2xl font-bold tracking-tight text-white whitespace-nowrap">
                J.A.R.V.I.S.
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          {!collapsed && (
            <div className="px-3 py-2 label-secondary text-[9.5px] whitespace-nowrap">
              SYSTEM DIRECTORIES
            </div>
          )}
          {navItems.map((item) =>
            collapsed ? (
              <CollapsedItem key={item.id} item={item} />
            ) : (
              <ExpandedItem
                key={item.id}
                item={item}
                onNavigate={() => onSelectPage(item.id)}
              />
            )
          )}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 border-t border-zinc-800 flex items-center justify-center py-3 hover:bg-zinc-800/50 transition text-zinc-500 hover:text-zinc-100"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* ── Mobile Overlay ─────────────────────────────────────────── */}
      <div
        onClick={onCloseMobile}
        className={`lg:hidden fixed inset-0 z-[55] bg-black/60 transition-opacity duration-200 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── Mobile Drawer ──────────────────────────────────────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-[60] w-72 bg-[#0d0f12] border-r border-zinc-800 flex flex-col select-none transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand + close */}
        <div className="p-5 border-b border-zinc-800 bg-[#111318] flex items-start justify-between shrink-0">
          <div>
            <div className="overline-cyan">OPERATIONAL OS</div>
            <div className="font-serif text-2xl font-bold tracking-tight text-white">
              J.A.R.V.I.S.
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 hover:bg-zinc-800 transition text-zinc-400 hover:text-white"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 label-secondary text-[9.5px]">SYSTEM DIRECTORIES</div>
          {navItems.map((item) => (
            <ExpandedItem
              key={item.id}
              item={item}
              onNavigate={() => {
                onSelectPage(item.id);
                onCloseMobile();
              }}
            />
          ))}
        </nav>
      </aside>
    </>
  );
};
