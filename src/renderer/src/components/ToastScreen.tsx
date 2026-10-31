import { MessagesSquare, Phone } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * Rendered inside the frameless meeting-detect toast window. The window never takes
 * focus, so this stays visible over a call without stealing keystrokes.
 */
export function ToastScreen() {
  return (
    <div className="dark flex h-full flex-col bg-background p-4 text-foreground">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Phone className="size-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight">Are you in a meeting?</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Rehearse can keep notes while you talk. Start a session, or dismiss this and carry on.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => window.rehearse.meeting.dismissFromToast()}>
          Dismiss
        </Button>
        <Button size="sm" onClick={() => window.rehearse.meeting.startFromToast()}>
          <MessagesSquare className="size-3.5" /> New session
        </Button>
      </div>
    </div>
  )
}
