import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthScreen } from './components/AuthScreen';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ContactsPage } from './components/ContactsPage';
import { MyContactsPage } from './components/MyContactsPage';
import { SearchModal } from './components/SearchModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { VisionModeOverlay } from './components/VisionModeOverlay';
import { VoiceModeOverlay } from './components/VoiceModeOverlay';
import { ScheduledView } from './components/ScheduledView';
import { LibraryView } from './components/LibraryView';
import { ProjectView } from './components/ProjectView';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { useJarvisStore } from './store/useJarvisStore';

export default function App() {
  const {
    initialized,
    user,
    settings,
    bootstrap,
    applyTheme,
    pendingConfirm,
    setPendingConfirm,
  } = useJarvisStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme, applyTheme]);

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FFFFFF] dark:bg-[#212121] text-[#717171] dark:text-[#A1A1AA] text-sm">
        Loading JARVIS…
      </div>
    );
  }

  if (!user || !user.signedIn) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#FFFFFF] dark:bg-[#212121] text-[#171717] dark:text-[#F5F5F5]">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 h-screen">
        <TopBar />
        <Routes>
          <Route path="/" element={<ChatWorkspace />} />
          <Route path="/c/:id" element={<ChatWorkspace />} />
          <Route path="/scheduled" element={<ScheduledView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/projects/:id" element={<ProjectView />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/my-contacts" element={<MyContactsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <SettingsModal />
      <SearchModal />
      <VoiceModeOverlay />
      <VisionModeOverlay />

      {pendingConfirm && (
        <ConfirmActionModal
          pending={pendingConfirm}
          onResolved={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}
