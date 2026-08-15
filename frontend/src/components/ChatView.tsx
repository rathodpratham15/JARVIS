import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Volume2,
  BookmarkPlus,
  Copy,
  Check,
  Paperclip,
  Database,
  Trash2,
  Mic,
  Image as ImageIcon,
  Brain,
  X,
  Radio,
  Sliders,
} from "lucide-react";
import { ChatMessage, PersonalityMode } from "../types";
import { speakJarvisText, playUiSound } from "../utils/audio";

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, imageBase64?: string, useMemory?: boolean) => Promise<void>;
  onClearHistory: () => void;
  onSaveToMemory: (title: string, content: string) => void;
  onSaveToNote: (title: string, content: string) => void;
  personalityMode: PersonalityMode;
  memoriesCount: number;
  onSelectPersonality?: (mode: PersonalityMode) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  onSaveToMemory,
  onSaveToNote,
  personalityMode,
  memoriesCount,
  onSelectPersonality,
}) => {
  const [inputText, setInputText] = useState("");
  const [useMemoryContext, setUseMemoryContext] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedMemId, setSavedMemId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suggestedPrompts = [
    "Summarize today's priority directives, alarms, and schedule.",
    "What's the latest news in AI today?",
    "Summarize my recent notes and reminders.",
    "Search the web for top productivity tools in 2026.",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if ((!textToSend && !selectedImage) || isSending) return;

    playUiSound("beep");
    const imgToSend = selectedImage || undefined;

    setInputText("");
    setSelectedImage(null);
    setIsSending(true);

    try {
      await onSendMessage(textToSend, imgToSend, useMemoryContext);
      playUiSound("success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveMem = (msg: ChatMessage) => {
    onSaveToMemory(`Chat Recall: ${msg.text.slice(0, 32)}...`, msg.text);
    setSavedMemId(msg.id);
    setTimeout(() => setSavedMemId(null), 2000);
  };

  const handleSaveNoteDirective = (msg: ChatMessage) => {
    onSaveToNote(`Directive: ${msg.text.slice(0, 28)}...`, msg.text);
    setSavedNoteId(msg.id);
    setTimeout(() => setSavedNoteId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 01</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Conversational Core
          </h1>
          <p className="label-secondary mt-1">
            REAL-TIME NEURAL DIALOGUE STREAM & SEMANTIC KNOWLEDGE RECALL
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClearHistory}
            className="editorial-btn-outline"
            title="Clear Chat Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR HISTORY</span>
          </button>
          <button
            onClick={() => handleSend("Jarvis, perform full system diagnostic scan and report status.")}
            className="editorial-btn-primary"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>QUICK STATUS SCAN</span>
          </button>
        </div>
      </div>

      {/* 2-Column Editorial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Primary Column: Chat Stream Panel (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <div className="editorial-panel flex flex-col min-h-[560px] h-[640px]">
            {/* Panel Overline & Title */}
            <div className="flex items-center justify-between">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                  Dialogue Stream
                </h2>
                <p className="text-xs text-[#555] font-sans mt-0.5">
                  Direct cognitive exchange with J.A.R.V.I.S. LLM subroutines
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                <span className="font-mono text-[10px] font-bold text-[#1a1a1a] uppercase">
                  STREAM ACTIVE
                </span>
              </div>
            </div>

            <div className="border-b border-[#1a1a1a] my-4" />

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-[#1a1a1a]/30 bg-[#EBEBEA]">
                  <div className="w-10 h-10 border border-[#1a1a1a] bg-[#00E5FF] flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#1a1a1a]">
                    Dialogue Stream Standing By
                  </h3>
                  <p className="font-mono text-xs text-[#555] max-w-sm mt-1">
                    Enter an operational command below or select one of the suggested directives in Panel 02.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      {/* Message Meta Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] uppercase font-bold text-[#555]">
                          {isUser ? "YOU" : "J.A.R.V.I.S."}
                        </span>
                        <span className="text-[#555] text-[10px]">•</span>
                        <span className="font-mono text-[10px] text-[#555]">
                          {msg.timestamp}
                        </span>
                        {msg.memoryUsed && (
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a]">
                            MEMORY RECALLED
                          </span>
                        )}
                      </div>

                      {/* Message Card */}
                      <div
                        className={`max-w-[90%] sm:max-w-[80%] p-4 text-xs font-mono border border-[#1a1a1a] ${
                          isUser
                            ? "bg-[#00E5FF] text-black font-semibold"
                            : "bg-[#EBEBEA] text-[#1a1a1a]"
                        }`}
                      >
                        {msg.imageAttachment && (
                          <img
                            src={msg.imageAttachment}
                            alt="Attachment"
                            className="max-h-48 border border-[#1a1a1a] mb-2 object-cover"
                          />
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </p>

                        {/* Jarvis Message Actions */}
                        {!isUser && (
                          <div className="flex items-center gap-3 pt-3 mt-3 border-t border-[#1a1a1a]/20">
                            <button
                              onClick={() => speakJarvisText(msg.text)}
                              className="text-[10px] font-mono uppercase flex items-center gap-1 text-[#1a1a1a] hover:text-[#00E5FF] transition font-bold"
                              title="Synthesize Voice"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>SPEAK</span>
                            </button>
                            <button
                              onClick={() => handleCopy(msg.id, msg.text)}
                              className="text-[10px] font-mono uppercase flex items-center gap-1 text-[#1a1a1a] hover:text-[#00E5FF] transition font-bold"
                              title="Copy to Clipboard"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedId === msg.id ? "COPIED" : "COPY"}</span>
                            </button>
                            <button
                              onClick={() => handleSaveMem(msg)}
                              className="text-[10px] font-mono uppercase flex items-center gap-1 text-[#1a1a1a] hover:text-[#00E5FF] transition font-bold"
                              title="Save into Semantic Memory"
                            >
                              <BookmarkPlus className="w-3 h-3" />
                              <span>{savedMemId === msg.id ? "SAVED TO MEM" : "SAVE MEM"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {isSending && (
                <div className="flex flex-col items-start space-y-1">
                  <span className="overline-cyan">J.A.R.V.I.S. COGNITIVE ENGINE</span>
                  <div className="p-3 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center gap-2 font-mono text-xs text-[#1a1a1a]">
                    <span className="w-2 h-2 bg-[#00E5FF] border border-[#1a1a1a] animate-ping" />
                    <span>Processing neural token stream...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Banner */}
            {selectedImage && (
              <div className="mt-2 p-2 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={selectedImage}
                    alt="Upload Preview"
                    className="h-10 w-10 object-cover border border-[#1a1a1a]"
                  />
                  <span className="font-mono text-xs text-[#1a1a1a]">
                    Optical Image Attachment Attached
                  </span>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-1 text-[#1a1a1a] hover:bg-black/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="pt-4 border-t border-[#1a1a1a] flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-3 border border-[#1a1a1a] bg-[#EBEBEA] hover:bg-black/5 flex items-center justify-center transition"
                title="Attach Optical Frame"
              >
                <ImageIcon className="w-4 h-4 text-[#1a1a1a]" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="INPUT COMMAND OR QUESTION..."
                className="editorial-input h-10"
              />

              <button
                onClick={() => handleSend()}
                disabled={(!inputText.trim() && !selectedImage) || isSending}
                className="editorial-btn-primary h-10 px-5"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SEND</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Secondary Column: Cognitive & Memory Panel (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                Cognitive Context
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Dynamic grounding and memory state parameters
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {/* Memory Link Toggle */}
            <div className="p-4 bg-[#EBEBEA] border border-[#1a1a1a] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#1a1a1a]" />
                  <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                    SEMANTIC VECTOR LINK
                  </span>
                </div>
                <button
                  onClick={() => setUseMemoryContext(!useMemoryContext)}
                  className={`w-9 h-5 border border-[#1a1a1a] transition p-0.5 flex items-center ${
                    useMemoryContext ? "bg-[#00E5FF] justify-end" : "bg-[#ccc] justify-start"
                  }`}
                >
                  <div className="w-3.5 h-3.5 bg-black" />
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#555]">
                {useMemoryContext
                  ? `Active: ${memoriesCount} memory nodes automatically injected into context buffer.`
                  : "Disabled: Conversation operates with transient stateless buffer."}
              </p>
            </div>

            {/* Active Directive Protocol */}
            <div className="space-y-2">
              <span className="label-secondary">ACTIVE PERSONALITY PROTOCOL</span>
              <div className="p-3 bg-[#EBEBEA] border border-[#1a1a1a] flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                  {personalityMode}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a]">
                  ACTIVE
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Suggested Macro Directives */}
            <div className="space-y-2.5">
              <span className="label-secondary">SUGGESTED OPERATIONAL MACROS</span>
              <div className="space-y-2">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="w-full text-left p-2.5 bg-[#EBEBEA] hover:bg-[#00E5FF] hover:text-black border border-[#1a1a1a] font-mono text-[11px] text-[#1a1a1a] transition font-medium"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Session Readout */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>SESSION MESSAGES</span>
                <span className="font-bold text-[#1a1a1a]">{messages.length}</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>AVG LATENCY</span>
                <span className="font-bold text-[#1a1a1a]">24ms</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>GROUNDING ENGINE</span>
                <span className="font-bold text-[#1a1a1a]">GEMINI 3.6 FLASH</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
