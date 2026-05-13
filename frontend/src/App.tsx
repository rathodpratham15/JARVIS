import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { MobileInterface } from './components/MobileInterface';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import FaceRecognitionDashboard from './components/FaceRecognitionDashboard';
import VisualAnalysisDashboard from './components/VisualAnalysisDashboard';
import PluginManager from './components/PluginManager';
import MemoryExplorer from './components/MemoryExplorer';
import EmotionAnalysisDashboard from './components/EmotionAnalysisDashboard';
import SystemController from './components/SystemController';
import VoiceTranscription from './components/VoiceTranscription';
import ChatInterface from './components/ChatInterface';
import NotesManager from './components/NotesManager';
import CameraRecognition from './components/CameraRecognition';

import './App.css';

// Wrapper component for NotesManager
const NotesManagerWrapper: React.FC = () => {
  const handleBack = () => {
    // Navigate back to dashboard
    window.location.href = '/';
  };

  return <NotesManager onBack={handleBack} />;
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <Router>
        {/* Mobile-first interface for small screens */}
        <div className="block md:hidden">
          <MobileInterface />
        </div>
        
        {/* Desktop interface for larger screens */}
        <div className="hidden md:block">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="/chat" element={<ChatInterface />} />
              <Route path="/voice-input" element={<VoiceTranscription />} />
              <Route path="/camera-recognition" element={<CameraRecognition />} />
              <Route path="/face-recognition" element={<FaceRecognitionDashboard />} />
              <Route path="/visual-analysis" element={<VisualAnalysisDashboard />} />
              <Route path="/plugins" element={<PluginManager />} />
              <Route path="/memory" element={<MemoryExplorer />} />
              <Route path="/notes" element={<NotesManagerWrapper />} />
              <Route path="/emotion-analysis" element={<EmotionAnalysisDashboard />} />
              <Route path="/system-control" element={<SystemController />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
