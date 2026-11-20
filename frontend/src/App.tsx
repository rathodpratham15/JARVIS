import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
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
import { LandingPage } from './components/LandingPage';
import { LoginView } from './components/LoginView';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { useJarvisStore } from './store/useJarvisStore';
import { isLoggedIn, getStoredUser } from './utils/auth';

const ScannerPage = React.lazy(() =>
  import('./components/ScannerPage').then((m) => ({ default: (m as any).ScannerPage ?? m.default }))
);

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    initialized,
    settings,
    bootstrap,
    applyTheme,
    openSettings,
    pendingConfirm,
    resolveConfirm,
  } = useJarvisStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // After Google OAuth callback redirects to /chat?google=connected,
  // open the Integrations tab so the status refresh useEffect fires.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('google') === 'connected') {
      navigate('/chat', { replace: true });
      openSettings('integrations');
    }
  }, [location.search, navigate, openSettings]);

  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme, applyTheme]);

  // Scanner — always public, no auth check needed
  if (location.pathname === '/scan') {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400 font-mono text-sm">
          INITIALIZING SCANNER…
        </div>
      }>
        <ScannerPage />
      </React.Suspense>
    );
  }

  // Privacy policy — always public
  if (location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }

  // Landing page — always public
  if (location.pathname === '/') {
    return <LandingPage onEnter={() => navigate('/login')} />;
  }

  const handleLoginSuccess = () => {
    navigate('/chat', { replace: true });
  };

  // SSO callback
  if (location.pathname === '/auth/callback') {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Login / signup routes
  if (location.pathname === '/login') {
    return <LoginView onLoginSuccess={handleLoginSuccess} initialMode="login" />;
  }
  if (location.pathname === '/signup') {
    return <LoginView onLoginSuccess={handleLoginSuccess} initialMode="signup" />;
  }

  // Protected routes — if not logged in, redirect to login
  if (!isLoggedIn() || !getStoredUser()) {
    return <Navigate to="/login" replace />;
  }

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#212121] text-[#A1A1AA] text-sm">
        Loading JARVIS…
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#FFFFFF] dark:bg-[#212121] text-[#171717] dark:text-[#F5F5F5]">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 h-screen">
        <TopBar />
        <Routes>
          <Route path="/chat" element={<ChatWorkspace />} />
          <Route path="/c/:id" element={<ChatWorkspace />} />
          <Route path="/scheduled" element={<ScheduledView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/projects/:id" element={<ProjectView />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/my-contacts" element={<MyContactsPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>

      <SettingsModal />
      <SearchModal />
      <VoiceModeOverlay />
      <VisionModeOverlay />

      {pendingConfirm && (
        <ConfirmActionModal
          pending={pendingConfirm}
          onResolved={resolveConfirm}
        />
      )}
    </div>
  );
}
