import { Briefcase, Mic, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Button, cn } from '@/components/ui'

const STEPS = [
  {
    icon: <Briefcase className="size-5" />,
    title: 'Three kinds of sessions',
    body: 'Interview for a role you are preparing for, Regular call for notes on any meeting, and Mock interview where the AI plays the interviewer and scores your answers.'
  },
  {
    icon: <Mic className="size-5" />,
    title: 'The live room',
    body: 'Open a session live: it transcribes what you say, keeps shared call audio, and writes everything up with your model when you end it. Everything stays on your machine.'
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: 'Your key, your data',
    body: 'Add your Anthropic API key in Settings. Sessions, resumes and transcripts never leave this computer except as prompts to the API.'
  }
] as const

/** First-run tour shown over the dashboard until it is dismissed. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-start bg-black/30 p-6 backdrop-blur-[2px]">
      <div role="dialog" aria-label="Welcome tour" className="w-96 rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{current.icon}</div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={onDone}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 className="mt-3 font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn('h-1.5 w-4 rounded-full transition-colors', i === step ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onDone() : setStep((s) => s + 1))}>
              {last ? 'Get started' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
