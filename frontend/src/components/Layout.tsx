import { Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import SearchDialog from "@/components/SearchDialog";
import VoiceMode from "@/components/VoiceMode";
import { useWakeWord } from "@/components/useWakeWord";

export default function Layout() {
  const { sidebarOpen, mobileOpen, setMobileOpen, modal } = useApp();
  useWakeWord();
  return (
    <div className="flex h-[100dvh] bg-j-main text-j-text overflow-hidden">
      <aside
        data-testid="sidebar-desktop"
        className="hidden md:flex shrink-0 bg-j-sidebar border-r border-j-border transition-[width] duration-300 ease-out overflow-hidden"
        style={{ width: sidebarOpen ? 260 : 60 }}
      >
        <Sidebar collapsed={!sidebarOpen} />
      </aside>

      <div className={`md:hidden fixed inset-0 z-40 ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div
          data-testid="sidebar-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          data-testid="sidebar-mobile"
          className={`absolute left-0 top-0 bottom-0 w-[280px] bg-j-sidebar transition-transform duration-300 ease-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Sidebar collapsed={false} mobile />
        </aside>
      </div>

      <main className="flex-1 min-w-0 flex flex-col relative">
        <Outlet />
      </main>

      <SettingsModal />
      <SearchDialog />
      {modal.voice && <VoiceMode />}
    </div>
  );
}
