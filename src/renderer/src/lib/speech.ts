import { useCallback, useEffect, useRef, useState } from 'react'

// ---------- text-to-speech: the interviewer reads questions aloud ----------

const LANG_CODES: Record<string, string> = {
  English: 'en', Spanish: 'es', French: 'fr', German: 'de', Hindi: 'hi', Portuguese: 'pt',
  Italian: 'it', Dutch: 'nl', Japanese: 'ja', Korean: 'ko', 'Chinese (Simplified)': 'zh'
}

export function langCode(language: string): string {
  return LANG_CODES[language] ?? 'en'
}

export function useSpeaker(language: string) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const code = langCode(language)
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(code))
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? code
      utterance.rate = 1
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    },
    [language, supported]
  )

  useEffect(() => stop, [stop])
  return { speak, stop, speaking, supported }
}

// ---------- microphone level meter ----------

/** Live 0..1 input level while `active`, so the user can see the mic is picking them up. */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!active) {
      setLevel(0)
      return
    }
    let raf = 0
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let cancelled = false

    void navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(s).connect(analyser)
        const buf = new Float32Array(analyser.fftSize)
        const tick = () => {
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += v * v
          const rms = Math.sqrt(sum / buf.length)
          setLevel((prev) => prev * 0.6 + Math.min(1, rms * 6) * 0.4)
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => setLevel(0))

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [active])
  return level
}

// ---------- dictation (speech-to-text) ----------

interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null
}

/**
 * Wraps the Web Speech recognition API. Electron builds often lack the speech service the
 * API needs, so `unavailable` flips to true on the first service error and the UI falls
 * back to typing.
 */
export function useDictation(language: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [unavailable, setUnavailable] = useState(() => recognitionCtor() === null)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    setError(null)
    const rec = new Ctor()
    rec.lang = langCode(language)
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim())
        else pending += r[0].transcript
      }
      setInterim(pending)
    }
    rec.onerror = (e) => {
      if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
        setUnavailable(true)
        setError('Voice dictation is not available in this environment, so type your answer instead.')
      } else if (e.error === 'not-allowed') {
        setError('Microphone access was blocked. Allow it in your OS privacy settings.')
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Dictation stopped: ${e.error}`)
      }
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
      recRef.current = null
    }
    recRef.current = rec
    rec.start()
    setListening(true)
  }, [language])

  useEffect(() => () => recRef.current?.stop(), [])
  return { listening, interim, unavailable, error, start, stop }
}
