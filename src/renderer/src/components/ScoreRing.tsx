import { cn } from './ui'

function toneFor(score: number): string {
  if (score >= 8) return 'text-primary'
  if (score >= 6) return 'text-warning'
  return 'text-danger'
}

/** Circular 0-10 score. Shows a dash while ungraded. */
export function ScoreRing({ score, size = 56, className }: { score: number | null; size?: number; className?: string }) {
  const stroke = Math.max(4, size / 12)
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const progress = score === null ? 0 : Math.min(1, score / 10)
  return (
    <div
      className={cn('relative shrink-0', score !== null && toneFor(score), className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? 'Not scored yet' : `Score ${score.toFixed(1)} out of 10`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-foreground"
        style={{ fontSize: size * 0.3 }}
      >
        {score === null ? '–' : Number.isInteger(score) ? score : score.toFixed(1)}
      </span>
    </div>
  )
}
