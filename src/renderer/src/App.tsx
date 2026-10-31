import { useEffect } from 'react'
import { Onboarding } from '@/components/Onboarding'
import { Sidebar } from '@/components/Sidebar'
import { CoachScreen } from '@/components/CoachScreen'
import { CompanionScreen } from '@/components/CompanionScreen'
import { ToastScreen } from '@/components/ToastScreen'
import { Spinner } from '@/components/ui'
import { navigate, useRoute } from '@/lib/router'
import { useMeetingProbe } from '@/lib/meetingProbe'
import { SettingsProvider, useSettings } from '@/lib/settings'
import { Dashboard } from '@/pages/Dashboard'
import { Library } from '@/pages/Library'
import { LiveSession } from '@/pages/LiveSession'
import { Practice } from '@/pages/Practice'
import { ResumeTailor } from '@/pages/ResumeTailor'
import { SessionForm } from '@/pages/SessionForm'
import { SettingsPage } from '@/pages/Settings'
import { Summary } from '@/pages/Summary'

function Screen() {
  const route = useRoute()
  const { settings, update } = useSettings()

  // Tray and meeting-toast navigation requests land here.
  useEffect(() => window.rehearse.onNavigate((to) => navigate(to)), [])

  // Meeting Detect listens while enabled and no session is open.
  useMeetingProbe(Boolean(settings?.meetingDetect), route)

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  // The toast, companion and coach windows render standalone screens without the app shell.
  if (route.name === 'toast') return <ToastScreen />
  if (route.name === 'companion') return <CompanionScreen />
  if (route.name === 'coach') return <CoachScreen />

  let page
  switch (route.name) {
    case 'dashboard':
      page = <Dashboard />
      break
    case 'new':
      page = <SessionForm key="new" />
      break
    case 'edit':
      page = <SessionForm key={route.id} sessionId={route.id} />
      break
    case 'practice':
      page = <Practice key={route.id} sessionId={route.id} />
      break
    case 'live':
      page = <LiveSession key={route.id} sessionId={route.id} />
      break
    case 'summary':
      page = <Summary key={route.id} sessionId={route.id} />
      break
    case 'library':
      page = <Library />
      break
    case 'tailor':
      page = <ResumeTailor />
      break
    case 'settings':
      page = <SettingsPage />
      break
  }

  return (
    <div className="flex h-full">
      <Sidebar route={route} />
      <main className="min-w-0 flex-1 overflow-y-auto">{page}</main>
      {!settings.tourDone && route.name === 'dashboard' && <Onboarding onDone={() => void update({ tourDone: true })} />}
    </div>
  )
}

export function App() {
  return (
    <SettingsProvider>
      <Screen />
    </SettingsProvider>
  )
}
