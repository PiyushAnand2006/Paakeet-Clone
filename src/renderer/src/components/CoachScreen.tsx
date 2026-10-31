import { Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Minus, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { APP_NAME } from '@shared/branding'
import type { CoachState, CoachStream } from '@shared/types'
import { Markdown } from '@/components/Markdown'
import { cn } from '@/components/ui'

const KIND_LABEL: Record<string, string> = {
  answer: 'from the transcript',
  screenshot: 'from the screen'
}

/**
 * The coach window: an always-on-top view of the answers the live room writes. It only shows
 * what was generated for you, and it is visible by design: no content protection, taskbar
 * presence, normal focusability, so screen sharing always shows it.
 */
export function CoachScreen() {
  const [state, setState] = useState<CoachState | null>(null)
  const [stream, setStream] = useState<CoachStream>({ text: '', isStreaming: false })
  const [copied, setCopied] = useState(false)
  /** Collapsed to a single line: the window shrinks with it, so it covers less of the call. */
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    document.title = `${APP_NAME} coach`
  }, [])
  useEffect(() => window.rehearse.coach.onUpdate((update) => setState('clear' in update ? null : update)), [])
  useEffect(() => window.rehearse.coach.onStream(setStream), [])

  const selected = useMemo(
    () => state?.answers.find((a) => a.id === state.selectedId) ?? null,
    [state]
  )
  const index = selected && state ? state.answers.findIndex((a) => a.id === selected.id) : -1
  const body = stream.isStreaming ? stream.text : (selected?.text ?? '')
  /** First readable line of the answer, for the collapsed bar. */
  const preview = body
    .split('\n')
    .map((line) => line.replace(/^[#>*\-\s]+/, '').trim())
    .find(Boolean)

  function toggleCompact(): void {
    setCompact((current) => {
      window.rehearse.coach.setCompact(!current)
      return !current
    })
  }

  async function copy() {
    if (!body) return
    await navigator.clipboard.writeText(body)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="dark flex h-full flex-col bg-background text-foreground">
      {/* Frameless drag region; controls opt out individually. */}
      <header
        className="flex select-none items-center gap-2 border-b border-border px-3 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold tracking-tight">{state?.title ?? 'Answer coach'}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('inline-block size-1.5 rounded-full', stream.isStreaming ? 'bg-primary' : 'bg-status-ended')} />
            {stream.isStreaming ? 'writing an answer' : state ? 'live answers' : 'no live room'}
            {state && state.answers.length > 0 && (
              <span className="font-mono tabular-nums">
                · {index >= 0 ? index + 1 : state.answers.length}/{state.answers.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            type="button"
            aria-label="Previous answer"
            disabled={index <= 0}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => void window.rehearse.coach.request('previous')}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next answer"
            disabled={!state || state.answers.length === 0 || index >= state.answers.length - 1}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => void window.rehearse.coach.request('next')}
          >
            <ChevronRight className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Copy answer"
            disabled={!body}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => void copy()}
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label={compact ? 'Expand the coach window' : 'Collapse to a single line'}
            title={compact ? 'Expand' : 'Collapse to a single line'}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={toggleCompact}
          >
            {compact ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Screenshot help"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void window.rehearse.coach.request('screenshot')}
          >
            <Camera className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Minimise"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void window.rehearse.coach.close()}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close coach"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void window.rehearse.coach.close()}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      {compact && (
        <div className="px-4 py-2">
          <p className="line-clamp-1 text-[12.5px] leading-snug">
            {preview || (state ? 'No answers yet.' : 'No live room is open.')}
          </p>
        </div>
      )}

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3', compact && 'hidden')}>
        {body ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {stream.isStreaming ? (
                <span className="font-medium text-primary">Writing…</span>
              ) : (
                selected && (
                  <>
                    <span className="font-medium">{KIND_LABEL[selected.kind]}</span>
                    {selected.origin === 'auto' && <span>· suggested automatically</span>}
                    <span className="ml-auto font-mono tabular-nums">
                      {new Date(selected.createdAt).toLocaleTimeString()}
                    </span>
                  </>
                )
              )}
            </div>
            {selected && !stream.isStreaming && selected.question && (
              <p className="mb-2 rounded-md border-l-2 border-border bg-muted/60 px-2 py-1 text-[11.5px] leading-snug text-muted-foreground">
                {selected.question}
              </p>
            )}
            <Markdown streaming={stream.isStreaming} className="text-[13.5px]">
              {body}
            </Markdown>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Sparkles className="mb-3 size-7" />
            <p className="text-sm font-medium text-foreground">
              {state ? 'No answers yet.' : 'No live room is open.'}
            </p>
            <p className="mt-1 max-w-[280px] text-xs leading-relaxed">
              {state
                ? 'Press Answer in the live room or use Ctrl/Cmd+Enter and a suggestion appears here, always on top.'
                : 'Open a session’s live room, then the answers written there show up in this window.'}
            </p>
          </div>
        )}
      </div>

      {!compact && (
        <footer className="select-none border-t border-border px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
          Visible to everyone — this window is never hidden from screen share.
          <br />
          <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Ctrl/Cmd+Enter</kbd> answer ·{' '}
          <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Ctrl/Cmd+Shift+Space</kbd> hide
        </footer>
      )}
    </div>
  )
}
