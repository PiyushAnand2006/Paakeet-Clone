import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AiEvent,
  AiJob,
  CoachAction,
  CoachAnswer,
  CoachShortcuts,
  CoachStream,
  CoachUpdate,
  CompanionUpdate,
  ImportResult,
  JobPostFields,
  LibraryItem,
  LibraryKind,
  Session,
  SessionInput,
  Settings,
  SettingsPatch,
  TranscriptEntry
} from '@shared/types'

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>

const api = {
  platform: process.platform,

  settings: {
    get: () => invoke<Settings>('settings:get'),
    update: (patch: SettingsPatch) => invoke<Settings>('settings:update', patch),
    setApiKey: (key: string | null) => invoke<Settings>('settings:setApiKey', key),
    testApiKey: () => invoke<{ ok: boolean; message: string }>('settings:testApiKey')
  },

  library: {
    list: (kind: LibraryKind) => invoke<LibraryItem[]>('library:list', kind),
    import: (kind: LibraryKind) => invoke<ImportResult>('library:import', kind),
    remove: (id: string) => invoke<void>('library:remove', id)
  },

  sessions: {
    list: () => invoke<Session[]>('sessions:list'),
    get: (id: string) => invoke<Session | null>('sessions:get', id),
    create: (input: SessionInput) => invoke<Session>('sessions:create', input),
    update: (id: string, patch: Partial<SessionInput>) => invoke<Session>('sessions:update', id, patch),
    remove: (id: string) => invoke<void>('sessions:remove', id),
    generateQuestions: (id: string) => invoke<Session>('sessions:generateQuestions', id),
    saveAnswer: (sessionId: string, questionId: string, answer: string, secondsSpent: number) =>
      invoke<Session>('sessions:saveAnswer', sessionId, questionId, answer, secondsSpent),
    setTranscript: (sessionId: string, transcript: TranscriptEntry[]) =>
      invoke<Session>('sessions:setTranscript', sessionId, transcript),
    setCoachAnswers: (sessionId: string, answers: CoachAnswer[]) =>
      invoke<Session>('sessions:setCoachAnswers', sessionId, answers),
    endLive: (sessionId: string) => invoke<Session>('sessions:endLive', sessionId)
  },

  scrape: {
    jobPost: (url: string) => invoke<JobPostFields>('scrape:url', url)
  },

  transcribe: {
    setKey: (key: string | null) => invoke<Settings>('transcribe:setKey', key),
    test: () => invoke<{ ok: boolean; message: string }>('transcribe:test'),
    /** Transcribe one webm audio chunk; returns the text. */
    chunk: (audio: Uint8Array, language: string) => invoke<string>('transcribe:chunk', audio, language)
  },

  transcript: {
    save: (suggestedName: string, markdown: string) => invoke<string | null>('transcript:save', suggestedName, markdown),
    saveAudio: (suggestedName: string, data: Uint8Array) => invoke<string | null>('audio:save', suggestedName, data)
  },

  meeting: {
    /** Report one mic-activity probe result from the main window's renderer. */
    reportActivity: (busy: boolean) => invoke<void>('meeting:reportActivity', busy),
    startFromToast: () => ipcRenderer.send('toast:action', 'start'),
    dismissFromToast: () => ipcRenderer.send('toast:action', 'dismiss')
  },

  companion: {
    /** Ask the main process to show the always-on-top transcript companion window. */
    open: () => invoke<boolean>('companion:open'),
    close: () => ipcRenderer.send('companion:close'),
    /** Live room: push the current transcript so the companion can mirror it. */
    push: (update: CompanionUpdate) => ipcRenderer.send('companion:push', update),
    /** Companion window: subscribe to transcript mirrors from the live room. */
    onUpdate: (listener: (update: CompanionUpdate) => void) => {
      const wrapped = (_e: IpcRendererEvent, update: CompanionUpdate) => listener(update)
      ipcRenderer.on('companion:update', wrapped)
      return () => {
        ipcRenderer.removeListener('companion:update', wrapped)
      }
    }
  },

  coach: {
    /** Ask the main process to show the always-on-top coach window. */
    open: () => invoke<boolean>('coach:open'),
    close: () => ipcRenderer.send('coach:close'),
    /** Live room: push the answer history so the coach window can mirror it. */
    push: (update: CoachUpdate) => ipcRenderer.send('coach:push', update),
    /** Live room: push the answer currently being written. */
    pushStream: (stream: CoachStream) => ipcRenderer.send('coach:stream', stream),
    /** Coach window: subscribe to the mirrored answer history. */
    onUpdate: (listener: (update: CoachUpdate) => void) => {
      const wrapped = (_e: IpcRendererEvent, update: CoachUpdate) => listener(update)
      ipcRenderer.on('coach:update', wrapped)
      return () => {
        ipcRenderer.removeListener('coach:update', wrapped)
      }
    },
    /** Coach window: subscribe to the answer currently being written. */
    onStream: (listener: (stream: CoachStream) => void) => {
      const wrapped = (_e: IpcRendererEvent, stream: CoachStream) => listener(stream)
      ipcRenderer.on('coach:stream', wrapped)
      return () => {
        ipcRenderer.removeListener('coach:stream', wrapped)
      }
    },
    /** Take one still of the primary screen, only when the user asked for it. */
    capture: () => invoke<string>('coach:capture'),
    /** Coach window: collapse to a one-line bar, or restore the full window. */
    setCompact: (compact: boolean) => ipcRenderer.send('coach:compact', compact),
    /**
     * Live room: hold the live-room shortcuts, or release them when the room closes.
     * `allowWindow` is false when the room keeps its answers for the debrief, which also refuses
     * to open the coach window.
     */
    setActive: (active: boolean, allowWindow?: boolean) =>
      invoke<CoachShortcuts>('coach:active', active, allowWindow),
    /** Coach window: ask the live room to run an action it owns. */
    request: (action: CoachAction) => ipcRenderer.send('coach:request', action),
    /** Live room: subscribe to shortcut and coach-window actions. */
    onAction: (listener: (action: CoachAction) => void) => {
      const wrapped = (_e: IpcRendererEvent, action: CoachAction) => listener(action)
      ipcRenderer.on('coach:action', wrapped)
      return () => {
        ipcRenderer.removeListener('coach:action', wrapped)
      }
    }
  },

  ai: {
    start: (job: AiJob) => invoke<string>('ai:start', job),
    cancel: (requestId: string) => invoke<void>('ai:cancel', requestId),
    /** Subscribe to streaming events; returns an unsubscribe function. */
    onEvent: (listener: (event: AiEvent) => void) => {
      const wrapped = (_e: IpcRendererEvent, event: AiEvent) => listener(event)
      ipcRenderer.on('ai:event', wrapped)
      return () => {
        ipcRenderer.removeListener('ai:event', wrapped)
      }
    }
  },

  /** Navigation requests from the tray or the meeting toast. */
  onNavigate: (listener: (to: string) => void) => {
    const wrapped = (_e: IpcRendererEvent, to: string) => listener(to)
    ipcRenderer.on('app:navigate', wrapped)
    return () => {
      ipcRenderer.removeListener('app:navigate', wrapped)
    }
  },

  exportPdf: (html: string, name: string) => invoke<string | null>('export:pdf', html, name)
}

export type RehearseApi = typeof api

contextBridge.exposeInMainWorld('rehearse', api)
