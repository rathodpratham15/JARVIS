import { useState, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

interface VoiceInputState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
}

export const useVoiceInput = ({
  onResult,
  onError,
  language = 'en-US',
  continuous = false
}: UseVoiceInputOptions) => {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isSupported: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    error: null
  });

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState(prev => ({ ...prev, isListening: false, error: null }));
  }, []);

  const startListening = useCallback(() => {
    if (!state.isSupported) {
      const error = 'Speech recognition is not supported in this browser';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    try {
      // Create new recognition instance
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
        
        // Auto-stop after 10 seconds if not continuous
        if (!continuous) {
          timeoutRef.current = setTimeout(() => {
            stopListening();
          }, 10000);
        }
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          onResult(finalTranscript.trim());
          if (!continuous) {
            stopListening();
          }
        }
      };

      recognition.onerror = (event: any) => {
        let errorMessage = 'Speech recognition error';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone was found. Please check your microphone settings.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
            break;
          case 'network':
            errorMessage = 'Network error occurred during speech recognition.';
            break;
          case 'aborted':
            errorMessage = 'Speech recognition was aborted.';
            break;
          case 'bad-grammar':
            errorMessage = 'Speech recognition grammar error.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }

        setState(prev => ({ ...prev, error: errorMessage, isListening: false }));
        onError?.(errorMessage);
        stopListening();
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error) {
      const errorMessage = `Failed to start speech recognition: ${error}`;
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [state.isSupported, language, continuous, onResult, onError, stopListening]);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening
  };
}; 