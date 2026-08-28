import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { apiFetch } from '../utils/api'
import { speakJarvisText, stopJarvisSpeech, unlockAudioContext } from '../utils/audio'

export type VoiceState = 'listening' | 'processing' | 'speaking'

const EXIT_PHRASES = ['stop', 'exit', 'goodbye', 'bye', 'cancel', 'dismiss', "that's all", 'never mind']

function isExit(text: string): boolean {
  return EXIT_PHRASES.some(p => text.toLowerCase().includes(p))
}

function speak(text: string): Promise<void> {
  return new Promise(resolve => speakJarvisText(text, resolve))
}

// ── Single-shot recognition ───────────────────────────────────────────────────
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
  const res = await apiFetch('/api/voice-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.response as string) || ''
}

// ── Screen wake lock ──────────────────────────────────────────────────────────
// Prevents the screen from dimming/locking during voice sessions.
// Works on Chrome 84+, Safari iOS 16.4+, and Android Chrome.

let _wakeLock: WakeLockSentinel | null = null

async function acquireWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return
  try {
    _wakeLock = await (navigator as any).wakeLock.request('screen')
  } catch { /* denied or not supported */ }
}

function releaseWakeLock(): void {
  if (_wakeLock) {
    _wakeLock.release().catch(() => {})
    _wakeLock = null
  }
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
    if (_abortWeb) { _abortWeb(); _abortWeb = null }
    stopJarvisSpeech()
    if (Capacitor.isNativePlatform()) SpeechRecognition.stop().catch(() => {})
    releaseWakeLock()
    setActive(false)
    setTranscript('')
    setReply('')
  }, [])

  const start = useCallback(() => {
    if (running.current) return

    // Unlock AudioContext while still inside the user-gesture handler
    if (!Capacitor.isNativePlatform()) unlockAudioContext()

    running.current = true
    setActive(true)

    ;(async () => {
      // Keep screen on during voice session
      await acquireWakeLock()

      // Wait for speechSynthesis voices on first load (browser may return [] initially)
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
      releaseWakeLock()
      setActive(false)
    })()
  }, [])

  useEffect(() => () => {
    running.current = false
    stopJarvisSpeech()
    releaseWakeLock()
  }, [])

  return { active, voiceState, transcript, reply, start, stop }
}
