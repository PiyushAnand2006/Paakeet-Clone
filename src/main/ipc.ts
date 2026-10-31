import Anthropic from '@anthropic-ai/sdk'
import { BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { AiEvent, AiJob, CoachAnswer, LibraryKind, SessionInput, SettingsPatch, TranscriptEntry } from '@shared/types'
import { cancelJob, friendlyError, generateQuestions, startJob } from './ai'
import { emitCoachAction, setCoachAllowed } from './coach'
import { importFiles, SUPPORTED_EXTENSIONS } from './documents'
import { scrapeJobPost } from './scrape'
import { setLiveShortcuts } from './shortcuts'
import * as store from './store'
import { testTranscribeKey, transcribeChunk } from './transcribe'

export function applyTheme(): void {
  nativeTheme.themeSource = store.getSettings().theme
}

async function exportPdf(sender: Electron.WebContents, html: string, suggestedName: string) {
  const owner = BrowserWindow.fromWebContents(sender) ?? undefined
  const { canceled, filePath } = await dialog.showSaveDialog(owner!, {
    title: 'Export PDF',
    defaultPath: `${suggestedName.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return null

  // Render in an isolated, script-free window so exported HTML can never run code.
  const printer = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await printer.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    })
    await writeFile(filePath, pdf)
    return filePath
  } finally {
    printer.destroy()
  }
}

export function registerIpc(): void {
  // settings
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:update', (_e, patch: SettingsPatch) => {
    const next = store.updateSettings(patch)
    if (patch.theme) applyTheme()
    return next
  })
  ipcMain.handle('settings:setApiKey', (_e, key: string | null) => {
    store.setApiKey(key)
    return store.getSettings()
  })
  ipcMain.handle('settings:testApiKey', async () => {
    const key = store.getApiKey()
    if (!key) return { ok: false, message: 'No API key saved.' }
    try {
      const model = await new Anthropic({ apiKey: key }).models.retrieve(store.defaultModel())
      return { ok: true, message: `Connected. ${model.display_name} is available.` }
    } catch (err) {
      return { ok: false, message: friendlyError(err) }
    }
  })

  // library
  ipcMain.handle('library:list', (_e, kind: LibraryKind) => store.listLibrary(kind))
  ipcMain.handle('library:import', async (e, kind: LibraryKind) => {
    const owner = BrowserWindow.fromWebContents(e.sender)!
    const { canceled, filePaths } = await dialog.showOpenDialog(owner, {
      title: kind === 'resume' ? 'Add resume' : 'Add documents',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents', extensions: SUPPORTED_EXTENSIONS }]
    })
    if (canceled) return { added: [], failed: [] }
    return importFiles(kind, filePaths)
  })
  ipcMain.handle('library:remove', (_e, id: string) => store.removeLibraryItem(id))

  // sessions
  ipcMain.handle('sessions:list', () => store.listSessions())
  ipcMain.handle('sessions:get', (_e, id: string) => store.getSession(id) ?? null)
  ipcMain.handle('sessions:create', (_e, input: SessionInput) => store.createSession(input))
  ipcMain.handle('sessions:update', (_e, id: string, patch: Partial<SessionInput>) =>
    store.updateSession(id, patch)
  )
  ipcMain.handle('sessions:remove', (_e, id: string) => store.removeSession(id))
  ipcMain.handle('sessions:generateQuestions', (_e, id: string) => generateQuestions(id))
  ipcMain.handle(
    'sessions:saveAnswer',
    (_e, sessionId: string, questionId: string, answer: string, secondsSpent: number) =>
      store.updateQuestion(sessionId, questionId, { answer, secondsSpent, answeredAt: Date.now() })
  )
  ipcMain.handle('sessions:setTranscript', (_e, sessionId: string, transcript: TranscriptEntry[]) =>
    store.setTranscript(sessionId, transcript)
  )
  ipcMain.handle('sessions:setCoachAnswers', (_e, sessionId: string, answers: CoachAnswer[]) =>
    store.setCoachAnswers(sessionId, answers)
  )
  ipcMain.handle('sessions:endLive', (_e, sessionId: string) => store.markLiveEnded(sessionId))

  // Live room shortcuts are held only while a live room says it is open. The room also says
  // whether its answers may be on screen at all; when they may not, the coach window stays shut.
  ipcMain.handle('coach:active', (_e, active: boolean, allowWindow?: boolean) => {
    setCoachAllowed(active ? allowWindow !== false : true)
    return setLiveShortcuts(active, emitCoachAction)
  })

  // job-post scraping for the session form
  ipcMain.handle('scrape:url', (_e, url: string) => scrapeJobPost(url))

  // live-room transcription (OpenAI-compatible endpoint, key stays in the main process)
  ipcMain.handle('transcribe:setKey', (_e, key: string | null) => {
    store.setTranscribeKey(key)
    return store.getSettings()
  })
  ipcMain.handle('transcribe:test', () => testTranscribeKey())
  ipcMain.handle('transcribe:chunk', (_e, audio: Uint8Array, language: string) => transcribeChunk(audio, language))

  // Save a live transcript as a text file the user keeps.
  ipcMain.handle('transcript:save', async (e, suggestedName: string, markdown: string) => {
    const owner = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePath } = await dialog.showSaveDialog(owner!, {
      title: 'Save transcript',
      defaultPath: `${suggestedName.replace(/[\\/:*?"<>|]+/g, '-')}.md`,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Plain text', extensions: ['txt'] }
      ]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, markdown, 'utf8')
    return filePath
  })

  // Save the audio captured in the live room ("share audio") as a .webm file.
  ipcMain.handle('audio:save', async (e, suggestedName: string, data: Uint8Array) => {
    const owner = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePath } = await dialog.showSaveDialog(owner!, {
      title: 'Save call audio',
      defaultPath: `${suggestedName.replace(/[\\/:*?"<>|]+/g, '-')}.webm`,
      filters: [{ name: 'Audio (webm)', extensions: ['webm'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, data)
    return filePath
  })

  // AI streaming jobs: events go back only to the window that asked.
  ipcMain.handle('ai:start', (e, job: AiJob) =>
    startJob(job, (event: AiEvent) => {
      if (!e.sender.isDestroyed()) e.sender.send('ai:event', event)
    })
  )
  ipcMain.handle('ai:cancel', (_e, requestId: string) => cancelJob(requestId))

  ipcMain.handle('export:pdf', (e, html: string, name: string) => exportPdf(e.sender, html, name))
}
