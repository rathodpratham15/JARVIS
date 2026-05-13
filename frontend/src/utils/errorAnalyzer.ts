import type { ErrorPattern, ErrorAnalysis } from '../types/errorTypes';

// Common error patterns and their solutions
export const ERROR_PATTERNS: ErrorPattern[] = [
  // JavaScript/TypeScript Syntax Errors
  {
    id: 'missing-brace',
    pattern: /Expected\s+"[{}]"\s+but\s+found\s+"[^"]+"/i,
    language: 'typescript',
    category: 'syntax',
    title: 'Missing Closing Brace',
    description: 'You have an unclosed object, function, or block. The parser expected a closing brace but found something else.',
    commonCauses: [
      'Missing } to close an object literal',
      'Missing } to close a function body',
      'Missing } to close a conditional block',
      'Accidentally using . instead of closing the object'
    ],
    example: {
      incorrect: `const config = {
  recipients: ['+1234567890']
  .map(n => n.trim())  // ❌ ERROR: .map before object closed
}`,
      correct: `const config = {
  recipients: ['+1234567890']
};
config.recipients = config.recipients.map(n => n.trim());

// OR
const config = {
  recipients: ['+1234567890'].map(n => n.trim())
};`
    }
  },
  {
    id: 'unexpected-token',
    pattern: /Unexpected\s+token\s+'([^']+)'/i,
    language: 'javascript',
    category: 'syntax',
    title: 'Unexpected Token',
    description: 'The parser encountered a character or keyword that doesn\'t belong in the current context.',
    commonCauses: [
      'Missing comma between object properties',
      'Missing semicolon after statement',
      'Using reserved keywords incorrectly',
      'Malformed string literals'
    ],
    example: {
      incorrect: `const obj = {
  name: 'John'
  age: 25  // ❌ Missing comma
};`,
      correct: `const obj = {
  name: 'John',
  age: 25  // ✅ Added comma
};`
    }
  },
  {
    id: 'jsx-expression-container',
    pattern: /JSX\s+expressions?\s+must\s+have\s+one\s+parent\s+element/i,
    language: 'react',
    category: 'jsx',
    title: 'JSX Multiple Root Elements',
    description: 'JSX expressions must be wrapped in a single parent element or React Fragment.',
    commonCauses: [
      'Multiple JSX elements without a wrapper',
      'Conditional rendering returning multiple elements',
      'Missing React Fragment wrapper'
    ],
    example: {
      incorrect: `return (
  <h1>Title</h1>
  <p>Content</p>  // ❌ Multiple root elements
);`,
      correct: `return (
  <>
    <h1>Title</h1>
    <p>Content</p>  // ✅ Wrapped in Fragment
  </>
);

// OR
return (
  <div>
    <h1>Title</h1>
    <p>Content</p>
  </div>
);`
    }
  },
  {
    id: 'cannot-read-property',
    pattern: /Cannot\s+read\s+propert(y|ies)\s+'([^']+)'\s+of\s+(undefined|null)/i,
    language: 'javascript',
    category: 'runtime',
    title: 'Cannot Read Property of Undefined/Null',
    description: 'You\'re trying to access a property on an undefined or null value.',
    commonCauses: [
      'Object is not initialized yet',
      'Async data hasn\'t loaded',
      'API response is empty or failed',
      'Typo in property name'
    ],
    example: {
      incorrect: `const user = await fetchUser();
console.log(user.name); // ❌ user might be null`,
      correct: `const user = await fetchUser();
if (user && user.name) {
  console.log(user.name);
}

// OR with optional chaining
console.log(user?.name);

// OR with default value
console.log(user?.name || 'Anonymous');`
    }
  },
  {
    id: 'python-indentation',
    pattern: /IndentationError|expected\s+an\s+indented\s+block/i,
    language: 'python',
    category: 'syntax',
    title: 'Python Indentation Error',
    description: 'Python requires consistent indentation to define code blocks.',
    commonCauses: [
      'Mixing tabs and spaces',
      'Inconsistent indentation levels',
      'Missing indentation after colon',
      'Empty function/class body without pass'
    ],
    example: {
      incorrect: `def my_function():
print("Hello")  # ❌ Not indented
    return True`,
      correct: `def my_function():
    print("Hello")  # ✅ Properly indented
    return True

# For empty functions
def placeholder():
    pass  # ✅ Use pass for empty blocks`
    }
  },
  {
    id: 'typescript-type-error',
    pattern: /Type\s+'([^']+)'\s+is\s+not\s+assignable\s+to\s+type\s+'([^']+)'/i,
    language: 'typescript',
    category: 'type',
    title: 'TypeScript Type Assignment Error',
    description: 'You\'re trying to assign a value of one type to a variable expecting a different type.',
    commonCauses: [
      'Incorrect type annotation',
      'Missing type conversion',
      'Union type not handled properly',
      'Generic type constraints violated'
    ],
    example: {
      incorrect: `interface User {
  name: string;
  age: number;
}

const user: User = {
  name: "John",
  age: "25"  // ❌ String assigned to number
};`,
      correct: `interface User {
  name: string;
  age: number;
}

const user: User = {
  name: "John",
  age: 25  // ✅ Number assigned to number
};

// OR with conversion
const user: User = {
  name: "John",
  age: parseInt("25")  // ✅ Convert string to number
};`
    }
  }
];

// Memory system for storing common user errors
class ErrorMemory {
  private static instance: ErrorMemory;
  private userErrorHistory: Map<string, ErrorAnalysis[]> = new Map();
  private commonErrorFrequency: Map<string, number> = new Map();

  static getInstance(): ErrorMemory {
    if (!ErrorMemory.instance) {
      ErrorMemory.instance = new ErrorMemory();
    }
    return ErrorMemory.instance;
  }

  recordError(userId: string, analysis: ErrorAnalysis): void {
    if (!this.userErrorHistory.has(userId)) {
      this.userErrorHistory.set(userId, []);
    }
    
    this.userErrorHistory.get(userId)!.push({
      ...analysis,
      timestamp: new Date()
    });

    // Track frequency
    const patternId = analysis.pattern?.id || 'unknown';
    this.commonErrorFrequency.set(
      patternId,
      (this.commonErrorFrequency.get(patternId) || 0) + 1
    );

    // Keep only last 50 errors per user
    const userHistory = this.userErrorHistory.get(userId)!;
    if (userHistory.length > 50) {
      this.userErrorHistory.set(userId, userHistory.slice(-50));
    }
  }

  getUserErrorHistory(userId: string, limit: number = 10): ErrorAnalysis[] {
    return this.userErrorHistory.get(userId)?.slice(-limit) || [];
  }

  getMostCommonErrors(limit: number = 10): Array<{ patternId: string; frequency: number }> {
    return Array.from(this.commonErrorFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([patternId, frequency]) => ({ patternId, frequency }));
  }

  getSimilarPastError(userId: string, currentError: string): ErrorAnalysis | null {
    const userHistory = this.userErrorHistory.get(userId) || [];
    return userHistory
      .reverse()
      .find(error => 
        error.originalError.toLowerCase().includes(currentError.toLowerCase()) ||
        currentError.toLowerCase().includes(error.originalError.toLowerCase())
      ) || null;
  }
}

// Main error analyzer class
export class ErrorAnalyzer {
  private memory = ErrorMemory.getInstance();

  analyzeError(errorMessage: string, userId: string = 'default'): ErrorAnalysis {
    const cleanError = this.cleanErrorMessage(errorMessage);
    const matchedPattern = this.findMatchingPattern(cleanError);
    
    const analysis: ErrorAnalysis = {
      originalError: errorMessage,
      cleanedError: cleanError,
      pattern: matchedPattern,
      timestamp: new Date(),
      suggestions: this.generateSuggestions(matchedPattern, cleanError),
      debuggingSteps: this.generateDebuggingSteps(matchedPattern),
      followUpQuestion: this.generateFollowUpQuestion(matchedPattern),
      relatedErrors: this.findRelatedErrors(matchedPattern),
      confidence: matchedPattern ? this.calculateConfidence(matchedPattern, cleanError) : 0.1
    };

    // Check memory for similar past errors
    const similarPastError = this.memory.getSimilarPastError(userId, cleanError);
    if (similarPastError) {
      analysis.previousSolution = similarPastError.suggestions[0];
      analysis.notes = `You encountered a similar error before. The previous solution was: ${similarPastError.suggestions[0]}`;
    }

    // Record this error in memory
    this.memory.recordError(userId, analysis);

    return analysis;
  }

  private cleanErrorMessage(error: string): string {
    return error
      .replace(/at line \d+/gi, '')
      .replace(/column \d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findMatchingPattern(error: string): ErrorPattern | null {
    return ERROR_PATTERNS.find(pattern => pattern.pattern.test(error)) || null;
  }

  private calculateConfidence(pattern: ErrorPattern, error: string): number {
    const match = error.match(pattern.pattern);
    if (!match) return 0.1;

    let confidence = 0.7; // Base confidence for pattern match

    // Increase confidence for exact keyword matches
    if (pattern.category === 'syntax' && /syntax/i.test(error)) confidence += 0.1;
    if (pattern.category === 'type' && /type/i.test(error)) confidence += 0.1;
    if (pattern.language === 'typescript' && /\.tsx?:|TypeScript/i.test(error)) confidence += 0.1;
    if (pattern.language === 'react' && /JSX|React/i.test(error)) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private generateSuggestions(pattern: ErrorPattern | null, error: string): string[] {
    if (!pattern) {
      return [
        'Please share more context about your code, including the lines around where the error occurs.',
        'Check for common syntax issues like missing brackets, semicolons, or quotes.',
        'Make sure all variables are properly declared before use.'
      ];
    }

    const suggestions = [
      `**${pattern.title}**: ${pattern.description}`,
      ...pattern.commonCauses.map(cause => `• Check for: ${cause}`),
    ];

    // Add contextual suggestions based on error content
    if (/line \d+/i.test(error)) {
      suggestions.push('• Look specifically at the mentioned line number and surrounding lines');
    }

    if (/undefined|null/i.test(error)) {
      suggestions.push('• Use optional chaining (?.) or null checks before accessing properties');
    }

    return suggestions;
  }

  private generateDebuggingSteps(pattern: ErrorPattern | null): string[] {
    const baseSteps = [
      'Read the error message carefully to understand what went wrong',
      'Locate the file and line number mentioned in the error',
      'Check the syntax around the error location',
    ];

    if (!pattern) return baseSteps;

    const specificSteps: Record<string, string[]> = {
      syntax: [
        'Use your editor\'s bracket matching to verify all braces are properly closed',
        'Check for missing commas between object properties or array elements',
        'Ensure all strings are properly quoted'
      ],
      type: [
        'Verify the types of all variables involved',
        'Check if you need to convert types (string to number, etc.)',
        'Review the TypeScript compiler output for more details'
      ],
      jsx: [
        'Ensure JSX elements are properly nested',
        'Check that all JSX expressions return a single root element',
        'Verify all JSX tags are properly closed'
      ],
      runtime: [
        'Add null/undefined checks before accessing object properties',
        'Use browser developer tools to inspect variable values',
        'Check if async operations have completed before accessing their results'
      ]
    };

    return [...baseSteps, ...(specificSteps[pattern.category] || [])];
  }

  private generateFollowUpQuestion(pattern: ErrorPattern | null): string {
    if (!pattern) {
      return 'Could you share the relevant code snippet (5-10 lines around the error) so I can provide more specific help?';
    }

    const followUpQuestions: Record<string, string> = {
      'missing-brace': 'Could you share the code around the line mentioned in the error? I\'ll help you find the missing brace.',
      'unexpected-token': 'Please share the code where this error occurs - I can help identify what\'s causing the unexpected token.',
      'jsx-expression-container': 'Can you show me the JSX code that\'s causing this error? I\'ll help you fix the structure.',
      'cannot-read-property': 'What object are you trying to access? Sharing the relevant code will help me suggest the best null-checking approach.',
      'python-indentation': 'Could you paste the Python code with the indentation error? I\'ll help you fix the formatting.',
      'typescript-type-error': 'Please share the TypeScript code and interface definitions involved - I\'ll help resolve the type mismatch.'
    };

    return followUpQuestions[pattern.id] || 
           'Could you share the relevant code section so I can provide more targeted assistance?';
  }

  private findRelatedErrors(pattern: ErrorPattern | null): ErrorPattern[] {
    if (!pattern) return [];

    return ERROR_PATTERNS.filter(p => 
      p.id !== pattern.id && 
      (p.category === pattern.category || p.language === pattern.language)
    ).slice(0, 3);
  }

  generateResponse(analysis: ErrorAnalysis): string {
    const { pattern, suggestions, debuggingSteps, followUpQuestion, confidence, previousSolution } = analysis;

    let response = '';

    // Confidence indicator
    if (confidence > 0.8) {
      response += '🎯 **High Confidence Match**\n\n';
    } else if (confidence > 0.5) {
      response += '🔍 **Likely Match**\n\n';
    } else {
      response += '❓ **Possible Issue**\n\n';
    }

    // Main explanation
    if (pattern) {
      response += `## ${pattern.title}\n\n`;
      response += `${pattern.description}\n\n`;

      // Code example
      if (pattern.example) {
        response += '### 📝 Example\n\n';
        response += '**Problem:**\n```' + pattern.language + '\n' + pattern.example.incorrect + '\n```\n\n';
        response += '**Solution:**\n```' + pattern.language + '\n' + pattern.example.correct + '\n```\n\n';
      }

      // Common causes
      response += '### 🔍 Common Causes\n';
      pattern.commonCauses.forEach(cause => {
        response += `• ${cause}\n`;
      });
      response += '\n';
    }

    // Previous solution if available
    if (previousSolution) {
      response += '💡 **Remember:** You had a similar error before. ' + previousSolution + '\n\n';
    }

    // Suggestions
    response += '### 💡 Suggestions\n';
    suggestions.forEach(suggestion => {
      response += `${suggestion}\n`;
    });
    response += '\n';

    // Debugging steps
    response += '### 🛠️ Debugging Steps\n';
    debuggingSteps.forEach((step, index) => {
      response += `${index + 1}. ${step}\n`;
    });
    response += '\n';

    // Follow-up question
    response += '### 🤔 Next Steps\n';
    response += followUpQuestion;

    return response;
  }

  // Quick error type detection for real-time suggestions
  detectErrorType(message: string): string {
    
    if (/error|exception|failed|cannot|undefined|null/i.test(message)) {
      if (/typescript|type.*not.*assignable/i.test(message)) return 'typescript-type';
      if (/jsx|react|element/i.test(message)) return 'jsx-error';
      if (/syntax|unexpected.*token|missing/i.test(message)) return 'syntax-error';
      if (/cannot.*read.*property|undefined|null/i.test(message)) return 'runtime-error';
      if (/indentation|python/i.test(message)) return 'python-indentation';
      return 'generic-error';
    }

    if (/help|how.*fix|what.*mean|explain/i.test(message)) {
      return 'help-request';
    }

    return 'unknown';
  }

  // Get user's error statistics
  getUserStats(userId: string): { totalErrors: number; mostCommon: string; recentPatterns: string[] } {
    const history = this.memory.getUserErrorHistory(userId, 20);
    const patterns = history.map(h => h.pattern?.id || 'unknown');
    const patternCounts = patterns.reduce((acc, pattern) => {
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(patternCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    return {
      totalErrors: history.length,
      mostCommon,
      recentPatterns: [...new Set(patterns.slice(-5))]
    };
  }
}

// Export singleton instance
export const errorAnalyzer = new ErrorAnalyzer();