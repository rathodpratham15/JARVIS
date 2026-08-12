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
  const isProcessing = voiceState === 'processing'
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

        {/* Ring visualiser */}
        <div className="relative flex items-center justify-center w-36 h-36">

          {/* Outer expanding ripple — listening & speaking */}
          {(isListening || isSpeaking) && (
            <span
              className="absolute w-36 h-36 rounded-full border border-[#00d4ff]"
              style={{ animation: 'jv-ring 1.6s ease-out infinite', opacity: 0.45 }}
            />
          )}

          {/* Second delayed ripple during speaking — gives a "wave" feel */}
          {isSpeaking && (
            <span
              className="absolute w-36 h-36 rounded-full border border-[#00d4ff]"
              style={{ animation: 'jv-ring 1.6s ease-out 0.55s infinite', opacity: 0.3 }}
            />
          )}

          {/* Middle ring */}
          <span
            className="absolute w-24 h-24 rounded-full border border-[#00d4ff]"
            style={{
              animation: isListening
                ? 'jv-pulse 1.2s ease-in-out infinite'
                : isSpeaking
                ? 'jv-pulse 0.7s ease-in-out infinite'
                : 'none',
              opacity: isListening ? 0.5 : isSpeaking ? 0.55 : 0.12,
            }}
          />

          {/* Inner ring */}
          <span
            className="absolute w-14 h-14 rounded-full border border-[#00d4ff]"
            style={{
              opacity: isSpeaking ? 0.7 : isListening ? 0.3 : 0.15,
              animation: isSpeaking ? 'jv-pulse 0.9s ease-in-out infinite' : 'none',
            }}
          />

          {/* Core dot */}
          <span
            className="w-3 h-3 rounded-full bg-[#00d4ff]"
            style={{
              animation: isProcessing
                ? 'jv-pulse 0.6s ease-in-out infinite'
                : 'none',
              boxShadow: isSpeaking
                ? '0 0 18px rgba(0,212,255,0.9)'
                : '0 0 10px rgba(0,212,255,0.6)',
            }}
          />
        </div>

        {/* State label */}
        <span className="font-hud-mono text-xs tracking-[0.25em] text-[#00d4ff]">
          {isListening ? 'LISTENING' : isProcessing ? 'THINKING' : 'SPEAKING'}
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
