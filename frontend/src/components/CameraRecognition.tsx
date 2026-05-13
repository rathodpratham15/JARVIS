import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface RecognitionResult {
  success: boolean;
  recognized: boolean;
  person?: string;
  confidence?: number;
  message: string;
}

const CameraRecognition: React.FC = () => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cameraStream, setCameraStream] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera stream
  useEffect(() => {
    startCameraStream();
    return () => {
      stopCameraStream();
    };
  }, []);

  const startCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const speakMessage = (message: string) => {
    if (voiceEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      speechSynthesis.speak(utterance);
    }
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || !isStreaming) {
      alert('Camera not available');
      return;
    }

    setIsRecognizing(true);
    setRecognitionResult(null);

    try {
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(videoRef.current, 0, 0, 640, 480);

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Could not capture image');
        }

        // Create form data
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');

        // Send to backend
        const response = await axios.post('/api/camera/recognize', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const result = response.data;
        setRecognitionResult(result);

        // Speak the result if voice is enabled
        if (voiceEnabled && result.message) {
          speakMessage(result.message);
        }

        setIsRecognizing(false);
      }, 'image/jpeg');

    } catch (error) {
      console.error('Recognition error:', error);
      setRecognitionResult({
        success: false,
        recognized: false,
        message: 'Recognition failed'
      });
      setIsRecognizing(false);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
  };

  const resetRecognition = () => {
    setRecognitionResult(null);
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-400">
          🎯 Camera Recognition
        </h2>
        <div className="flex gap-2">
          <button
            onClick={toggleVoice}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              voiceEnabled 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            🔊 {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
          </button>
          <button
            onClick={resetRecognition}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Feed */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-300">
            📹 Live Camera Feed
          </h3>
          
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 object-cover"
            />
            
            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <div className="text-4xl mb-2">📹</div>
                  <div className="text-gray-400">Camera not available</div>
                </div>
              </div>
            )}
            
            {isRecognizing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="text-center">
                  <div className="animate-spin text-4xl mb-2">🔍</div>
                  <div className="text-blue-400">Recognizing...</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={captureAndRecognize}
            disabled={!isStreaming || isRecognizing}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {isRecognizing ? '🔍 Recognizing...' : '🎯 Recognize Face'}
          </button>
        </div>

        {/* Recognition Results */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-300">
            🎯 Recognition Results
          </h3>
          
          <div className="bg-gray-800 rounded-lg p-4 min-h-64">
            {recognitionResult ? (
              <div className="space-y-4">
                <div className={`text-center p-4 rounded-lg ${
                  recognitionResult.recognized 
                    ? 'bg-green-900 border border-green-600' 
                    : 'bg-red-900 border border-red-600'
                }`}>
                  <div className="text-2xl mb-2">
                    {recognitionResult.recognized ? '✅' : '❓'}
                  </div>
                  <div className="text-xl font-semibold mb-2">
                    {recognitionResult.message}
                  </div>
                  
                  {recognitionResult.recognized && recognitionResult.person && (
                    <div className="space-y-2">
                      <div className="text-green-400">
                        👤 {recognitionResult.person}
                      </div>
                      <div className="text-blue-400">
                        🎯 Confidence: {(recognitionResult.confidence! * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-400">
                  <div>🗣️ Voice feedback: {voiceEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div>📹 Camera: {isStreaming ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">🎯</div>
                  <div>Click "Recognize Face" to start</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-lg font-semibold text-blue-300 mb-2">
          📋 Instructions
        </h4>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>• Look at the camera and click "Recognize Face"</li>
          <li>• Voice feedback will announce recognition results</li>
          <li>• Toggle voice on/off with the voice button</li>
          <li>• Reset to clear previous recognition results</li>
          <li>• Works with your known faces: Shah Rukh Khan, Pratham Rathod</li>
        </ul>
      </div>
    </div>
  );
};

export default CameraRecognition; 