import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  TrashIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';

interface TranscriptionResult {
  text: string;
  confidence: number;
  timestamp: number;
}

const VoiceTranscription: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTranscription({
          text: data.text,
          confidence: data.confidence,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      setError('Failed to transcribe audio. Please try again.');
      console.error('Error transcribing audio:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const playRecording = () => {
    if (audioBlob && audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setTranscription(null);
    setError(null);
    if (audioRef.current) {
      audioRef.current.src = '';
    }
  };

  const sendToChat = () => {
    if (transcription?.text) {
      // This would integrate with the chat system
      console.log('Sending to chat:', transcription.text);
      // You could emit an event or call a parent function here
    }
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Voice Transcription</h2>
          
          {/* Recording Controls */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            {!isRecording ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <MicrophoneIcon className="h-6 w-6" />
                <span>Start Recording</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
              >
                <StopIcon className="h-6 w-6" />
                <span>Stop Recording</span>
              </motion.button>
            )}
          </div>

          {/* Recording Status */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Recording...</span>
              </div>
            </motion.div>
          )}

          {/* Audio Playback */}
          {audioBlob && !isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-gray-50 rounded-lg"
            >
              <h3 className="font-semibold text-gray-900 mb-3">Recording Preview</h3>
              <div className="flex items-center space-x-3">
                {!isPlaying ? (
                  <button
                    onClick={playRecording}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    <PlayIcon className="h-5 w-5" />
                    <span>Play</span>
                  </button>
                ) : (
                  <button
                    onClick={stopPlaying}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    <StopIcon className="h-5 w-5" />
                    <span>Stop</span>
                  </button>
                )}
                
                <button
                  onClick={clearRecording}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <TrashIcon className="h-5 w-5" />
                  <span>Clear</span>
                </button>
              </div>
              
              <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
            </motion.div>
          )}

          {/* Transcribe Button */}
          {audioBlob && !isRecording && (
            <div className="text-center mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={transcribeAudio}
                disabled={isProcessing}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Transcribing...</span>
                  </div>
                ) : (
                  <span>Transcribe Audio</span>
                )}
              </motion.button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <p className="text-red-700">{error}</p>
            </motion.div>
          )}

          {/* Transcription Result */}
          {transcription && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Transcription Result</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Confidence: {(transcription.confidence * 100).toFixed(1)}%
                  </span>
                  <button
                    onClick={sendToChat}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    <span>Send to Chat</span>
                  </button>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-800">{transcription.text}</p>
              </div>
              
              <div className="mt-2 text-sm text-gray-600">
                Transcribed at: {new Date(transcription.timestamp).toLocaleString()}
              </div>
            </motion.div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">How to Use</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Click "Start Recording" to begin voice capture</li>
              <li>• Speak clearly into your microphone</li>
              <li>• Click "Stop Recording" when finished</li>
              <li>• Preview your recording before transcribing</li>
              <li>• Click "Transcribe Audio" to convert speech to text</li>
              <li>• Send the transcription to chat for AI processing</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VoiceTranscription; 