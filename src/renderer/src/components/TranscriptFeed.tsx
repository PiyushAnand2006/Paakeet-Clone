import type { TranscriptEntry } from '@shared/types'
import { cn } from '@/components/ui'
import { formatDuration } from '@/lib/format'

export const ZOOM_STEPS = ['text-[13px]', 'text-sm', 'text-base', 'text-lg'] as const

export const SOURCE_DOT: Record<TranscriptEntry['source'], string> = {
  mic: 'bg-primary',
  system: 'bg-violet-500'
}

export const SOURCE_LABEL: Record<TranscriptEntry['source'], string> = {
  mic: 'You',
  system: 'Audio'
}

function entryTime(at: number, startedAt: number): string {
  return formatDuration((at - startedAt) / 1000)
}

/**
 * The live transcript list, shared by the live room and the companion window so both
 * always render the same feed the same way.
 */
export function TranscriptFeed({
  entries,
  interim,
  zoom,
  startedAt
}: {
  entries: TranscriptEntry[]
  interim?: string
  zoom: number
  startedAt: number
}) {
  return (
    <ul className={cn('space-y-3', ZOOM_STEPS[zoom])}>
      {entries.map((t) => (
        <li key={t.id} className="flex gap-2.5">
          <span className={cn('mt-[7px] size-2 shrink-0 rounded-full', SOURCE_DOT[t.source])} aria-hidden />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground">{SOURCE_LABEL[t.source]}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                {entryTime(t.at, startedAt)}
              </span>
            </div>
            <p className="leading-snug">{t.text}</p>
          </div>
        </li>
      ))}
      {interim && (
        <li className="flex gap-2.5 opacity-60">
          <span className={cn('mt-[7px] size-2 shrink-0 rounded-full', SOURCE_DOT.mic)} aria-hidden />
          <p className="leading-snug">{interim}</p>
        </li>
      )}
    </ul>
  )
}
