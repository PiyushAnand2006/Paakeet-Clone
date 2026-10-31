import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { getSettings } from './store'

const REQUIRED_BUSY_PROBES = 3
const COOLDOWN_MS = 15 * 60 * 1000

let mainWindow: () => BrowserWindow | null
let toastWindow: BrowserWindow | null = null
let busyStreak = 0
let lastToastAt = 0

/**
 * Meeting Detect watches for sustained microphone activity while no Rehearse session is
 * running and offers to start one. The probe itself runs in the main window's renderer
 * (short getUserMedia opens measured for loudness, see meetingProbe.ts); this module turns
 * a sustained "busy" streak into a toast and hands the user's choice back to the app.
 */
export function initMeetingDetect(getMain: () => BrowserWindow | null): void {
  mainWindow = getMain

  ipcMain.handle('meeting:reportActivity', (_e, busy: boolean) => {
    if (!getSettings().meetingDetect) return
    busyStreak = busy ? busyStreak + 1 : 0
    if (busyStreak >= REQUIRED_BUSY_PROBES) {
      busyStreak = 0
      showToast()
    }
  })

  ipcMain.on('toast:action', (_e, action: 'start' | 'dismiss') => {
    toastWindow?.close()
    if (action === 'start') {
      const main = mainWindow()
      if (!main) return
      if (main.isMinimized()) main.restore()
      main.show()
      main.focus()
      main.webContents.send('app:navigate', '#/new')
    }
  })
}

function showToast(): void {
  if (Date.now() - lastToastAt < COOLDOWN_MS) return
  if (toastWindow || mainWindow()?.webContents.getURL().includes('practice')) return
  lastToastAt = Date.now()

  const { workArea } = screen.getPrimaryDisplay()
  toastWindow = new BrowserWindow({
    width: 380,
    height: 156,
    x: workArea.x + workArea.width - 380 - 16,
    y: workArea.y + workArea.height - 156 - 16,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  toastWindow.once('ready-to-show', () => toastWindow?.show())
  toastWindow.on('closed', () => {
    toastWindow = null
  })
  toastWindow.on('focus', () => toastWindow?.blur()) // never steal focus from the call
  const page = process.env['ELECTRON_RENDERER_URL']
  if (page) void toastWindow.loadURL(`${page}#/toast`)
  else void toastWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/toast' })
}

export function closeToast(): void {
  toastWindow?.close()
}
