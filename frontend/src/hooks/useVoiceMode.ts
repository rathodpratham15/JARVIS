import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export type VoiceState = 'listening' | 'processing' | 'speaking'

const EXIT_PHRASES = ['stop', 'exit', 'goodbye', 'bye', 'cancel', 'dismiss', "that's all", 'never mind']

function isExit(text: string): boolean {
  const t = text.toLowerCase()
  return EXIT_PHRASES.some(p => t.includes(p))
}

// ── Audio unlock ──────────────────────────────────────────────────────────────
// Call synchronously inside a user-gesture handler. Once an AudioContext is
// resumed in a gesture, it stays unlocked for the lifetime of the page —
// no 5-second expiry like the transient activation used by speechSynthesis.

let _audioCtx: AudioContext | null = null

function unlockAudio(): void {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!_audioCtx) _audioCtx = new AC()
    _audioCtx.resume()
  } catch { /* not available */ }
}

// ── TTS ───────────────────────────────────────────────────────────────────────
// Fetches audio bytes from /api/tts and plays via AudioContext.decodeAudioData.
// Using AudioContext (not HTMLAudioElement or speechSynthesis) is the only
// approach that reliably works after a long async chain in Chrome.

async function speak(text: string): Promise<void> {
  // Fetch audio from backend (ElevenLabs or macOS say fallback)
  try {
    const token = localStorage.getItem("jarvis_access_token");
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    })
    if (res.ok && _audioCtx) {
      const arrayBuf = await res.arrayBuffer()
      return new Promise(resolve => {
        _audioCtx!.decodeAudioData(
          arrayBuf,
          decoded => {
            const src = _audioCtx!.createBufferSource()
            src.buffer = decoded
            src.connect(_audioCtx!.destination)
            src.onended = () => resolve()
            src.start(0)
          },
          () => resolve(), // decode error → silent
        )
      })
    }
  } catch { /* fall through */ }

  // Fallback: Web Speech Synthesis
  await new Promise<void>(resolve => {
    const synth = window.speechSynthesis
    if (!synth) { resolve(); return }
    synth.cancel()
    synth.resume()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.0
    utt.lang = 'en-US'
    const voices = synth.getVoices()
    const v = voices.find(v => v.lang.startsWith('en') && v.localService) || voices.find(v => v.lang.startsWith('en'))
    if (v) utt.voice = v
    const fallback = setTimeout(resolve, Math.max(4000, text.length * 65))
    utt.onend = () => { clearTimeout(fallback); resolve() }
    utt.onerror = () => { clearTimeout(fallback); resolve() }
    synth.speak(utt)
  })
}

// ── Single-shot recognition ───────────────────────────────────────────────────
// Exported so stop() can abort an in-flight session immediately, freeing the
// mic before wake-word detection tries to restart.
let _abortWeb: (() => void) | null = null

function listenWeb(): Promise<string | null> {
  return new Promise(resolve => {
    const w = window as unknown as Record<string, unknown>
    const Rec = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as (new () => any) | undefined
    if (!Rec) { resolve(null); return }

    const rec = new Rec()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    let done = false
    const finish = (v: string | null) => {
      _abortWeb = null
      if (!done) { done = true; resolve(v) }
    }

    _abortWeb = () => { try { rec.abort() } catch { /* ignore */ } finish(null) }
    rec.onresult = (e: any) => finish(e.results[0]?.[0]?.transcript?.trim() || null)
    rec.onerror = () => finish(null)
    rec.onend = () => finish(null)
    try { rec.start() } catch { finish(null) }
  })
}

async function listenNative(): Promise<string | null> {
  try {
    const r = await SpeechRecognition.start({
      language: 'en-US', maxResults: 1, partialResults: false, popup: false,
    })
    return r.matches?.[0]?.trim() || null
  } catch { return null }
}

async function sendToBackend(message: string): Promise<string> {
  const res = await fetch('/api/voice-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.response as string) || ''
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceMode() {
  const [active, setActive] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('listening')
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const running = useRef(false)

  const stop = useCallback(() => {
    running.current = false
    // Abort any in-flight web recognition immediately so the mic is freed
    // before useWakeWord tries to restart its own session.
    if (_abortWeb) { _abortWeb(); _abortWeb = null }
    window.speechSynthesis?.cancel()
    if (Capacitor.isNativePlatform()) SpeechRecognition.stop().catch(() => {})
    setActive(false)
    setTranscript('')
    setReply('')
  }, [])

  const start = useCallback(() => {
    if (running.current) return

    // Unlock HTML5 audio and speechSynthesis while still in the gesture handler
    if (!Capacitor.isNativePlatform()) unlockAudio()

    running.current = true
    setActive(true)

    ;(async () => {
      // Wait for speech synthesis voices (first call may return [])
      if (!Capacitor.isNativePlatform() && window.speechSynthesis) {
        if (window.speechSynthesis.getVoices().length === 0) {
          await new Promise<void>(res => {
            const id = setTimeout(res, 1000)
            window.speechSynthesis.onvoiceschanged = () => { clearTimeout(id); res() }
          })
        }
      }

      while (running.current) {
        setVoiceState('listening')
        setTranscript('')
        setReply('')

        const text = Capacitor.isNativePlatform() ? await listenNative() : await listenWeb()
        if (!running.current) break
        if (!text) continue

        setTranscript(text)

        if (isExit(text)) {
          setVoiceState('speaking')
          await speak('Goodbye.')
          break
        }

        setVoiceState('processing')
        let answer = ''
        try {
          answer = await sendToBackend(text)
        } catch {
          answer = "I'm having trouble reaching my core. Please try again."
        }
        if (!running.current) break

        setReply(answer)
        setVoiceState('speaking')
        await speak(answer)
      }

      running.current = false
      setActive(false)
    })()
  }, [])

  useEffect(() => () => {
    running.current = false
    window.speechSynthesis?.cancel()
  }, [])

  return { active, voiceState, transcript, reply, start, stop }
}
