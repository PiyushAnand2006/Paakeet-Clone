import type { PracticeQuestion } from '@shared/types'

export type Readiness = 'not-yet' | 'getting-there' | 'ready'

/**
 * The single number shown on the dashboard and the debrief for a whole session.
 *
 * Each question has `score` (1-10, or null while ungraded) and `answer` ('' when skipped).
 * Return null when there is nothing meaningful to show yet.
 */
export function overallScore(questions: PracticeQuestion[]): number | null {
  // TODO(you): decide how a session's overall score is computed. See the note in chat.
  const graded = questions.filter((q) => q.score !== null)
  if (graded.length === 0) return null
  return graded.reduce((sum, q) => sum + (q.score ?? 0), 0) / graded.length
}

export function readiness(score: number | null): Readiness | null {
  if (score === null) return null
  if (score >= 8) return 'ready'
  if (score >= 6) return 'getting-there'
  return 'not-yet'
}

export const READINESS_LABEL: Record<Readiness, string> = {
  'not-yet': 'Not yet',
  'getting-there': 'Getting there',
  ready: 'Ready'
}
