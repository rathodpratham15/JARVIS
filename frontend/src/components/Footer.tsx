import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const Footer: React.FC = () => {
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        setIsChecking(true);
        const response = await fetch('http://localhost:8000/api/health');
        if (response.ok) {
          setBackendConnected(true);
        } else {
          setBackendConnected(false);
        }
      } catch (error) {
        console.error('Failed to check backend health:', error);
        setBackendConnected(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
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
          Online
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-xs">
          Offline
        </Badge>
      );
    }
  };

  const getActivityBadge = () => {
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
          Active
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="text-xs">
          Inactive
        </Badge>
      );
    }
  };

  return (
    <footer className="bg-background border-t border-border/40 mt-auto">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              <p>Powered by Advanced AI</p>
              <p className="font-medium">J.A.R.V.I.S v2.0.0</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center space-x-2">
              {getStatusBadge()}
              {getActivityBadge()}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>© 2024 J.A.R.V.I.S AI Assistant</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Built with React & Python</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 