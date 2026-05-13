// Visual Analysis Type Definitions for J.A.R.V.I.S

export interface AnalysisResult {
  id: string;
  timestamp: string;
  type: 'object' | 'scene' | 'text';
  image_url: string;
  results: {
    // Scene Analysis
    scene_description?: string;
    scene_type?: string;
    mood?: string;
    lighting?: string;
    time_of_day?: string;
    
    // Object Detection
    objects?: string[];
    object_count?: number;
    
    // Color Analysis
    colors?: string[];
    dominant_color?: string;
    
    // Text Recognition
    text_content?: string;
    
    // Metadata
    confidence: number;
    processing_time?: number;
    model_version?: string;
    
    // Additional insights
    composition?: string;
    style?: string;
    setting?: string;
    activity?: string;
    emotions_detected?: string[];
  };
}

export interface AnalysisStats {
  total_analyses: number;
  object_detections: number;
  text_recognitions: number;
  scene_analyses: number;
  last_analysis: string;
  average_confidence?: number;
  processing_time_avg?: number;
}

export interface SceneInsight {
  category: string;
  value: string;
  confidence: number;
  icon: string;
  color: string;
}

export interface AnalysisRequest {
  image: File;
  type: 'object' | 'scene' | 'text';
  options?: {
    detailed?: boolean;
    include_colors?: boolean;
    include_emotions?: boolean;
    language?: string;
  };
}

export interface AnalysisError {
  error: string;
  code?: string;
  details?: string;
  timestamp: string;
}

// UI Component Props
export interface SceneAnalysisProps {
  result: AnalysisResult;
  onAnalyze?: (request: AnalysisRequest) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onShare?: (result: AnalysisResult) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export interface AnalysisCardProps {
  result: AnalysisResult;
  onClick?: () => void;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

// Analysis Configuration
export interface AnalysisConfig {
  maxFileSize: number; // in bytes
  supportedFormats: string[];
  maxImageDimensions: {
    width: number;
    height: number;
  };
  confidenceThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

export const defaultAnalysisConfig: AnalysisConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  maxImageDimensions: {
    width: 2048,
    height: 2048
  },
  confidenceThresholds: {
    low: 0.3,
    medium: 0.6,
    high: 0.8
  }
};