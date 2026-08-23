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
  // Desktop collapse
  collapsed: boolean;
  onToggleCollapse: () => void;
  // Mobile drawer
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
    { id: "settings", label: "Settings", code: "12", icon: <Settings className="w-4 h-4" /> },
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
        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono transition text-left ${
          isActive
            ? "bg-[#00E5FF] text-black font-bold border border-[#1a1a1a]"
            : "text-[#1a1a1a] hover:bg-black/5 border border-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] opacity-60 font-bold shrink-0">{item.code}</span>
          <span className={`shrink-0 ${isActive ? "text-black" : "text-[#555]"}`}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge && (
          <span
            className={`text-[9px] px-1.5 py-0.5 border font-mono font-bold shrink-0 ml-1 ${
              isActive
                ? "bg-black text-white border-black"
                : "bg-[#EBEBEA] text-[#1a1a1a] border-[#1a1a1a]/30"
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
        className={`relative w-full flex items-center justify-center py-2.5 transition ${
          isActive
            ? "bg-[#00E5FF] text-black"
            : "text-[#555] hover:bg-black/5 hover:text-[#1a1a1a]"
        }`}
      >
        {item.icon}
        {item.badge && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-black" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <aside
        style={{ width: collapsed ? "3.5rem" : "14rem", transition: "width 200ms ease" }}
        className="hidden lg:flex flex-col bg-[#F2F2EF] border-r border-[#1a1a1a] select-none shrink-0 overflow-hidden"
      >
        {/* Brand */}
        <div className="border-b border-[#1a1a1a] bg-[#EBEBEA] shrink-0">
          {collapsed ? (
            <div className="flex items-center justify-center h-[68px]">
              <div className="w-2 h-2 bg-[#00E5FF] border border-[#1a1a1a] animate-pulse" />
            </div>
          ) : (
            <div className="p-5">
              <div className="overline-cyan whitespace-nowrap">OPERATIONAL OS</div>
              <div className="font-serif text-2xl font-bold tracking-tight text-[#1a1a1a] whitespace-nowrap">
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
          className="shrink-0 border-t border-[#1a1a1a] flex items-center justify-center py-3 hover:bg-black/5 transition text-[#555] hover:text-[#1a1a1a]"
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
        className={`lg:hidden fixed inset-0 z-[55] bg-black/50 transition-opacity duration-200 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── Mobile Drawer ──────────────────────────────────────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-[60] w-72 bg-[#F2F2EF] border-r border-[#1a1a1a] flex flex-col select-none transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand + close */}
        <div className="p-5 border-b border-[#1a1a1a] bg-[#EBEBEA] flex items-start justify-between shrink-0">
          <div>
            <div className="overline-cyan">OPERATIONAL OS</div>
            <div className="font-serif text-2xl font-bold tracking-tight text-[#1a1a1a]">
              J.A.R.V.I.S.
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 hover:bg-black/10 transition border border-transparent hover:border-[#1a1a1a]/20"
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
