import React, { useState, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { SceneDescriptionCard } from './SceneDescriptionCard';
import { 
  Upload, 
  Camera, 
  Image as ImageIcon,
  Zap,
  Brain,
  Sparkles,
  RefreshCw,
  Download,
  Grid3x3
} from 'lucide-react';

interface AnalysisResult {
  id: string;
  timestamp: string;
  type: 'scene';
  image_url: string;
  results: {
    scene_description: string;
    confidence: number;
    scene_type?: string;
    mood?: string;
    lighting?: string;
    time_of_day?: string;
    objects?: string[];
    colors?: string[];
  };
}

interface EnhancedSceneAnalysisProps {
  className?: string;
  onAnalysisComplete?: (result: AnalysisResult) => void;
}

export const EnhancedSceneAnalysis: React.FC<EnhancedSceneAnalysisProps> = ({ className = "", onAnalysisComplete }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setAnalysisResult(null);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('type', 'scene');

    try {
      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      setAnalysisResult(result);
      
      // Save to history if callback is provided
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
      
    } catch (err) {
      setError('Failed to analyze image. Please try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Scene Description AI</h1>
            <p className="text-gray-400 text-sm">Advanced visual understanding and analysis</p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      {!selectedImage && (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Upload Image for Analysis</h3>
              <p className="text-gray-400 text-sm">
                Drop an image here or click to select. J.A.R.V.I.S will analyze the scene and provide detailed insights.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Select Image
              </Button>
              
              <Button variant="outline" className="border-gray-600 hover:border-gray-500">
                <Camera className="w-4 h-4 mr-2" />
                Use Camera
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            <div className="text-xs text-gray-500 space-x-4">
              <span>Supports: JPG, PNG, WebP</span>
              <span>•</span>
              <span>Max size: 10MB</span>
            </div>
          </div>
        </Card>
      )}

      {/* Image Preview and Analysis */}
      {selectedImage && (
        <div className="space-y-4">
          {/* Image Preview Card */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Selected Image</h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="border-gray-600 hover:border-gray-500"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
                
                {!analysisResult && (
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Analyze Scene
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Display */}
              <div className="space-y-3">
                <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-700">
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Selected for analysis"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                
                <div className="text-xs text-gray-500 text-center">
                  <span className="font-medium">{selectedImage.name}</span>
                  <span className="mx-2">•</span>
                  <span>{(selectedImage.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              </div>

              {/* Analysis Status */}
              <div className="space-y-4">
                {isAnalyzing && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Brain className="w-4 h-4 text-blue-400 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-300">AI Analysis in Progress</h4>
                        <p className="text-xs text-gray-400">Processing visual information...</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Analyzing scene composition...</span>
                        <span className="text-blue-400">✓</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Detecting objects and entities...</span>
                        <span className="text-blue-400 animate-pulse">○</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Understanding context and mood...</span>
                        <span className="text-gray-500">○</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-red-400">⚠️</span>
                      <span className="font-medium text-red-300">Analysis Failed</span>
                    </div>
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}

                {!isAnalyzing && !analysisResult && !error && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="text-center space-y-2">
                      <Sparkles className="w-8 h-8 text-gray-400 mx-auto" />
                      <h4 className="font-medium text-gray-300">Ready for Analysis</h4>
                      <p className="text-xs text-gray-500">
                        Click "Analyze Scene" to get AI-powered insights about this image
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Analysis Results */}
          {analysisResult && (
            <SceneDescriptionCard
              sceneDescription={analysisResult.results.scene_description}
              confidence={analysisResult.results.confidence}
              sceneType={analysisResult.results.scene_type}
              mood={analysisResult.results.mood}
              lighting={analysisResult.results.lighting}
              timeOfDay={analysisResult.results.time_of_day}
              objects={analysisResult.results.objects}
              colors={analysisResult.results.colors}
              imageUrl={analysisResult.image_url}
              analysisId={analysisResult.id}
              timestamp={analysisResult.timestamp}
            />
          )}
        </div>
      )}
    </div>
  );
};