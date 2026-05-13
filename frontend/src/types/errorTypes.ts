export interface CodeExample {
  incorrect: string;
  correct: string;
  explanation?: string;
}

export interface ErrorPattern {
  id: string;
  pattern: RegExp;
  language: 'javascript' | 'typescript' | 'react' | 'python' | 'css' | 'html' | 'json' | 'generic';
  category: 'syntax' | 'type' | 'runtime' | 'jsx' | 'logic' | 'performance' | 'security';
  title: string;
  description: string;
  commonCauses: string[];
  example?: CodeExample;
  priority?: number;
  tags?: string[];
}

export interface ErrorAnalysis {
  originalError: string;
  cleanedError: string;
  pattern: ErrorPattern | null;
  timestamp: Date;
  suggestions: string[];
  debuggingSteps: string[];
  followUpQuestion: string;
  relatedErrors: ErrorPattern[];
  confidence: number;
  previousSolution?: string;
  notes?: string;
  codeContext?: {
    file?: string;
    line?: number;
    column?: number;
    snippet?: string;
  };
}

export interface ErrorMemoryItem {
  errorId: string;
  userId: string;
  analysis: ErrorAnalysis;
  resolved: boolean;
  solutionUsed?: string;
  rating?: number; // User rating of solution quality
  feedback?: string;
}

export interface ErrorStats {
  totalErrors: number;
  mostCommonPattern: string;
  recentPatterns: string[];
  resolutionRate: number;
  averageConfidence: number;
}

export interface CodeSnippet {
  language: string;
  code: string;
  lineNumber?: number;
  fileName?: string;
}

export interface DebugSuggestion {
  type: 'fix' | 'improvement' | 'alternative' | 'investigation';
  title: string;
  description: string;
  example?: CodeExample;
  priority: 'high' | 'medium' | 'low';
}

export interface ErrorContext {
  framework?: 'react' | 'vue' | 'angular' | 'vanilla';
  environment?: 'browser' | 'node' | 'deno' | 'bun';
  buildTool?: 'webpack' | 'vite' | 'parcel' | 'rollup';
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  version?: string;
}