import { app, BrowserWindow, nativeImage, nativeTheme, session, shell } from 'electron'
import { join } from 'node:path'
import { APP_NAME } from '@shared/branding'
import { closeCoach, initCoach } from './coach'
import { closeCompanion, initCompanion, toggleCompanion } from './companion'
import { applyTheme, registerIpc } from './ipc'
import { initMeetingDetect } from './meeting'
import { registerShortcuts } from './shortcuts'
import { createTray } from './tray'
import { appIconPng } from './tray-icon'

const ALLOWED_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write'])

let mainWindow: BrowserWindow | null = null
const getMain = () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    autoHideMenuBar: true,
    icon: nativeImage.createFromBuffer(appIconPng(256)),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#09090b' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow = win

  win.once('ready-to-show', () => win.show())
  // The companion and the coach mirror the live room, so they have nothing to show without it.
  win.on('closed', () => {
    closeCompanion()
    closeCoach()
  })

  // External links open in the user's browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

// One instance only: each process keeps the JSON store in memory, so two would overwrite each other.
if (!app.requestSingleInstanceLock()) app.quit()

app.on('second-instance', () => {
  const win = getMain()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  // Microphone (for dictation and the live room) and clipboard writes only; everything else is denied.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(ALLOWED_PERMISSIONS.has(permission))
  )
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))

  // "Share audio" in the live room: when the page asks for display media, hand it the
  // selected screen *with system loopback audio* so shared-audio lines can be captured.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    // 'loopback' is a runtime-only value on Windows; the typings still say WebFrameMain.
    callback({ video: 'screen', audio: 'loopback' } as unknown as Parameters<typeof callback>[0])
  })

  applyTheme()
  registerIpc()
  createWindow()
  initMeetingDetect(getMain)
  initCompanion()
  initCoach(getMain)
  const disposeShortcuts = registerShortcuts(getMain, toggleCompanion)
  createTray(getMain, () => {
    const win = getMain()
    win?.show()
    win?.focus()
    win?.webContents.send('app:navigate', '#/new')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else getMain()?.show()
  })

  app.on('quit', disposeShortcuts)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
