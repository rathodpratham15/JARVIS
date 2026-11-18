import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp, Mic, MicOff, Paperclip, X, Copy, Check, Volume2, MessageSquare,
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
}

const SUGGESTED_PROMPTS = [
  "What's on my calendar today?",
  "Summarize my recent notes and reminders.",
  "Search the web for top AI news today.",
  "Set a reminder for tomorrow morning.",
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
}) => {
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Auto-resize textarea
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
    try {
      await onSendMessage(text, img);
    } catch {}
    finally { setIsSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    <div className="flex flex-col h-screen bg-[#0f0f10]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/5 shrink-0">
        <span className="text-sm font-medium text-zinc-400">J.A.R.V.I.S.</span>
        {messages.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-4 pb-32">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-1">How can I help?</h2>
            <p className="text-sm text-zinc-500 mb-8">Ask me anything, or try one of these</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="text-left px-4 py-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/8 text-sm text-zinc-300 hover:text-white transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  {/* Assistant avatar */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 mr-3">
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  <div className={`flex flex-col gap-1 ${isUser ? "items-end max-w-[75%]" : "items-start flex-1 min-w-0"}`}>
                    {/* Image attachment */}
                    {msg.imageAttachment && (
                      <img
                        src={msg.imageAttachment}
                        alt="Attachment"
                        className="max-h-48 rounded-xl object-cover border border-white/10"
                      />
                    )}

                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "text-zinc-100"
                      } ${msg.isStreaming ? "opacity-80" : ""}`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : msg.text ? (
                        <div className="prose prose-sm prose-invert max-w-none
                          prose-p:my-1 prose-p:leading-relaxed
                          prose-headings:text-white prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                          prose-strong:text-white prose-strong:font-semibold
                          prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                          prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
                          prose-ul:my-1 prose-li:my-0.5
                          prose-ol:my-1
                          prose-blockquote:border-l-2 prose-blockquote:border-indigo-500 prose-blockquote:pl-3 prose-blockquote:text-zinc-400
                          prose-hr:border-white/10
                          prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic text-xs">…</span>
                      )}

                      {/* Streaming indicator */}
                      {msg.isStreaming && (
                        <div className="flex gap-1 mt-2 items-center">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                    </div>

                    {/* Assistant actions */}
                    {!isUser && !msg.isStreaming && msg.text && (
                      <div className="flex items-center gap-1 px-1">
                        <button
                          onClick={() => speakJarvisText(msg.text)}
                          title="Speak"
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          title="Copy"
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                        >
                          {copiedId === msg.id
                            ? <Check className="w-3.5 h-3.5 text-green-400" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isSending && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 mr-3">
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-transparent px-1 py-3 flex items-center gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 pb-5 pt-2 max-w-2xl mx-auto w-full">
        {/* Image preview */}
        {selectedImage && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/8">
            <img src={selectedImage} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-xs text-zinc-400 flex-1">Image attached</span>
            <button onClick={() => setSelectedImage(null)} className="text-zinc-500 hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input pill */}
        <div className={`flex items-end gap-2 bg-[#1c1c1e] border rounded-2xl px-3 py-2.5 shadow-lg transition-colors ${
          isListening ? "border-red-500/50" : "border-white/10 hover:border-white/20 focus-within:border-indigo-500/50"
        }`}>
          {/* Attach */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors shrink-0 self-end mb-0.5"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening…" : "Message J.A.R.V.I.S."}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none focus:outline-none leading-relaxed py-0.5 max-h-40"
          />

          {/* Voice */}
          {voiceSupported && (
            <button
              onClick={toggleListening}
              title={isListening ? "Stop listening" : "Voice input"}
              className={`p-1.5 rounded-lg transition-colors shrink-0 self-end mb-0.5 ${
                isListening
                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/8"
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Send */}
          <button
            onClick={() => handleSend()}
            disabled={(!inputText.trim() && !selectedImage) || isSending}
            title="Send"
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors shrink-0 self-end mb-0.5"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
