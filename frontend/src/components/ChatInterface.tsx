import React, { useState, useEffect, useRef } from 'react';
import { Socket, io } from 'socket.io-client';
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon, 
  PhotoIcon,
  SparklesIcon,
  UserIcon,
  CpuChipIcon,
  CodeBracketIcon,
  BugAntIcon,
  LightBulbIcon,
  ClipboardDocumentCheckIcon,
  StopIcon,
  PlayIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { errorAnalyzer } from '../utils/errorAnalyzer';
import type { ErrorAnalysis } from '../types/errorTypes';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'jarvis';
  timestamp: Date;
  isTyping?: boolean;
  isErrorAnalysis?: boolean;
  errorAnalysis?: ErrorAnalysis;
  codeSnippet?: string;
  isCodeError?: boolean;
}

interface BackendStatus {
  initialized: boolean;
  modules: string[];
}

interface BackendHealth {
  initialized: boolean;
  modules: string[];
}

// Web Speech API type declarations
interface SpeechRecognitionEvent {
  results: unknown;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

// Enhanced voice input hook with recording capabilities
const useEnhancedVoiceInput = ({ onResult, onError }: {
  onResult: (text: string) => void;
  onError: (error: string) => void;
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const [showVoiceControls, setShowVoiceControls] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Check if MediaRecorder is supported
  const isSupported = 'MediaRecorder' in window;

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isRecording]);

  // Audio visualization animation
  const animateAudioLevels = () => {
    if (!isRecording || !analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Process audio data for visualization
    const bars = new Array(32).fill(0);
    const chunkSize = Math.floor(dataArray.length / 32);
    
    for (let i = 0; i < 32; i++) {
      const start = i * chunkSize;
      const end = start + chunkSize;
      const chunk = dataArray.slice(start, end);
      
      if (chunk.length > 0) {
        const average = chunk.reduce((sum, val) => sum + val, 0) / chunk.length;
        bars[i] = Math.min(1, average / 128); // Normalize to 0-1
      }
    }
    
    setAudioLevels(bars);
    
    if (isRecording) {
      animationRef.current = requestAnimationFrame(animateAudioLevels);
    }
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setRecordingDuration(0);
      setAudioLevels(new Array(32).fill(0));
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Set up audio analysis for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setShowVoiceControls(true);
        
        // Clear timer and animation
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        
        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Start audio visualization
      animateAudioLevels();
    } catch (err) {
      onError('Failed to access microphone. Please check permissions.');
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer and animation
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);

    try {
      // For now, we'll use the Web Speech API as a fallback
      // In a real implementation, you'd send the audio to your backend
      // @ts-expect-error - Web Speech API types not available in standard TypeScript
      const SpeechRecognition = (window as unknown).SpeechRecognition || (window as unknown).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = (event.results as { [key: number]: { [key: number]: { transcript: string } } })[0][0].transcript;
          
          // Auto-send the transcription
          onResult(transcript);
          setShowVoiceControls(false);
          setAudioBlob(null);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          onError(event.error);
          setIsProcessing(false);
        };

        recognition.onend = () => {
          setIsProcessing(false);
        };

        recognition.start();
      } else {
        // Fallback: create a mock transcription for demo purposes
        setTimeout(() => {
          const mockText = "Voice input processed successfully";
          onResult(mockText);
          setShowVoiceControls(false);
          setAudioBlob(null);
          setIsProcessing(false);
        }, 1000);
      }
    } catch (err) {
      onError('Failed to transcribe audio. Please try again.');
      setIsProcessing(false);
      console.error('Error transcribing audio:', err);
    }
  };

  const playRecording = () => {
    if (audioBlob && audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;
      audioRef.current.play();
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setShowVoiceControls(false);
    if (audioRef.current) {
      audioRef.current.src = '';
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else if (audioBlob) {
      transcribeAudio();
    } else {
      startRecording();
    }
  };

  return { 
    isRecording, 
    isProcessing, 
    isSupported, 
    audioBlob, 
    showVoiceControls,
    recordingDuration,
    toggleVoiceInput, 
    playRecording, 
    clearRecording,
    audioRef,
    audioLevels
  };
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ initialized: false, modules: [] });
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [showImageUpload, setShowImageUpload] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef<number>(1);

  // Backend API configuration
  const BACKEND_URL = '';

  // Enhanced voice input hook
  const {
    isRecording,
    isProcessing,
    isSupported: isVoiceSupported,
    audioBlob,
    showVoiceControls,
    recordingDuration,
    toggleVoiceInput,
    playRecording,
    clearRecording,
    audioRef,
    audioLevels
  } = useEnhancedVoiceInput({
    onResult: (text) => {
      setInput(text);
      // Auto-send voice input
      sendMessage(text);
    },
    onError: (error) => {
      console.error('Voice input error:', error);
      setMessages(prev => [...prev, {
        id: messageIdRef.current++,
        text: `🎤 Voice input error: ${error}`,
        sender: 'jarvis',
        timestamp: new Date(),
      }]);
    }
  });

  useEffect(() => {
    // Check for continued conversation from memory
    const continuedChatData = localStorage.getItem('jarvis_continue_chat');
    if (continuedChatData) {
      try {
        const chatData = JSON.parse(continuedChatData);
        const { interactions } = chatData;
        
        // Convert interactions to messages
        const conversationMessages: Message[] = interactions.map((interaction: { user_input: string; response: string; timestamp: string }) => [
          {
            id: messageIdRef.current++,
            text: interaction.user_input,
            sender: 'user' as const,
            timestamp: new Date(interaction.timestamp),
          },
          {
            id: messageIdRef.current++,
            text: interaction.response,
            sender: 'jarvis' as const,
            timestamp: new Date(interaction.timestamp),
          }
        ]).flat();
        
        setMessages(conversationMessages);
        
        // Clear the localStorage data
        localStorage.removeItem('jarvis_continue_chat');
        
        // Show a notification that conversation was loaded
        setMessages(prev => [...prev, {
          id: messageIdRef.current++,
          text: '🔄 Continued conversation from memory',
          sender: 'jarvis',
          timestamp: new Date(),
        }]);
        
      } catch (error) {
        console.error('Error loading continued conversation:', error);
      }
    }
    
    // Initialize socket connection
    initializeSocket();
    
    // Check backend health
    checkBackendHealth();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSocket = () => {
    try {
    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
        console.log('Connected to backend');
      setConnectionStatus('connected');
    });

    socketRef.current.on('disconnect', () => {
        console.log('Disconnected from backend');
      setConnectionStatus('disconnected');
    });

    socketRef.current.on('chat_response', (data) => {
        setMessages(prev => [...prev, {
        id: messageIdRef.current++,
        text: data.response,
        sender: 'jarvis',
          timestamp: new Date(),
        }]);
      setIsLoading(false);
    });

    socketRef.current.on('error', (data) => {
        setMessages(prev => [...prev, {
        id: messageIdRef.current++,
          text: `❌ Error: ${data.message}`,
        sender: 'jarvis',
        timestamp: new Date(),
        }]);
      setIsLoading(false);
    });

      socketRef.current.on('status', (data) => {
        setBackendStatus(data);
      });

    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setConnectionStatus('disconnected');
    }
  };

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (response.ok) {
        const health: BackendHealth = await response.json();
      setBackendStatus({
          initialized: health.initialized,
          modules: health.modules || []
      });
      }
    } catch (error) {
      console.error('Failed to check backend health:', error);
    }
  };

  const sendMessage = (messageText: string) => {
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: messageIdRef.current++,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Check if this looks like a code error before sending to backend
    const errorType = errorAnalyzer.detectErrorType(messageText);
    if (errorType !== 'unknown' && errorType !== 'help-request' && 
        (messageText.toLowerCase().includes('error') || 
         messageText.toLowerCase().includes('exception') ||
         messageText.toLowerCase().includes('failed') ||
         messageText.toLowerCase().includes('cannot'))) {
      
      // Perform local error analysis
      const analysis = errorAnalyzer.analyzeError(messageText, 'default');
      const analysisResponse = errorAnalyzer.generateResponse(analysis);

      const errorAnalysisMessage: Message = {
      id: messageIdRef.current++,
        text: analysisResponse,
      sender: 'jarvis',
      timestamp: new Date(),
        isErrorAnalysis: true,
        errorAnalysis: analysis,
        isCodeError: true
      };

      setTimeout(() => {
        setMessages(prev => [...prev, errorAnalysisMessage]);
        setIsLoading(false);
      }, 1000); // Small delay for better UX

      return; // Don't send to backend for now, use local analysis
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('chat_message', {
        message: messageText,
        user_id: 'default'
      });
      } else {
      // Fallback to HTTP API
      fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          message: messageText,
          user_id: 'default'
        }),
      })
      .then(response => response.json())
      .then(data => {
        setMessages(prev => [...prev, {
          id: messageIdRef.current++,
          text: data.response || 'Sorry, I encountered an error processing your message.',
          sender: 'jarvis',
          timestamp: new Date(),
        }]);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error sending message:', error);
        setMessages(prev => [...prev, {
        id: messageIdRef.current++,
          text: '❌ Failed to send message. Please try again.',
        sender: 'jarvis',
        timestamp: new Date(),
        }]);
      setIsLoading(false);
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const formatMessage = (text: string, isErrorAnalysis?: boolean) => {
    // Split text into paragraphs and format
    const paragraphs = text.split('\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      // Handle headers (###, ##, #)
      const headerMatch = paragraph.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const HeaderTag = `h${level + 2}` as 'h3' | 'h4' | 'h5';
        const headerClass = level === 1 ? 'text-lg font-bold text-gray-900 mb-3' :
                           level === 2 ? 'text-base font-semibold text-gray-800 mb-2' :
                           'text-sm font-medium text-gray-700 mb-1';
        
        return React.createElement(HeaderTag, {
          key: index,
          className: headerClass
        }, headerMatch[2]);
      }

      // Handle code blocks
      if (paragraph.startsWith('```')) {
        return null; // Will be handled as part of code block processing
      }

      // Check if it's a numbered list item
      const numberedMatch = paragraph.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        return (
          <div key={index} className="flex items-start space-x-3 mb-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              {numberedMatch[1]}
            </span>
            <span className="flex-1">{numberedMatch[2]}</span>
          </div>
        );
      }

      // Check if it's a bullet point
      const bulletMatch = paragraph.match(/^[•·*-]\s+(.+)$/);
      if (bulletMatch) {
        return (
          <div key={index} className="flex items-start space-x-3 mb-1">
            <span className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full mt-2"></span>
            <span className="flex-1">{bulletMatch[1]}</span>
          </div>
        );
      }
      
      // Check if it's a bold text
      const boldMatch = paragraph.match(/\*\*(.+?)\*\*/g);
      if (boldMatch) {
        let formattedText = paragraph;
        boldMatch.forEach(match => {
          const text = match.replace(/\*\*/g, '');
          formattedText = formattedText.replace(match, `<strong class="font-semibold ${isErrorAnalysis ? 'text-red-700' : 'text-gray-900'}">${text}</strong>`);
        });
        return <p key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: formattedText }} />;
      }

      // Handle inline code
      if (paragraph.includes('`')) {
        let formattedText = paragraph;
        const codeMatches = paragraph.match(/`([^`]+)`/g);
        if (codeMatches) {
          codeMatches.forEach(match => {
            const code = match.replace(/`/g, '');
            formattedText = formattedText.replace(match, `<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">${code}</code>`);
          });
          return <p key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: formattedText }} />;
        }
      }
      
      return <p key={index} className="mb-2">{paragraph}</p>;
    });
  };

  // Handle code blocks separately
  const renderCodeBlocks = (text: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        parts.push(
          <div key={`text-${lastIndex}`}>
            {formatMessage(beforeText)}
          </div>
        );
      }

      // Add code block
      const language = match[1] || 'text';
      const code = match[2].trim();
      parts.push(
        <div key={`code-${match.index}`} className="my-4">
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
              <span>{language}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(code)}
                className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                title="Copy code"
              >
                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="text-sm text-gray-100 font-mono">
              <code>{code}</code>
            </pre>
          </div>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(
        <div key={`text-${lastIndex}`}>
          {formatMessage(remainingText)}
        </div>
      );
    }

    return parts.length > 0 ? parts : formatMessage(text);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">J.A.R.V.I.S Chat</h1>
            </div>
            <div className={`flex items-center space-x-1 text-sm ${getConnectionStatusColor()}`}>
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
              <span>{getConnectionStatusText()}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <SparklesIcon className="h-4 w-4" />
              <span>AI Assistant</span>
            </div>
            {backendStatus.initialized && (
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Backend Ready</span>
              </div>
            )}
        </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-white rounded-2xl p-8 shadow-lg max-w-2xl">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full">
                  <CpuChipIcon className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to J.A.R.V.I.S</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                I'm your advanced AI assistant with specialized code error analysis capabilities. 
                I can help debug code, explain errors, and provide practical fixes with examples.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">💡 What I can help with:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Code error analysis & debugging</li>
                    <li>• TypeScript, JavaScript, React issues</li>
                    <li>• Python syntax & runtime errors</li>
                    <li>• Technical troubleshooting</li>
                  </ul>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-900 mb-2">🐛 Error Analysis Features:</h3>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• Smart error pattern detection</li>
                    <li>• Code examples with fixes</li>
                    <li>• Memory of your past errors</li>
                    <li>• Follow-up debugging questions</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">🚀 Try These Examples:</h4>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setInput('What does this error mean?\nERROR: Expected "}" but found "." at line 160')}
                    className="text-xs bg-white px-3 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                  >
                    Syntax Error
                  </button>
                  <button 
                    onClick={() => setInput('TypeError: Cannot read property "name" of undefined')}
                    className="text-xs bg-white px-3 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                  >
                    Runtime Error
                  </button>
                  <button 
                    onClick={() => setInput('JSX expressions must have one parent element')}
                    className="text-xs bg-white px-3 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                  >
                    JSX Error
                  </button>
                </div>
              </div>
        </div>
          </div>
        ) : (
          messages.map((message) => (
          <div
            key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
              <div className={`max-w-3xl ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start space-x-3 ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.sender === 'user'
                      ? 'bg-blue-500 text-white' 
                      : message.isErrorAnalysis 
                        ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                  }`}>
                    {message.sender === 'user' ? (
                      <UserIcon className="h-4 w-4" />
                    ) : message.isErrorAnalysis ? (
                      <BugAntIcon className="h-4 w-4" />
                    ) : (
                      <CpuChipIcon className="h-4 w-4" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`flex-1 ${message.sender === 'user' ? 'text-right' : ''}`}>
                    {message.isErrorAnalysis && (
                      <div className="mb-2 flex items-center space-x-2 text-sm">
                        <CodeBracketIcon className="h-4 w-4 text-red-500" />
                        <span className="text-red-600 font-medium">Code Error Analysis</span>
                        {message.errorAnalysis && (
                          <span className="text-gray-500">
                            • Confidence: {Math.round(message.errorAnalysis.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                    <div className={`inline-block px-4 py-3 rounded-2xl shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : message.isErrorAnalysis
                          ? 'bg-red-50 text-gray-900 border border-red-200'
                          : 'bg-white text-gray-900 border border-gray-200'
                    }`}>
                      <div className={`prose prose-sm max-w-none ${
                        message.sender === 'user' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {renderCodeBlocks(message.text)}
                      </div>
                    </div>
                    
                    {/* Error Analysis Actions */}
                    {message.isErrorAnalysis && message.errorAnalysis && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button 
                          className="flex items-center space-x-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-200 transition-colors"
                          onClick={() => {
                            const question = message.errorAnalysis?.followUpQuestion || 'Could you share more code context?';
                            setInput(question);
                          }}
                        >
                          <LightBulbIcon className="h-3 w-3" />
                          <span>Ask Follow-up</span>
                        </button>
                        
                        {message.errorAnalysis.pattern?.example && (
                          <button 
                            className="flex items-center space-x-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full hover:bg-green-200 transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(message.errorAnalysis!.pattern!.example!.correct);
                            }}
                          >
                            <ClipboardDocumentCheckIcon className="h-3 w-3" />
                            <span>Copy Fix</span>
                          </button>
                        )}
                        
                        <button 
                          className="flex items-center space-x-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full hover:bg-purple-200 transition-colors"
                          onClick={() => {
                            const stats = errorAnalyzer.getUserStats('default');
                            setMessages(prev => [...prev, {
                              id: messageIdRef.current++,
                              text: `📊 **Your Error Statistics:**\n• Total errors analyzed: ${stats.totalErrors}\n• Most common pattern: ${stats.mostCommon}\n• Recent patterns: ${stats.recentPatterns.join(', ') || 'None'}`,
                              sender: 'jarvis',
                              timestamp: new Date(),
                            }]);
                          }}
                        >
                          <SparklesIcon className="h-3 w-3" />
                          <span>My Stats</span>
                        </button>
                      </div>
                    )}
                    <div className={`text-xs text-gray-500 mt-1 ${
                      message.sender === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-3xl">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <CpuChipIcon className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        {/* Error Detection Hint */}
        {input && errorAnalyzer.detectErrorType(input) !== 'unknown' && (
          <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <BugAntIcon className="h-4 w-4 text-orange-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-orange-800">Error detected:</span>
                <span className="text-orange-700 ml-1">
                  I'll analyze this for you and provide debugging suggestions.
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1 relative">
            {/* Voice Input Status Indicator */}
            {isRecording && (
              <div className="absolute left-3 top-3 z-10">
                <div className="flex items-center space-x-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Recording</span>
                  <span className="font-mono">
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? "Recording voice input..." : "Type your message here, or paste an error message for analysis..."}
              className={`w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all ${
                isRecording ? 'pl-20 bg-red-50 border-red-300' : ''
              }`}
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            {/* Quick Error Templates */}
            <div className="absolute right-2 top-2">
              <button
                type="button"
                onClick={() => setInput('What does this error mean?\nERROR: Expected "}" but found "." at line 160')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                title="Example error message"
              >
                Example
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={!isVoiceSupported || isProcessing}
              className={`p-3 rounded-full transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg scale-105'
                  : audioBlob && showVoiceControls
                    ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-md'
              } ${!isVoiceSupported || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={
                !isVoiceSupported ? 'Voice input not supported' :
                isProcessing ? 'Processing voice input...' :
                isRecording ? 'Click to stop recording' :
                audioBlob && showVoiceControls ? 'Click to send voice message' :
                'Click to start voice recording'
              }
            >
              {isRecording ? (
                <StopIcon className="h-5 w-5" />
              ) : audioBlob && showVoiceControls ? (
                <PaperAirplaneIcon className="h-5 w-5" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>

            {/* Image Upload Button */}
        <button
              type="button"
          onClick={() => setShowImageUpload(!showImageUpload)}
              className="p-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              title="Upload image"
        >
              <PhotoIcon className="h-5 w-5" />
        </button>

            {/* Send Button */}
        <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`p-3 rounded-full transition-colors ${
                input.trim() && !isLoading
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Send message"
        >
              <PaperAirplaneIcon className="h-5 w-5" />
        </button>
          </div>
        </form>
        
        {/* Voice Status and Controls */}
        {isRecording && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-700">Recording Voice Input</span>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full font-mono">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <span className="text-xs text-red-600">Click microphone to stop</span>
            </div>
            
            {/* Audio Visualization Bars */}
            <div className="flex items-center justify-center space-x-1 h-16 mb-3">
              {audioLevels.map((height, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full transition-all duration-75 bg-gradient-to-t from-red-500 to-pink-400"
                  style={{
                    height: `${Math.max(4, height * 60)}px`,
                    opacity: 0.8 + height * 0.2
                  }}
                />
              ))}
            </div>
            
            <div className="text-center">
              <div className="text-sm text-red-600 font-medium mb-1">🎤 Speak clearly for best recognition</div>
              <div className="text-xs text-red-500">Voice input will be automatically transcribed and sent</div>
            </div>
          </div>
        )}
        
        {isProcessing && (
          <div className="mt-2 flex items-center space-x-2 text-sm text-yellow-600">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-spin"></div>
            <span>Processing voice input...</span>
          </div>
        )}
        
        {/* Enhanced Voice Controls */}
        {showVoiceControls && audioBlob && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-blue-800">Voice Recording Ready</span>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  Duration: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={playRecording}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  title="Play recording"
                >
                  <PlayIcon className="h-3 w-3" />
                  <span>Play</span>
                </button>
                <button
                  type="button"
                  onClick={clearRecording}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  title="Clear recording"
                >
                  <TrashIcon className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-600">Click the microphone button again to send</span>
              <div className="flex items-center space-x-1">
                <MicrophoneIcon className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-blue-600">Send</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden audio element for playback */}
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
} 