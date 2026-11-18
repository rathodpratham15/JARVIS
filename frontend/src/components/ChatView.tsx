import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp, Mic, MicOff, Paperclip, X, Copy, Check, Volume2,
  Calendar, FileText, Globe, Clock, ChevronDown, Bell, Camera, AudioLines,
} from "lucide-react";
import { ChatMessage, PersonalityMode } from "../types";
import { speakJarvisText } from "../utils/audio";
import { useVoiceInput } from "../hooks/useVoiceInput";

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, imageBase64?: string, suppressAutoSpeak?: boolean) => Promise<string>;
  onClearHistory: () => void;
  onSaveToMemory: (title: string, content: string) => void;
  onSaveToNote: (title: string, content: string) => void;
  personalityMode: PersonalityMode;
  memoriesCount: number;
  onSelectPersonality?: (mode: PersonalityMode) => void;
  onOpenVision?: () => void;
  onOpenVoice?: () => void;
  onToggleMobileSidebar?: () => void;
}

const PERSONALITIES: PersonalityMode[] = ["Standard", "Tactical", "Formal", "Concise"];

const SUGGESTIONS = [
  { icon: <Calendar className="w-4 h-4 shrink-0 text-[#8e8ea0]" />, text: "What's on my calendar today?" },
  { icon: <FileText className="w-4 h-4 shrink-0 text-[#8e8ea0]" />, text: "Summarize my recent notes and reminders." },
  { icon: <Globe className="w-4 h-4 shrink-0 text-[#8e8ea0]" />, text: "Search the web for top AI news today." },
  { icon: <Clock className="w-4 h-4 shrink-0 text-[#8e8ea0]" />, text: "Set a reminder for tomorrow morning." },
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  personalityMode,
  memoriesCount,
  onSelectPersonality,
  onOpenVision,
  onOpenVoice,
  onToggleMobileSidebar,
}) => {
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPersonalityMenu, setShowPersonalityMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput({
    onResult: (text) => {
      setInputText((prev) => (prev ? prev + " " + text : text));
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [inputText]);

  const handleSend = async (customText?: string) => {
    const text = (customText ?? inputText).trim();
    if ((!text && !selectedImage) || isSending) return;
    const img = selectedImage ?? undefined;
    setInputText("");
    setSelectedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsSending(true);
    try { await onSendMessage(text, img); } catch {}
    finally { setIsSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSelectedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[#212121]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        {/* Left: mobile hamburger + title + personality */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-1.5 text-[#8e8ea0] hover:text-white hover:bg-white/8 rounded-lg transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowPersonalityMenu((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white hover:bg-white/8 px-2 py-1.5 rounded-lg transition-colors"
            >
              <span className="text-white">J.A.R.V.I.S.</span>
              <span className="text-[#8e8ea0] font-normal">{personalityMode}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8e8ea0]" />
            </button>
            {showPersonalityMenu && (
              <div className="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-xl z-50 py-1 min-w-[160px]">
                {PERSONALITIES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { onSelectPersonality?.(mode); setShowPersonalityMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/8 ${
                      personalityMode === mode ? "text-white font-medium" : "text-[#b4b4b4]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: memory, vision, voice */}
        <div className="flex items-center gap-1">
          <button
            title={`Memory: ${memoriesCount} memories loaded`}
            className="p-2 hover:bg-white/8 rounded-lg text-[#8e8ea0] hover:text-white transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={onOpenVision}
            title="Vision — face recognition"
            className="p-2 hover:bg-white/8 rounded-lg text-[#8e8ea0] hover:text-white transition-colors"
          >
            <Camera className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={onOpenVoice}
            title="Voice mode"
            className="p-2 hover:bg-white/8 rounded-lg text-[#8e8ea0] hover:text-white transition-colors"
          >
            <AudioLines className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-4 pb-24">
            <h1 className="text-[32px] font-bold text-white mb-8 text-center">How can I help?</h1>

            {/* Composer on empty state */}
            <div className="w-full max-w-[680px] mb-5">
              {selectedImage && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                  <img src={selectedImage} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                  <span className="text-xs text-[#8e8ea0] flex-1">Image attached</span>
                  <button onClick={() => setSelectedImage(null)} className="text-[#8e8ea0] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className={`flex items-center gap-2 bg-[#2f2f2f] border rounded-2xl px-3 py-3 shadow-lg transition-colors ${
                isListening ? "border-red-500/50" : "border-white/10 hover:border-white/20 focus-within:border-white/30"
              }`}>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <button onClick={() => fileInputRef.current?.click()} title="Attach image"
                  className="p-1.5 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-white/8 transition-colors shrink-0">
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? "Listening…" : "Message J.A.R.V.I.S."}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder-[#8e8ea0] resize-none focus:outline-none leading-relaxed py-0.5 max-h-40"
                />
                <div className="flex items-center gap-1 shrink-0">
                  {/* Memory toggle icons (decorative, matches screenshot) */}
                  <div className="flex items-center gap-0.5 mr-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">M</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">G</span>
                    </div>
                  </div>
                  {voiceSupported && (
                    <button onClick={toggleListening} title={isListening ? "Stop" : "Voice input"}
                      className={`p-1.5 rounded-lg transition-colors ${isListening ? "text-red-400 bg-red-500/10" : "text-[#8e8ea0] hover:text-white hover:bg-white/8"}`}>
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => handleSend()} disabled={(!inputText.trim() && !selectedImage) || isSending}
                    className="p-1.5 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed text-black transition-colors">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[680px]">
              {SUGGESTIONS.map(({ icon, text }) => (
                <button key={text} onClick={() => handleSend(text)}
                  className="flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border border-white/10 bg-[#2f2f2f] hover:bg-[#3a3a3a] text-sm text-[#c5c5c5] hover:text-white transition-all">
                  {icon}
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-[680px] mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div key={msg.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-white">
                      J
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 ${isUser ? "items-end max-w-[75%]" : "items-start flex-1 min-w-0"}`}>
                    {msg.imageAttachment && (
                      <img src={msg.imageAttachment} alt="Attachment"
                        className="max-h-48 rounded-xl object-cover border border-white/10" />
                    )}
                    <div className={`text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#2f2f2f] text-white px-4 py-2.5 rounded-2xl rounded-br-sm"
                        : "text-[#ececec]"
                    } ${msg.isStreaming ? "opacity-80" : ""}`}>
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : msg.text ? (
                        <div className="prose prose-sm prose-invert max-w-none
                          prose-p:my-1.5 prose-p:leading-relaxed
                          prose-headings:text-white prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-1
                          prose-strong:text-white prose-strong:font-semibold
                          prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                          prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
                          prose-ul:my-1.5 prose-li:my-0.5 prose-ol:my-1.5
                          prose-blockquote:border-l-2 prose-blockquote:border-indigo-500 prose-blockquote:pl-3 prose-blockquote:text-[#8e8ea0]
                          prose-hr:border-white/10
                          prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 py-1">
                          <span className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                      {msg.isStreaming && msg.text && (
                        <span className="inline-block w-0.5 h-4 bg-white/60 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                    {!isUser && !msg.isStreaming && msg.text && (
                      <div className="flex items-center gap-0.5 px-1 mt-0.5">
                        <button onClick={() => speakJarvisText(msg.text)} title="Speak"
                          className="p-1.5 rounded-lg text-[#555] hover:text-[#b4b4b4] hover:bg-white/5 transition-colors">
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleCopy(msg.id, msg.text)} title="Copy"
                          className="p-1.5 rounded-lg text-[#555] hover:text-[#b4b4b4] hover:bg-white/5 transition-colors">
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isSending && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-white">J</div>
                <div className="flex items-center gap-1 py-2">
                  <span className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Fixed input bar (only shown when there are messages) */}
      {!isEmpty && (
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-[680px] mx-auto">
            {selectedImage && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                <img src={selectedImage} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                <span className="text-xs text-[#8e8ea0] flex-1">Image attached</span>
                <button onClick={() => setSelectedImage(null)} className="text-[#8e8ea0] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className={`flex items-center gap-2 bg-[#2f2f2f] border rounded-2xl px-3 py-3 transition-colors ${
              isListening ? "border-red-500/50" : "border-white/10 hover:border-white/20 focus-within:border-white/30"
            }`}>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <button onClick={() => fileInputRef.current?.click()} title="Attach"
                className="p-1.5 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-white/8 transition-colors shrink-0">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening…" : "Message J.A.R.V.I.S."}
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-[#8e8ea0] resize-none focus:outline-none leading-relaxed py-0.5 max-h-40"
              />
              <div className="flex items-center gap-1 shrink-0">
                {voiceSupported && (
                  <button onClick={toggleListening} title={isListening ? "Stop" : "Voice input"}
                    className={`p-1.5 rounded-lg transition-colors ${isListening ? "text-red-400 bg-red-500/10" : "text-[#8e8ea0] hover:text-white hover:bg-white/8"}`}>
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
                <button onClick={() => handleSend()} disabled={(!inputText.trim() && !selectedImage) || isSending}
                  className="p-1.5 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed text-black transition-colors">
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-center text-[12px] text-[#555] pb-3 shrink-0">
        J.A.R.V.I.S. can make mistakes. Verify important information.
      </p>
    </div>
  );
};
