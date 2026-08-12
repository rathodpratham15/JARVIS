import { useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';
import { VoiceModeOverlay } from '@/components/VoiceModeOverlay';
import { useReminderPoller } from '@/hooks/useReminderPoller';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useVoiceMode } from '@/hooks/useVoiceMode';

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

function VoiceActivation() {
  const { active, voiceState, transcript, reply, start, stop } = useVoiceMode();

  // Wake word detection — paused while voice mode is active to avoid re-triggering
  const { listening, supported } = useWakeWord({
    onActivation: start,
    enabled: !active,
  });

  // '/' shortcut: open voice mode (or close if already open)
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (active) stop(); else start();
    }
  }, [active, start, stop]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  return (
    <>
      <VoiceModeOverlay
        active={active}
        voiceState={voiceState}
        transcript={transcript}
        reply={reply}
        onDismiss={stop}
      />

      {/* Floating status badge */}
      <div className="fixed bottom-20 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-[rgba(2,8,23,0.9)] border border-[rgba(0,180,255,0.25)] backdrop-blur-sm pointer-events-none">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]"
          style={{
            animation: (listening || active) ? 'jv-pulse 1.2s ease-in-out infinite' : 'none',
            opacity: (listening || active) ? 1 : 0.3,
          }}
        />
        <span className="font-hud-mono text-[9px] tracking-widest text-[#4a7fa0]">
          {active ? 'VOICE MODE' : listening ? 'LISTENING' : supported ? 'STANDBY' : '/ TO ACTIVATE'}
        </span>
      </div>
    </>
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
      <VoiceActivation />
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
