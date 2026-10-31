import { BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { APP_NAME } from '@shared/branding'
import type { CoachAction, CoachStream, CoachUpdate } from '@shared/types'

const COACH_WIDTH = 460
const COACH_HEIGHT = 520
/** Height when the window is collapsed to a single-line bar. */
const COACH_BAR_HEIGHT = 96
/** Captures are downscaled before they reach the model: enough to read a problem statement. */
const SCREENSHOT_WIDTH = 1440
const SCREENSHOT_QUALITY = 82
const COACH_ACTIONS: CoachAction[] = ['answer', 'screenshot', 'coach', 'previous', 'next', 'clear']

let coachWindow: BrowserWindow | null = null
let lastUpdate: CoachUpdate | null = null
let lastStream: CoachStream | null = null
/** Cleared while the live room keeps its answers for the debrief instead of showing them. */
let coachAllowed = true
let getActionTarget: () => Electron.WebContents | null = () => null

function send(win: BrowserWindow, channel: string, payload: unknown): void {
  if (!win.isDestroyed()) win.webContents.send(channel, payload)
}

function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: COACH_WIDTH,
    height: COACH_HEIGHT,
    minWidth: 320,
    minHeight: 72,
    // Left of the companion window so an open live room can show both without overlap.
    x: workArea.x + 24,
    y: workArea.y + 80,
    frame: false,
    show: false,
    title: `${APP_NAME} coach`,
    backgroundColor: '#09090b',
    // Visible by design, exactly like the companion: taskbar presence, normal focus, always on
    // top only in the plain "floating" sense, and never any content protection — screen share
    // always shows this window and the answers in it.
    skipTaskbar: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => {
    win.show()
    if (lastUpdate) send(win, 'coach:update', lastUpdate)
    if (lastStream) send(win, 'coach:stream', lastStream)
  })
  win.on('closed', () => {
    coachWindow = null
  })
  const page = process.env['ELECTRON_RENDERER_URL']
  if (page) void win.loadURL(`${page}#/coach`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/coach' })
  return win
}

function ensureWindow(): BrowserWindow {
  if (!coachWindow || coachWindow.isDestroyed()) coachWindow = createWindow()
  return coachWindow
}

export function showCoach(): boolean {
  if (!coachAllowed) return false
  const win = ensureWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  return true
}

export function toggleCoach(): void {
  if (!coachAllowed) return
  if (coachWindow && !coachWindow.isDestroyed() && coachWindow.isVisible()) coachWindow.hide()
  else showCoach()
}

/**
 * The live room decides whether its answers may be on screen at all. While they may not, the
 * window is closed and every route that could open it is refused, including the shortcut.
 */
export function setCoachAllowed(allow: boolean): void {
  coachAllowed = allow
  if (!allow) {
    lastUpdate = null
    lastStream = null
    closeCoach()
  }
}

/** Collapse the window to a one-line bar, or restore it. */
export function setCoachCompact(compact: boolean): void {
  const win = coachWindow
  if (!win || win.isDestroyed()) return
  const [width] = win.getSize()
  win.setSize(width, compact ? COACH_BAR_HEIGHT : COACH_HEIGHT)
}

export function closeCoach(): void {
  coachWindow?.close()
  coachWindow = null
}

/** Hand an action to the live room, which owns the answers and the history. */
export function emitCoachAction(action: CoachAction): void {
  if (action === 'coach') {
    // With no window to show, tell the room so the shortcut can explain itself.
    if (!coachAllowed) {
      const target = getActionTarget()
      if (target && !target.isDestroyed()) target.send('coach:action', action)
      return
    }
    toggleCoach()
    return
  }
  const target = getActionTarget()
  if (target && !target.isDestroyed()) target.send('coach:action', action)
}

/**
 * One still of the primary screen, taken only when the user asks for it. The coach window is
 * hidden for the moment of the capture so its own answers are not fed back to the model.
 */
export async function captureScreen(): Promise<string> {
  const display = screen.getPrimaryDisplay()
  const scale = Math.min(1, SCREENSHOT_WIDTH / display.bounds.width)
  const win = coachWindow
  const hideCoach = Boolean(win && !win.isDestroyed() && win.isVisible())
  try {
    if (hideCoach) {
      win!.hide()
      // Let the compositor repaint without the window before grabbing the frame.
      await new Promise((resolve) => setTimeout(resolve, 180))
    }
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.max(1, Math.round(display.bounds.width * scale)),
        height: Math.max(1, Math.round(display.bounds.height * scale))
      }
    })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    const image = source?.thumbnail
    if (!image || image.isEmpty()) throw new Error('The screen capture came back empty. Try again.')
    return `data:image/jpeg;base64,${image.toJPEG(SCREENSHOT_QUALITY).toString('base64')}`
  } finally {
    if (hideCoach && win && !win.isDestroyed()) win.showInactive()
  }
}

export function initCoach(getMain: () => BrowserWindow | null): void {
  getActionTarget = () => getMain()?.webContents ?? null

  // The live room pushes the whole answer history; only changes worth redrawing are sent.
  ipcMain.on('coach:push', (_e, update: CoachUpdate) => {
    lastUpdate = update
    if (coachWindow && !coachWindow.isDestroyed()) send(coachWindow, 'coach:update', update)
  })
  // The text still being written travels separately so deltas stay small.
  ipcMain.on('coach:stream', (_e, stream: CoachStream) => {
    lastStream = stream
    if (coachWindow && !coachWindow.isDestroyed()) send(coachWindow, 'coach:stream', stream)
  })
  ipcMain.handle('coach:open', () => showCoach())
  ipcMain.on('coach:close', () => closeCoach())
  ipcMain.on('coach:compact', (_e, compact: boolean) => setCoachCompact(Boolean(compact)))
  ipcMain.handle('coach:capture', () => captureScreen())
  // Buttons in the coach window: ask the live room to do it, so there is one owner of state.
  ipcMain.on('coach:request', (_e, action: CoachAction) => {
    if (COACH_ACTIONS.includes(action)) emitCoachAction(action)
  })
}
