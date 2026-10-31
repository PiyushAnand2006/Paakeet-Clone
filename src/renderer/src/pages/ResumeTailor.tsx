import { Check, Copy, Download, Square, Upload, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MODELS, type LibraryItem, type ModelId } from '@shared/types'
import { Markdown } from '@/components/Markdown'
import { Alert, Button, Card, EmptyState, Field, PageHeader, Select, Textarea } from '@/components/ui'
import { exportElementAsPdf } from '@/lib/pdf'
import { href } from '@/lib/router'
import { useSettings } from '@/lib/settings'
import { useAiStream } from '@/lib/useAiStream'

export function ResumeTailor() {
  const { settings } = useSettings()
  const [resumes, setResumes] = useState<LibraryItem[]>([])
  const [resumeId, setResumeId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [model, setModel] = useState<ModelId>(settings!.defaultModel)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const tailor = useAiStream()

  useEffect(() => {
    void window.rehearse.library.list('resume').then((r) => {
      setResumes(r)
      if (r[0]) setResumeId((id) => id || r[0].id)
    })
  }, [])

  async function upload() {
    const result = await window.rehearse.library.import('resume')
    if (result.added[0]) {
      setResumes(await window.rehearse.library.list('resume'))
      setResumeId(result.added[0].id)
    }
  }

  const streaming = tailor.status === 'streaming'
  const resumeName = resumes.find((r) => r.id === resumeId)?.name ?? 'Resume'
  // Only the resume itself goes into the PDF, not the "What changed" notes after the rule.
  const resumeOnly = tailor.text.split(/\n-{3,}\s*\n/)[0]

  async function copy() {
    await navigator.clipboard.writeText(resumeOnly)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function exportPdf() {
    if (!outputRef.current) return
    setExporting(true)
    try {
      const container = document.createElement('div')
      container.innerHTML = outputRef.current.innerHTML
      // Drop everything from the first horizontal rule onwards (the change notes).
      const hr = container.querySelector('hr')
      while (hr?.nextSibling) hr.nextSibling.remove()
      hr?.remove()
      await exportElementAsPdf(container, `${resumeName} (tailored)`)
    } finally {
      setExporting(false)
    }
  }

  if (resumes.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-8">
        <PageHeader title="Resume tailor" description="Rewrite your resume for a specific job, using only facts already in it." />
        <EmptyState
          icon={<Wand2 className="size-5" />}
          title="Upload a resume to tailor"
          description="PDF, Word and text files work. The tailor reorders and rephrases what's there; it never invents experience."
          action={
            <Button onClick={() => void upload()}>
              <Upload className="size-4" /> Upload resume
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader title="Resume tailor" description="Rewrite your resume for a specific job, using only facts already in it." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit space-y-4 p-5">
          <Field label="Resume" htmlFor="tailor-resume">
            <div className="flex gap-2">
              <Select id="tailor-resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="icon" aria-label="Upload another resume" onClick={() => void upload()}>
                <Upload className="size-4" />
              </Button>
            </div>
          </Field>
          <Field label="Job description" htmlFor="tailor-jd">
            <Textarea
              id="tailor-jd"
              className="min-h-52"
              placeholder="Paste the job posting…"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor="tailor-notes" hint="Optional, e.g. “keep it to one page” or “lead with the payments work”.">
            <Textarea id="tailor-notes" className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="Model" htmlFor="tailor-model">
            <Select id="tailor-model" value={model} onChange={(e) => setModel(e.target.value as ModelId)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          {!settings?.hasApiKey && (
            <Alert tone="warning">
              <a href={href.settings} className="font-medium underline">Add an API key</a> to use the tailor.
            </Alert>
          )}
          {streaming ? (
            <Button variant="outline" className="w-full" onClick={tailor.cancel}>
              <Square className="size-4" /> Stop
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={!resumeId || !jobDescription.trim() || !settings?.hasApiKey}
              onClick={() => void tailor.start({ kind: 'tailor', resumeId, jobDescription, notes, model })}
            >
              <Wand2 className="size-4" /> {tailor.text ? 'Tailor again' : 'Tailor resume'}
            </Button>
          )}
        </Card>

        <Card className="min-h-[60vh] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold">Tailored resume</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={!tailor.text || streaming} onClick={() => void copy()}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy Markdown'}
              </Button>
              <Button variant="ghost" size="sm" disabled={!tailor.text || streaming} loading={exporting} onClick={() => void exportPdf()}>
                <Download className="size-3.5" /> Export PDF
              </Button>
            </div>
          </div>
          <div className="px-6 py-5">
            {tailor.error ? (
              <Alert>{tailor.error}</Alert>
            ) : tailor.text ? (
              <Markdown ref={outputRef} streaming={streaming}>
                {tailor.text}
              </Markdown>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {streaming ? 'Reading your resume and the job…' : 'Your tailored resume will appear here.'}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
