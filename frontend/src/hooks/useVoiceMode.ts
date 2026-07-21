import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export type VoiceState = 'listening' | 'processing' | 'speaking'

const EXIT_PHRASES = ['stop', 'exit', 'goodbye', 'bye', 'cancel', 'dismiss', "that's all", 'never mind']

function isExit(text: string): boolean {
  const t = text.toLowerCase()
  return EXIT_PHRASES.some(p => t.includes(p))
}

// ── TTS ───────────────────────────────────────────────────────────────────────

function speak(text: string): Promise<void> {
  return new Promise(resolve => {
    const synth = window.speechSynthesis
    if (!synth) { resolve(); return }
    synth.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.05
    utt.onend = () => resolve()
    utt.onerror = () => resolve()
    synth.speak(utt)
  })
}

// ── Single-shot recognition ───────────────────────────────────────────────────

function listenWeb(): Promise<string | null> {
  return new Promise(resolve => {
    const w = window as Record<string, unknown>
    const Rec = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as (new () => any) | undefined
    if (!Rec) { resolve(null); return }

    const rec = new Rec()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    let done = false
    const finish = (v: string | null) => { if (!done) { done = true; resolve(v) } }

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
  const res = await fetch('/api/chat', {
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
    window.speechSynthesis?.cancel()
    if (Capacitor.isNativePlatform()) SpeechRecognition.stop().catch(() => {})
    setActive(false)
    setTranscript('')
    setReply('')
  }, [])

  const start = useCallback(() => {
    if (running.current) return
    running.current = true
    setActive(true)

    ;(async () => {
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
