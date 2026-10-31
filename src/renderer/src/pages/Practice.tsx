import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  MicOff,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Square,
  Timer,
  Trophy,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PracticeQuestion, Session } from '@shared/types'
import { Markdown } from '@/components/Markdown'
import { ScoreRing } from '@/components/ScoreRing'
import { Alert, Badge, Button, Card, ConfirmDialog, Spinner, Textarea, cn } from '@/components/ui'
import { formatDuration, stripScoreLine, wordCount } from '@/lib/format'
import { href, navigate } from '@/lib/router'
import { useSettings } from '@/lib/settings'
import { useDictation, useMicLevel, useSpeaker } from '@/lib/speech'
import { useAiStream } from '@/lib/useAiStream'

const KIND_LABEL: Record<PracticeQuestion['kind'], string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  coding: 'Coding',
  situational: 'Situational'
}

function firstOpenIndex(session: Session): number {
  const i = session.questions.findIndex((q) => q.answeredAt === null)
  return i === -1 ? Math.max(0, session.questions.length - 1) : i
}

function MicMeter({ level }: { level: number }) {
  return (
    <div className="flex h-4 items-end gap-0.5" aria-hidden="true">
      {[0.15, 0.35, 0.55, 0.75, 0.9].map((threshold, i) => (
        <span
          key={i}
          className={cn('w-1 rounded-full transition-colors', level > threshold * 0.6 ? 'bg-primary' : 'bg-muted-foreground/25')}
          style={{ height: `${30 + i * 17}%` }}
        />
      ))}
    </div>
  )
}

function QuestionRail({
  questions,
  index,
  onSelect
}: {
  questions: PracticeQuestion[]
  index: number
  onSelect: (i: number) => void
}) {
  return (
    <nav aria-label="Questions" className="space-y-1">
      {questions.map((q, i) => {
        const done = q.answeredAt !== null
        return (
          <button
            key={q.id}
            onClick={() => onSelect(i)}
            aria-current={i === index ? 'step' : undefined}
            className={cn(
              'flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
              i === index ? 'bg-accent' : 'hover:bg-accent/60'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                done
                  ? q.score === null
                    ? 'bg-muted-foreground/20 text-muted-foreground'
                    : 'bg-primary text-primary-foreground'
                  : i === index
                    ? 'border-2 border-primary text-primary'
                    : 'border border-border text-muted-foreground'
              )}
            >
              {done && q.score !== null ? q.score : i + 1}
            </span>
            <span className={cn('line-clamp-2 text-[13px] leading-snug', i === index ? 'text-foreground' : 'text-muted-foreground')}>
              {q.text}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function Practice({ sessionId }: { sessionId: string }) {
  const { settings } = useSettings()
  const [session, setSession] = useState<Session | null>(null)
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'generating' | 'answering' | 'reviewing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [autoRead, setAutoRead] = useState(settings?.autoReadQuestions ?? true)
  const answerRef = useRef<HTMLTextAreaElement>(null)

  const question = session?.questions[index]
  const speaker = useSpeaker(session?.language ?? 'English')

  const feedback = useAiStream(() => {
    // Main process stored the feedback and parsed score; pull the fresh copy.
    void window.rehearse.sessions.get(sessionId).then((s) => s && setSession(s))
  })

  const appendDictation = useCallback((text: string) => {
    if (!text) return
    setDraft((d) => (d && !/\s$/.test(d) ? `${d} ${text}` : d + text))
  }, [])
  const dictation = useDictation(session?.language ?? 'English', appendDictation)
  const micLevel = useMicLevel(dictation.listening)

  const generate = useCallback(async () => {
    setPhase('generating')
    setError(null)
    try {
      const next = await window.rehearse.sessions.generateQuestions(sessionId)
      setSession(next)
      setIndex(0)
      setPhase('answering')
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
      setPhase('error')
    }
  }, [sessionId])

  // Load the session, generating questions on first open.
  useEffect(() => {
    void window.rehearse.sessions.get(sessionId).then((s) => {
      if (!s) {
        setError('This session no longer exists.')
        setPhase('error')
        return
      }
      setSession(s)
      if (s.questions.length === 0) {
        if (settings?.hasApiKey) void generate()
        else {
          setError('Add your Anthropic API key in Settings so Rehearse can write your questions.')
          setPhase('error')
        }
        return
      }
      const i = firstOpenIndex(s)
      setIndex(i)
      setPhase(s.questions[i].feedback ? 'reviewing' : 'answering')
    })
  }, [sessionId, settings?.hasApiKey, generate])

  // Switching questions: restore that question's saved answer and state.
  useEffect(() => {
    if (!question) return
    setDraft(question.answer)
    setSeconds(question.secondsSpent)
    feedback.reset()
    dictation.stop()
    setPhase(question.feedback ? 'reviewing' : 'answering')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id])

  // Read each new question aloud, like an interviewer would.
  useEffect(() => {
    if (phase === 'answering' && question && autoRead && !question.answeredAt) speaker.speak(question.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, phase === 'answering'])

  // Answer timer runs only while answering.
  useEffect(() => {
    if (phase !== 'answering') return
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [phase])

  const answeredCount = session?.questions.filter((q) => q.answeredAt !== null).length ?? 0
  const allAnswered = session ? answeredCount === session.questions.length && session.questions.length > 0 : false
  const isLast = session ? index === session.questions.length - 1 : false

  async function submit(skip = false) {
    if (!session || !question) return
    dictation.stop()
    speaker.stop()
    const answer = skip ? '' : draft.trim()
    const updated = await window.rehearse.sessions.saveAnswer(session.id, question.id, answer, seconds)
    setSession(updated)
    if (skip) {
      goNext(updated)
      return
    }
    setPhase('reviewing')
    void feedback.start({ kind: 'feedback', sessionId: session.id, questionId: question.id })
  }

  /** Next unanswered question after this one, wrapping to the start; else simply the next one. */
  function goNext(current: Session = session!) {
    const open = (i: number) => current.questions[i]?.answeredAt === null
    const n = current.questions.length
    for (let step = 1; step < n; step++) {
      const i = (index + step) % n
      if (open(i)) return setIndex(i)
    }
    if (index < n - 1) setIndex(index + 1)
  }

  function retry() {
    feedback.reset()
    setPhase('answering')
    requestAnimationFrame(() => answerRef.current?.focus())
  }

  const shownFeedback = feedback.status === 'idle' ? (question?.feedback ?? '') : feedback.text
  const shownScore = feedback.status === 'streaming' ? null : (question?.score ?? null)
  const streaming = feedback.status === 'streaming'

  const progress = useMemo(
    () => (session && session.questions.length ? (answeredCount / session.questions.length) * 100 : 0),
    [answeredCount, session]
  )

  if (phase === 'loading' || phase === 'generating') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Spinner label={phase === 'generating' ? 'Your interviewer is preparing questions…' : 'Loading…'} />
        {phase === 'generating' && (
          <p className="max-w-sm text-xs text-muted-foreground">
            Reading the job description{session?.resumeId ? ' and your resume' : ''} to write {session?.questionCount} questions.
          </p>
        )}
      </div>
    )
  }

  if (phase === 'error' || !session || !question) {
    return (
      <div className="mx-auto max-w-lg px-8 py-16">
        <Alert>{error ?? 'Something went wrong.'}</Alert>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => navigate(href.dashboard)}>
            <ArrowLeft className="size-4" /> Back to sessions
          </Button>
          {settings?.hasApiKey ? (
            session && (
              <Button onClick={() => void generate()}>
                <RefreshCw className="size-4" /> Try again
              </Button>
            )
          ) : (
            <Button onClick={() => navigate(href.settings)}>Open settings</Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Question list */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-4">
          <a href={href.dashboard} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Sessions
          </a>
          <h1 className="truncate font-semibold">{session.title}</h1>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {answeredCount} of {session.questions.length} answered
            </span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <QuestionRail questions={session.questions} index={index} onSelect={setIndex} />
        </div>
        <div className="space-y-2 border-t border-border p-3">
          {allAnswered && (
            <Button className="w-full" onClick={() => navigate(href.summary(session.id))}>
              <Trophy className="size-4" /> Finish & see debrief
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmRegen(true)}>
            <RefreshCw className="size-3.5" /> New set of questions
          </Button>
        </div>
      </aside>

      {/* Stage */}
      <section className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge tone="session">Question {index + 1}</Badge>
              <Badge>{KIND_LABEL[question.kind]}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-2 flex items-center gap-1 text-sm text-muted-foreground tabular-nums" aria-label="Time on this answer">
                <Timer className="size-4" /> {formatDuration(seconds)}
              </span>
              {speaker.supported && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={speaker.speaking ? 'Stop reading' : 'Read question aloud'}
                    onClick={() => (speaker.speaking ? speaker.stop() : speaker.speak(question.text))}
                  >
                    {speaker.speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={autoRead ? 'Turn off auto-read' : 'Turn on auto-read'}
                    aria-pressed={autoRead}
                    title={autoRead ? 'Auto-read is on' : 'Auto-read is off'}
                    onClick={() => setAutoRead((a) => !a)}
                  >
                    {autoRead ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4" />}
                  </Button>
                </>
              )}
            </div>
          </div>

          <h2 className="text-xl leading-snug font-semibold tracking-tight text-balance">{question.text}</h2>

          {/* Answer */}
          <Card className="mt-6 p-4">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="answer" className="text-[13px] font-medium">
                Your answer
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">{wordCount(draft)} words</span>
            </div>
            <Textarea
              ref={answerRef}
              id="answer"
              className="min-h-44 border-0 px-0 focus:ring-0"
              placeholder={
                dictation.unavailable
                  ? 'Type your answer as you would say it…'
                  : 'Press the mic to answer out loud, or type your answer…'
              }
              value={draft + (dictation.interim ? (draft ? ' ' : '') + dictation.interim : '')}
              readOnly={phase === 'reviewing' || dictation.listening}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && phase === 'answering' && draft.trim()) void submit()
              }}
            />
            {dictation.error && <p className="mt-2 text-xs text-warning">{dictation.error}</p>}

            {phase === 'answering' ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  {!dictation.unavailable && (
                    <Button
                      type="button"
                      variant={dictation.listening ? 'danger' : 'outline'}
                      size="sm"
                      onClick={() => (dictation.listening ? dictation.stop() : (speaker.stop(), dictation.start()))}
                    >
                      {dictation.listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                      {dictation.listening ? 'Stop' : 'Answer out loud'}
                    </Button>
                  )}
                  {dictation.listening && <MicMeter level={micLevel} />}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void submit(true)}>
                    <SkipForward className="size-3.5" /> Skip
                  </Button>
                  <Button size="sm" disabled={!draft.trim()} onClick={() => void submit()} title="Ctrl+Enter">
                    <Check className="size-3.5" /> Get feedback
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <Button variant="ghost" size="sm" onClick={retry} disabled={streaming}>
                  <RotateCcw className="size-3.5" /> Try this answer again
                </Button>
              </div>
            )}
          </Card>

          {/* Feedback */}
          {phase === 'reviewing' && (
            <Card className="mt-5 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
                <ScoreRing score={shownScore} size={40} />
                <div>
                  <div className="text-sm font-semibold">Coach feedback</div>
                  <div className="text-xs text-muted-foreground">
                    {streaming ? 'Reviewing your answer…' : question.answer ? 'Based on the role and your resume' : 'Skipped'}
                  </div>
                </div>
                {streaming && (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={feedback.cancel}>
                    <Square className="size-3.5" /> Stop
                  </Button>
                )}
              </div>
              <div className="px-5 py-4">
                {feedback.error ? (
                  <div className="space-y-3">
                    <Alert>{feedback.error}</Alert>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void feedback.start({ kind: 'feedback', sessionId: session.id, questionId: question.id })}
                    >
                      <RefreshCw className="size-3.5" /> Retry feedback
                    </Button>
                  </div>
                ) : shownFeedback ? (
                  <Markdown streaming={streaming}>{stripScoreLine(shownFeedback)}</Markdown>
                ) : streaming ? (
                  <Spinner label="Thinking about your answer…" />
                ) : (
                  <p className="text-sm text-muted-foreground">No feedback for skipped questions.</p>
                )}
              </div>
              {!streaming && (
                <div className="flex justify-end border-t border-border px-4 py-3">
                  {isLast || allAnswered ? (
                    allAnswered ? (
                      <Button onClick={() => navigate(href.summary(session.id))}>
                        <Trophy className="size-4" /> See your debrief
                      </Button>
                    ) : (
                      <Button onClick={() => goNext()}>
                        Next unanswered <ArrowRight className="size-4" />
                      </Button>
                    )
                  ) : (
                    <Button onClick={() => goNext()}>
                      Next question <ArrowRight className="size-4" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Write a new set of questions?"
        description="Your current answers and feedback for this session will be replaced."
        confirmLabel="Generate new questions"
        onConfirm={() => void generate()}
      />
    </div>
  )
}
