import { useEffect } from 'react'
import type { VoiceState } from '@/hooks/useVoiceMode'

interface Props {
  active: boolean
  voiceState: VoiceState
  transcript: string
  reply: string
  onDismiss: () => void
}

export function VoiceModeOverlay({ active, voiceState, transcript, reply, onDismiss }: Props) {
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onDismiss])

  if (!active) return null

  const isListening = voiceState === 'listening'
  const isSpeaking = voiceState === 'speaking'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(2,8,23,0.92)] backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className="flex flex-col items-center gap-8 px-8 py-12 max-w-md w-full">

        {/* Brand */}
        <span className="font-hud-mono text-[10px] tracking-[0.35em] text-[#4a7fa0]">
          J.A.R.V.I.S — VOICE MODE
        </span>

        {/* Pulse rings + core dot */}
        <div className="relative flex items-center justify-center w-32 h-32">
          {/* Outer expanding ring — only during listening/speaking */}
          {(isListening || isSpeaking) && (
            <span
              className="absolute w-32 h-32 rounded-full border border-[#00d4ff]"
              style={{ animation: 'jv-ring 1.6s ease-out infinite', opacity: 0.4 }}
            />
          )}
          {/* Middle ring */}
          <span
            className="absolute w-20 h-20 rounded-full border border-[#00d4ff]"
            style={{
              animation: isListening ? 'jv-pulse 1.2s ease-in-out infinite' : 'none',
              opacity: isListening ? 0.5 : 0.15,
            }}
          />
          {/* Inner ring */}
          <span
            className="absolute w-12 h-12 rounded-full border border-[#00d4ff]"
            style={{ opacity: isSpeaking ? 0.6 : 0.2 }}
          />
          {/* Core dot */}
          <span
            className="w-3 h-3 rounded-full bg-[#00d4ff]"
            style={{
              animation: voiceState === 'processing'
                ? 'jv-pulse 0.8s ease-in-out infinite'
                : 'none',
              boxShadow: '0 0 12px rgba(0,212,255,0.7)',
            }}
          />
        </div>

        {/* State label */}
        <span className="font-hud-mono text-xs tracking-[0.25em] text-[#00d4ff]">
          {isListening ? 'LISTENING' : voiceState === 'processing' ? 'THINKING' : 'SPEAKING'}
        </span>

        {/* What the user said */}
        {transcript ? (
          <p className="text-center text-sm font-mono text-[#8bb8cc]">
            <span className="text-[#4a7fa0] text-[10px] tracking-widest mr-1">YOU</span>
            &ldquo;{transcript}&rdquo;
          </p>
        ) : isListening ? (
          <p className="font-hud-mono text-[10px] tracking-widest text-[#2a4f60]">
            AWAITING COMMAND
          </p>
        ) : null}

        {/* JARVIS reply */}
        {reply && (
          <p className="text-center text-sm text-[#c8e8f8] max-w-xs leading-relaxed">
            {reply}
          </p>
        )}

        {/* Dismiss hint */}
        <button
          onClick={onDismiss}
          className="mt-4 font-hud-mono text-[9px] tracking-widest text-[#2a4f60] hover:text-[#4a7fa0] transition-colors pointer-events-auto"
        >
          [ ESC OR TAP OUTSIDE TO EXIT ]
        </button>
      </div>
    </div>
  )
}
