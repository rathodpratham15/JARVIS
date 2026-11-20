import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Send,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useJarvisStore } from '../store/useJarvisStore';

type VoicePhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'denied';

interface VoiceTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function VoiceModeOverlay() {
  const {
    voiceOpen,
    setVoiceOpen,
    activeConversationId,
    settings,
    refreshHistory,
    loadConversation,
  } = useJarvisStore();

  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [showTranscript, setShowTranscript] = useState(true);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackInput, setFallbackInput] = useState('');
  const [levels, setLevels] = useState<number[]>(new Array(24).fill(0.18));

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const convIdRef = useRef<string | undefined>(activeConversationId || undefined);

  useEffect(() => {
    convIdRef.current = activeConversationId || undefined;
  }, [activeConversationId]);

  const stopAudioPlayback = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      playbackAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const cleanupAll = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  // Animate speaking or idle waveform smoothly
  useEffect(() => {
    if (!voiceOpen) return;
    if (phase === 'speaking') {
      let tick = 0;
      const timer = setInterval(() => {
        tick += 0.35;
        setLevels(
          Array.from({ length: 24 }, (_, i) => {
            const centerWeight = 1 - Math.abs(i - 11.5) / 14;
            const wave = Math.abs(Math.sin(tick + i * 0.55));
            return Math.max(0.15, Math.min(1, 0.2 + wave * 0.8 * centerWeight));
          })
        );
      }, 65);
      return () => clearInterval(timer);
    } else if (phase === 'idle' || phase === 'denied') {
      setLevels(new Array(24).fill(0.15));
    }
  }, [phase, voiceOpen]);

  useEffect(() => {
    if (!voiceOpen) {
      cleanupAll();
      setPhase('idle');
      setErrorMsg(null);
    }
    return () => {
      cleanupAll();
    };
  }, [voiceOpen, cleanupAll]);

  const processUserUtterance = async (spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) {
      setPhase('idle');
      return;
    }

    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: clean }]);
    setPhase('processing');
    setErrorMsg(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantText = '';
    const assistantTurnId = `a-${Date.now()}`;

    try {
      await api.streamChat(
        {
          conversationId: convIdRef.current,
          message: clean,
          personalityMode: settings.personalityMode,
        },
        {
          signal: controller.signal,
          onInit: ({ conversationId }) => {
            convIdRef.current = conversationId;
          },
          onToken: (token) => {
            assistantText += token;
            setTurns((prev) => {
              const exists = prev.some((t) => t.id === assistantTurnId);
              if (!exists) {
                return [...prev, { id: assistantTurnId, role: 'assistant', text: assistantText }];
              }
              return prev.map((t) =>
                t.id === assistantTurnId ? { ...t, text: assistantText } : t
              );
            });
          },
          onError: (err) => {
            setErrorMsg(err);
          },
        }
      );

      void refreshHistory();
      if (convIdRef.current) {
        void loadConversation(convIdRef.current);
      }

      if (!assistantText.trim()) {
        setPhase('idle');
        return;
      }

      // Speak response aloud via Gemini TTS
      setPhase('speaking');
      try {
        const { audioBase64, mimeType } = await api.synthesizeSpeech({
          text: assistantText,
          voice: settings.voice,
          personalityMode: settings.personalityMode,
        });
        if (controller.signal.aborted) return;
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        playbackAudioRef.current = audio;
        audio.onended = () => {
          playbackAudioRef.current = null;
          setPhase('idle');
        };
        audio.onerror = () => {
          playbackAudioRef.current = null;
          setPhase('idle');
        };
        await audio.play();
      } catch {
        // Browser speech synthesis fallback
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(
            assistantText.replace(/[#*_`>~]/g, '')
          );
          utter.onend = () => setPhase('idle');
          utter.onerror = () => setPhase('idle');
          window.speechSynthesis.speak(utter);
        } else {
          setPhase('idle');
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setErrorMsg(err instanceof Error ? err.message : 'Voice request failed.');
      }
      setPhase('idle');
    }
  };

  const startListening = async () => {
    setErrorMsg(null);
    stopAudioPlayback();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWaveform = () => {
        if (!streamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 24 }, (_, i) => {
          const val = dataArray[i % dataArray.length] / 255;
          return Math.max(0.16, Math.min(1, val * 1.25));
        });
        setLevels(bars);
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioCtxRef.current) {
          void audioCtxRef.current.close();
          audioCtxRef.current = null;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size < 400) {
          setPhase('idle');
          return;
        }
        setPhase('processing');
        try {
          const { transcript } = await api.transcribeAudio(blob);
          if (transcript.trim()) {
            await processUserUtterance(transcript);
          } else {
            setErrorMsg('No speech detected. Please try speaking clearly.');
            setPhase('idle');
          }
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Transcription failed.');
          setPhase('idle');
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setPhase('listening');
    } catch {
      setPhase('denied');
      setErrorMsg(
        'Microphone permission was denied. Allow microphone access in your browser settings or type below.'
      );
    }
  };

  const stopListening = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const handleInterrupt = () => {
    stopAudioPlayback();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setPhase('idle');
  };

  if (!voiceOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FFFFFF] dark:bg-[#212121] text-[#171717] dark:text-[#F5F5F5]">
      {/* Top Bar */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-[#E5E5E5] dark:border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-base">Voice mode</span>
          <span className="text-xs text-[#717171] dark:text-[#A1A1AA]">
            {settings.personalityMode} · Voice: {settings.voice}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
              showTranscript
                ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#6366f1]'
                : 'border-[#E5E5E5] dark:border-white/10 text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5]'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Transcript</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceOpen(false)}
            aria-label="End voice conversation"
            className="w-9 h-9 rounded-full border border-[#E5E5E5] dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Waveform Visualization Stage */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="relative flex flex-col items-center">
            {/* Waveform Bars */}
            <div className="h-36 flex items-center justify-center gap-1.5 px-6">
              {phase === 'processing' ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-[#6366f1] animate-spin" />
                </div>
              ) : (
                levels.map((level, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${Math.round(level * 120)}px` }}
                    className={`w-2 rounded-full transition-all duration-75 ${
                      phase === 'listening'
                        ? 'bg-[#6366f1]'
                        : phase === 'speaking'
                          ? 'bg-emerald-500'
                          : 'bg-[#717171]/35 dark:bg-[#A1A1AA]/30'
                    }`}
                  />
                ))
              )}
            </div>

            {/* Phase status label */}
            <div className="mt-4 text-sm font-medium text-[#717171] dark:text-[#A1A1AA]">
              {phase === 'listening' && 'Listening… Tap stop when finished'}
              {phase === 'processing' && 'Thinking…'}
              {phase === 'speaking' && 'Speaking… Tap interrupt to stop'}
              {phase === 'idle' && 'Tap the microphone to speak'}
              {phase === 'denied' && 'Microphone unavailable'}
            </div>

            {errorMsg && (
              <div className="mt-3 max-w-md text-center text-xs text-red-500 px-4">
                {errorMsg}
              </div>
            )}

            {/* Primary Controls */}
            <div className="mt-8 flex items-center gap-4">
              {phase === 'listening' ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  aria-label="Stop listening and send"
                >
                  <Square className="w-6 h-6 fill-current" />
                </button>
              ) : phase === 'speaking' ? (
                <button
                  type="button"
                  onClick={handleInterrupt}
                  className="px-6 h-14 rounded-full bg-[#2A2A2A] text-white hover:bg-[#3A3A3A] flex items-center gap-2.5 text-sm font-medium shadow-lg cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Interrupt</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={phase === 'processing'}
                  onClick={() => void startListening()}
                  className="w-16 h-16 rounded-full bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-40 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  aria-label="Start speaking"
                >
                  {phase === 'denied' ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setVoiceOpen(false)}
                aria-label="End conversation"
                className="w-12 h-12 rounded-full border border-[#E5E5E5] dark:border-white/15 flex items-center justify-center text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Graceful text fallback when mic is denied */}
            {phase === 'denied' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (fallbackInput.trim()) {
                    const val = fallbackInput;
                    setFallbackInput('');
                    void processUserUtterance(val);
                  }
                }}
                className="mt-6 w-full max-w-sm flex items-center gap-2"
              >
                <input
                  type="text"
                  value={fallbackInput}
                  onChange={(e) => setFallbackInput(e.target.value)}
                  placeholder="Type a message instead..."
                  className="flex-1 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F4F4F4] dark:bg-[#2A2A2A] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
                <button
                  type="submit"
                  className="w-9 h-9 rounded-xl bg-[#6366f1] text-white flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Toggleable Transcript Panel */}
        {showTranscript && (
          <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] flex flex-col max-h-[42vh] md:max-h-none">
            <div className="px-4 py-3 border-b border-[#E5E5E5] dark:border-white/10 text-xs font-medium text-[#717171] dark:text-[#A1A1AA]">
              Conversation transcript
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {turns.length === 0 ? (
                <div className="text-xs text-[#717171] dark:text-[#A1A1AA] py-8 text-center">
                  Your voice exchange will appear here.
                </div>
              ) : (
                turns.map((turn) => (
                  <div key={turn.id} className="space-y-1">
                    <div className="text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA]">
                      {turn.role === 'user' ? 'You' : 'JARVIS'}
                    </div>
                    <div className="text-sm leading-relaxed text-[#171717] dark:text-[#F5F5F5]">
                      {turn.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
