import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { APP_NAME } from '@shared/branding'
import type { CompanionUpdate } from '@shared/types'

let companionWindow: BrowserWindow | null = null
let lastUpdate: CompanionUpdate | null = null

function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: 380,
    height: 560,
    minWidth: 300,
    minHeight: 320,
    x: workArea.x + workArea.width - 380 - 24,
    y: workArea.y + 80,
    frame: false,
    show: false,
    title: `${APP_NAME} companion`,
    backgroundColor: '#09090b',
    // Visible by design: taskbar presence, normal focus, always on top only in the plain
    // "floating" sense, and never any content protection — screen share always shows it.
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
    if (lastUpdate) win.webContents.send('companion:update', lastUpdate)
  })
  win.on('closed', () => {
    companionWindow = null
  })
  const page = process.env['ELECTRON_RENDERER_URL']
  if (page) void win.loadURL(`${page}#/companion`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/companion' })
  return win
}

function ensureWindow(): BrowserWindow {
  if (!companionWindow || companionWindow.isDestroyed()) companionWindow = createWindow()
  return companionWindow
}

/** Show the companion (creating it if needed). */
export function showCompanion(): void {
  const win = ensureWindow()
  if (win.isMinimized()) win.restore()
  win.show()
}

export function toggleCompanion(): void {
  if (companionWindow && !companionWindow.isDestroyed() && companionWindow.isVisible()) companionWindow.hide()
  else showCompanion()
}

export function closeCompanion(): void {
  companionWindow?.close()
  companionWindow = null
}

export function initCompanion(): void {
  // The live room pushes its transcript; the companion only ever mirrors what was said.
  ipcMain.on('companion:push', (_e, update: CompanionUpdate) => {
    lastUpdate = update
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.webContents.send('companion:update', update)
    }
  })
  ipcMain.handle('companion:open', () => {
    showCompanion()
    return true
  })
  ipcMain.on('companion:close', () => closeCompanion())
}
