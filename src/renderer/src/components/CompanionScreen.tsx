import { Minus, PictureInPicture2, ZoomIn, ZoomOut, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CompanionState } from '@shared/types'
import { TranscriptFeed, ZOOM_STEPS } from '@/components/TranscriptFeed'
import { cn } from '@/components/ui'

/**
 * The companion window: an always-on-top mirror of the active live room's transcript.
 * It carries only what was said and what you type — never generated answers — and it is
 * visible by design: no content protection, taskbar presence, normal focusability, so
 * screen sharing always shows it.
 */
export function CompanionScreen() {
  const [state, setState] = useState<CompanionState | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(
    () =>
      window.rehearse.companion.onUpdate((update) => {
        setState('clear' in update ? null : update)
      }),
    []
  )

  return (
    <div className="dark flex h-full flex-col bg-background text-foreground">
      {/* Frameless drag region; controls opt out individually. */}
      <header
        className="flex select-none items-center gap-2 border-b border-border px-3 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <PictureInPicture2 className="size-3.5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold tracking-tight">{state?.title ?? 'Companion'}</div>
          {state && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('inline-block size-1.5 rounded-full', state.listening ? 'bg-primary' : 'bg-status-ended')} />
              live transcript
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            type="button"
            aria-label="Zoom out"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            className="cursor-pointer rounded-md px-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setZoom(1)}
          >
            A
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Minimise"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void window.rehearse.companion.close()}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close companion"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void window.rehearse.companion.close()}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {state && state.entries.length > 0 ? (
          <TranscriptFeed entries={state.entries} interim={state.interim} zoom={zoom} startedAt={state.startedAt} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <PictureInPicture2 className="mb-3 size-7" />
            <p className="text-sm font-medium text-foreground">
              {state ? 'Nothing captured yet.' : 'No live room is open.'}
            </p>
            <p className="mt-1 max-w-[260px] text-xs leading-relaxed">
              {state
                ? 'Lines appear here as the live room captures them.'
                : 'Open a session’s live room, then this window mirrors its transcript here, always on top.'}
            </p>
          </div>
        )}
      </div>

      <footer className="select-none border-t border-border px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
        Visible to everyone — this window is never hidden from screen share. Toggle with
        <kbd className="mx-1 rounded border border-border bg-muted px-1 font-mono text-[10px]">Ctrl/Cmd+Shift+O</kbd>
      </footer>
    </div>
  )
}
