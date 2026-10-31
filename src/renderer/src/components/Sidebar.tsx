import { FileText, KeyRound, LayoutGrid, Plus, Settings2, Wand2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_NAME, APP_TAGLINE } from '@shared/branding'
import { href, type Route } from '@/lib/router'
import { useSettings } from '@/lib/settings'
import { cn } from './ui'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M9 21.5V10.5h6.2a4.1 4.1 0 0 1 1.2 8l3.6 3"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="11" r="2.2" fill="white" />
    </svg>
  )
}

function NavItem({ to, icon, label, active }: { to: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <a
      href={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      <span className="[&>svg]:size-4">{icon}</span>
      {label}
    </a>
  )
}

export function Sidebar({ route }: { route: Route }) {
  const { settings } = useSettings()
  const isSessions = ['dashboard', 'practice', 'summary', 'edit'].includes(route.name)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-6">
        <Logo className="size-7" />
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">{APP_NAME}</div>
          <div className="text-[11px] text-muted-foreground">{APP_TAGLINE}</div>
        </div>
      </div>

      <div className="px-3">
        <a
          href={href.new}
          className="mb-4 flex h-9 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> New session
        </a>
        <nav className="space-y-0.5" aria-label="Main">
          <NavItem to={href.dashboard} icon={<LayoutGrid />} label="Sessions" active={isSessions} />
          <NavItem to={href.library} icon={<FileText />} label="Resumes & documents" active={route.name === 'library'} />
          <NavItem to={href.tailor} icon={<Wand2 />} label="Resume tailor" active={route.name === 'tailor'} />
          <NavItem to={href.settings} icon={<Settings2 />} label="Settings" active={route.name === 'settings'} />
        </nav>
      </div>

      <div className="mt-auto p-3">
        {settings && !settings.hasApiKey && (
          <a
            href={href.settings}
            className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed transition-colors hover:bg-warning/15"
          >
            <KeyRound className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <span className="font-semibold">Add an API key</span> to generate questions and feedback.
            </span>
          </a>
        )}
      </div>
    </aside>
  )
}
