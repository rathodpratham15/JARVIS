import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CloudIcon,
  ClockIcon,
  CalendarIcon,
  NewspaperIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  PlayIcon
} from '@heroicons/react/24/outline';

interface QuickCommand {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  command: string;
  color: string;
}

const QuickCommands: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const quickCommands: QuickCommand[] = [
    {
      id: 'weather',
      name: 'Weather',
      description: 'Get current weather information',
      icon: CloudIcon,
      command: 'weather',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'time',
      name: 'Time',
      description: 'Get current time',
      icon: ClockIcon,
      command: 'time',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      id: 'date',
      name: 'Date',
      description: 'Get today\'s date',
      icon: CalendarIcon,
      command: 'date',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      id: 'news',
      name: 'News',
      description: 'Get latest news',
      icon: NewspaperIcon,
      command: 'news',
      color: 'bg-red-500 hover:bg-red-600'
    },
    {
      id: 'status',
      name: 'System Status',
      description: 'Check system status',
      icon: CogIcon,
      command: 'status',
      color: 'bg-gray-500 hover:bg-gray-600'
    },
    {
      id: 'help',
      name: 'Help',
      description: 'Get help information',
      icon: QuestionMarkCircleIcon,
      command: 'help',
      color: 'bg-yellow-500 hover:bg-yellow-600'
    }
  ];

  const executeCommand = async (command: QuickCommand) => {
    setLoading(command.id);
    setLastResult(null);

    try {
      const response = await fetch('/api/dashboard/quick-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: command.command
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setLastResult({
          success: false,
          error: data.error,
          command: command.name
        });
      } else {
        setLastResult({
          success: true,
          command: command.name,
          input: data.input,
          response: data.response,
          timestamp: new Date(data.timestamp * 1000).toLocaleString()
        });
      }
    } catch (error) {
      setLastResult({
        success: false,
        error: 'Failed to execute command',
        command: command.name
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Commands</h2>
          
          {/* Command Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {quickCommands.map((command) => (
              <motion.div
                key={command.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative"
              >
                <button
                  onClick={() => executeCommand(command)}
                  disabled={loading === command.id}
                  className={`w-full p-4 rounded-lg text-white transition-all duration-200 ${command.color} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center space-x-3">
                    <command.icon className="h-6 w-6" />
                    <div className="text-left">
                      <h3 className="font-semibold">{command.name}</h3>
                      <p className="text-sm opacity-90">{command.description}</p>
                    </div>
                  </div>
                  
                  {loading === command.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Result Display */}
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                lastResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  lastResult.success ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {lastResult.command} Command
                  </h4>
                  
                  {lastResult.success ? (
                    <div className="mt-2 space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Input:</span>
                        <p className="text-sm text-gray-800 ml-2">{lastResult.input}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Response:</span>
                        <p className="text-sm text-gray-800 ml-2">{lastResult.response}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Time:</span>
                        <p className="text-sm text-gray-800 ml-2">{lastResult.timestamp}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="text-sm font-medium text-gray-600">Error:</span>
                      <p className="text-sm text-red-600 ml-2">{lastResult.error}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">How to Use</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Click any command button to execute it instantly</li>
              <li>• Commands are processed through JARVIS AI</li>
              <li>• Results are displayed below the command grid</li>
              <li>• You can also use voice commands for these functions</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default QuickCommands; 