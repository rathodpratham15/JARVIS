import React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  CheckSquare,
  MoreHorizontal,
  Eye,
  Bell,
  FileText,
  Calendar,
  Settings,
  Shield,
  Brain,
} from "lucide-react";
import { PageId } from "../types";

interface BottomNavProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  runningTasksCount?: number;
  dueRemindersCount?: number;
}

const PRIMARY: { id: PageId; icon: React.ReactNode; label: string }[] = [
  { id: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Home" },
  { id: "chat",      icon: <MessageSquare   className="w-5 h-5" />, label: "Chat" },
  { id: "voice",     icon: <Mic             className="w-5 h-5" />, label: "Voice" },
  { id: "tasks",     icon: <CheckSquare     className="w-5 h-5" />, label: "Tasks" },
  { id: "more" as any, icon: <MoreHorizontal className="w-5 h-5" />, label: "More" },
];

const MORE: { id: PageId; icon: React.ReactNode; label: string }[] = [
  { id: "vision",      icon: <Eye        className="w-5 h-5" />, label: "Vision" },
  { id: "notes",       icon: <FileText   className="w-5 h-5" />, label: "Notes" },
  { id: "reminders",   icon: <Bell       className="w-5 h-5" />, label: "Reminders" },
  { id: "schedules",   icon: <Calendar   className="w-5 h-5" />, label: "Schedules" },
  { id: "memory",      icon: <Brain      className="w-5 h-5" />, label: "Memory" },
  { id: "permissions", icon: <Shield     className="w-5 h-5" />, label: "Permissions" },
  { id: "settings",    icon: <Settings   className="w-5 h-5" />, label: "Settings" },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  currentPage,
  onSelectPage,
  runningTasksCount = 0,
  dueRemindersCount = 0,
}) => {
  const [moreOpen, setMoreOpen] = React.useState(false);

  const handlePrimary = (id: string) => {
    if (id === "more") { setMoreOpen(v => !v); return; }
    setMoreOpen(false);
    onSelectPage(id as PageId);
  };

  const handleMore = (id: PageId) => {
    setMoreOpen(false);
    onSelectPage(id);
  };

  const isMoreActive = MORE.some(m => m.id === currentPage);

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed bottom-16 inset-x-0 z-50 bg-[#F2F2EF] border-t-2 border-[#1a1a1a] pb-safe">
          <div className="grid grid-cols-4 divide-x divide-[#1a1a1a] border-b border-[#1a1a1a]">
            {MORE.map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => handleMore(id)}
                className={`flex flex-col items-center justify-center gap-1 py-4 transition ${
                  currentPage === id ? "bg-[#00E5FF] text-black" : "text-[#555] hover:bg-black/5"
                }`}
              >
                {icon}
                <span className="font-mono text-[9px] uppercase font-bold">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#F2F2EF] border-t border-[#1a1a1a] flex pb-safe">
        {PRIMARY.map(({ id, icon, label }) => {
          const active = id === "more" ? isMoreActive || moreOpen : currentPage === id;
          const badge =
            id === "tasks" && runningTasksCount > 0 ? runningTasksCount
            : id === "reminders" && dueRemindersCount > 0 ? dueRemindersCount
            : 0;
          return (
            <button
              key={id}
              onClick={() => handlePrimary(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition ${
                active ? "text-black" : "text-[#888]"
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-4 h-0.5 bg-[#00E5FF]" />
              )}
              {icon}
              <span className="font-mono text-[9px] uppercase font-bold">{label}</span>
              {badge > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-12px)] min-w-[14px] h-3.5 px-1 bg-[#00E5FF] border border-[#1a1a1a] font-mono text-[8px] font-black text-black flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
