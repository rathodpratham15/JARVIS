import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface EmotionResult {
  tone: string;
  confidence: number;
  polarity: number;
  subjectivity: number;
  keywords: string[];
}

const EmotionAnalysisDashboard: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [analysis, setAnalysis] = useState<EmotionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeEmotion = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-emotion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze emotion');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze emotion. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEmotionColor = (tone: string): string => {
    const colors = {
      happy: 'bg-yellow-500',
      sad: 'bg-blue-500',
      angry: 'bg-red-500',
      excited: 'bg-green-500',
      neutral: 'bg-gray-500',
    };
    return colors[tone as keyof typeof colors] || colors.neutral;
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-white">Emotion Analysis</h2>
      
      <div className="mb-6">
        <textarea
          className="w-full h-32 p-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Enter text to analyze emotions..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={analyzeEmotion}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Emotion'}
        </motion.button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500 bg-opacity-20 text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-4">
            <div className={`p-4 rounded-full ${getEmotionColor(analysis.tone)}`} />
            <div>
              <h3 className="text-xl font-semibold text-white">
                Detected Emotion: {analysis.tone.charAt(0).toUpperCase() + analysis.tone.slice(1)}
              </h3>
              <p className="text-gray-400">
                Confidence: {(analysis.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-700 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2">Sentiment Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Polarity</span>
                  <span className="text-white">{analysis.polarity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Subjectivity</span>
                  <span className="text-white">{analysis.subjectivity.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2">Detected Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-600 text-white rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default EmotionAnalysisDashboard; 