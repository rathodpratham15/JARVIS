import React, { useState, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  CameraIcon,
  FaceSmileIcon,
  EyeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

interface SystemStatus {
  llm_service: boolean;
  voice_recognition: boolean;
  vision_system: boolean;
  memory_system: boolean;
  plugin_system: boolean;
  face_recognition: boolean;
}

const Dashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    llm_service: false,
    voice_recognition: false,
    vision_system: false,
    memory_system: false,
    plugin_system: false,
    face_recognition: false,
  });
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsChecking(true);
        const response = await fetch('/api/health');
        if (response.ok) {
          const status = await response.json();
          setSystemStatus({
            llm_service: status.initialized,
            voice_recognition: status.initialized,
            vision_system: status.initialized,
            memory_system: status.initialized,
            plugin_system: status.initialized,
            face_recognition: status.initialized,
          });
          setBackendConnected(true);
        } else {
          setBackendConnected(false);
          setSystemStatus({
            llm_service: false,
            voice_recognition: false,
            vision_system: false,
            memory_system: false,
            plugin_system: false,
            face_recognition: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error);
        setBackendConnected(false);
        setSystemStatus({
          llm_service: false,
          voice_recognition: false,
          vision_system: false,
          memory_system: false,
          plugin_system: false,
          face_recognition: false,
        });
      } finally {
        setIsChecking(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      name: 'LLM Service',
      description: 'AI language model status and performance',
      icon: ChatBubbleLeftRightIcon,
      status: systemStatus.llm_service,
      color: 'from-blue-500 to-blue-600',
    },
    {
      name: 'Voice Processing',
      description: 'Speech recognition and synthesis systems',
      icon: MicrophoneIcon,
      status: systemStatus.voice_recognition,
      color: 'from-green-500 to-green-600',
    },
    {
      name: 'Vision Engine',
      description: 'Computer vision and image processing',
      icon: EyeIcon,
      status: systemStatus.vision_system,
      color: 'from-orange-500 to-orange-600',
    },
    {
      name: 'Face Recognition',
      description: 'Facial identification and analysis',
      icon: FaceSmileIcon,
      status: systemStatus.face_recognition,
      color: 'from-purple-500 to-purple-600',
    },
    {
      name: 'Memory Database',
      description: 'Conversation storage and retrieval',
      icon: BookOpenIcon,
      status: systemStatus.memory_system,
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      name: 'Plugin Manager',
      description: 'Extension system and integrations',
      icon: PuzzlePieceIcon,
      status: systemStatus.plugin_system,
      color: 'from-pink-500 to-pink-600',
    },
  ];

  const quickActions = [
    {
      name: 'Start New Chat',
      description: 'Begin a fresh conversation with J.A.R.V.I.S',
      icon: ChatBubbleLeftRightIcon,
      href: '/chat',
      color: 'from-blue-500 to-purple-600',
    },
    {
      name: 'Upload Image',
      description: 'Analyze images with computer vision',
      icon: CameraIcon,
      href: '/visual-analysis',
      color: 'from-orange-500 to-red-600',
    },
    {
      name: 'View Memory',
      description: 'Browse conversation history and context',
      icon: BookOpenIcon,
      href: '/memory',
      color: 'from-indigo-500 to-purple-600',
    },
    {
      name: 'Manage Plugins',
      description: 'Configure and manage system extensions',
      icon: PuzzlePieceIcon,
      href: '/plugins',
      color: 'from-pink-500 to-rose-600',
    },
  ];

  const getActiveModulesCount = () => {
    return Object.values(systemStatus).filter(status => status).length;
  };

  const getBackendStatusText = () => {
    if (isChecking) return 'Checking...';
    if (backendConnected) return 'Online';
    return 'Offline';
  };

  const getBackendStatusColor = () => {
    if (isChecking) return 'text-[#fbbf24]';
    if (backendConnected) return 'text-[#00d4ff]';
    return 'text-[#ef4444]';
  };

  return (
    <div className="p-6 space-y-6 animate-[fadeIn_0.4s_ease]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif' }} className="text-2xl font-bold text-[#00d4ff] tracking-widest uppercase">
            SYSTEM OVERVIEW
          </h1>
          <p className="text-xs font-mono text-[#4a7fa0] tracking-widest mt-1">
            J.A.R.V.I.S MARK II — OPERATIONAL STATUS
          </p>
        </div>
        <div className={`px-3 py-1 border text-xs font-mono tracking-widest ${
          isChecking ? 'border-[#fbbf2440] text-[#fbbf24]' :
          backendConnected ? 'border-[#00b4d840] text-[#00d4ff]' :
          'border-[#ef444440] text-[#ef4444]'
        }`}>
          {isChecking ? '[ SCANNING ]' : backendConnected ? '[ ALL SYSTEMS GO ]' : '[ BACKEND OFFLINE ]'}
        </div>
      </div>

      {/* System Health Grid */}
      <div className="relative border border-[rgba(0,180,255,0.15)] bg-[#071228] p-5 hud-corner">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-[#00d4ff]" />
          <span className="text-xs font-mono tracking-widest text-[#4a7fa0] uppercase">System Health &amp; Status</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className={`flex items-center gap-3 p-3 border transition-all ${
                feature.status
                  ? 'border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.05)]'
                  : 'border-[rgba(0,180,255,0.1)] bg-[#0a1628]'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center border ${
                feature.status ? 'border-[#00b4d8] text-[#00d4ff]' : 'border-[#1e3a5f] text-[#4a7fa0]'
              }`}>
                <feature.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-mono tracking-wider ${feature.status ? 'text-[#cae8ff]' : 'text-[#4a7fa0]'}`}>
                  {feature.name.toUpperCase()}
                </p>
                <p className="text-[10px] text-[#4a7fa0] truncate">{feature.description}</p>
              </div>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                feature.status ? 'bg-[#00d4ff] shadow-[0_0_6px_#00d4ff]' : 'bg-[#1e3a5f]'
              }`} />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="relative border border-[rgba(0,180,255,0.15)] bg-[#071228] p-5 hud-corner">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-[#fbbf24]" />
          <span className="text-xs font-mono tracking-widest text-[#4a7fa0] uppercase">Quick Actions</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <a
              key={action.name}
              href={action.href}
              className="group flex items-center gap-3 p-4 border border-[rgba(0,180,255,0.12)] bg-[#0a1628] hover:border-[rgba(0,212,255,0.4)] hover:bg-[rgba(0,212,255,0.05)] transition-all"
            >
              <div className="w-8 h-8 flex items-center justify-center border border-[#1e3a5f] group-hover:border-[#00b4d8] text-[#4a7fa0] group-hover:text-[#00d4ff] transition-colors">
                <action.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-mono tracking-wider text-[#cae8ff] group-hover:text-[#00d4ff] transition-colors">
                  {action.name.toUpperCase()}
                </p>
                <p className="text-[10px] text-[#4a7fa0] mt-0.5">{action.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Capabilities */}
        <div className="relative border border-[rgba(0,180,255,0.15)] bg-[#071228] p-5 hud-corner">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-[#8b5cf6]" />
            <span className="text-xs font-mono tracking-widest text-[#4a7fa0] uppercase">AI Capabilities</span>
          </div>
          <div className="space-y-3">
            {[
              'Advanced Language Processing',
              'Real-time Voice Recognition',
              'Computer Vision & Analysis',
              'Memory & Context Management',
              'Extensible Plugin System',
            ].map((cap) => (
              <div key={cap} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] shadow-[0_0_4px_#00d4ff]" />
                <span className="text-xs font-mono text-[#cae8ff]">{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="relative border border-[rgba(0,180,255,0.15)] bg-[#071228] p-5 hud-corner">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-[#4a7fa0]" />
            <span className="text-xs font-mono tracking-widest text-[#4a7fa0] uppercase">System Info</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Version', value: '2.0.0' },
              { label: 'Backend Status', value: getBackendStatusText(), colorClass: getBackendStatusColor() },
              { label: 'Active Modules', value: `${getActiveModulesCount()}/6` },
              { label: 'Last Updated', value: isChecking ? 'Scanning...' : backendConnected ? 'Just now' : 'Offline' },
            ].map(({ label, value, colorClass }) => (
              <div key={label} className="flex justify-between items-center border-b border-[rgba(0,180,255,0.08)] pb-2 last:border-0 last:pb-0">
                <span className="text-xs font-mono text-[#4a7fa0] tracking-wider">{label.toUpperCase()}</span>
                <span className={`text-xs font-mono font-medium ${colorClass ?? 'text-[#cae8ff]'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
