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
