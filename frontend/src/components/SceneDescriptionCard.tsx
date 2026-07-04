import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { 
  Eye, 
  Image as ImageIcon, 
  Clock, 
  Lightbulb,
  Camera,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Share2
} from 'lucide-react';

interface SceneDescriptionCardProps {
  sceneDescription: string;
  confidence: number;
  sceneType?: string;
  mood?: string;
  lighting?: string;
  timeOfDay?: string;
  objects?: string[];
  colors?: string[];
  imageUrl?: string;
  analysisId: string;
  timestamp: string;
  className?: string;
}

export const SceneDescriptionCard: React.FC<SceneDescriptionCardProps> = ({
  sceneDescription,
  confidence,
  sceneType,
  mood,
  lighting,
  timeOfDay,
  objects = [],
  colors = [],
  imageUrl,
  analysisId,
  timestamp,
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyDescription = async () => {
    try {
      await navigator.clipboard.writeText(sceneDescription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'J.A.R.V.I.S Scene Analysis',
          text: sceneDescription,
          url: window.location.href
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400 bg-green-500/10';
    if (confidence >= 0.6) return 'text-yellow-400 bg-yellow-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Header with Confidence Badge */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Scene Analysis</h3>
              <p className="text-sm text-gray-400">AI-powered visual understanding</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
              {getConfidenceLabel(confidence)} • {Math.round(confidence * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Scene Description */}
        <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-700/30">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="font-medium text-purple-300 text-sm">Scene Description</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDescription}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <Copy className="w-3 h-3" />
              </Button>
              {typeof navigator.share === 'function' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <Share2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-gray-200 leading-relaxed text-sm mb-3">
            {sceneDescription}
          </p>
          
          {copied && (
            <div className="text-xs text-green-400 flex items-center space-x-1">
              <span>✓</span>
              <span>Description copied to clipboard</span>
            </div>
          )}
        </div>

        {/* Scene Insights Grid */}
        <div className="grid grid-cols-2 gap-3">
          {sceneType && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 transition-all hover:bg-purple-500/15">
              <div className="flex items-center space-x-2 mb-1">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 text-xs font-medium">Scene Type</span>
              </div>
              <p className="text-white text-sm font-medium">{sceneType}</p>
            </div>
          )}
          
          {mood && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 transition-all hover:bg-yellow-500/15">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-yellow-400 text-sm">😊</span>
                <span className="text-yellow-300 text-xs font-medium">Mood</span>
              </div>
              <p className="text-white text-sm font-medium">{mood}</p>
            </div>
          )}
          
          {lighting && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 transition-all hover:bg-orange-500/15">
              <div className="flex items-center space-x-2 mb-1">
                <Lightbulb className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 text-xs font-medium">Lighting</span>
              </div>
              <p className="text-white text-sm font-medium">{lighting}</p>
            </div>
          )}
          
          {timeOfDay && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 transition-all hover:bg-indigo-500/15">
              <div className="flex items-center space-x-2 mb-1">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span className="text-indigo-300 text-xs font-medium">Time</span>
              </div>
              <p className="text-white text-sm font-medium">{timeOfDay}</p>
            </div>
          )}
        </div>

        {/* Objects and Colors Section */}
        {(objects.length > 0 || colors.length > 0) && (
          <div className="space-y-3">
            {objects.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Camera className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 text-sm font-medium">Objects Detected</span>
                  <span className="text-xs text-gray-500">({objects.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {objects.slice(0, isExpanded ? objects.length : 6).map((obj, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-300 hover:bg-green-500/20 transition-colors"
                    >
                      {obj}
                    </span>
                  ))}
                  {objects.length > 6 && !isExpanded && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(true)}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      +{objects.length - 6} more
                    </Button>
                  )}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-pink-400 to-red-400 rounded-full"></div>
                  <span className="text-pink-300 text-sm font-medium">Dominant Colors</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {colors.slice(0, 5).map((color, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-xs text-pink-300"
                    >
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expandable Detailed Analysis */}
        <div className="border-t border-gray-700/50 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-gray-300"
          >
            <span className="text-xs">
              {isExpanded ? 'Hide' : 'Show'} Technical Details
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
          
          {isExpanded && (
            <div className="mt-3 bg-gray-900/40 rounded-lg p-3 border border-gray-700/30">
              <div className="text-xs text-gray-400 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Analysis Method:</span>
                    <span className="ml-2">Multi-Modal AI Vision</span>
                  </div>
                  <div>
                    <span className="font-medium">Processing Time:</span>
                    <span className="ml-2">~2.3s</span>
                  </div>
                  <div>
                    <span className="font-medium">Model Version:</span>
                    <span className="ml-2">J.A.R.V.I.S v2.1.0</span>
                  </div>
                  <div>
                    <span className="font-medium">Analysis ID:</span>
                    <span className="ml-2 font-mono">{analysisId.slice(0, 8)}...</span>
                  </div>
                  <div>
                    <span className="font-medium">Timestamp:</span>
                    <span className="ml-2">{new Date(timestamp).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Confidence Score:</span>
                    <span className="ml-2">{Math.round(confidence * 100)}% accuracy</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};