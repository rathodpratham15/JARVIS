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

// Chrome requires speechSynthesis to be "unlocked" inside a synchronous
// user-gesture handler before any async speak() call will produce audio.
// Call this immediately when the user triggers voice mode.
function unlockSpeech(): void {
  const synth = window.speechSynthesis
  if (!synth) return
  const u = new SpeechSynthesisUtterance('')
  u.volume = 0
  synth.speak(u)
}

function speak(text: string): Promise<void> {
  return new Promise(resolve => {
    const synth = window.speechSynthesis
    if (!synth) { resolve(); return }

    synth.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.0
    utt.lang = 'en-US'

    // Prefer a local English voice — Google voices require network and can fail
    const voices = synth.getVoices()
    const preferred =
      voices.find(v => v.lang.startsWith('en') && v.localService) ||
      voices.find(v => v.lang.startsWith('en'))
    if (preferred) utt.voice = preferred

    let resolved = false
    const done = () => { if (!resolved) { resolved = true; resolve() } }

    utt.onend = done
    utt.onerror = done

    // Chrome bug: onend sometimes silently never fires (especially after
    // a page-load or when the tab loses focus mid-utterance). Resolve after
    // a generous estimate so the conversation loop doesn't hang.
    const fallbackMs = Math.max(4000, text.length * 65)
    const fallback = setTimeout(done, fallbackMs)
    utt.onend = () => { clearTimeout(fallback); done() }
    utt.onerror = () => { clearTimeout(fallback); done() }

    synth.speak(utt)

    // Second Chrome bug: speak() may be a no-op if the audio context is
    // suspended (autoplay policy). Resume it then re-queue if needed.
    setTimeout(() => {
      if (!resolved && !synth.speaking) {
        synth.cancel()
        synth.speak(utt)
      }
    }, 250)
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
    window.speechSynthesis?.cancel()
    if (Capacitor.isNativePlatform()) SpeechRecognition.stop().catch(() => {})
    setActive(false)
    setTranscript('')
    setReply('')
  }, [])

  const start = useCallback(() => {
    if (running.current) return

    // Unlock speech synthesis while still inside the user-gesture call stack —
    // must happen before any async work or Chrome will silently block audio.
    if (!Capacitor.isNativePlatform()) unlockSpeech()

    running.current = true
    setActive(true)

    ;(async () => {
      // Wait for voices to load (first call to getVoices may return [])
      if (!Capacitor.isNativePlatform() && window.speechSynthesis) {
        if (window.speechSynthesis.getVoices().length === 0) {
          await new Promise<void>(res => {
            const id = setTimeout(res, 1000) // fallback if event never fires
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
