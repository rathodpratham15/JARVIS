import React, { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';

interface VoiceVisualizerProps {
  isListening: boolean;
  audioData?: number[];
  className?: string;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isListening,
  audioData = [],
  className = ""
}) => {
  const animationRef = useRef<number>(0);
  const [bars, setBars] = useState<number[]>(new Array(32).fill(0));

  useEffect(() => {
    if (!isListening) {
      // Animate bars down when not listening
      const fadeOut = () => {
        setBars(prev => {
          const newBars = prev.map(bar => Math.max(0, bar * 0.95));
          if (newBars.some(bar => bar > 0.01)) {
            animationRef.current = requestAnimationFrame(fadeOut);
          }
          return newBars;
        });
      };
      animationRef.current = requestAnimationFrame(fadeOut);
    } else {
      // Animate bars when listening
      const animate = () => {
        if (audioData.length > 0) {
          // Use real audio data if available
          const processedData = processAudioData(audioData);
          setBars(processedData);
        } else {
          // Generate animated bars for visual feedback
          setBars(prev => prev.map((_, i) => {
            const base = Math.sin(Date.now() * 0.003 + i * 0.2) * 0.3 + 0.3;
            const random = Math.random() * 0.4;
            return Math.min(1, base + random);
          }));
        }
        
        if (isListening) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, audioData, bars]);

  const processAudioData = (data: number[]): number[] => {
    const bars = new Array(32).fill(0);
    const chunkSize = Math.floor(data.length / 32);
    
    for (let i = 0; i < 32; i++) {
      const start = i * chunkSize;
      const end = start + chunkSize;
      const chunk = data.slice(start, end);
      
      if (chunk.length > 0) {
        const average = chunk.reduce((sum, val) => sum + Math.abs(val), 0) / chunk.length;
        bars[i] = Math.min(1, average * 2); // Normalize and amplify
      }
    }
    
    return bars;
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center space-x-1 h-16">
          {bars.map((height, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isListening 
                  ? 'bg-gradient-to-t from-blue-500 to-cyan-400' 
                  : 'bg-gradient-to-t from-gray-400 to-gray-300'
              }`}
              style={{
                height: `${Math.max(4, height * 60)}px`,
                opacity: isListening ? 0.8 + height * 0.2 : 0.3
              }}
            />
          ))}
        </div>
        
        <div className="text-center">
          <div className={`text-sm font-medium ${
            isListening ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {isListening ? '🎤 Listening...' : '🔇 Voice Inactive'}
          </div>
          {isListening && (
            <div className="text-xs text-gray-400 mt-1">
              Speak clearly for best recognition
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};