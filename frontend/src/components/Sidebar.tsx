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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  runningTasksCount = 0,
  activeSchedulesCount = 0,
  permissionsCount = 0,
  dueRemindersCount = 0,
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
    { id: "tasks", label: "Tasks", code: "04", icon: <CheckSquare className="w-4 h-4" />, badge: runningTasksCount > 0 ? `${runningTasksCount} RUN` : undefined },
    { id: "schedules", label: "Schedules", code: "05", icon: <Clock className="w-4 h-4" />, badge: activeSchedulesCount > 0 ? `${activeSchedulesCount} ACT` : undefined },
    { id: "permissions", label: "Permissions", code: "06", icon: <ShieldCheck className="w-4 h-4" />, badge: permissionsCount > 0 ? `${permissionsCount} CAP` : undefined },
    { id: "computer", label: "Computer Use", code: "07", icon: <Monitor className="w-4 h-4" /> },
    { id: "notes", label: "Directives", code: "08", icon: <FileText className="w-4 h-4" /> },
    { id: "reminders", label: "Reminders", code: "09", icon: <Bell className="w-4 h-4" />, badge: dueRemindersCount > 0 ? `${dueRemindersCount} DUE` : undefined },
    { id: "settings", label: "Settings", code: "10", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#F2F2EF] border-r border-[#1a1a1a] select-none shrink-0">
        {/* Brand Banner */}
        <div className="p-5 border-b border-[#1a1a1a] bg-[#EBEBEA]">
          <div className="overline-cyan">OPERATIONAL OS</div>
          <div className="font-serif text-2xl font-bold tracking-tight text-[#1a1a1a]">
            J.A.R.V.I.S.
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 label-secondary text-[9.5px]">
            SYSTEM DIRECTORIES
          </div>

          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono transition text-left ${
                  isActive
                    ? "bg-[#00E5FF] text-black font-bold border border-[#1a1a1a]"
                    : "text-[#1a1a1a] hover:bg-black/5 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] opacity-60 font-bold">{item.code}</span>
                  <span className={isActive ? "text-black" : "text-[#555]"}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 border font-mono font-bold ${
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
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F2F2EF] border-t border-[#1a1a1a] px-2 py-1.5 flex items-center justify-around overflow-x-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id)}
              className={`flex flex-col items-center justify-center p-1.5 text-[10px] font-mono transition min-w-[54px] ${
                isActive
                  ? "text-black font-bold bg-[#00E5FF] border border-[#1a1a1a]"
                  : "text-[#555] hover:text-[#1a1a1a]"
              }`}
            >
              <span>{item.icon}</span>
              <span className="truncate max-w-[48px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
