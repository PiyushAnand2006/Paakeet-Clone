import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  CoachAnswer,
  LibraryItem,
  LibraryKind,
  ModelId,
  PracticeQuestion,
  Session,
  SessionInput,
  Settings,
  SettingsPatch,
  TranscriptEntry
} from '@shared/types'

interface StoredSettings extends Omit<Settings, 'hasApiKey' | 'hasTranscribeKey'> {}

interface Db {
  version: 2
  settings: StoredSettings
  library: LibraryItem[]
  sessions: Session[]
}

const DEFAULT_SETTINGS: StoredSettings = {
  defaultModel: 'claude-opus-5-5',
  defaultLanguage: 'English',
  theme: 'light',
  autoReadQuestions: true,
  meetingDetect: false,
  inactivityEndMinutes: 5,
  coachMode: 'live',
  tourDone: false,
  transcribeBaseUrl: 'https://api.openai.com/v1',
  transcribeModel: 'whisper-1'
}

const MAX_COACH_ANSWERS = 50

const dataPath = () => join(app.getPath('userData'), 'rehearse-data.json')
const keyPath = () => join(app.getPath('userData'), 'anthropic-key.bin')
const transcribeKeyPath = () => join(app.getPath('userData'), 'transcribe-key.bin')

let db: Db | null = null

function load(): Db {
  if (db) return db
  const empty: Db = { version: 2, settings: { ...DEFAULT_SETTINGS }, library: [], sessions: [] }
  try {
    if (existsSync(dataPath())) {
      const parsed = JSON.parse(readFileSync(dataPath(), 'utf8')) as Partial<Db>
      db = {
        ...empty,
        ...parsed,
        // Settings keys added in later versions fall back to their defaults.
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        // Sessions created before session types and the live room existed get those fields.
        sessions: (parsed.sessions ?? []).map((s) => ({
          ...s,
          type: s.type ?? 'mock',
          transcript: s.transcript ?? [],
          coachAnswers: s.coachAnswers ?? [],
          liveStartedAt: s.liveStartedAt ?? null
        }))
      }
      return db
    }
  } catch (err) {
    console.error('Could not read data file, starting fresh:', err)
  }
  db = empty
  return db
}

/** Write to a temp file then rename, so a crash mid-write never corrupts the data file. */
function persist(): void {
  const tmp = `${dataPath()}.tmp`
  writeFileSync(tmp, JSON.stringify(load(), null, 2))
  renameSync(tmp, dataPath())
}

// ---------- settings & API key ----------

export function getSettings(): Settings {
  return {
    ...load().settings,
    hasApiKey: getApiKey() !== null,
    hasTranscribeKey: getTranscribeKey() !== null
  }
}

export function updateSettings(patch: SettingsPatch): Settings {
  const d = load()
  d.settings = { ...d.settings, ...patch }
  persist()
  return getSettings()
}

export function setApiKey(key: string | null): void {
  if (!key) {
    rmSync(keyPath(), { force: true })
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable, so the API key cannot be stored securely.')
  }
  writeFileSync(keyPath(), safeStorage.encryptString(key.trim()))
}

export function getApiKey(): string | null {
  if (!existsSync(keyPath())) return null
  try {
    return safeStorage.decryptString(readFileSync(keyPath()))
  } catch {
    return null
  }
}

// ---------- transcription key (separate credential, same protection) ----------

export function setTranscribeKey(key: string | null): void {
  if (!key) {
    rmSync(transcribeKeyPath(), { force: true })
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable, so the key cannot be stored securely.')
  }
  writeFileSync(transcribeKeyPath(), safeStorage.encryptString(key.trim()))
}

export function getTranscribeKey(): string | null {
  if (!existsSync(transcribeKeyPath())) return null
  try {
    return safeStorage.decryptString(readFileSync(transcribeKeyPath()))
  } catch {
    return null
  }
}

// ---------- library ----------

export function listLibrary(kind: LibraryKind): LibraryItem[] {
  return load()
    .library.filter((item) => item.kind === kind)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function getLibraryItem(id: string): LibraryItem | undefined {
  return load().library.find((item) => item.id === id)
}

export function addLibraryItem(item: Omit<LibraryItem, 'id' | 'createdAt'>): LibraryItem {
  const full: LibraryItem = { ...item, id: randomUUID(), createdAt: Date.now() }
  load().library.push(full)
  persist()
  return full
}

export function removeLibraryItem(id: string): void {
  const d = load()
  d.library = d.library.filter((item) => item.id !== id)
  for (const s of d.sessions) {
    if (s.resumeId === id) s.resumeId = null
    s.documentIds = s.documentIds.filter((docId) => docId !== id)
  }
  persist()
}

// ---------- sessions ----------

export function listSessions(): Session[] {
  return [...load().sessions].sort((a, b) => b.createdAt - a.createdAt)
}

export function getSession(id: string): Session | undefined {
  return load().sessions.find((s) => s.id === id)
}

export function createSession(input: SessionInput): Session {
  const session: Session = {
    ...input,
    id: randomUUID(),
    status: 'draft',
    questions: [],
    summary: '',
    transcript: [],
    coachAnswers: [],
    liveStartedAt: null,
    createdAt: Date.now(),
    completedAt: null
  }
  load().sessions.push(session)
  persist()
  return session
}

/** Replace the whole live transcript of a session (the live room sends its full local state). */
export function setTranscript(sessionId: string, transcript: TranscriptEntry[]): Session {
  const session = getSession(sessionId)
  if (!session) throw new Error('Session not found.')
  session.transcript = transcript
  session.liveStartedAt = transcript.length ? (session.liveStartedAt ?? Date.now()) : session.liveStartedAt
  if (session.status === 'draft') session.status = 'in-progress'
  persist()
  return session
}

export function markLiveEnded(sessionId: string): Session {
  const session = getSession(sessionId)
  if (!session) throw new Error('Session not found.')
  session.liveStartedAt = null
  if (session.type === 'mock' && session.questions.length) session.status = 'in-progress'
  persist()
  return session
}

/** Replace the coach answer history of a session. The live room caps it before sending. */
export function setCoachAnswers(sessionId: string, answers: CoachAnswer[]): Session {
  const session = getSession(sessionId)
  if (!session) throw new Error('Session not found.')
  session.coachAnswers = answers.slice(-MAX_COACH_ANSWERS)
  persist()
  return session
}

export function updateSession(id: string, patch: Partial<Session>): Session {
  const session = getSession(id)
  if (!session) throw new Error('Session not found.')
  Object.assign(session, patch, { id })
  persist()
  return session
}

export function updateQuestion(
  sessionId: string,
  questionId: string,
  patch: Partial<PracticeQuestion>
): Session {
  const session = getSession(sessionId)
  const question = session?.questions.find((q) => q.id === questionId)
  if (!session || !question) throw new Error('Question not found.')
  Object.assign(question, patch, { id: questionId })
  persist()
  return session
}

export function removeSession(id: string): void {
  const d = load()
  d.sessions = d.sessions.filter((s) => s.id !== id)
  persist()
}

export function defaultModel(): ModelId {
  return load().settings.defaultModel
}
