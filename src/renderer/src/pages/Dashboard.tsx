import { ArrowRight, Briefcase, MessagesSquare, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session, SessionType } from '@shared/types'
import { ScoreRing } from '@/components/ScoreRing'
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Segmented, Spinner } from '@/components/ui'
import { relativeTime } from '@/lib/format'
import { href, navigate } from '@/lib/router'
import { overallScore, READINESS_LABEL, readiness } from '@/lib/scoring'

type Filter = 'all' | 'in-progress' | 'completed'

const TYPE_META: Record<SessionType, { label: string; tone: 'session' | 'document' | 'success'; icon: React.ReactNode }> = {
  interview: { label: 'Interview', tone: 'session', icon: <Briefcase /> },
  call: { label: 'Regular call', tone: 'document', icon: <Phone /> },
  mock: { label: 'Mock interview', tone: 'success', icon: <MessagesSquare /> }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
    </Card>
  )
}

/** Tracks the cursor over a card so the spotlight sheen follows it. */
function useSpotlight() {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spotlight-x', `${((e.clientX - rect.left) / rect.width) * 100}%`)
    el.style.setProperty('--spotlight-y', `${((e.clientY - rect.top) / rect.height) * 100}%`)
  }
  return { ref, onMove }
}

function SessionCard({ session, onDelete }: { session: Session; onDelete: () => void }) {
  const [menu, setMenu] = useState(false)
  const spotlight = useSpotlight()
  const answered = session.questions.filter((q) => q.answeredAt !== null).length
  const score = overallScore(session.questions)
  const ready = readiness(score)
  const isLive = session.type !== 'mock'
  const primaryHref = isLive ? href.live(session.id) : session.status === 'completed' ? href.summary(session.id) : href.practice(session.id)
  const primaryLabel = isLive
    ? session.transcript.length
      ? 'Open live room'
      : 'Start'
    : session.status === 'completed'
      ? 'View debrief'
      : session.questions.length
        ? 'Continue'
        : 'Start'
  const typeMeta = TYPE_META[session.type]

  return (
    <Card className="card-spotlight group relative flex flex-col p-4 transition-shadow hover:shadow-md" ref={spotlight.ref as React.Ref<HTMLDivElement>} onMouseMove={spotlight.onMove}>
      <div className="flex items-start gap-3">
        {!isLive && <ScoreRing score={score} size={48} />}
        <div className="min-w-0 flex-1">
          <a href={primaryHref} className="block truncate font-semibold hover:underline">
            {session.title}
          </a>
          <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {[session.role, session.company].filter(Boolean).join(' · ') || typeMeta.label}
          </div>
        </div>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Session actions" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="size-4" />
          </Button>
          {menu && (
            <div
              className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
              onMouseLeave={() => setMenu(false)}
            >
              <a href={href.edit(session.id)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                <Pencil className="size-3.5" /> Edit setup
              </a>
              {isLive && session.transcript.length > 0 && (
                <a href={href.summary(session.id)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                  <MessagesSquare className="size-3.5" /> View notes
                </a>
              )}
              <button
                onClick={() => {
                  setMenu(false)
                  onDelete()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-accent"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone={typeMeta.tone}>
          <span className="[&>svg]:size-3">{typeMeta.icon}</span>
          {typeMeta.label}
        </Badge>
        {!isLive && session.status === 'completed' && ready && (
          <Badge tone={ready === 'ready' ? 'success' : ready === 'getting-there' ? 'warning' : 'danger'}>
            {READINESS_LABEL[ready]}
          </Badge>
        )}
        {isLive && session.transcript.length > 0 && <Badge>{`${session.transcript.length} lines`}</Badge>}
        {!isLive && session.status !== 'completed' && (
          <Badge>{session.questions.length ? `${answered}/${session.questions.length} answered` : 'Not started'}</Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{relativeTime(session.completedAt ?? session.createdAt)}</span>
        <a href={primaryHref} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
          {primaryLabel}
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [type, setType] = useState<SessionType | 'all'>('all')
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)

  const reload = () => void window.rehearse.sessions.list().then(setSessions)
  useEffect(reload, [])

  const stats = useMemo(() => {
    const list = sessions ?? []
    const completed = list.filter((s) => s.status === 'completed')
    const scores = completed.filter((s) => s.type === 'mock').map((s) => overallScore(s.questions)).filter((s): s is number => s !== null)
    const answered = list.reduce((n, s) => n + s.questions.filter((q) => q.answeredAt !== null).length, 0)
    return {
      completed: completed.length,
      average: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '–',
      answered
    }
  }, [sessions])

  const visible = (sessions ?? []).filter(
    (s) =>
      (type === 'all' || s.type === type) &&
      (filter === 'all' ? true : filter === 'completed' ? s.status === 'completed' : s.status !== 'completed')
  )

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Sessions"
        description="Interviews you are preparing for, calls you want notes on, and mock interviews to practise."
        actions={
          <Button onClick={() => navigate(href.new)}>
            <Plus className="size-4" /> New session
          </Button>
        }
      />

      {sessions === null ? (
        <Spinner label="Loading sessions…" />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="size-5" />}
          title="No sessions yet"
          description="Add the resumes and documents the AI should know about, then create your first session — an interview to prepare for, a call to take notes on, or a mock interview."
          action={
            <Button onClick={() => navigate(href.new)}>
              <Plus className="size-4" /> Create your first session
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat label="Sessions completed" value={String(stats.completed)} />
            <Stat label="Average score" value={stats.average} />
            <Stat label="Questions answered" value={String(stats.answered)} />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Filter by type"
              value={type}
              onChange={setType}
              options={[
                { value: 'all', label: 'All' },
                { value: 'interview', label: 'Interviews' },
                { value: 'call', label: 'Calls' },
                { value: 'mock', label: 'Mock' }
              ]}
            />
            <Segmented
              label="Filter sessions"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Any status' },
                { value: 'in-progress', label: 'In progress' },
                { value: 'completed', label: 'Completed' }
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No sessions match this filter.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => (
                <SessionCard key={s.id} session={s} onDelete={() => setPendingDelete(s)} />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this session?"
        description={`"${pendingDelete?.title ?? ''}" and all of its answers, transcript and notes will be removed.`}
        confirmLabel="Delete session"
        onConfirm={() => {
          if (pendingDelete) void window.rehearse.sessions.remove(pendingDelete.id).then(reload)
        }}
      />
    </div>
  )
}
