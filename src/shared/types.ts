export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'
export type ThemePref = 'light' | 'dark' | 'system'
export type LibraryKind = 'resume' | 'document'
export type InterviewFocus = 'behavioral' | 'technical' | 'coding' | 'mixed'
export type FeedbackStyle = 'concise' | 'detailed' | 'model-answer'
export type QuestionKind = 'behavioral' | 'technical' | 'coding' | 'situational'
/**
 * Where the answer coach's suggestions go while a live room is open:
 *  - live:   written into the room and the coach window as they arrive.
 *  - review: written away from the screen and listed in the session's debrief instead.
 * Both modes save every answer to the session.
 */
export type CoachMode = 'live' | 'review'

/**
 * What the session is for:
 *  - interview: you have an interview coming up; set up the role, then run the live room
 *               to keep notes while you speak (and rehearse against the same context).
 *  - call:      a regular meeting or call you want a live transcript and AI notes for.
 *  - mock:      the AI interviews you and scores every answer.
 */
export type SessionType = 'interview' | 'call' | 'mock'

export const SESSION_TYPES: { id: SessionType; label: string; description: string }[] = [
  {
    id: 'interview',
    label: 'Interview',
    description: 'An interview you are preparing for. Add the role and company, keep live notes, and rehearse against the same context.'
  },
  {
    id: 'call',
    label: 'Regular call',
    description: 'Any meeting or call. Keep a live transcript and get written-up notes at the end.'
  },
  {
    id: 'mock',
    label: 'Mock interview',
    description: 'The AI plays the interviewer. Answer out loud or by typing and get a score on every answer.'
  }
]

export const MODELS: { id: ModelId; label: string; hint: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Most thorough feedback' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Balanced speed and depth' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Fastest, lowest cost' }
]

export const FEEDBACK_STYLES: { id: FeedbackStyle; label: string; hint: string }[] = [
  { id: 'concise', label: 'Quick essentials', hint: 'The two or three fixes that matter most.' },
  { id: 'detailed', label: 'Core answer with context', hint: 'Breakdown by structure, relevance, specificity and delivery.' },
  { id: 'model-answer', label: 'Model answer', hint: 'Feedback plus a stronger example answer to study.' }
]

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Hindi', 'Portuguese',
  'Italian', 'Dutch', 'Japanese', 'Korean', 'Chinese (Simplified)'
]

export interface LibraryItem {
  id: string
  kind: LibraryKind
  name: string
  fileName: string
  text: string
  sizeBytes: number
  createdAt: number
}

export interface PracticeQuestion {
  id: string
  text: string
  kind: QuestionKind
  answer: string
  feedback: string
  score: number | null
  answeredAt: number | null
  secondsSpent: number
}

/** One line of the live room's transcript. `system` lines come from shared audio, `mic` from your microphone. */
export interface TranscriptEntry {
  id: string
  at: number
  source: 'mic' | 'system'
  text: string
}

/**
 * One suggested answer written during a live room. Kept in the session so the room can be
 * reopened, and shown in the coach window that sits beside the call.
 */
export interface CoachAnswer {
  id: string
  createdAt: number
  /** `answer` reads the transcript; `screenshot` also looks at one screen capture you took. */
  kind: 'answer' | 'screenshot'
  /** `auto` means the live room wrote it after a new line arrived without you asking. */
  origin: 'manual' | 'auto'
  /** The interviewer line the answer was written for; empty when nothing was captured yet. */
  question: string
  text: string
}

export interface Session {
  id: string
  type: SessionType
  title: string
  role: string
  company: string
  jobDescription: string
  resumeId: string | null
  documentIds: string[]
  instructions: string
  focus: InterviewFocus
  questionCount: number
  feedbackStyle: FeedbackStyle
  language: string
  model: ModelId
  status: 'draft' | 'in-progress' | 'completed'
  questions: PracticeQuestion[]
  summary: string
  /** Live-room transcript; empty for sessions that have not been run live. */
  transcript: TranscriptEntry[]
  /** Suggested answers written in the live room, oldest first. */
  coachAnswers: CoachAnswer[]
  /** When the live room was last started, for the session timer. */
  liveStartedAt: number | null
  createdAt: number
  completedAt: number | null
}

export type SessionInput = Omit<
  Session,
  | 'id'
  | 'status'
  | 'questions'
  | 'summary'
  | 'transcript'
  | 'coachAnswers'
  | 'liveStartedAt'
  | 'createdAt'
  | 'completedAt'
>

export interface Settings {
  hasApiKey: boolean
  defaultModel: ModelId
  defaultLanguage: string
  theme: ThemePref
  autoReadQuestions: boolean
  /** Watch for the microphone being used by another app and offer to start a session. */
  meetingDetect: boolean
  /** End the live room automatically after this many minutes without speech. 0 disables. */
  inactivityEndMinutes: number
  /** Whether the live room shows answers as they are written, or keeps them for the debrief. */
  coachMode: CoachMode
  /** The first-run tour has been shown. */
  tourDone: boolean
  /** Base URL of an OpenAI-compatible /audio/transcriptions endpoint used for live room speech-to-text. */
  transcribeBaseUrl: string
  /** Transcription model id, e.g. whisper-1. */
  transcribeModel: string
  /** A transcription API key is stored. */
  hasTranscribeKey: boolean
}

export type SettingsPatch = Partial<Omit<Settings, 'hasApiKey'>>

/** Fields extracted from a job-posting URL by the "Fill fields from interview post URL" action. */
export interface JobPostFields {
  company: string
  role: string
  jobDescription: string
}

/** Streaming AI jobs the renderer can start. */
export type AiJob =
  | { kind: 'feedback'; sessionId: string; questionId: string }
  | { kind: 'summary'; sessionId: string }
  | { kind: 'notes'; sessionId: string }
  | { kind: 'tailor'; resumeId: string; jobDescription: string; notes: string; model: ModelId }
  /**
   * Live-room answer coach. The transcript rides along so the answer matches what was said
   * at the moment you asked, and a screenshot is an explicit `data:` URL you captured.
   */
  | {
      kind: 'coach-answer'
      sessionId: string
      transcript: TranscriptEntry[]
      screenshotDataUrl?: string
    }

export type AiEvent =
  | { requestId: string; type: 'delta'; text: string }
  /** The primary model declined mid-stream and a fallback model restarted: discard partial text. */
  | { requestId: string; type: 'reset' }
  | { requestId: string; type: 'done'; text: string }
  | { requestId: string; type: 'error'; message: string }

export interface ImportResult {
  added: LibraryItem[]
  failed: { fileName: string; reason: string }[]
}

/**
 * State mirrored into the companion window (the always-on-top transcript/notes view).
 * The companion shows only what was said and what you type — it never carries generated answers.
 */
export interface CompanionState {
  sessionId: string
  title: string
  startedAt: number
  entries: TranscriptEntry[]
  interim: string
  listening: boolean
}

export type CompanionUpdate = { clear: true } | CompanionState

/**
 * State mirrored into the coach window. Answers are pushed as a whole list so the window can
 * step through the history; the text still being streamed travels on its own channel.
 */
export interface CoachState {
  sessionId: string
  title: string
  startedAt: number
  answers: CoachAnswer[]
  selectedId: string | null
}

export type CoachUpdate = { clear: true } | CoachState

/** The answer currently being written, mirrored separately so deltas stay small. */
export interface CoachStream {
  text: string
  isStreaming: boolean
}

/** What the live room should do when a shortcut or the coach window asks for it. */
export type CoachAction = 'answer' | 'screenshot' | 'coach' | 'previous' | 'next' | 'clear'

/** Shortcuts the main process could and could not take over for an open live room. */
export interface CoachShortcuts {
  registered: string[]
  failed: string[]
}
