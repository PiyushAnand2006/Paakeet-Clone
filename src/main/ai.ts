import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam, BetaImageBlockParam } from '@anthropic-ai/sdk/resources/beta/messages'
import { randomUUID } from 'node:crypto'
import type { AiEvent, AiJob, ModelId, PracticeQuestion, QuestionKind, Session } from '@shared/types'
import { coachPrompt, feedbackPrompt, notesPrompt, questionsPrompt, summaryPrompt, tailorPrompt } from './prompts'
import { getApiKey, getLibraryItem, getSession, updateQuestion, updateSession } from './store'

type Prompt = { system: string; user: string | BetaContentBlockParam[] }
type Effort = 'low' | 'medium' | 'high'

/** Screenshots arrive as a data URL so the renderer never has to hand over a file path. */
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/
const MAX_IMAGE_BASE64 = 4 * 1024 * 1024

const active = new Map<string, { abort(): void }>()

function client(): Anthropic {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use AI features.')
  return new Anthropic({ apiKey })
}

/** A client for one-off structured calls that are not streaming jobs (e.g. URL scraping). */
export function getModelClient(_model: ModelId): Anthropic {
  return client()
}

/**
 * Server-side refusal fallback: if a model declines, the API re-runs the request on a
 * fallback model inside the same call. Haiku 5.5 has no server-side fallback.
 */
function fallbackParams(model: ModelId) {
  if (model === 'claude-haiku-5-5') return {}
  return { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
}

export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Your Anthropic API key was rejected. Check it in Settings.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to the selected model.'
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by the API. Wait a moment and try again.'
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your connection.'
  if (err instanceof Anthropic.APIError) return `API error ${err.status ?? ''}: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}

function sessionContext(session: Session) {
  const resume = session.resumeId ? getLibraryItem(session.resumeId) : undefined
  const documents = session.documentIds
    .map((id) => getLibraryItem(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
  return { resume, documents }
}

/** Turn the live room's screenshot data URL into an image block, rejecting anything unexpected. */
function imageBlock(dataUrl: string): BetaImageBlockParam {
  const match = IMAGE_DATA_URL.exec(dataUrl)
  if (!match) throw new Error('That screenshot could not be read. Capture it again.')
  if (match[2].length > MAX_IMAGE_BASE64) throw new Error('That screenshot is too large. Capture it again.')
  const mediaType = match[1] as 'image/png' | 'image/jpeg' | 'image/webp'
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: match[2] } }
}

// ---------- structured: question generation ----------

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          kind: { type: 'string', enum: ['behavioral', 'technical', 'coding', 'situational'] }
        },
        required: ['text', 'kind'],
        additionalProperties: false
      }
    }
  },
  required: ['questions'],
  additionalProperties: false
}

export async function generateQuestions(sessionId: string): Promise<Session> {
  const session = getSession(sessionId)
  if (!session) throw new Error('Session not found.')
  const { resume, documents } = sessionContext(session)
  const prompt = questionsPrompt(session, resume, documents)

  const stream = client().beta.messages.stream({
    model: session.model,
    max_tokens: 16000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: QUESTION_SCHEMA } },
    ...fallbackParams(session.model)
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') throw new Error('The model declined to write questions for this session.')

  const raw = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  const parsed = JSON.parse(raw) as { questions: { text: string; kind: QuestionKind }[] }
  const questions: PracticeQuestion[] = parsed.questions
    .slice(0, session.questionCount)
    .map((q) => ({
      id: randomUUID(),
      text: q.text.trim(),
      kind: q.kind,
      answer: '',
      feedback: '',
      score: null,
      answeredAt: null,
      secondsSpent: 0
    }))
  if (questions.length === 0) throw new Error('No questions came back. Try again.')
  return updateSession(sessionId, { questions, status: 'in-progress', summary: '', completedAt: null })
}

// ---------- streaming jobs ----------

async function streamText(
  requestId: string,
  model: ModelId,
  prompt: Prompt,
  effort: Effort,
  send: (event: AiEvent) => void
): Promise<string> {
  const stream = client().beta.messages.stream({
    model,
    max_tokens: 64000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    output_config: { effort },
    ...fallbackParams(model)
  })
  active.set(requestId, stream)
  let text = ''
  try {
    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'fallback') {
        text = ''
        send({ requestId, type: 'reset' })
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text
        send({ requestId, type: 'delta', text: event.delta.text })
      }
    }
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw new Error('The model declined this request.')
    return text
  } finally {
    active.delete(requestId)
  }
}

const SCORE_LINE = /score:\s*(\d{1,2})\s*\/\s*10/i

async function execute(job: AiJob, requestId: string, send: (e: AiEvent) => void): Promise<string> {
  switch (job.kind) {
    case 'feedback': {
      const session = getSession(job.sessionId)
      const question = session?.questions.find((q) => q.id === job.questionId)
      if (!session || !question) throw new Error('Question not found.')
      const { resume, documents } = sessionContext(session)
      const text = await streamText(requestId, session.model, feedbackPrompt(session, question, resume, documents), 'medium', send)
      const match = text.match(SCORE_LINE)
      const score = match ? Math.min(10, Math.max(1, Number(match[1]))) : null
      updateQuestion(session.id, question.id, { feedback: text, score })
      return text
    }
    case 'summary': {
      const session = getSession(job.sessionId)
      if (!session) throw new Error('Session not found.')
      const { resume } = sessionContext(session)
      const text = await streamText(requestId, session.model, summaryPrompt(session, resume), 'medium', send)
      updateSession(session.id, { summary: text, status: 'completed', completedAt: Date.now() })
      return text
    }
    case 'notes': {
      // Live-room write-up for interview/call sessions: notes from the transcript, not a score.
      const session = getSession(job.sessionId)
      if (!session) throw new Error('Session not found.')
      const { resume, documents } = sessionContext(session)
      const text = await streamText(requestId, session.model, notesPrompt(session, resume, documents), 'medium', send)
      updateSession(session.id, { summary: text, status: 'completed', completedAt: Date.now() })
      return text
    }
    case 'tailor': {
      const resume = getLibraryItem(job.resumeId)
      if (!resume) throw new Error('Resume not found.')
      return streamText(requestId, job.model, tailorPrompt(resume, job.jobDescription, job.notes), 'high', send)
    }
    case 'coach-answer': {
      // Live room: suggest an answer from the transcript, plus the screenshot when one was taken.
      const session = getSession(job.sessionId)
      if (!session) throw new Error('Session not found.')
      const { resume, documents } = sessionContext(session)
      const prompt = coachPrompt(session, job.transcript, resume, documents, Boolean(job.screenshotDataUrl))
      const content: BetaContentBlockParam[] = []
      if (job.screenshotDataUrl) content.push(imageBlock(job.screenshotDataUrl))
      content.push({ type: 'text', text: prompt.user })
      const effort: Effort = job.screenshotDataUrl ? 'medium' : 'low'
      return streamText(requestId, session.model, { system: prompt.system, user: content }, effort, send)
    }
  }
}

/**
 * Starts a job and returns its id at once; progress arrives through `send`.
 * Execution is deferred a macrotask so the invoke reply carrying the id always reaches
 * the renderer before the first event, even when the job fails immediately.
 */
export function startJob(job: AiJob, send: (e: AiEvent) => void): string {
  const requestId = randomUUID()
  setImmediate(() => {
    execute(job, requestId, send)
      .then((text) => send({ requestId, type: 'done', text }))
      .catch((err) => {
        if (err instanceof Anthropic.APIUserAbortError) return
        send({ requestId, type: 'error', message: friendlyError(err) })
      })
  })
  return requestId
}

export function cancelJob(requestId: string): void {
  active.get(requestId)?.abort()
  active.delete(requestId)
}
