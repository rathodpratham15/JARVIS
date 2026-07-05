import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';
import { useReminderPoller } from '@/hooks/useReminderPoller';
import { useWakeWord } from '@/hooks/useWakeWord';
import { hudToast } from '@/lib/hudToast';

// Pages
import Dashboard from '@/pages/Dashboard';
import Chat from '@/pages/Chat';
import VoiceInput from '@/pages/VoiceInput';
import Vision from '@/pages/Vision';
import Intelligence from '@/pages/Intelligence';
import Data from '@/pages/Data';
import Plugins from '@/pages/Plugins';
import SystemControl from '@/pages/SystemControl';
import SettingsManager from '@/pages/SettingsManager';

import './App.css';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* silent */ });
  });
}

// Single component handles both navigation + the floating badge
function WakeWord() {
  const navigate = useNavigate();

  const { listening, supported } = useWakeWord({
    onActivation: () => {
      hudToast.info('JARVIS ACTIVATED — listening…');
      navigate('/chat');
    },
  });

  if (!supported) return null;

  return (
    <div className="md:hidden fixed bottom-20 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-[rgba(2,8,23,0.9)] border border-[rgba(0,180,255,0.25)] backdrop-blur-sm pointer-events-none">
      <span
        className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]"
        style={{ animation: listening ? 'jv-pulse 1.2s ease-in-out infinite' : 'none', opacity: listening ? 1 : 0.3 }}
      />
      <span className="font-hud-mono text-[9px] tracking-widest text-[#4a7fa0]">
        {listening ? 'LISTENING' : 'STANDBY'}
      </span>
    </div>
  );
}

function AppInner() {
  useReminderPoller();
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/voice-input" element={<VoiceInput />} />
          <Route path="/vision" element={<Vision />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/data" element={<Data />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/system-control" element={<SystemControl />} />
          <Route path="/settings" element={<SettingsManager />} />
        </Route>
      </Routes>
      <WakeWord />
      <Toaster position="bottom-right" />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
