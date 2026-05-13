import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { VoiceVisualizer } from './VoiceVisualizer';
import ChatInterface from './ChatInterface';
import { 
  Mic, 
  MicOff, 
  Camera, 
  Settings, 
  Menu,
  X,
  MessageSquare,
  Eye
} from 'lucide-react';

interface MobileInterfaceProps {
  className?: string;
}

export const MobileInterface: React.FC<MobileInterfaceProps> = ({ className = "" }) => {
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'chat' | 'camera'>('voice');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleVoice = () => {
    setIsListening(prev => !prev);
  };

  const TabButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ icon, label, isActive, onClick }) => (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className={`flex flex-col items-center space-y-1 h-16 ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );

  if (!isMobile) {
    return null; // Only show on mobile
  }

  return (
    <div className={`fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 ${className}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">J</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">J.A.R.V.I.S</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'voice' && (
          <div className="p-4 h-full flex flex-col">
            <Card className="flex-1 flex flex-col items-center justify-center space-y-6">
              <VoiceVisualizer 
                isListening={isListening}
                className="w-full max-w-sm"
              />
              
              <Button
                onClick={toggleVoice}
                size="lg"
                className={`w-20 h-20 rounded-full ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </Button>
              
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {isListening ? 'Listening...' : 'Tap to speak'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Voice commands are processed in real-time
                </p>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="h-full">
            <ChatInterface />
          </div>
        )}

        {activeTab === 'camera' && (
          <div className="p-4 h-full">
            <Card className="h-full flex flex-col items-center justify-center">
              <Camera className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Camera Recognition
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Point camera at objects or people for instant recognition
              </p>
              <Button className="mt-4" size="lg">
                Start Camera
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2">
        <div className="flex justify-around">
          <TabButton
            icon={<Mic className="w-5 h-5" />}
            label="Voice"
            isActive={activeTab === 'voice'}
            onClick={() => setActiveTab('voice')}
          />
          <TabButton
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            isActive={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
          />
          <TabButton
            icon={<Eye className="w-5 h-5" />}
            label="Vision"
            isActive={activeTab === 'camera'}
            onClick={() => setActiveTab('camera')}
          />
          <TabButton
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            isActive={false}
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </div>

      {/* Settings Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60">
          <div className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Settings</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-medium mb-2">Voice Settings</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Continuous listening</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Voice feedback</span>
                  </label>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Display</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Dark mode</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Reduce animations</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};