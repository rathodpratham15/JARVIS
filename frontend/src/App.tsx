import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Chat from '@/pages/Chat';
import VoiceInput from '@/pages/VoiceInput';
import CameraRecognition from '@/pages/CameraRecognition';
import FaceRecognition from '@/pages/FaceRecognition';
import VisualAnalysis from '@/pages/VisualAnalysis';
import Plugins from '@/pages/Plugins';
import Memory from '@/pages/Memory';
import Notes from '@/pages/Notes';
import EmotionAnalysis from '@/pages/EmotionAnalysis';
import SystemControl from '@/pages/SystemControl';
import SettingsManager from '@/pages/SettingsManager';

import './App.css';

// Mobile placeholder — shown on small screens instead of the HUD shell
const MobileNotice = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-[#020817] text-[#cae8ff] p-8 text-center">
    <div className="font-orbitron text-2xl tracking-widest jv-glow mb-4">J.A.R.V.I.S</div>
    <p className="font-hud-mono text-xs tracking-widest text-[#4a7fa0]">
      DESKTOP INTERFACE REQUIRED
    </p>
    <p className="text-sm text-[#4a7fa0] mt-4">Please open on a larger screen.</p>
  </div>
);

function App() {
  return (
    <Router>
      {/* Mobile notice for small screens */}
      <div className="block md:hidden">
        <MobileNotice />
      </div>

      {/* Desktop HUD shell */}
      <div className="hidden md:block">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/voice-input" element={<VoiceInput />} />
            <Route path="/camera-recognition" element={<CameraRecognition />} />
            <Route path="/face-recognition" element={<FaceRecognition />} />
            <Route path="/visual-analysis" element={<VisualAnalysis />} />
            <Route path="/plugins" element={<Plugins />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/emotion-analysis" element={<EmotionAnalysis />} />
            <Route path="/system-control" element={<SystemControl />} />
            <Route path="/settings" element={<SettingsManager />} />
          </Route>
        </Routes>
      </div>

      <Toaster position="bottom-right" />
    </Router>
  );
}

export default App;
