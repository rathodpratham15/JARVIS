import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';
import { useReminderPoller } from '@/hooks/useReminderPoller';

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

const MobileNotice = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-[#020817] text-[#cae8ff] p-8 text-center">
    <div className="font-orbitron text-2xl tracking-widest jv-glow mb-4">J.A.R.V.I.S</div>
    <p className="font-hud-mono text-xs tracking-widest text-[#4a7fa0]">DESKTOP INTERFACE REQUIRED</p>
    <p className="text-sm text-[#4a7fa0] mt-4">Please open on a larger screen.</p>
  </div>
);

function AppInner() {
  useReminderPoller();
  return (
    <>
      <div className="block md:hidden"><MobileNotice /></div>
      <div className="hidden md:block">
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
      </div>
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
