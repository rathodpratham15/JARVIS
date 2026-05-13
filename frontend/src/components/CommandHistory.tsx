import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface CommandHistoryProps {
  onBack: () => void;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  user_input: string;
  response: string;
  intent: any;
  success: boolean;
}

const CommandHistory: React.FC<CommandHistoryProps> = ({ onBack }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    filterHistory();
  }, [history, searchTerm, selectedFilter]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard/history?limit=100');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        setError('Failed to load command history');
      }
    } catch (err) {
      setError('Network error loading history');
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterHistory = () => {
    let filtered = [...history];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.user_input.toLowerCase().includes(term) ||
        entry.response.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(entry => {
        const intentType = entry.intent?.type || 'conversation';
        return intentType === selectedFilter;
      });
    }

    setFilteredHistory(filtered);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getIntentColor = (intent: any) => {
    const type = intent?.type || 'conversation';
    const colors = {
      conversation: 'bg-blue-500/20 text-blue-400',
      action: 'bg-green-500/20 text-green-400',
      query: 'bg-purple-500/20 text-purple-400',
      command: 'bg-yellow-500/20 text-yellow-400',
      error: 'bg-red-500/20 text-red-400'
    };
    return colors[type as keyof typeof colors] || colors.conversation;
  };

  const getUniqueIntentTypes = () => {
    const types = new Set(['all']);
    history.forEach(entry => {
      const type = entry.intent?.type || 'conversation';
      types.add(type);
    });
    return Array.from(types);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Command History</h1>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Command History</h1>
            <p className="text-gray-400">
              {filteredHistory.length} of {history.length} interactions
            </p>
          </div>
        </div>
        
        <button
          onClick={fetchHistory}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search commands and responses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none min-w-[150px]"
          >
            {getUniqueIntentTypes().map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-4">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <ClockIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {history.length === 0 
                ? "No command history available yet"
                : "No commands match your search criteria"
              }
            </p>
          </div>
        ) : (
          filteredHistory.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getIntentColor(entry.intent)}`}>
                    {entry.intent?.type || 'conversation'}
                  </span>
                  <span className="text-gray-400 text-sm flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                
                <div className={`w-3 h-3 rounded-full ${entry.success ? 'bg-green-400' : 'bg-red-400'}`}></div>
              </div>

              {/* Conversation */}
              <div className="space-y-4">
                {/* User Input */}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <ChatBubbleLeftEllipsisIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {entry.user_input}
                    </p>
                  </div>
                </div>

                {/* Jarvis Response */}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <ChatBubbleLeftIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {entry.response}
                    </p>
                  </div>
                </div>
              </div>

              {/* Intent Details (if available) */}
              {entry.intent && Object.keys(entry.intent).length > 1 && (
                <details className="mt-4">
                  <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
                    View Intent Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-900/50 rounded-lg">
                    <pre className="text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(entry.intent, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Load More (if needed) */}
      {history.length >= 100 && (
        <div className="text-center">
          <button
            onClick={() => {/* Implement pagination */}}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default CommandHistory;