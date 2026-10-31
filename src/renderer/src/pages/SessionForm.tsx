import { Briefcase, Check, FileText, Link2, Loader2, MessagesSquare, Phone, Plus, Upload } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import {
  FEEDBACK_STYLES,
  LANGUAGES,
  MODELS,
  SESSION_TYPES,
  type InterviewFocus,
  type LibraryItem,
  type SessionInput,
  type SessionType
} from '@shared/types'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Segmented, Select, Spinner, Textarea, cn } from '@/components/ui'
import { href, navigate } from '@/lib/router'
import { useSettings } from '@/lib/settings'

const FOCUS_OPTIONS: { value: InterviewFocus; label: string }[] = [
  { value: 'mixed', label: 'Mixed loop' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'technical', label: 'Technical' },
  { value: 'coding', label: 'Coding' }
]

const TYPE_ICONS: Record<SessionType, React.ReactNode> = {
  interview: <Briefcase className="size-5" />,
  call: <Phone className="size-5" />,
  mock: <MessagesSquare className="size-5" />
}

function emptyInput(defaults: { model: SessionInput['model']; language: string }): SessionInput {
  return {
    type: 'interview',
    title: '',
    role: '',
    company: '',
    jobDescription: '',
    resumeId: null,
    documentIds: [],
    instructions: '',
    focus: 'mixed',
    questionCount: 5,
    feedbackStyle: 'detailed',
    language: defaults.language,
    model: defaults.model
  }
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  )
}

export function SessionForm({ sessionId }: { sessionId?: string }) {
  const { settings } = useSettings()
  const [input, setInput] = useState<SessionInput>(() =>
    emptyInput({ model: settings!.defaultModel, language: settings!.defaultLanguage })
  )
  const [resumes, setResumes] = useState<LibraryItem[]>([])
  const [documents, setDocuments] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(Boolean(sessionId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postUrl, setPostUrl] = useState('')
  const [filling, setFilling] = useState(false)
  const [fillNote, setFillNote] = useState<string | null>(null)
  const editing = Boolean(sessionId)

  const set = <K extends keyof SessionInput>(key: K, value: SessionInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    void Promise.all([window.rehearse.library.list('resume'), window.rehearse.library.list('document')]).then(
      ([r, d]) => {
        setResumes(r)
        setDocuments(d)
        if (!sessionId && r[0]) setInput((prev) => ({ ...prev, resumeId: prev.resumeId ?? r[0].id }))
      }
    )
    if (sessionId) {
      void window.rehearse.sessions.get(sessionId).then((s) => {
        if (s) {
          const {
            id: _id,
            status: _st,
            questions: _q,
            summary: _su,
            transcript: _t,
            liveStartedAt: _ls,
            createdAt: _c,
            completedAt: _co,
            ...rest
          } = s
          setInput(rest)
        } else setError('This session no longer exists.')
        setLoading(false)
      })
    }
  }, [sessionId])

  async function importInto(kind: 'resume' | 'document') {
    const result = await window.rehearse.library.import(kind)
    if (result.failed.length) {
      setError(result.failed.map((f) => `${f.fileName}: ${f.reason}`).join('\n'))
    }
    if (!result.added.length) return
    if (kind === 'resume') {
      setResumes(await window.rehearse.library.list('resume'))
      set('resumeId', result.added[0].id)
    } else {
      setDocuments(await window.rehearse.library.list('document'))
      setInput((prev) => ({ ...prev, documentIds: [...prev.documentIds, ...result.added.map((d) => d.id)] }))
    }
  }

  function toggleDocument(id: string) {
    setInput((prev) => ({
      ...prev,
      documentIds: prev.documentIds.includes(id) ? prev.documentIds.filter((d) => d !== id) : [...prev.documentIds, id]
    }))
  }

  async function fillFromUrl() {
    if (!postUrl.trim()) return
    setFilling(true)
    setError(null)
    setFillNote(null)
    try {
      const fields = await window.rehearse.scrape.jobPost(postUrl.trim())
      setInput((prev) => ({
        ...prev,
        company: fields.company || prev.company,
        role: fields.role || prev.role,
        jobDescription: fields.jobDescription || prev.jobDescription
      }))
      setFillNote(
        fields.company || fields.role || fields.jobDescription
          ? 'Fields filled from the posting. Check them before starting.'
          : 'The page loaded but no clear fields were found. Paste the details instead.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setFilling(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (input.type === 'interview' && !input.company.trim()) {
      setError('Company is required for interview mode.')
      return
    }
    if (input.type === 'mock' && !input.jobDescription.trim() && !input.role.trim()) {
      setError('Add at least a role or a job description so the questions have something to aim at.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: SessionInput = {
      ...input,
      title:
        input.title.trim() ||
        [input.role.trim(), input.company.trim()].filter(Boolean).join(' at ') ||
        (input.type === 'call' ? 'Regular call' : input.type === 'interview' ? 'Interview' : 'Practice session')
    }
    try {
      if (sessionId) {
        await window.rehearse.sessions.update(sessionId, payload)
        navigate(href.dashboard)
      } else {
        const created = await window.rehearse.sessions.create(payload)
        navigate(created.type === 'mock' ? href.practice(created.id) : href.live(created.id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <Spinner label="Loading session…" />
      </div>
    )
  }

  const showRole = input.type !== 'call'
  const showBackground = input.type !== 'call'
  const showFormat = input.type === 'mock'

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader
        title={editing ? 'Edit session' : 'New session'}
        description={
          editing
            ? 'Changes apply the next time you open this session.'
            : 'What is this session for? You can change the details later.'
        }
      />

      <div className="space-y-5">
        <Section title="Session type" description="Sets what the live room does and how the session wraps up.">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Session type">
            {SESSION_TYPES.map((t) => {
              const on = input.type === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('type', t.id)}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3 text-left transition-colors',
                    on
                      ? t.id === 'interview'
                        ? 'border-session bg-session-bg/60 ring-1 ring-session/50'
                        : t.id === 'call'
                          ? 'border-document bg-document-bg/60 ring-1 ring-document/50'
                          : 'border-primary bg-primary/6 ring-1 ring-primary'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        '[&>svg]:size-4',
                        t.id === 'interview' ? 'text-session' : t.id === 'call' ? 'text-document' : 'text-primary'
                      )}
                    >
                      {TYPE_ICONS[t.id]}
                    </span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <div className="mt-1.5 text-xs leading-snug text-muted-foreground">{t.description}</div>
                </button>
              )
            })}
          </div>
        </Section>

        {showRole && (
          <Section title="The role" description="Context for the live room and any practice you run here.">
            {input.type === 'interview' && (
              <Field
                label="Interview post URL"
                htmlFor="post-url"
                hint="Paste a link to the posting and the fields below fill themselves."
              >
                <div className="flex gap-2">
                  <Input
                    id="post-url"
                    type="url"
                    placeholder="https://jobs.example.com/posting/123"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                  />
                  <Button type="button" variant="outline" disabled={!postUrl.trim() || filling} onClick={() => void fillFromUrl()}>
                    {filling ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                    Fill fields
                  </Button>
                </div>
              </Field>
            )}
            {fillNote && (
              <p className="-mt-2 flex items-center gap-1.5 text-xs text-primary">
                <Check className="size-3.5" /> {fillNote}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role" htmlFor="role">
                <Input id="role" placeholder="Senior Frontend Engineer" value={input.role} onChange={(e) => set('role', e.target.value)} />
              </Field>
              <Field label="Company" htmlFor="company">
                <Input
                  id="company"
                  placeholder={input.type === 'interview' ? 'Required' : 'Acme Corp'}
                  value={input.company}
                  onChange={(e) => set('company', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Job description" htmlFor="jd" hint="Paste the full posting: responsibilities, requirements and nice-to-haves.">
              <Textarea
                id="jd"
                className="min-h-40"
                placeholder="Paste the job description here…"
                value={input.jobDescription}
                onChange={(e) => set('jobDescription', e.target.value)}
              />
            </Field>
            <Field label="Session name" htmlFor="title" hint="Optional. Defaults to role and company.">
              <Input id="title" value={input.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
          </Section>
        )}

        {input.type === 'call' && (
          <Section title="About this call" description="All optional — just enough to recognise the session later.">
            <Field label="Session name" htmlFor="title-call" hint="Optional. Defaults to “Regular call”.">
              <Input id="title-call" value={input.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Notes for the write-up" htmlFor="notes-call" hint="What the call is about, who is on it, anything to capture.">
              <Textarea id="notes-call" value={input.instructions} onChange={(e) => set('instructions', e.target.value)} />
            </Field>
          </Section>
        )}

        {showBackground && (
          <Section title="Your background" description="Lets the AI ground everything in your actual experience.">
            <Field label="Resume" htmlFor="resume">
              <div className="flex gap-2">
                <Select
                  id="resume"
                  value={input.resumeId ?? ''}
                  onChange={(e) => set('resumeId', e.target.value || null)}
                >
                  <option value="">No resume</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" onClick={() => void importInto('resume')}>
                  <Upload className="size-4" /> Upload
                </Button>
              </div>
            </Field>

            <Field label="Reference documents" hint="Optional: company notes, a project write-up, a study guide.">
              <div className="flex flex-wrap gap-2">
                {documents.map((d) => {
                  const on = input.documentIds.includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDocument(d.id)}
                      className={cn(
                        'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition-colors',
                        on
                          ? 'border-document/50 bg-document-bg text-document'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {on ? <Check className="size-3.5" /> : <FileText className="size-3.5" />}
                      {d.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => void importInto('document')}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-[13px] text-muted-foreground hover:bg-accent"
                >
                  <Plus className="size-3.5" /> Add document
                </button>
              </div>
            </Field>

            <Field
              label="Notes"
              htmlFor="notes"
              hint="Anything to emphasise, e.g. “I struggle with system design” or “focus on leadership”."
            >
              <Textarea id="notes" value={input.instructions} onChange={(e) => set('instructions', e.target.value)} />
            </Field>
          </Section>
        )}

        {showFormat && (
          <Section title="Interview format" description="Shape the questions and the feedback you get.">
            <Field label="Focus">
              <div>
                <Segmented label="Interview focus" value={input.focus} onChange={(v) => set('focus', v)} options={FOCUS_OPTIONS} />
              </div>
            </Field>

            <Field label={`Number of questions: ${input.questionCount}`} htmlFor="count">
              <input
                id="count"
                type="range"
                min={3}
                max={12}
                value={input.questionCount}
                onChange={(e) => set('questionCount', Number(e.target.value))}
                className="w-full accent-[hsl(var(--primary))]"
              />
            </Field>

            <Field label="Feedback style">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Feedback style">
                {FEEDBACK_STYLES.map((s) => {
                  const on = input.feedbackStyle === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('feedbackStyle', s.id)}
                      className={cn(
                        'cursor-pointer rounded-lg border p-3 text-left transition-colors',
                        on ? 'border-primary bg-primary/6 ring-1 ring-primary' : 'border-border hover:bg-accent'
                      )}
                    >
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{s.hint}</div>
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>
        )}

        <Section title="Language & model" description="Used for transcription language and every AI write-up.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Language" htmlFor="language">
              <Select id="language" value={input.language} onChange={(e) => set('language', e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Model" htmlFor="model" hint={MODELS.find((m) => m.id === input.model)?.hint}>
              <Select id="model" value={input.model} onChange={(e) => set('model', e.target.value as SessionInput['model'])}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        {error && <Alert>{<span className="whitespace-pre-line">{error}</span>}</Alert>}
        {!settings?.hasApiKey && (
          <Alert tone="warning">
            You can save this session now, but you'll need to <a href={href.settings} className="font-medium underline">add an API key</a> before AI write-ups and questions can be generated.
          </Alert>
        )}

        <div className="flex items-center justify-between pt-1">
          <Badge tone={input.type === 'call' ? 'document' : input.type === 'interview' ? 'session' : 'success'}>
            {SESSION_TYPES.find((t) => t.id === input.type)?.label}
            {input.type === 'mock' &&
              ` · ${input.questionCount} questions · ${FOCUS_OPTIONS.find((f) => f.value === input.focus)?.label}`}
          </Badge>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(href.dashboard)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : input.type === 'mock' ? 'Create & start practising' : 'Create & open live room'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
