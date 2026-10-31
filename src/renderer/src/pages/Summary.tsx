import { ArrowLeft, ChevronDown, Download, Pencil, RefreshCw, Repeat } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Session, SessionInput } from '@shared/types'
import { Markdown } from '@/components/Markdown'
import { ScoreRing } from '@/components/ScoreRing'
import { Alert, Badge, Button, Card, Spinner, cn } from '@/components/ui'
import { formatDate, formatDuration, stripScoreLine } from '@/lib/format'
import { exportElementAsPdf } from '@/lib/pdf'
import { href, navigate } from '@/lib/router'
import { overallScore, READINESS_LABEL, readiness } from '@/lib/scoring'
import { useSettings } from '@/lib/settings'
import { useAiStream } from '@/lib/useAiStream'

function configOf(session: Session): SessionInput {
  const {
    id: _id,
    status: _s,
    questions: _q,
    summary: _su,
    transcript: _t,
    liveStartedAt: _ls,
    createdAt: _c,
    completedAt: _co,
    ...rest
  } = session
  return rest
}

export function Summary({ sessionId }: { sessionId: string }) {
  const { settings } = useSettings()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [open, setOpen] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const debriefRef = useRef<HTMLDivElement>(null)

  const reload = () => window.rehearse.sessions.get(sessionId).then(setSession)
  const debrief = useAiStream(() => void reload())

  useEffect(() => {
    void reload().then(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // A live-room session gets a notes write-up; a mock interview gets the scored debrief.
  const isNotes = session ? session.type !== 'mock' || (session.questions.length === 0 && session.transcript.length > 0) : false
  const answered = session?.questions.filter((q) => q.answer.trim()).length ?? 0

  useEffect(() => {
    if (!session || session.summary || !settings?.hasApiKey || debrief.status !== 'idle') return
    if (isNotes ? session.transcript.length > 0 : answered > 0) {
      void debrief.start({ kind: isNotes ? 'notes' : 'summary', sessionId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.summary, isNotes, answered])

  if (session === undefined) {
    return (
      <div className="p-8">
        <Spinner label="Loading…" />
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="mx-auto max-w-lg px-8 py-16">
        <Alert>This session no longer exists.</Alert>
      </div>
    )
  }

  const score = overallScore(session.questions)
  const ready = readiness(score)
  const totalSeconds = session.questions.reduce((n, q) => n + q.secondsSpent, 0)
  const streaming = debrief.status === 'streaming'
  const debriefText = debrief.status === 'idle' ? session.summary : debrief.text
  const typeLabel = session.type === 'interview' ? 'Interview' : session.type === 'call' ? 'Regular call' : 'Mock interview'

  async function practiceAgain() {
    const created = await window.rehearse.sessions.create({ ...configOf(session!), title: `${session!.title} (again)` })
    navigate(href.practice(created.id))
  }

  async function exportPdf() {
    if (!debriefRef.current) return
    setExporting(true)
    try {
      await exportElementAsPdf(debriefRef.current, `${session!.title} ${isNotes ? 'notes' : 'debrief'}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <a href={href.dashboard} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Sessions
      </a>

      <Card className="flex flex-wrap items-center gap-6 p-6">
        {!isNotes && <ScoreRing score={score} size={88} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{session.title}</h1>
            <Badge tone={session.type === 'call' ? 'document' : 'session'}>{typeLabel}</Badge>
            {!isNotes && ready && (
              <Badge tone={ready === 'ready' ? 'success' : ready === 'getting-there' ? 'warning' : 'danger'}>
                {READINESS_LABEL[ready]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNotes
              ? `${session.transcript.length} transcript ${session.transcript.length === 1 ? 'line' : 'lines'} from the live room`
              : `${answered} of ${session.questions.length} answered · ${formatDuration(totalSeconds)} speaking time`}
            {session.completedAt ? ` · ${formatDate(session.completedAt)}` : ''}
            {session.coachAnswers.length > 0
              ? ` · ${session.coachAnswers.length} ${session.coachAnswers.length === 1 ? 'suggestion' : 'suggestions'} saved`
              : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {isNotes ? (
            <Button variant="outline" onClick={() => navigate(href.edit(session.id))}>
              <Pencil className="size-4" /> Edit session
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => navigate(href.practice(session.id))}>
                <Pencil className="size-4" /> Review answers
              </Button>
              <Button onClick={() => void practiceAgain()}>
                <Repeat className="size-4" /> Practice again
              </Button>
            </>
          )}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold">{isNotes ? 'Session notes' : 'Coach debrief'}</h2>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={streaming || !settings?.hasApiKey || (isNotes ? session.transcript.length === 0 : answered === 0)}
                onClick={() => void debrief.start({ kind: isNotes ? 'notes' : 'summary', sessionId })}
              >
                <RefreshCw className="size-3.5" /> Rewrite
              </Button>
              <Button variant="ghost" size="sm" disabled={streaming || !debriefText} loading={exporting} onClick={() => void exportPdf()}>
                <Download className="size-3.5" /> PDF
              </Button>
            </div>
          </div>
          <div className="px-5 py-4">
            {debrief.error ? (
              <Alert>{debrief.error}</Alert>
            ) : debriefText ? (
              <Markdown ref={debriefRef} streaming={streaming}>
                {debriefText}
              </Markdown>
            ) : isNotes ? (
              session.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">The live room captured nothing to write up.</p>
              ) : !settings?.hasApiKey ? (
                <Alert tone="warning">
                  <a href={href.settings} className="font-medium underline">Add an API key</a> to generate your notes.
                </Alert>
              ) : (
                <Spinner label="Writing up your notes…" />
              )
            ) : answered === 0 ? (
              <p className="text-sm text-muted-foreground">Answer at least one question to get a debrief.</p>
            ) : !settings?.hasApiKey ? (
              <Alert tone="warning">
                <a href={href.settings} className="font-medium underline">Add an API key</a> to generate your debrief.
              </Alert>
            ) : (
              <Spinner label="Writing your debrief…" />
            )}
          </div>
        </Card>

        <div className="space-y-2">
          <h2 className="px-1 text-sm font-semibold">{isNotes ? 'Transcript' : 'Question by question'}</h2>
          {isNotes
            ? session.transcript.map((t) => (
                <Card key={t.id} className="px-3 py-2.5 text-[13px]">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'mt-[6px] size-1.5 shrink-0 rounded-full',
                        t.source === 'mic' ? 'bg-primary' : 'bg-violet-500'
                      )}
                    />
                    <span className="flex-1 leading-snug">{t.text}</span>
                  </div>
                  <div className="mt-0.5 pl-3.5 text-[11px] text-muted-foreground">
                    {t.source === 'mic' ? 'You' : 'Audio'} · {new Date(t.at).toLocaleTimeString()}
                  </div>
                </Card>
              ))
            : session.questions.map((q, i) => (
                <Card key={q.id} className="overflow-hidden">
                  <button
                    onClick={() => setOpen(open === q.id ? null : q.id)}
                    aria-expanded={open === q.id}
                    className="flex w-full cursor-pointer items-start gap-3 p-3 text-left hover:bg-accent/50"
                  >
                    <ScoreRing score={q.score} size={32} />
                    <span className="line-clamp-2 flex-1 text-[13px] leading-snug">
                      <span className="text-muted-foreground">{i + 1}. </span>
                      {q.text}
                    </span>
                    <ChevronDown
                      className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', open === q.id && 'rotate-180')}
                    />
                  </button>
                  {open === q.id && (
                    <div className="space-y-3 border-t border-border px-3 py-3 text-[13px]">
                      <div>
                        <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Your answer</div>
                        <p className="whitespace-pre-wrap">{q.answer || <em className="text-muted-foreground">Skipped</em>}</p>
                      </div>
                      {q.feedback && (
                        <div>
                          <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Feedback</div>
                          <Markdown className="text-[13px]">{stripScoreLine(q.feedback)}</Markdown>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
        </div>
      </div>

      {session.coachAnswers.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold">Answers saved during the call</h2>
            <span className="text-xs text-muted-foreground">
              {session.coachAnswers.length} {session.coachAnswers.length === 1 ? 'suggestion' : 'suggestions'} kept with
              the session
            </span>
          </div>
          <div className="divide-y divide-border">
            {session.coachAnswers.map((a, i) => (
              <div key={a.id} className="px-5 py-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono tabular-nums">{i + 1}</span>
                  <span>{a.kind === 'screenshot' ? 'from a screenshot' : 'from the transcript'}</span>
                  {a.origin === 'auto' && <span>· suggested automatically</span>}
                  <span className="ml-auto">{new Date(a.createdAt).toLocaleTimeString()}</span>
                </div>
                {a.question && (
                  <p className="mt-1.5 border-l-2 border-border pl-2 text-[12.5px] leading-snug text-muted-foreground">
                    {a.question}
                  </p>
                )}
                <Markdown className="mt-1.5 text-[13px]">{a.text}</Markdown>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
