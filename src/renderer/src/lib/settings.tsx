import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Settings, SettingsPatch } from '@shared/types'

interface SettingsContextValue {
  settings: Settings | null
  update: (patch: SettingsPatch) => Promise<void>
  setApiKey: (key: string | null) => Promise<void>
  setTranscribeKey: (key: string | null) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function useResolvedDark(theme: Settings['theme'] | undefined): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return theme === 'dark' || (theme === 'system' && systemDark)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void window.rehearse.settings.get().then(setSettings)
  }, [])

  const dark = useResolvedDark(settings?.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const update = useCallback(async (patch: SettingsPatch) => {
    setSettings(await window.rehearse.settings.update(patch))
  }, [])
  const setApiKey = useCallback(async (key: string | null) => {
    setSettings(await window.rehearse.settings.setApiKey(key))
  }, [])
  const setTranscribeKey = useCallback(async (key: string | null) => {
    setSettings(await window.rehearse.transcribe.setKey(key))
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, update, setApiKey, setTranscribeKey }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
