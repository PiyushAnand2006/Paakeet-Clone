import { BrowserWindow, globalShortcut, webContents } from 'electron'
import type { CoachAction, CoachShortcuts } from '@shared/types'

const NUDGE_PX = 40

/**
 * Live-room shortcuts, registered only while a live room is open. `Ctrl/Cmd+Backspace` is
 * deliberately not used for Clear: it deletes a word in whatever text field has focus.
 */
const LIVE_SHORTCUTS: { accelerator: string; label: string; action: CoachAction }[] = [
  { accelerator: 'CommandOrControl+Enter', label: 'Ctrl/Cmd+Enter', action: 'answer' },
  { accelerator: 'CommandOrControl+Shift+Enter', label: 'Ctrl/Cmd+Shift+Enter', action: 'screenshot' },
  { accelerator: 'CommandOrControl+Shift+Space', label: 'Ctrl/Cmd+Shift+Space', action: 'coach' },
  { accelerator: 'CommandOrControl+Shift+Left', label: 'Ctrl/Cmd+Shift+Left', action: 'previous' },
  { accelerator: 'CommandOrControl+Shift+Right', label: 'Ctrl/Cmd+Shift+Right', action: 'next' },
  { accelerator: 'CommandOrControl+Shift+Backspace', label: 'Ctrl/Cmd+Shift+Backspace', action: 'clear' }
]

/**
 * The live room's combinations, held only while it is open so the app never sits on
 * Ctrl+Enter for the rest of the OS. Returns which shortcuts were already taken by another app.
 */
export function setLiveShortcuts(active: boolean, emit: (action: CoachAction) => void): CoachShortcuts {
  for (const shortcut of LIVE_SHORTCUTS) globalShortcut.unregister(shortcut.accelerator)
  const result: CoachShortcuts = { registered: [], failed: [] }
  if (!active) return result
  for (const shortcut of LIVE_SHORTCUTS) {
    if (globalShortcut.register(shortcut.accelerator, () => emit(shortcut.action))) result.registered.push(shortcut.label)
    else result.failed.push(shortcut.label)
  }
  return result
}

/**
 * Window shortcuts. `Ctrl/Cmd+Shift+H` is global so the app can be summoned or hidden over
 * whatever you are doing, and `Ctrl/Cmd+Shift+O` toggles the companion transcript window;
 * the arrow nudges only apply while a Rehearse window is focused, so the OS-wide arrow
 * combinations are never taken over.
 */
export function registerShortcuts(getMain: () => BrowserWindow | null, toggleCompanion: () => void): () => void {
  const toggleMain = () => {
    const main = getMain()
    if (!main) return
    if (main.isVisible() && main.isFocused()) main.hide()
    else {
      if (main.isMinimized()) main.restore()
      main.show()
      main.focus()
    }
  }

  globalShortcut.register('CommandOrControl+Shift+H', toggleMain)
  globalShortcut.register('CommandOrControl+Shift+O', toggleCompanion)

  const nudge = (contents: Electron.WebContents, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(contents)
    if (!win) return
    const [x, y] = win.getPosition()
    win.setPosition(x + dx * NUDGE_PX, y + dy * NUDGE_PX)
  }

  const listener = (event: Electron.Event, input: Electron.Input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || !input.alt) return
    const deltas = {
      Up: [0, -1],
      Down: [0, 1],
      Left: [-1, 0],
      Right: [1, 0]
    } as const
    const delta = deltas[input.key as keyof typeof deltas]
    if (!delta) return
    const focused = webContents.getFocusedWebContents()
    if (!focused) return
    event.preventDefault()
    nudge(focused, delta[0], delta[1])
  }

  const attach = (win: BrowserWindow | null) => win?.webContents.on('before-input-event', listener)
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(attach)

  return () => {
    globalShortcut.unregister('CommandOrControl+Shift+H')
    globalShortcut.unregister('CommandOrControl+Shift+O')
    windows.forEach((w) => w.webContents.removeListener('before-input-event', listener))
  }
}
