import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CogIcon,
  LightBulbIcon,
  AcademicCapIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

interface AdvancedAIStatus {
  advanced_conversation: boolean;
  knowledge_base: boolean;
  contextual_memory: boolean;
  multimodal_processor: boolean;
  jarvis_ai_core: boolean;
  conversation_orchestrator: boolean;
}

interface KnowledgeEntry {
  id: string;
  content: string;
  title: string;
  source: string;
  domain: string;
  confidence: number;
  relevance_score: number;
  tags: string[];
}

const AdvancedAIDashboard: React.FC = () => {
  const [aiStatus, setAiStatus] = useState<AdvancedAIStatus>({
    advanced_conversation: false,
    knowledge_base: false,
    contextual_memory: false,
    multimodal_processor: false,
    jarvis_ai_core: false,
    conversation_orchestrator: false
  });
  
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAIStatus();
    const interval = setInterval(fetchAIStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAIStatus = async () => {
    try {
      const response = await fetch('/api/system-status');
      if (response.ok) {
        const data = await response.json();
        setAiStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch AI status:', error);
    }
  };

  const searchKnowledge = async () => {
    if (!knowledgeQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: knowledgeQuery })
      });
      
      if (response.ok) {
        const data = await response.json();
        setKnowledgeResults(data.results || []);
      }
    } catch (error) {
      console.error('Knowledge search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addKnowledge = async (content: string, title: string) => {
    try {
      const response = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          title,
          category: 'manual',
          tags: ['user-added']
        })
      });
      
      if (response.ok) {
        alert('Knowledge added successfully!');
      }
    } catch (error) {
      console.error('Failed to add knowledge:', error);
    }
  };

  const StatusCard: React.FC<{ 
    title: string; 
    status: boolean; 
    icon: React.ComponentType<any>;
    description: string;
  }> = ({ title, status, icon: Icon, description }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-6 rounded-lg border-2 ${
        status ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
      }`}
    >
      <div className="flex items-center space-x-3">
        <Icon className={`h-8 w-8 ${status ? 'text-green-600' : 'text-gray-400'}`} />
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <div className="mt-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {status ? 'Active' : 'Inactive'}
        </span>
      </div>
    </motion.div>
  );

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Advanced AI Dashboard
          </h1>
          <p className="text-gray-400">
            Monitor and interact with J.A.R.V.I.S advanced AI capabilities
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8">
                         {[
               { id: 'overview', name: 'Overview', icon: CpuChipIcon },
               { id: 'knowledge', name: 'Knowledge Base', icon: DocumentTextIcon },
               { id: 'conversation', name: 'Advanced Chat', icon: ChatBubbleLeftRightIcon },
               { id: 'memory', name: 'Contextual Memory', icon: CogIcon }
             ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatusCard
                title="Advanced Conversation"
                status={aiStatus.advanced_conversation}
                icon={ChatBubbleLeftRightIcon}
                description="Multi-turn conversations with context awareness"
              />
              <StatusCard
                title="Knowledge Base"
                status={aiStatus.knowledge_base}
                icon={DocumentTextIcon}
                description="Intelligent knowledge storage and retrieval"
              />
              <StatusCard
                title="Contextual Memory"
                status={aiStatus.contextual_memory}
                icon={CogIcon}
                description="Context-aware memory management"
              />
              <StatusCard
                title="Multimodal Processor"
                status={aiStatus.multimodal_processor}
                icon={GlobeAltIcon}
                description="Process text, images, and audio simultaneously"
              />
                             <StatusCard
                 title="Jarvis AI Core"
                 status={aiStatus.jarvis_ai_core}
                 icon={CpuChipIcon}
                 description="Central AI coordination and reasoning"
               />
              <StatusCard
                title="Conversation Orchestrator"
                status={aiStatus.conversation_orchestrator}
                icon={LightBulbIcon}
                description="Orchestrates all AI components for seamless conversations"
              />
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Advanced AI Capabilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <h4 className="font-medium text-white mb-2">🤖 Intelligent Reasoning</h4>
                  <ul className="space-y-1">
                    <li>• Analytical problem solving</li>
                    <li>• Creative brainstorming</li>
                    <li>• Research and synthesis</li>
                    <li>• Critical thinking</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">🧠 Advanced Memory</h4>
                  <ul className="space-y-1">
                    <li>• Contextual conversation history</li>
                    <li>• Semantic knowledge retrieval</li>
                    <li>• Learning from interactions</li>
                    <li>• Adaptive responses</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">🔍 Knowledge Management</h4>
                  <ul className="space-y-1">
                    <li>• Web search integration</li>
                    <li>• Document processing</li>
                    <li>• Semantic search</li>
                    <li>• Knowledge synthesis</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">🎯 Multimodal Processing</h4>
                  <ul className="space-y-1">
                    <li>• Text + Image analysis</li>
                    <li>• Voice + Visual recognition</li>
                    <li>• Cross-modal understanding</li>
                    <li>• Unified response generation</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'knowledge' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Knowledge Base Search
              </h3>
              <div className="flex space-x-4 mb-6">
                <input
                  type="text"
                  value={knowledgeQuery}
                  onChange={(e) => setKnowledgeQuery(e.target.value)}
                  placeholder="Search knowledge base..."
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={searchKnowledge}
                  disabled={isSearching}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {knowledgeResults.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">
                    Search Results ({knowledgeResults.length})
                  </h4>
                  {knowledgeResults.map((result) => (
                    <div key={result.id} className="bg-gray-700 rounded-lg p-4">
                      <h5 className="font-medium text-white mb-2">{result.title}</h5>
                      <p className="text-gray-300 text-sm mb-2">{result.content}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>Source: {result.source}</span>
                        <span>Domain: {result.domain}</span>
                        <span>Confidence: {(result.confidence * 100).toFixed(1)}%</span>
                      </div>
                      {result.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Advanced Chat Tab */}
        {activeTab === 'conversation' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              Advanced Conversation Engine
            </h3>
            <div className="text-gray-300 space-y-4">
              <p>
                The advanced conversation engine provides ChatGPT/Claude-level capabilities with:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Multi-turn conversation context</li>
                <li>Intelligent reasoning modes</li>
                <li>Tool integration (web search, calculator, etc.)</li>
                <li>Knowledge base integration</li>
                <li>Emotional context awareness</li>
                <li>Personalized responses</li>
              </ul>
              <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-400">
                  💡 Try using the regular chat interface - it now uses the advanced conversation engine!
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Contextual Memory Tab */}
        {activeTab === 'memory' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              Contextual Memory System
            </h3>
            <div className="text-gray-300 space-y-4">
              <p>
                The contextual memory system provides advanced memory capabilities:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Semantic memory retrieval</li>
                <li>Conversation context preservation</li>
                <li>User preference learning</li>
                <li>Adaptive response generation</li>
                <li>Memory consolidation and optimization</li>
              </ul>
              <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-400">
                  🔄 Memory is automatically updated with each conversation
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdvancedAIDashboard; 