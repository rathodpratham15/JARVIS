import { useState, useEffect } from 'react';
import { CameraIcon } from '@heroicons/react/24/outline';
import { EnhancedSceneAnalysis } from './EnhancedSceneAnalysis';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Brain, 
  Eye, 
  FileText, 
  Sparkles,
  TrendingUp,
  Activity,
  RefreshCw
} from 'lucide-react';

interface AnalysisResult {
  id: string;
  timestamp: string;
  type: 'object' | 'scene' | 'text';
  image_url: string;
  results: {
    objects?: string[];
    scene_description?: string;
    text_content?: string;
    confidence: number;
    scene_type?: string;
    mood?: string;
    lighting?: string;
    time_of_day?: string;
    colors?: string[];
  };
}

interface AnalysisStats {
  total_analyses: number;
  object_detections: number;
  text_recognitions: number;
  scene_analyses: number;
  last_analysis: string;
}

export default function VisualAnalysisDashboard() {
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [stats, setStats] = useState<AnalysisStats>({
    total_analyses: 0,
    object_detections: 0,
    text_recognitions: 0,
    scene_analyses: 0,
    last_analysis: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  // Function to parse AI analysis results from scene_description
  const parseAIResponse = (sceneDescription: string) => {
    try {
      console.log('Raw scene_description received:', sceneDescription);
      
      // Remove markdown code blocks if present
      let jsonStr = sceneDescription;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/, '').replace(/\s*```/, '');
      }
      
      // Try to parse as JSON first
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // If direct JSON parsing fails, try to extract JSON from the string
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found');
        }
      }
      
      console.log('Parsed AI response:', parsed);
      
      return {
        description: parsed.description || sceneDescription,
        confidence: parsed.confidence || 0.85,
        scene_type: parsed.scene_type || 'unknown',
        mood: parsed.mood || 'neutral',
        colors: parsed.colors || [],
        objects: parsed.objects_detected || parsed.objects || [],
        lighting: parsed.lighting,
        time_of_day: parsed.time_of_day
      };
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      console.log('Scene description that failed to parse:', sceneDescription);
      
      // Fallback: try to extract key information using regex
      const fallbackData: {
        description: string;
        confidence: number;
        scene_type: string;
        mood: string;
        colors: string[];
        objects: string[];
        lighting?: string;
        time_of_day?: string;
      } = {
        description: sceneDescription,
        confidence: 0.85,
        scene_type: 'unknown',
        mood: 'neutral',
        colors: [],
        objects: [],
        lighting: undefined,
        time_of_day: undefined
      };
      
      // Try to extract description
      const descMatch = sceneDescription.match(/"description":\s*"([^"]+)"/);
      if (descMatch) {
        fallbackData.description = descMatch[1];
      }
      
      // Try to extract objects
      const objectsMatch = sceneDescription.match(/"objects_detected":\s*\[([^\]]+)\]/);
      if (objectsMatch) {
        fallbackData.objects = objectsMatch[1].split(',').map(obj => obj.trim().replace(/"/g, ''));
      }
      
      // Try to extract colors
      const colorsMatch = sceneDescription.match(/"colors":\s*\[([^\]]+)\]/);
      if (colorsMatch) {
        fallbackData.colors = colorsMatch[1].split(',').map(color => color.trim().replace(/"/g, ''));
      }
      
      // Try to extract scene type and mood
      const typeMatch = sceneDescription.match(/"scene_type":\s*"([^"]+)"/);
      if (typeMatch) {
        fallbackData.scene_type = typeMatch[1];
      }
      
      const moodMatch = sceneDescription.match(/"mood":\s*"([^"]+)"/);
      if (moodMatch) {
        fallbackData.mood = moodMatch[1];
      }
      
      return fallbackData;
    }
  };

  useEffect(() => {
    fetchAnalysisHistory();
    fetchStats();
  }, []);

  const fetchAnalysisHistory = async () => {
    try {
      // First try to get from localStorage
      const localHistory = localStorage.getItem('jarvis_vision_history');
      if (localHistory) {
        const parsedHistory = JSON.parse(localHistory);
        setAnalysisHistory(parsedHistory);
        // Update stats based on local data
        updateStatsFromHistory(parsedHistory);
        setLoading(false);
        return;
      }

      // Fallback to API if no local data
      const response = await fetch('/api/vision/history');
      if (!response.ok) throw new Error('Failed to fetch analysis history');
      const data = await response.json();
      setAnalysisHistory(data.history || []);
    } catch (err) {
      setError('Failed to load analysis history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Calculate stats from local history first
      const localHistory = localStorage.getItem('jarvis_vision_history');
      if (localHistory) {
        const parsedHistory = JSON.parse(localHistory);
        updateStatsFromHistory(parsedHistory);
        return;
      }

      // Fallback to API
      const response = await fetch('/api/vision/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.stats || data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Update stats based on local history data
  const updateStatsFromHistory = (history: AnalysisResult[]) => {
    const totalAnalyses = history.length;
    const objectDetections = history.filter(item => item.type === 'object').length;
    const textRecognitions = history.filter(item => item.type === 'text').length;
    const sceneAnalyses = history.filter(item => item.type === 'scene').length;
    const lastAnalysis = history.length > 0 ? history[0].timestamp : '';

    setStats({
      total_analyses: totalAnalyses,
      object_detections: objectDetections,
      text_recognitions: textRecognitions,
      scene_analyses: sceneAnalyses,
      last_analysis: lastAnalysis,
    });
  };

  // Save new analysis result to history
  // This function is used by other components to save analysis results
  const saveAnalysisResult = (result: AnalysisResult) => {
    const existingHistory = localStorage.getItem('jarvis_vision_history');
    let history = existingHistory ? JSON.parse(existingHistory) : [];
    
    // Add new result at the beginning
    history.unshift(result);
    
    // Keep only last 50 results to prevent localStorage from getting too large
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    
    // Save to localStorage
    localStorage.setItem('jarvis_vision_history', JSON.stringify(history));
    
    // Update state
    setAnalysisHistory(history);
    updateStatsFromHistory(history);
  };

  // Demo function to add sample data (for testing)
  const addDemoAnalysis = () => {
    const demoResult: AnalysisResult = {
      id: `demo_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'scene',
      image_url: 'https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Demo+Image',
      results: {
        scene_description: 'A beautiful landscape with mountains and trees',
        confidence: 0.92,
        scene_type: 'landscape',
        mood: 'peaceful',
        lighting: 'natural',
        time_of_day: 'afternoon',
        colors: ['blue', 'green', 'brown'],
        objects: ['mountain', 'tree', 'sky']
      }
    };
    saveAnalysisResult(demoResult);
  };

  // Clear analysis history
  const clearAnalysisHistory = () => {
    if (window.confirm('Are you sure you want to clear all analysis history? This action cannot be undone.')) {
      localStorage.removeItem('jarvis_vision_history');
      setAnalysisHistory([]);
      setStats({
        total_analyses: 0,
        object_detections: 0,
        text_recognitions: 0,
        scene_analyses: 0,
        last_analysis: '',
      });
    }
  };

  // Export analysis history
  const exportAnalysisHistory = () => {
    const dataStr = JSON.stringify(analysisHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jarvis_vision_history_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Enhanced Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Visual Analysis System
            </h1>
            <p className="text-gray-400">AI-powered scene understanding and object recognition</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg max-w-2xl mx-auto">
            {error}
          </div>
        )}
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total Analyses</p>
              <p className="text-2xl font-bold text-white">{stats.total_analyses}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Object Detections</p>
              <p className="text-2xl font-bold text-white">{stats.object_detections}</p>
            </div>
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <CameraIcon className="w-5 h-5 text-green-400" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">Scene Analyses</p>
              <p className="text-2xl font-bold text-white">{stats.scene_analyses}</p>
            </div>
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-300 text-sm font-medium">Text Recognition</p>
              <p className="text-2xl font-bold text-white">{stats.text_recognitions}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Interface with Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'new' | 'history')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="new" className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>New Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>Analysis History</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="mt-6">
          <EnhancedSceneAnalysis onAnalysisComplete={saveAnalysisResult} />
        </TabsContent>
        
        <TabsContent value="history" className="mt-6">
          {/* Analysis History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recent Analyses</h3>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={fetchAnalysisHistory}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={exportAnalysisHistory}>
                  📥 Export
                </Button>
                <Button variant="outline" size="sm" onClick={clearAnalysisHistory} className="text-red-400 hover:text-red-300">
                  🗑️ Clear
                </Button>
              </div>
            </div>
            
            {/* History Summary */}
            {analysisHistory.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-4 mb-4 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">Total Analyses:</span>
                      <span className="text-lg font-bold text-white">{analysisHistory.length}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">Latest:</span>
                      <span className="text-sm text-white">
                        {analysisHistory.length > 0 ? new Date(analysisHistory[0].timestamp).toLocaleDateString() : 'None'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Click "View Details" on any card to expand
                  </div>
                </div>
              </div>
            )}
            
            {analysisHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No Analysis History Yet</h3>
                <p className="text-gray-400 mb-4">Start by analyzing an image to build your visual analysis history</p>
                <div className="flex items-center justify-center space-x-3">
                  <Button onClick={() => setActiveTab('new')} className="bg-blue-500 hover:bg-blue-600">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start New Analysis
                  </Button>
                  <Button onClick={addDemoAnalysis} variant="outline" className="text-purple-400 hover:text-purple-300">
                    🎭 Add Demo Data
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {analysisHistory.map((result) => (
                  <div
                    key={result.id}
                    className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors"
                  >
                    {/* Compact Header */}
                    <div className="flex items-start space-x-3 mb-3">
                      <div className="aspect-square w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0">
                        {result.image_url ? (
                          <img
                            src={result.image_url}
                            alt="Analysis result"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <div className="text-2xl mb-1">📷</div>
                              <div className="text-xs">No image</div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize text-white">{result.type} Analysis</span>
                          <span className="text-xs text-gray-400">
                            {new Date(result.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Quick Stats Row */}
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs text-gray-400">
                            {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span className="text-xs text-blue-400">
                              {Math.round(result.results.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Quick Preview Tags */}
                        {(() => {
                          const parsed = parseAIResponse(result.results.scene_description || '');
                          return (
                            <div className="flex flex-wrap gap-1">
                              {parsed.scene_type && (
                                <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-300 rounded-full">
                                  {parsed.scene_type}
                                </span>
                              )}
                              {parsed.mood && (
                                <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-300 rounded-full">
                                  {parsed.mood}
                                </span>
                              )}
                              {parsed.objects.length > 0 && (
                                <span className="text-xs px-2 py-1 bg-green-500/10 text-green-300 rounded-full">
                                  {parsed.objects.length} objects
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Expandable Details Section */}
                    <details className="group">
                      <summary className="cursor-pointer text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors flex items-center justify-between py-2 border-t border-gray-700/50">
                        <span>View Details</span>
                        <span className="text-xs opacity-60 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      
                      <div className="pt-3 space-y-3 border-t border-gray-700/30">
                        {/* Scene Description Preview */}
                        {result.results.scene_description && (
                          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <span className="text-blue-400 text-xs">🎯</span>
                              </div>
                              <p className="font-medium text-blue-300 text-sm">Scene Analysis</p>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-300">
                              {(() => {
                                const parsed = parseAIResponse(result.results.scene_description || '');
                                return parsed.description.length > 120 
                                  ? parsed.description.slice(0, 120) + '...'
                                  : parsed.description;
                              })()}
                            </p>
                          </div>
                        )}
                        
                        {/* Objects Preview */}
                        {(() => {
                          const parsed = parseAIResponse(result.results.scene_description || '');
                          return parsed.objects.length > 0 && (
                            <div>
                              <p className="font-medium text-green-300 mb-1 text-sm">🔍 Objects</p>
                              <div className="flex flex-wrap gap-1">
                                {parsed.objects.slice(0, 5).map((obj: string, i: number) => (
                                  <span key={i} className="text-xs px-2 py-1 bg-green-500/10 rounded-full">
                                    {obj}
                                  </span>
                                ))}
                                {parsed.objects.length > 5 && (
                                  <span className="text-xs text-gray-500">+{parsed.objects.length - 5} more</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Colors Preview */}
                        {(() => {
                          const parsed = parseAIResponse(result.results.scene_description || '');
                          return parsed.colors.length > 0 && (
                            <div>
                              <p className="font-medium text-pink-300 mb-1 text-sm">🎨 Colors</p>
                              <div className="flex flex-wrap gap-1">
                                {parsed.colors.slice(0, 5).map((color: string, i: number) => (
                                  <span key={i} className="text-xs px-2 py-1 bg-pink-500/10 rounded-full">
                                    {color}
                                  </span>
                                ))}
                                {parsed.colors.length > 5 && (
                                  <span className="text-xs text-gray-500">+{parsed.colors.length - 5} more</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => setSelectedResult(result)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                          >
                            <span>🔍</span>
                            <span>Full View</span>
                          </button>
                          <button
                            onClick={() => {
                              const parsed = parseAIResponse(result.results.scene_description || '');
                              navigator.clipboard.writeText(parsed.description);
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                          >
                            <span>📋</span>
                            <span>Copy Text</span>
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Result Details Modal */}
      {selectedResult && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedResult(null)}
        >
          <div
            className="bg-gray-900 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white capitalize">{selectedResult.type} Analysis</h2>
                  <p className="text-gray-400 text-sm">
                    {new Date(selectedResult.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Image */}
              <div className="space-y-4">
                <div className="bg-black rounded-xl overflow-hidden">
                  {selectedResult.image_url ? (
                    <img
                      src={selectedResult.image_url}
                      alt="Analysis result"
                      className="w-full h-auto object-cover"
                    />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-6xl mb-4">📷</div>
                        <div className="text-lg">No image available</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Quick Stats */}
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <h3 className="text-lg font-semibold text-white mb-3">Analysis Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {Math.round(selectedResult.results.confidence * 100)}%
                      </div>
                      <div className="text-sm text-gray-400">Confidence</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {(() => {
                          try {
                            const parsed = parseAIResponse(selectedResult.results.scene_description || '');
                            return parsed.objects.length;
                          } catch {
                            // Fallback: try to extract objects from JSON string
                            const sceneDesc = selectedResult.results.scene_description || '';
                            if (sceneDesc.includes('"objects_detected"')) {
                              try {
                                const jsonMatch = sceneDesc.match(/"objects_detected":\s*\[([^\]]+)\]/);
                                if (jsonMatch) {
                                  const objects = jsonMatch[1].split(',').map(obj => obj.trim().replace(/"/g, ''));
                                  return objects.length;
                                }
                              } catch (e) {
                                console.warn('Failed to extract objects from JSON string:', e);
                              }
                            }
                            return 0;
                          }
                        })()}
                      </div>
                      <div className="text-sm text-gray-400">Objects</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Analysis Details */}
              <div className="space-y-4">
                {/* Main Scene Description */}
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 text-sm">✨</span>
                    </div>
                    <h3 className="text-lg font-semibold text-blue-300">Scene Description</h3>
                  </div>
                  <p className="text-gray-200 leading-relaxed text-sm">
                    {(() => {
                      try {
                        const parsed = parseAIResponse(selectedResult.results.scene_description || '');
                        return parsed.description;
                      } catch {
                        // If parsing fails, try to extract description from JSON string
                        const sceneDesc = selectedResult.results.scene_description || '';
                        if (sceneDesc.includes('"description"')) {
                          try {
                            const jsonMatch = sceneDesc.match(/"description":\s*"([^"]+)"/);
                            if (jsonMatch) {
                              return jsonMatch[1];
                            }
                          } catch (e) {
                            console.warn('Failed to extract description from JSON string:', e);
                          }
                        }
                        return selectedResult.results.scene_description || 'No description available';
                      }
                    })()}
                  </p>
                </div>

                {/* Key Insights Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const parsed = parseAIResponse(selectedResult.results.scene_description || '');
                    return (
                      <>
                        {parsed.scene_type && (
                          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-purple-400 text-sm">🏷️</span>
                              <span className="text-purple-300 text-xs font-medium uppercase">Type</span>
                            </div>
                            <p className="text-white font-semibold">{parsed.scene_type}</p>
                          </div>
                        )}
                        
                        {parsed.mood && (
                          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-yellow-400 text-sm">😊</span>
                              <span className="text-yellow-300 text-xs font-medium uppercase">Mood</span>
                            </div>
                            <p className="text-white font-semibold">{parsed.mood}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Objects Detected */}
                {(() => {
                  const parsed = parseAIResponse(selectedResult.results.scene_description || '');
                  return parsed.objects.length > 0 && (
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-green-400 text-sm">🔍</span>
                        <span className="text-green-300 font-medium">Objects Detected</span>
                        <span className="text-green-400 text-xs bg-green-500/20 px-2 py-1 rounded-full">
                          {parsed.objects.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parsed.objects.map((obj: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm text-green-200 font-medium"
                          >
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Colors Detected */}
                {(() => {
                  const parsed = parseAIResponse(selectedResult.results.scene_description || '');
                  return parsed.colors.length > 0 && (
                    <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/10 border border-pink-500/20 rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-pink-400 text-sm">🎨</span>
                        <span className="text-pink-300 font-medium">Colors</span>
                        <span className="text-pink-400 text-xs bg-pink-500/20 px-2 py-1 rounded-full">
                          {parsed.colors.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parsed.colors.map((color: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 bg-pink-500/20 border border-pink-500/30 rounded-full text-sm text-pink-200 font-medium"
                          >
                            {color}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    onClick={() => {
                      const parsed = parseAIResponse(selectedResult.results.scene_description || '');
                      navigator.clipboard.writeText(parsed.description);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors border border-blue-500/30"
                  >
                    <span>📋</span>
                    <span>Copy Description</span>
                  </button>
                  <button
                    onClick={() => {
                      const dataStr = JSON.stringify(selectedResult, null, 2);
                      navigator.clipboard.writeText(dataStr);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors border border-gray-500/30"
                  >
                    <span>📄</span>
                    <span>Copy JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 