import { Menu, Tray, nativeImage } from 'electron'
import { APP_NAME } from '@shared/branding'
import { appIconPng } from './tray-icon'

interface MainWindowLike {
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
}

let tray: Tray | null = null

export function createTray(getMain: () => MainWindowLike | null, onNewSession: () => void): void {
  const icon = nativeImage.createFromBuffer(appIconPng(32))
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Show ${APP_NAME}`,
        click: () => {
          const main = getMain()
          if (!main) return
          if (main.isMinimized()) main.restore()
          main.show()
          main.focus()
        }
      },
      { label: 'New session', click: onNewSession },
      { type: 'separator' },
      { role: 'quit', label: `Quit ${APP_NAME}` }
    ])
  )
  tray.on('double-click', () => {
    const main = getMain()
    if (!main) return
    main.show()
    main.focus()
  })
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
