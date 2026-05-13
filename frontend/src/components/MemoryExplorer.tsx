import React, { useState, useEffect } from 'react';
import { 
  EyeIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  interaction_count: number;
  session_id: string;
  tags: string[];
  context_id: string;
  user_id: string;
  metadata: Record<string, unknown>;
}

interface Interaction {
  id: string;
  user_input: string;
  response: string;
  timestamp: string;
  session_id: string;
  tags: string[];
  intent_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface MemoryStats {
  total_conversations: number;
  total_interactions: number;
  storage_size_mb: number;
  total_tags: number;
  recent_interactions: number;
  last_activity: string | null;
  cache_size: number;
  user_id: string;
}

interface MemoryItem {
  id: string;
  key: string;
  value: string;
  timestamp: string;
  type: string;
}

interface ConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  interactions: Interaction[];
  loading: boolean;
  onContinueChat?: (conversationId: string, interactions: Interaction[]) => void;
}

const ConversationModal: React.FC<ConversationModalProps> = ({
  isOpen,
  onClose,
  conversation,
  interactions,
  loading,
  onContinueChat
}) => {
  if (!isOpen || !conversation) return null;

  const handleContinueChat = () => {
    if (onContinueChat && conversation) {
      onContinueChat(conversation.id, interactions);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Conversation Details</h2>
          <div className="flex items-center space-x-2">
            {onContinueChat && (
              <button
                onClick={handleContinueChat}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">{conversation.title}</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Created: {new Date(conversation.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(conversation.updated_at).toLocaleString()}</p>
            <p>Interactions: {conversation.interaction_count}</p>
            <p>Session: {conversation.session_id}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {conversation.tags.map((tag, index) => (
                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction, index) => (
              <div key={interaction.id} className="border rounded-lg p-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-1">User Input:</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded">{interaction.user_input}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-1">Assistant Response:</h4>
                      <p className="text-gray-700 bg-blue-50 p-3 rounded">{interaction.response}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(interaction.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MemoryExplorer: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [shortTermMemory, setShortTermMemory] = useState<MemoryItem[]>([]);
  const [longTermMemory, setLongTermMemory] = useState<MemoryItem[]>([]);
  const [sessionMemory, setSessionMemory] = useState<MemoryItem[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [conversationInteractions, setConversationInteractions] = useState<Interaction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  useEffect(() => {
    fetchMemoryData();
  }, []);

  useEffect(() => {
    // Fetch data based on active tab
    switch (activeTab) {
      case 'conversations':
        fetchConversations();
        break;
      case 'short-term':
        fetchShortTermMemory();
        break;
      case 'long-term':
        fetchLongTermMemory();
        break;
      case 'session':
        fetchSessionMemory();
        break;
    }
  }, [activeTab]);

  const fetchMemoryData = async () => {
    try {
      setLoading(true);
      const statsResponse = await fetch('http://localhost:8000/api/memory/stats');
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setMemoryStats(stats);
      }
      
      // Initial data fetch for conversations tab
      await fetchConversations();
    } catch (error) {
      console.error('Error fetching memory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/memory/conversations?limit=50');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchShortTermMemory = async () => {
    try {
      // For now, we'll simulate short-term memory data
      // In the future, this could fetch from a dedicated endpoint
      const mockShortTerm: MemoryItem[] = [
        { id: 'st1', key: 'current_task', value: 'Processing user request', timestamp: new Date().toISOString(), type: 'task' },
        { id: 'st2', key: 'user_context', value: 'User is asking about memory system', timestamp: new Date().toISOString(), type: 'context' },
        { id: 'st3', key: 'session_state', value: 'Active chat session', timestamp: new Date().toISOString(), type: 'state' }
      ];
      setShortTermMemory(mockShortTerm);
    } catch (error) {
      console.error('Error fetching short-term memory:', error);
    }
  };

  const fetchLongTermMemory = async () => {
    try {
      // For now, we'll simulate long-term memory data
      // In the future, this could fetch from a dedicated endpoint
      const mockLongTerm: MemoryItem[] = [
        { id: 'lt1', key: 'user_preferences', value: 'Dark mode enabled', timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'preference' },
        { id: 'lt2', key: 'frequent_topics', value: 'AI, programming, technology', timestamp: new Date(Date.now() - 172800000).toISOString(), type: 'learning' },
        { id: 'lt3', key: 'system_settings', value: 'Voice recognition enabled', timestamp: new Date(Date.now() - 259200000).toISOString(), type: 'setting' }
      ];
      setLongTermMemory(mockLongTerm);
    } catch (error) {
      console.error('Error fetching long-term memory:', error);
    }
  };

  const fetchSessionMemory = async () => {
    try {
      // For now, we'll simulate session memory data
      // In the future, this could fetch from a dedicated endpoint
      const mockSession: MemoryItem[] = [
        { id: 's1', key: 'current_session_id', value: 'session_12345', timestamp: new Date().toISOString(), type: 'session' },
        { id: 's2', key: 'active_conversation', value: 'Memory system discussion', timestamp: new Date().toISOString(), type: 'conversation' },
        { id: 's3', key: 'user_activity', value: 'Navigating memory explorer', timestamp: new Date().toISOString(), type: 'activity' }
      ];
      setSessionMemory(mockSession);
    } catch (error) {
      console.error('Error fetching session memory:', error);
    }
  };

  const fetchConversationInteractions = async (conversationId: string) => {
    try {
      setLoadingInteractions(true);
      const response = await fetch(`http://localhost:8000/api/memory/conversations/${conversationId}/interactions`);
      if (response.ok) {
        const data = await response.json();
        setConversationInteractions(data.interactions || []);
      }
    } catch (error) {
      console.error('Error fetching conversation interactions:', error);
    } finally {
      setLoadingInteractions(false);
    }
  };

  const viewConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowConversationModal(true);
    await fetchConversationInteractions(conversation.id);
  };

  const continueChat = (conversationId: string, interactions: Interaction[]) => {
    // Store the conversation data in localStorage for the chat interface to pick up
    const chatData = {
      conversationId,
      interactions,
      timestamp: Date.now()
    };
    localStorage.setItem('jarvis_continue_chat', JSON.stringify(chatData));
    
    // Navigate to the chat interface
    window.location.href = '/chat';
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/memory/conversations/${conversationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        // Remove from selected conversations if it was selected
        setSelectedConversations(prev => {
          const newSet = new Set(prev);
          newSet.delete(conversationId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const deleteSelectedConversations = async () => {
    try {
      const deletePromises = Array.from(selectedConversations).map(conversationId =>
        fetch(`http://localhost:8000/api/memory/conversations/${conversationId}`, {
          method: 'DELETE'
        })
      );

      await Promise.all(deletePromises);
      
      // Remove deleted conversations from state
      setConversations(prev => prev.filter(conv => !selectedConversations.has(conv.id)));
      setSelectedConversations(new Set());
      setIsMultiSelectMode(false);
      
      // Refresh memory stats
      fetchMemoryData();
    } catch (error) {
      console.error('Error deleting selected conversations:', error);
    }
  };

  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const selectAllConversations = () => {
    setSelectedConversations(new Set(conversations.map(conv => conv.id)));
  };

  const deselectAllConversations = () => {
    setSelectedConversations(new Set());
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'conversations':
        return (
          <div className="space-y-4">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`bg-white rounded-lg shadow p-4 transition-all ${
                  selectedConversations.has(conversation.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      {isMultiSelectMode && (
                        <button
                          onClick={() => toggleConversationSelection(conversation.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedConversations.has(conversation.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {selectedConversations.has(conversation.id) && (
                            <CheckIcon className="h-3 w-3 text-white" />
                          )}
                        </button>
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{conversation.title}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          {formatDate(conversation.created_at)} • Interactions: {conversation.interaction_count}
                        </p>
                        <p className="text-xs text-gray-400 mb-2">Session: {conversation.session_id}</p>
                        <div className="flex flex-wrap gap-1">
                          {conversation.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {!isMultiSelectMode && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => viewConversation(conversation)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View conversation"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => deleteConversation(conversation.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete conversation"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'short-term':
        return (
          <div className="space-y-4">
            {shortTermMemory.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ClockIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">{item.key}</h3>
                    <p className="text-sm text-gray-600 mb-2">{item.value}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">{item.type}</span>
                      <span>{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'long-term':
        return (
          <div className="space-y-4">
            {longTermMemory.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <CpuChipIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">{item.key}</h3>
                    <p className="text-sm text-gray-600 mb-2">{item.value}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">{item.type}</span>
                      <span>{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'session':
        return (
          <div className="space-y-4">
            {sessionMemory.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">{item.key}</h3>
                    <p className="text-sm text-gray-600 mb-2">{item.value}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full">{item.type}</span>
                      <span>{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Memory Statistics */}
      {memoryStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Conversations</h3>
            <p className="text-2xl font-bold text-gray-900">{memoryStats.total_conversations}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Interactions</h3>
            <p className="text-2xl font-bold text-gray-900">{memoryStats.total_interactions}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Storage Size</h3>
            <p className="text-2xl font-bold text-gray-900">{memoryStats.storage_size_mb?.toFixed(2) || '0.00'} MB</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Tags</h3>
            <p className="text-2xl font-bold text-gray-900">{memoryStats.total_tags}</p>
          </div>
        </div>
      )}

      {/* Search and Multi-Select Controls - Only show for conversations tab */}
      {activeTab === 'conversations' && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            {isMultiSelectMode ? (
              <>
                <button
                  onClick={selectAllConversations}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllConversations}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Deselect All
                </button>
                <button
                  onClick={deleteSelectedConversations}
                  disabled={selectedConversations.size === 0}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Selected ({selectedConversations.size})
                </button>
                <button
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedConversations(new Set());
                  }}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsMultiSelectMode(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Multi-Select
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'conversations', label: 'Conversations', icon: ChatBubbleLeftRightIcon },
            { id: 'short-term', label: 'Short-term', icon: ClockIcon },
            { id: 'long-term', label: 'Long-term', icon: CpuChipIcon },
            { id: 'session', label: 'Session', icon: CalendarIcon }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Conversation Modal */}
      <ConversationModal
        isOpen={showConversationModal}
        onClose={() => setShowConversationModal(false)}
        conversation={selectedConversation}
        interactions={conversationInteractions}
        loading={loadingInteractions}
        onContinueChat={continueChat}
      />
    </div>
  );
};

export default MemoryExplorer; 