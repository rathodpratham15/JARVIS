import React, { useState, useEffect } from 'react';
import { BellIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SystemStatus {
  llm_service: boolean;
  voice_recognition: boolean;
  vision_system: boolean;
  memory_system: boolean;
  plugin_system: boolean;
  face_recognition: boolean;
}

const TopBar: React.FC = () => {
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

  const fetchStatus = async () => {
    try {
      setIsChecking(true);
      const response = await fetch('/api/health');
      if (response.ok) {
        const status = await response.json();
        // Map the health response to our system status format
        setSystemStatus({
          llm_service: status.initialized,
          voice_recognition: status.initialized,
          vision_system: status.initialized,
          memory_system: status.initialized,
          plugin_system: status.initialized,
          face_recognition: status.initialized
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
          face_recognition: false
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
        face_recognition: false
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: boolean, label: string) => (
    <div className="flex items-center space-x-2">
      <Badge 
        variant={status ? "default" : "secondary"} 
        className="text-xs px-2 py-0.5"
      >
        {label}
      </Badge>
    </div>
  );

  const getBackendStatusBadge = () => {
    if (isChecking) {
      return (
        <Badge variant="secondary" className="text-xs">
          Checking...
        </Badge>
      );
    }
    
    if (backendConnected) {
      return (
        <Badge variant="default" className="text-xs">
          Backend Ready
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-xs">
          Backend Offline
        </Badge>
      );
    }
  };

  return (
    <div className="bg-background border-b border-border/40 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Cog6ToothIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              J.A.R.V.I.S
            </h1>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* System Status Indicators */}
          <div className="hidden md:flex items-center space-x-3">
            {getStatusBadge(systemStatus.llm_service, "LLM")}
            {getStatusBadge(systemStatus.voice_recognition, "Voice")}
            {getStatusBadge(systemStatus.vision_system, "Vision")}
            {getStatusBadge(systemStatus.memory_system, "Memory")}
            {getStatusBadge(systemStatus.plugin_system, "Plugins")}
            {getStatusBadge(systemStatus.face_recognition, "Face Rec")}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Version Info */}
          <Badge variant="secondary" className="text-xs">
            v2.0.0
          </Badge>
          
          {/* AI Assistant Status */}
          <Badge variant="outline" className="text-xs">
            AI Assistant
          </Badge>
          
          {/* Dynamic Backend Status */}
          {getBackendStatusBadge()}
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <BellIcon className="w-4 h-4" />
          </Button>
          
          {/* Settings */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Cog6ToothIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Mobile Status Bar */}
      <div className="md:hidden mt-3 pt-3 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusBadge(systemStatus.llm_service, "LLM")}
            {getStatusBadge(systemStatus.voice_recognition, "Voice")}
            {getStatusBadge(systemStatus.vision_system, "Vision")}
          </div>
          <Badge variant={backendConnected ? "default" : "destructive"} className="text-xs">
            {backendConnected ? "Ready" : "Offline"}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default TopBar; 