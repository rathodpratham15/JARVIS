import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Calendar,
  Camera,
  Folder,
  Globe,
  Home,
  ImagePlus,
  Loader2,
  Mail,
  Mic,
  MicOff,
  Plus,
  Bell,
  Square,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useJarvisStore } from '../store/useJarvisStore';
import type { MessageAttachment } from '../types/jarvis';

interface MessageComposerProps {
  onSend: (text: string, attachments: MessageAttachment[]) => Promise<void>;
  centered?: boolean;
}

interface ActionMenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  action: () => void;
}

export function MessageComposer({ onSend, centered = false }: MessageComposerProps) {
  const { streamStatus, stopGeneration, projects } = useJarvisStore();
  const isGenerating = streamStatus === 'waiting' || streamStatus === 'streaming';

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [showProjectSubmenu, setShowProjectSubmenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActionMenuOpen(false);
        setShowProjectSubmenu(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!cameraModalOpen) {
      stopCameraStream();
      return;
    }
    let active = true;
    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (active) setCameraError('Camera access was denied or no camera was detected.');
      });
    return () => {
      active = false;
      stopCameraStream();
    };
  }, [cameraModalOpen]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachments((prev) => [
            ...prev,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              mimeType: file.type,
              dataUrl: reader.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    setActionMenuOpen(false);
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setAttachments((prev) => [
      ...prev,
      {
        id: `photo-${Date.now()}`,
        name: `Photo_${new Date().toLocaleTimeString()}.jpg`,
        mimeType: 'image/jpeg',
        dataUrl,
      },
    ]);
    setCameraModalOpen(false);
  };

  const handleToggleMic = async () => {
    setMicError(null);
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        setIsTranscribing(true);
        try {
          const { transcript } = await api.transcribeAudio(blob);
          if (transcript) {
            setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
            textareaRef.current?.focus();
          }
        } catch (err) {
          setMicError(err instanceof Error ? err.message : 'Could not transcribe audio.');
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMicError('Microphone access denied.');
    }
  };

  const insertPrefix = (prefix: string) => {
    setText((prev) => {
      const newText = prev ? `${prefix}${prev}` : prefix;
      return newText;
    });
    setActionMenuOpen(false);
    setShowProjectSubmenu(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSubmit = async () => {
    if (isGenerating) {
      stopGeneration();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    const toSendText = trimmed;
    const toSendAttachments = [...attachments];
    setText('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSend(toSendText, toSendAttachments);
  };

  const canSend = text.trim().length > 0 || attachments.length > 0;

  const topActions: ActionMenuItem[] = [
    {
      icon: <ImagePlus className="w-4 h-4" />,
      label: 'Attach file',
      description: 'Upload from computer',
      action: () => fileInputRef.current?.click(),
    },
    {
      icon: <Camera className="w-4 h-4" />,
      label: 'Take photo',
      description: 'Use camera',
      action: () => { setActionMenuOpen(false); setCameraModalOpen(true); },
    },
  ];

  const bottomActions: ActionMenuItem[] = [
    {
      icon: <Globe className="w-4 h-4" />,
      label: 'Web search',
      description: 'Find real-time info',
      action: () => insertPrefix('Search the web for: '),
    },
    {
      icon: <Mail className="w-4 h-4" />,
      label: 'Check emails',
      description: 'Read your Gmail',
      action: () => insertPrefix('Check my emails'),
    },
    {
      icon: <Calendar className="w-4 h-4" />,
      label: 'Check calendar',
      description: "What's on today",
      action: () => insertPrefix("What's on my calendar today"),
    },
    {
      icon: <Bell className="w-4 h-4" />,
      label: 'Set a reminder',
      description: 'Schedule something',
      action: () => insertPrefix('Remind me to '),
    },
    {
      icon: <Folder className="w-4 h-4" />,
      label: 'Work in a project',
      description: 'Focus on a project',
      action: () => setShowProjectSubmenu((v) => !v),
    },
    {
      icon: <Home className="w-4 h-4" />,
      label: 'Smart home',
      description: 'Control devices',
      action: () => insertPrefix('Control my home: '),
    },
  ];

  return (
    <div className={`w-full max-w-[680px] mx-auto ${centered ? '' : 'px-3 sm:px-4 pb-3 pt-1'}`}>
      {micError && (
        <div className="mb-2 text-xs text-red-500 px-2 flex items-center justify-between">
          <span>{micError}</span>
          <button type="button" onClick={() => setMicError(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="relative rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F4F4F4] dark:bg-[#303030] px-3 py-2.5 transition-colors focus-within:border-[#6366f1]/60">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2.5 mb-1 border-b border-[#E5E5E5] dark:border-white/10">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group w-16 h-16 rounded-xl overflow-hidden border border-[#E5E5E5] dark:border-white/15 bg-black/10"
              >
                <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== att.id))}
                  aria-label="Remove attachment"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 text-white flex items-center justify-center opacity-90 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Left: JARVIS action menu button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setActionMenuOpen((v) => !v); setShowProjectSubmenu(false); }}
              title="JARVIS actions"
              aria-label="JARVIS actions"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            {actionMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => { setActionMenuOpen(false); setShowProjectSubmenu(false); }} />
                <div className="absolute left-0 top-11 z-30 w-64 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-xl p-1.5">
                  {/* Top section — file/camera */}
                  {topActions.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <span className="text-[#717171] dark:text-[#A1A1AA]">{item.icon}</span>
                      <span className="flex-1 text-left">
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block text-[11px] text-[#717171] dark:text-[#A1A1AA]">{item.description}</span>
                      </span>
                    </button>
                  ))}

                  <div className="my-1.5 h-px bg-[#E5E5E5] dark:bg-white/10" />

                  {/* Bottom section — JARVIS actions */}
                  {bottomActions.map((item) => (
                    <div key={item.label} className="relative">
                      <button
                        type="button"
                        onClick={item.action}
                        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <span className="text-[#717171] dark:text-[#A1A1AA]">{item.icon}</span>
                        <span className="flex-1 text-left">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="block text-[11px] text-[#717171] dark:text-[#A1A1AA]">{item.description}</span>
                        </span>
                      </button>

                      {/* Project submenu */}
                      {item.label === 'Work in a project' && showProjectSubmenu && (
                        <div className="absolute left-full top-0 ml-1 w-48 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-xl p-1.5 z-40">
                          {projects.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-[#717171] dark:text-[#A1A1AA]">
                              No projects yet. Create one in the sidebar.
                            </div>
                          ) : (
                            projects.map((proj) => (
                              <button
                                key={proj.id}
                                type="button"
                                onClick={() => insertPrefix(`[Project: ${proj.name}] `)}
                                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                              >
                                <Folder className="w-3.5 h-3.5 text-[#717171] dark:text-[#A1A1AA]" />
                                <span className="truncate">{proj.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* Center: Auto-growing textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Message JARVIS"
            className="flex-1 min-w-0 max-h-[160px] resize-none bg-transparent py-1.5 text-[15px] leading-6 text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#717171] dark:placeholder:text-[#A1A1AA] focus:outline-none"
          />

          {/* Right: Mic & Send/Stop */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleToggleMic()}
              disabled={isTranscribing}
              title={isRecording ? 'Stop dictation' : 'Dictate message'}
              aria-label={isRecording ? 'Stop dictation' : 'Dictate message'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!isGenerating && !canSend}
              title={isGenerating ? 'Stop generating' : 'Send message'}
              aria-label={isGenerating ? 'Stop generating' : 'Send message'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isGenerating
                  ? 'bg-[#171717] dark:bg-[#F5F5F5] text-[#FFFFFF] dark:text-[#171717] cursor-pointer hover:opacity-90'
                  : canSend
                    ? 'bg-[#6366f1] text-white cursor-pointer hover:bg-[#5558e6]'
                    : 'bg-[#6366f1] text-white opacity-30 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {!centered && (
        <p className="text-center text-[11px] text-[#717171] dark:text-[#A1A1AA] mt-2">
          JARVIS can make mistakes. Verify important information.
        </p>
      )}

      {/* Camera Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#212121] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] dark:border-white/10">
              <h3 className="font-display text-sm font-semibold">Take a photo</h3>
              <button type="button" onClick={() => setCameraModalOpen(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {cameraError ? (
                <div className="py-12 text-center text-sm text-[#717171] dark:text-[#A1A1AA]">{cameraError}</div>
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-video object-cover" />
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setCameraModalOpen(false)} className="px-4 py-2 rounded-xl text-sm border border-[#E5E5E5] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                {!cameraError && (
                  <button type="button" onClick={handleCapturePhoto} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#6366f1] hover:bg-[#5558e6] text-white cursor-pointer">
                    Attach photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
