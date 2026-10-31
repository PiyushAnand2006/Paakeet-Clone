import {
  ArrowLeft,
  AudioLines,
  Camera,
  Captions,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Download,
  Mic,
  MicOff,
  PictureInPicture2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CoachAnswer, Session, TranscriptEntry } from '@shared/types'
import { Markdown } from '@/components/Markdown'
import { SOURCE_LABEL, TranscriptFeed, ZOOM_STEPS } from '@/components/TranscriptFeed'
import { Alert, Badge, Button, Card, ConfirmDialog, Input, Spinner, Switch, cn } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import { href, navigate } from '@/lib/router'
import { useSettings } from '@/lib/settings'
import { langCode, useDictation, useMicLevel } from '@/lib/speech'
import { useAiStream } from '@/lib/useAiStream'

/** How much shared audio goes to the transcription endpoint per request. */
const CHUNK_MS = 12_000
/** Suggested answers kept per session; older ones drop off so the data file stays small. */
const MAX_ANSWERS = 50
/** Floor between automatic suggestions, so a busy call cannot run up a bill. */
const AUTO_COOLDOWN_MS = 6_000

/** The newest line from shared audio, which is where the interviewer's question lands. */
function lastInterviewerLine(entries: TranscriptEntry[]): string {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].source === 'system') return entries[i].text
  }
  return ''
}

function transcriptMarkdown(session: Session, startedAt: number, entries: TranscriptEntry[]): string {
  const lines = entries.map(
    (t) => `**[${formatDuration((t.at - startedAt) / 1000)}] ${SOURCE_LABEL[t.source]}:** ${t.text}`
  )
  return `# ${session.title}\n\n${new Date(startedAt).toLocaleString()}\n\n${lines.join('\n\n')}\n`
}

/**
 * The live room. Shell stays themed; this screen always renders dark.
 * It transcribes your microphone where the platform speech service is available, keeps
 * shared call audio for the recording, and saves everything into the session on exit.
 */
export function LiveSession({ sessionId }: { sessionId: string }) {
  const { settings } = useSettings()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const [draft, setDraft] = useState('')
  const [zoom, setZoom] = useState(1)
  const [elapsed, setElapsed] = useState(0)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [consentOpen, setConsentOpen] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [shareLevel, setShareLevel] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const canTranscribe = Boolean(settings?.hasTranscribeKey && settings.transcribeBaseUrl)
  /** Answers are written either way; "review" keeps them off the screen and out of the coach window. */
  const coachReview = (settings?.coachMode ?? 'live') === 'review'
  const [transcribeOn, setTranscribeOn] = useState(true)
  const [answers, setAnswers] = useState<CoachAnswer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoCoach, setAutoCoach] = useState(false)
  const [coachDraft, setCoachDraft] = useState('')
  const [coachNotice, setCoachNotice] = useState<string | null>(null)

  const startedAtRef = useRef(Date.now())
  const entriesRef = useRef<TranscriptEntry[]>([])
  entriesRef.current = entries
  const lastActivityRef = useRef(Date.now())
  const dirtyRef = useRef(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const endedRef = useRef(false)
  const answersRef = useRef<CoachAnswer[]>([])
  answersRef.current = answers
  /** What the answer being streamed right now should be saved as. */
  const pendingRef = useRef<{ kind: CoachAnswer['kind']; origin: CoachAnswer['origin']; question: string } | null>(null)
  const streamingRef = useRef(false)
  const lastAutoAtRef = useRef(0)
  const lastAutoEntryRef = useRef<string | null>(null)

  // One streaming job at a time: the coach answer, saved once the model finishes.
  const stream = useAiStream((text) => {
    const meta = pendingRef.current
    pendingRef.current = null
    if (!meta || !text.trim()) return
    const answer: CoachAnswer = { id: crypto.randomUUID(), createdAt: Date.now(), ...meta, text }
    const next = [...answersRef.current, answer].slice(-MAX_ANSWERS)
    setAnswers(next)
    setSelectedId(answer.id)
    void window.rehearse.sessions.setCoachAnswers(sessionId, next).catch(() => undefined)
  })
  streamingRef.current = stream.status === 'streaming'

  const addEntry = useCallback((source: TranscriptEntry['source'], text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    lastActivityRef.current = Date.now()
    dirtyRef.current = true
    setEntries((prev) => [...prev, { id: crypto.randomUUID(), at: Date.now(), source, text: trimmed }])
  }, [])

  const language = session?.language ?? settings?.defaultLanguage ?? 'English'
  const dictation = useDictation(language, (text) => addEntry('mic', text))
  const micLevel = useMicLevel(dictation.listening)

  useEffect(() => {
    if (dictation.error) setNotice(dictation.error)
  }, [dictation.error])

  // Load the session (a live room can be opened for any session type).
  useEffect(() => {
    void window.rehearse.sessions.get(sessionId).then((s) => {
      if (!s) {
        setMissing(true)
        setLoading(false)
        return
      }
      setSession(s)
      setEntries(s.transcript)
      setAnswers(s.coachAnswers ?? [])
      setSelectedId(s.coachAnswers?.[s.coachAnswers.length - 1]?.id ?? null)
      startedAtRef.current = s.liveStartedAt ?? Date.now()
      setElapsed(s.liveStartedAt ? Math.floor((Date.now() - s.liveStartedAt) / 1000) : 0)
      setLoading(false)
    })
  }, [sessionId])

  // Session timer.
  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Mirror the transcript into the companion window whenever it changes.
  const companionState = useCallback(
    () =>
      window.rehearse.companion.push({
        sessionId,
        title: session?.title ?? 'Session',
        startedAt: startedAtRef.current,
        entries: entriesRef.current,
        interim: dictation.interim,
        listening: dictation.listening
      }),
    [sessionId, session?.title, dictation.interim, dictation.listening]
  )
  useEffect(() => {
    companionState()
  }, [entries, companionState])
  useEffect(
    () => () => {
      void window.rehearse.companion.push({ clear: true })
    },
    []
  )

  // ---- answer coach ----
  const askCoach = useCallback(
    async (kind: CoachAnswer['kind'], origin: CoachAnswer['origin'], typedQuestion?: string) => {
      if (streamingRef.current) return
      setCoachNotice(null)
      let screenshotDataUrl: string | undefined
      if (kind === 'screenshot') {
        try {
          screenshotDataUrl = await window.rehearse.coach.capture()
        } catch (err) {
          setCoachNotice(err instanceof Error ? err.message : String(err))
          return
        }
      }
      // A question you type is sent as the interviewer's line, so solo practice still works.
      const typed = typedQuestion?.trim()
      const captured = entriesRef.current
      const transcript = (typed
        ? [...captured, { id: crypto.randomUUID(), at: Date.now(), source: 'system' as const, text: typed }]
        : captured
      ).slice(-40)
      pendingRef.current = { kind, origin, question: typed || lastInterviewerLine(captured) }
      void stream.start({ kind: 'coach-answer', sessionId, transcript, screenshotDataUrl })
    },
    [sessionId, stream.start]
  )

  /** The coach window is refused while the room keeps its answers for the debrief. */
  const openCoach = useCallback(async () => {
    if (coachReview) {
      setCoachNotice('This room keeps its answers for the debrief, so the coach window stays closed.')
      return
    }
    const opened = await window.rehearse.coach.open().catch(() => false)
    if (!opened) setCoachNotice('The coach window could not be opened right now.')
  }, [coachReview])

  const selectRelative = useCallback((delta: number) => {
    setSelectedId((current) => {
      const list = answersRef.current
      if (!list.length) return null
      const at = current ? list.findIndex((a) => a.id === current) : list.length - 1
      const next = Math.min(list.length - 1, Math.max(0, (at < 0 ? list.length - 1 : at) + delta))
      return list[next]?.id ?? null
    })
  }, [])

  const clearAnswers = useCallback(() => {
    stream.cancel()
    pendingRef.current = null
    setAnswers([])
    setSelectedId(null)
    void window.rehearse.sessions.setCoachAnswers(sessionId, []).catch(() => undefined)
  }, [sessionId, stream.cancel])

  // Mirror the answer history into the coach window; the text being written travels separately.
  // A room in review mode mirrors nothing: its answers are kept for the debrief instead.
  const coachWindowState = useCallback(() => {
    if (coachReview) return
    window.rehearse.coach.push({
      sessionId,
      title: session?.title ?? 'Session',
      startedAt: startedAtRef.current,
      answers,
      selectedId
    })
  }, [coachReview, sessionId, session?.title, answers, selectedId])
  useEffect(() => {
    coachWindowState()
  }, [coachWindowState])
  useEffect(
    () => () => {
      void window.rehearse.coach.push({ clear: true })
    },
    []
  )
  useEffect(() => {
    if (coachReview) return
    window.rehearse.coach.pushStream({ text: stream.text, isStreaming: stream.status === 'streaming' })
  }, [stream.text, stream.status, coachReview])

  useEffect(() => {
    if (stream.error) setCoachNotice(stream.error)
  }, [stream.error])

  // Hold the live-room shortcuts only while this room is open, and tell the main process
  // whether the coach window may be shown at all.
  useEffect(() => {
    let dropped = false
    void window.rehearse.coach
      .setActive(true, !coachReview)
      .then((shortcuts) => {
        if (!dropped && shortcuts.failed.length) {
          setCoachNotice(`Another app is using ${shortcuts.failed.join(', ')}, so those shortcuts stay unavailable.`)
        }
      })
      .catch(() => undefined)
    return () => {
      dropped = true
      void window.rehearse.coach.setActive(false).catch(() => undefined)
    }
  }, [coachReview])

  // Shortcuts and the coach window's own buttons both land here.
  useEffect(
    () =>
      window.rehearse.coach.onAction((action) => {
        if (action === 'previous') selectRelative(-1)
        else if (action === 'next') selectRelative(1)
        else if (action === 'clear') clearAnswers()
        else if (action === 'answer') void askCoach('answer', 'manual')
        else if (action === 'screenshot') void askCoach('screenshot', 'manual')
        else if (action === 'coach' && coachReview) {
          setCoachNotice('This room keeps its answers for the debrief, so the coach window stays closed.')
        }
      }),
    [askCoach, selectRelative, clearAnswers, coachReview]
  )

  // Auto-suggest answers the newest shared-audio line, with a cooldown between runs.
  useEffect(() => {
    if (!autoCoach || loading || missing) return
    const last = entries[entries.length - 1]
    if (!last || last.source !== 'system' || lastAutoEntryRef.current === last.id) return
    if (stream.status === 'streaming') return
    if (Date.now() - lastAutoAtRef.current < AUTO_COOLDOWN_MS) return
    lastAutoEntryRef.current = last.id
    lastAutoAtRef.current = Date.now()
    void askCoach('answer', 'auto')
  }, [entries, autoCoach, loading, missing, stream.status, askCoach])

  // Keep the transcript pinned to the newest line.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [entries.length, dictation.interim])

  // Debounced autosave of the transcript into the session record.
  useEffect(() => {
    if (loading || missing) return
    const timer = setInterval(() => {
      if (!dirtyRef.current || endedRef.current) return
      dirtyRef.current = false
      void window.rehearse.sessions
        .setTranscript(sessionId, entriesRef.current)
        .then((s) => setSession(s))
        .catch(() => {
          dirtyRef.current = true
        })
    }, 4000)
    return () => clearInterval(timer)
  }, [sessionId, loading, missing])

  const endRoom = useCallback(
    async (reason: 'manual' | 'inactivity') => {
      if (endedRef.current) return
      endedRef.current = true
      dictation.stop()
      stopShare()
      if (reason === 'inactivity') addEntry('system', 'Session ended automatically after inactivity.')
      await window.rehearse.sessions.setTranscript(sessionId, entriesRef.current).catch(() => undefined)
      await window.rehearse.sessions.endLive(sessionId).catch(() => undefined)
      navigate(href.summary(sessionId))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addEntry, sessionId]
  )

  // Inactivity auto-end (unless disabled in Settings).
  useEffect(() => {
    const minutes = settings?.inactivityEndMinutes ?? 0
    if (!minutes) return
    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > minutes * 60_000) void endRoom('inactivity')
    }, 15_000)
    return () => clearInterval(timer)
  }, [endRoom, settings?.inactivityEndMinutes])

  // ---- share audio (system loopback capture) ----
  const shareStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcribeStopRef = useRef<(() => void) | null>(null)

  /**
   * Rolls the shared audio through self-contained ~12s recordings and sends each one to the
   * transcription endpoint in order. MediaRecorder webm chunks are only decodable from the
   * start, so each cycle records a fresh blob rather than splitting one stream.
   */
  function startTranscription(tracks: MediaStreamTrack[]) {
    let stopped = false
    let chain: Promise<void> = Promise.resolve()
    const cycle = () => {
      if (stopped) return
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(new MediaStream(tracks))
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = () => {
        if (!stopped && chunks.length) {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          chain = chain.then(async () => {
            try {
              const buffer = new Uint8Array(await blob.arrayBuffer())
              const text = await window.rehearse.transcribe.chunk(buffer, langCode(language))
              if (!stopped && text) addEntry('system', text)
            } catch (err) {
              if (!stopped) setNotice(err instanceof Error ? err.message : String(err))
            }
          })
        }
        if (!stopped) cycle()
      }
      recorder.start()
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, CHUNK_MS)
    }
    cycle()
    transcribeStopRef.current = () => {
      stopped = true
    }
  }

  function stopShare() {
    transcribeStopRef.current?.()
    transcribeStopRef.current = null
    recorderRef.current?.state === 'recording' && recorderRef.current.stop()
    shareStreamRef.current?.getTracks().forEach((t) => t.stop())
    shareStreamRef.current = null
    recorderRef.current = null
    setSharing(false)
    setShareLevel(0)
  }

  async function toggleShare() {
    if (sharing) {
      stopShare()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints
      })
      const audio = stream.getAudioTracks()
      if (!audio.length) {
        stream.getTracks().forEach((t) => t.stop())
        setNotice('The selected source had no audio. Pick a screen or window and tick "Share audio".')
        return
      }
      shareStreamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopShare())
      chunksRef.current = []
      const recorder = new MediaRecorder(new MediaStream(audio))
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.start(2000)
      recorderRef.current = recorder
      addEntry('system', 'Started sharing audio from the call.')
      setSharing(true)
      if (canTranscribe && transcribeOn) startTranscription(audio)

      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(new MediaStream(audio)).connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      const tick = () => {
        if (shareStreamRef.current !== stream) {
          void ctx.close()
          return
        }
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += v * v
        const rms = Math.sqrt(sum / buf.length)
        if (rms > 0.035) lastActivityRef.current = Date.now()
        setShareLevel(Math.min(1, rms * 6))
        requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // User cancelled the picker; nothing to clean up.
    }
  }

  async function saveAudio() {
    if (!chunksRef.current.length) {
      setNotice('No audio has been captured in this session yet.')
      return
    }
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const buffer = new Uint8Array(await blob.arrayBuffer())
    const path = await window.rehearse.transcript.saveAudio(session!.title, buffer)
    setNotice(path ? 'Audio saved.' : 'Audio not saved.')
  }

  const context = useMemo(() => {
    if (!session) return null
    return [session.role, session.company].filter(Boolean).join(' · ')
  }, [session])

  const selectedAnswer = answers.find((a) => a.id === selectedId) ?? null
  const selectedIndex = selectedAnswer ? answers.findIndex((a) => a.id === selectedAnswer.id) : -1
  const coachBusy = stream.status === 'streaming'
  const coachBody = coachBusy ? stream.text : (selectedAnswer?.text ?? '')

  if (loading) {
    return (
      <div className="p-8">
        <Spinner label="Opening the live room…" />
      </div>
    )
  }
  if (missing || !session) {
    return (
      <div className="p-8">
        <Alert>This session no longer exists.</Alert>
      </div>
    )
  }

  return (
    <div className="dark flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(href.dashboard)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-semibold tracking-tight">{session.title}</h1>
            <Badge tone={session.type === 'call' ? 'document' : 'session'}>
              {session.type === 'interview' ? 'Interview' : session.type === 'call' ? 'Regular call' : 'Practice'}
            </Badge>
          </div>
          {context && <div className="truncate text-xs text-muted-foreground">{context}</div>}
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 font-mono text-sm tabular-nums">
          <span className={cn('inline-block size-2 rounded-full', dictation.listening ? 'bg-primary' : 'bg-status-ended')} />
          {formatDuration(elapsed)}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1">
          <button
            type="button"
            aria-label="Zoom out"
            className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setZoom(1)}
          >
            A
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
          >
            <ZoomIn className="size-4" />
          </button>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open answer coach window"
          title={
            coachReview
              ? 'This room keeps its answers for the debrief, so the coach window stays closed'
              : 'Open the always-on-top answer coach (visible to everyone)'
          }
          onClick={() => void openCoach()}
        >
          <Sparkles className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open companion window"
          title="Open the always-on-top companion window (visible to everyone)"
          onClick={() => void window.rehearse.companion.open()}
        >
          <PictureInPicture2 className="size-4" />
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmEnd(true)}>
          <CircleStop className="size-4" /> End session
        </Button>
      </header>

      {consentOpen && (
        <div className="border-b border-border bg-warning/10 px-5 py-2 text-xs text-warning-text">
          <span className="font-medium">A note on consent:</span> everyone on the call should know you are keeping
          notes and audio.{' '}
          <button type="button" className="cursor-pointer underline" onClick={() => setConsentOpen(false)}>
            Got it
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Transcript */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {entries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <AudioLines className="mb-3 size-8" />
                <p className="text-sm font-medium text-foreground">
                  {dictation.unavailable ? 'Live dictation is unavailable here.' : 'The live room is open.'}
                </p>
                <p className="mt-1 max-w-sm text-[13px] leading-relaxed">
                  {dictation.unavailable
                    ? 'This environment has no speech service, so type lines below as the call goes. Everything is kept in the transcript and can be written up at the end.'
                    : 'Start dictation to capture what you say, or type a line below. Shared call audio is kept for the recording and shows as a level meter here.'}
                </p>
              </div>
            ) : (
              <TranscriptFeed entries={entries} interim={dictation.interim} zoom={zoom} startedAt={startedAtRef.current} />
            )}
          </div>

          {/* Input row */}
          <div className="border-t border-border px-5 py-3">
            {notice && (
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{notice}</span>
                <button type="button" className="cursor-pointer underline" onClick={() => setNotice(null)}>
                  Dismiss
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                disabled={dictation.unavailable}
                aria-label={dictation.listening ? 'Stop dictation' : 'Start dictation'}
                className={cn(
                  'relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
                  dictation.listening ? 'bg-danger text-white' : 'bg-muted text-foreground hover:bg-accent disabled:opacity-40'
                )}
              >
                {dictation.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {micLevel > 0.08 && (
                  <span
                    className="absolute inset-0 rounded-full border border-primary/60"
                    style={{ transform: `scale(${1 + micLevel * 0.5})` }}
                  />
                )}
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    addEntry('mic', draft)
                    setDraft('')
                  }
                }}
                placeholder={dictation.listening ? 'Listening… you can also type here' : 'Type a line for the transcript…'}
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <Button
                variant={sharing ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => void toggleShare()}
                title="Share a screen or window with its audio"
              >
                <AudioLines className="size-4" /> {sharing ? 'Stop share' : 'Share audio'}
                {sharing && (
                  <span className="ml-1 inline-block h-3 w-8 overflow-hidden rounded-sm bg-muted">
                    <span
                      className="block h-full bg-violet-500 transition-[width] duration-150"
                      style={{ width: `${Math.round(shareLevel * 100)}%` }}
                    />
                  </span>
                )}
              </Button>
              {canTranscribe && (
                <button
                  type="button"
                  aria-pressed={transcribeOn}
                  onClick={() => setTranscribeOn((v) => !v)}
                  title="Turn shared audio into transcript lines while sharing"
                  className={cn(
                    'flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    transcribeOn
                      ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  <Captions className="size-3.5" /> Transcribe
                </button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (draft.trim()) {
                    addEntry('mic', draft)
                    setDraft('')
                  }
                }}
                disabled={!draft.trim()}
              >
                <Plus className="size-4" /> Add
              </Button>
            </div>
          </div>
        </div>

        {/* Context rail */}
        <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border px-4 py-4 lg:flex">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold">Answer coach</h2>
              <Badge tone={coachReview ? 'document' : 'warning'}>{coachReview ? 'For the debrief' : 'On screen'}</Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {coachReview
                ? 'Suggests how to answer the interviewer’s latest line, and files each answer in this session’s debrief instead of showing it during the call.'
                : 'Suggests how to answer the interviewer’s latest line. It sits on this screen, so anyone you share it with sees the answers too.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void askCoach('answer', 'manual')} disabled={coachBusy}>
                <Sparkles className="size-4" /> Answer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void askCoach('screenshot', 'manual')}
                disabled={coachBusy}
                title="Take one still of your screen and get help with what is on it"
              >
                <Camera className="size-4" /> Screenshot
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void openCoach()}
                title={
                  coachReview
                    ? 'This room keeps its answers for the debrief, so the coach window stays closed'
                    : 'Show the answers in a separate always-on-top window'
                }
              >
                <PictureInPicture2 className="size-4" /> Window
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium">Auto-suggest</div>
                <p className="text-[11px] leading-snug text-muted-foreground">Answer each new shared line without asking.</p>
              </div>
              <Switch checked={autoCoach} onChange={setAutoCoach} label="Auto-suggest answers" />
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!coachDraft.trim() || coachBusy) return
                void askCoach('answer', 'manual', coachDraft)
                setCoachDraft('')
              }}
            >
              <Input
                value={coachDraft}
                onChange={(e) => setCoachDraft(e.target.value)}
                placeholder="Or type the question you were asked…"
                aria-label="Question to answer"
                className="h-8 text-[13px]"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={!coachDraft.trim() || coachBusy}>
                Ask
              </Button>
            </form>

            {coachReview ? (
              <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {coachBusy
                  ? 'Writing an answer…'
                  : answers.length
                    ? `${answers.length} ${answers.length === 1 ? 'answer' : 'answers'} saved for the debrief. Nothing appears here.`
                    : 'Answers are collected for this session’s debrief instead of being shown on screen.'}
              </p>
            ) : (
              (coachBody || coachBusy) && (
                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-background px-3 py-2">
                  {coachBody ? (
                    <Markdown streaming={coachBusy} className="text-[12.5px]">
                      {coachBody}
                    </Markdown>
                  ) : (
                    <span className="text-xs text-muted-foreground">Writing…</span>
                  )}
                </div>
              )
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
              <span>{answers.length ? `${answers.length} saved` : 'No answers yet'}</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Previous answer"
                  disabled={selectedIndex <= 0}
                  className="cursor-pointer rounded-md p-1 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => selectRelative(-1)}
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next answer"
                  disabled={selectedIndex >= answers.length - 1}
                  className="cursor-pointer rounded-md p-1 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => selectRelative(1)}
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Clear answers"
                  disabled={!answers.length && !coachBusy}
                  className="cursor-pointer rounded-md p-1 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  onClick={clearAnswers}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {coachNotice && <p className="mt-2 text-[11px] leading-snug text-warning-text">{coachNotice}</p>}

            <p className="mt-2 border-t border-border pt-2 text-[10.5px] leading-relaxed text-muted-foreground/80">
              While this room is open: Ctrl/Cmd+Enter answer · Ctrl/Cmd+Shift+Enter screenshot · Ctrl/Cmd+Shift+←/→
              history · Ctrl/Cmd+Shift+Space hide coach.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold">Session context</h2>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              {context && (
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{context}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Language · model</dt>
                <dd>
                  {session.language} · {session.model.replace('claude-', 'Claude ')}
                </dd>
              </div>
            </dl>
            {session.jobDescription && (
              <p className="mt-3 line-clamp-6 whitespace-pre-line border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
                {session.jobDescription}
              </p>
            )}
            {session.instructions && (
              <p className="mt-2 line-clamp-3 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
                {session.instructions}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold">Wrap-up</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Ending the session saves the transcript to this session and writes up the notes with the selected model.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveAudio()}
                disabled={!sharing && !chunksRef.current.length}
              >
                <Download className="size-4" /> Save call audio
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void window.rehearse.transcript.save(session.title, transcriptMarkdown(session, startedAtRef.current, entriesRef.current))}
              >
                <Save className="size-4" /> Save transcript
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="End this session?"
        description="The transcript is saved to the session and the AI writes up the notes. The room cannot be reopened."
        confirmLabel="End session"
        onConfirm={() => void endRoom('manual')}
      />
    </div>
  )
}
