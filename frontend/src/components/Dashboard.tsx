import React, { useState, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  CameraIcon,
  FaceSmileIcon,
  EyeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
  DocumentTextIcon,
  HeartIcon,
  Cog6ToothIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  CpuChipIcon,
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
          // Backend responded but with error
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
        // Backend is down or unreachable
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
    if (isChecking) return 'text-yellow-600';
    if (backendConnected) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <CpuChipIcon className="w-8 h-8 text-white" />
        </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to J.A.R.V.I.S
        </h1>
        {!backendConnected && !isChecking && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              ⚠️ Backend services are currently offline. Some features may not be available.
            </p>
          </div>
        )}
        <p className="text-gray-600 max-w-2xl mx-auto">
          {backendConnected 
            ? "Your advanced AI assistant is ready to help with a wide range of tasks. From intelligent conversations to visual analysis, J.A.R.V.I.S provides cutting-edge AI capabilities."
            : "Your advanced AI assistant interface is ready, but backend services need to be started to enable full functionality."
          }
        </p>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className={`w-6 h-6 ${backendConnected ? 'text-green-600' : 'text-red-600'}`} />
              <h2 className="text-xl font-semibold text-gray-900">System Health & Status</h2>
            </div>
            {!isChecking && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                backendConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {backendConnected ? 'All Systems Operational' : 'Backend Offline'}
              </div>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature.name}
                className={`p-4 rounded-lg border transition-all duration-200 status-card ${
                  feature.status
                    ? 'bg-white border-green-200 shadow-sm hover:shadow-md'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-black">{feature.name}</h3>
                    <p className="text-sm text-black">{feature.description}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${feature.status ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-3">
            <BoltIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Common Tasks & Actions</h2>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <a
                key={action.name}
                href={action.href}
                className="group block p-6 rounded-lg border border-gray-200 bg-white hover:shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 dashboard-card"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black group-hover:text-blue-600 transition-colors">
                      {action.name}
                    </h3>
                    <p className="text-sm text-black mt-1">{action.description}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
        </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <SparklesIcon className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI Capabilities</h2>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-black">Advanced Language Processing</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-black">Real-time Voice Recognition</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-black">Computer Vision & Analysis</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-black">Memory & Context Management</span>
            </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-black">Extensible Plugin System</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <Cog6ToothIcon className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">System Info</h2>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Version</span>
                <span className="text-sm font-medium text-black">2.0.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Backend Status</span>
                <span className={`text-sm font-medium ${getBackendStatusColor()}`}>
                  {getBackendStatusText()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Active Modules</span>
                <span className="text-sm font-medium text-black">
                  {getActiveModulesCount()}/6
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Last Updated</span>
                <span className="text-sm font-medium text-black">
                  {isChecking ? 'Checking...' : backendConnected ? 'Just now' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;