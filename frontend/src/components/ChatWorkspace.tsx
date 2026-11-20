import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageComposer } from './MessageComposer';

const SUGGESTIONS = [
  "What's on my calendar today?",
  'Summarize my recent notes and reminders.',
  'Search the web for top AI news today.',
  'Set a reminder for tomorrow morning.',
];

export function ChatWorkspace() {
  const { id: urlConvId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    messages,
    settings,
    streamStatus,
    streamError,
    speakingMessageId,
    ttsLoadingId,
    activeConversationId,
    sendMessage,
    regenerateLastResponse,
    editUserMessage,
    setFeedback,
    speakMessage,
    stopSpeaking,
    loadConversation,
  } = useJarvisStore();

  // When navigating to /c/:id (URL changes), load that conversation.
  // Intentionally only depends on urlConvId so that clearing activeConversationId
  // via startNewChat() does NOT re-trigger a load while still on the old URL.
  useEffect(() => {
    if (urlConvId) {
      void loadConversation(urlConvId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId]);

  // Once a conversation ID is assigned (e.g. after the first reply), push
  // the URL from /chat → /c/:id so a refresh stays on the same chat.
  useEffect(() => {
    if (activeConversationId && !urlConvId) {
      navigate(`/c/${activeConversationId}`, { replace: true });
    }
  }, [activeConversationId, urlConvId, navigate]);

  const [isDark, setIsDark] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [settings.theme]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 140);
  };

  useEffect(() => {
    if (!showScrollBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamStatus, showScrollBottom]);

  const scrollToBottom = () => {
    setShowScrollBottom(false);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      void sendMessage(lastUser.content, lastUser.attachments || [], {
        replaceFromMessageId: lastUser.id,
      });
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-[680px] flex flex-col items-center">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight text-center mb-7">
            How can I help?
          </h1>

          <MessageComposer onSend={sendMessage} centered />

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
            {SUGGESTIONS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage(prompt, [])}
                className="text-left rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#2A2A2A]/70 hover:bg-[#F4F4F4] dark:hover:bg-[#2A2A2A] px-4 py-3 text-sm text-[#171717] dark:text-[#F5F5F5] transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-[#717171] dark:text-[#A1A1AA] mt-6">
            JARVIS can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 pt-6 pb-8"
      >
        <div className="max-w-[680px] mx-auto space-y-6">
          {messages.map((msg, index) => {
            const isLast = index === messages.length - 1;
            const isStreamingThis =
              isLast && msg.role === 'assistant' && streamStatus === 'streaming';
            const isWaitingThis =
              isLast && msg.role === 'assistant' && streamStatus === 'waiting' && !msg.content;

            if (msg.role === 'user') {
              const isEditing = editingId === msg.id;
              return (
                <div key={msg.id} className="group flex flex-col items-end">
                  {isEditing ? (
                    <div className="w-full max-w-[85%] rounded-2xl border border-[#6366f1] bg-[#F4F4F4] dark:bg-[#303030] p-3">
                      <textarea
                        rows={3}
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        className="w-full bg-transparent text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none resize-y"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#717171] dark:text-[#A1A1AA] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editDraft.trim()) {
                              setEditingId(null);
                              void editUserMessage(msg.id, editDraft.trim());
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6366f1] text-white hover:bg-[#5558e6] cursor-pointer"
                        >
                          Save & send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="max-w-[85%] rounded-2xl bg-[#F4F4F4] dark:bg-[#303030] px-4 py-2.5 text-[15px] leading-relaxed text-[#171717] dark:text-[#F5F5F5]">
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {msg.attachments.map((att) => (
                              <img
                                key={att.id}
                                src={att.dataUrl}
                                alt={att.name}
                                className="max-h-56 rounded-xl object-cover border border-[#E5E5E5] dark:border-white/10"
                              />
                            ))}
                          </div>
                        )}
                        {msg.content && (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => { setEditingId(msg.id); setEditDraft(msg.content); }}
                          title="Edit message"
                          aria-label="Edit message"
                          className="p-1.5 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopy(msg.id, msg.content)}
                          title="Copy message"
                          aria-label="Copy message"
                          className="p-1.5 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            }

            const isSpeaking = speakingMessageId === msg.id;
            const isTtsLoading = ttsLoadingId === msg.id;
            const isCompleted = !isStreamingThis && !isWaitingThis && msg.content.length > 0;

            return (
              <div key={msg.id} className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center text-white shrink-0 mt-0.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  {isWaitingThis ? (
                    <div className="flex items-center gap-1.5 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#717171] dark:bg-[#A1A1AA] animate-dot-1" />
                      <span className="w-2 h-2 rounded-full bg-[#717171] dark:bg-[#A1A1AA] animate-dot-2" />
                      <span className="w-2 h-2 rounded-full bg-[#717171] dark:bg-[#A1A1AA] animate-dot-3" />
                    </div>
                  ) : (
                    <div>
                      <MarkdownRenderer content={msg.content} isDark={isDark} />
                      {isStreamingThis && <span className="streaming-cursor" aria-hidden="true" />}
                    </div>
                  )}

                  {msg.sources && msg.sources.length > 0 && isCompleted && (
                    <div className="mt-3 pt-2.5 border-t border-[#E5E5E5] dark:border-white/10">
                      <div className="text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                        Sources
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {msg.sources.slice(0, 5).map((src) => (
                          <a
                            key={src.uri}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#6366f1] hover:underline max-w-[240px] truncate"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="flex items-center gap-1 mt-2 -ml-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopy(msg.id, msg.content)}
                        title="Copy response"
                        aria-label="Copy response"
                        className="p-1.5 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          isSpeaking ? stopSpeaking() : void speakMessage(msg.id, msg.content)
                        }
                        title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                        aria-label={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isSpeaking
                            ? 'text-[#6366f1] bg-[#6366f1]/10'
                            : 'text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {isTtsLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isSpeaking ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void setFeedback(msg.id, msg.feedback === 'up' ? null : 'up')}
                        title="Good response"
                        aria-label="Good response"
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          msg.feedback === 'up'
                            ? 'text-[#6366f1]'
                            : 'text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void setFeedback(msg.id, msg.feedback === 'down' ? null : 'down')
                        }
                        title="Poor response"
                        aria-label="Poor response"
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          msg.feedback === 'down'
                            ? 'text-red-500'
                            : 'text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void regenerateLastResponse(msg.id)}
                        title="Regenerate response"
                        aria-label="Regenerate response"
                        className="p-1.5 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {streamStatus === 'error' && streamError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3 text-sm text-red-500">
              <span>{streamError}</span>
              <button
                type="button"
                onClick={handleRetry}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {showScrollBottom && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="w-9 h-9 rounded-full border border-[#E5E5E5] dark:border-white/15 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-lg flex items-center justify-center text-[#171717] dark:text-[#F5F5F5] hover:bg-[#F4F4F4] dark:hover:bg-[#353535] cursor-pointer"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="shrink-0 bg-[#FFFFFF] dark:bg-[#212121]">
        <MessageComposer onSend={sendMessage} />
      </div>
    </div>
  );
}
