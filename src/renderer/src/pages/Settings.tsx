import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, XCircle } from 'lucide-react'
import { useState } from 'react'
import { LANGUAGES, MODELS, type CoachMode, type ModelId, type ThemePref } from '@shared/types'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Segmented, Select, Switch } from '@/components/ui'
import { useSettings } from '@/lib/settings'

export function SettingsPage() {
  const { settings, update, setApiKey, setTranscribeKey } = useSettings()
  const [keyDraft, setKeyDraft] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [tKeyDraft, setTKeyDraft] = useState('')
  const [tReveal, setTReveal] = useState(false)
  const [tBusy, setTBusy] = useState(false)
  const [tTest, setTTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [tError, setTError] = useState<string | null>(null)

  if (!settings) return null

  async function saveKey() {
    setBusy(true)
    setKeyError(null)
    setTest(null)
    try {
      await setApiKey(keyDraft)
      setKeyDraft('')
      setTest(await window.rehearse.settings.testApiKey())
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveTranscribeKey() {
    setTBusy(true)
    setTError(null)
    setTTest(null)
    try {
      await setTranscribeKey(tKeyDraft)
      setTKeyDraft('')
      setTTest(await window.rehearse.transcribe.test())
    } catch (err) {
      setTError(err instanceof Error ? err.message : String(err))
    } finally {
      setTBusy(false)
    }
  }

  async function runTest() {
    setBusy(true)
    setTest(await window.rehearse.settings.testApiKey())
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <PageHeader title="Settings" />

      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <KeyRound className="size-4" /> Anthropic API key
              </h2>
              <p className="text-[13px] text-muted-foreground">Used for questions, feedback, debriefs and the resume tailor.</p>
            </div>
            {settings.hasApiKey ? <Badge tone="success">Saved</Badge> : <Badge tone="warning">Not set</Badge>}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={reveal ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={settings.hasApiKey ? 'Paste a new key to replace the saved one' : 'sk-ant-…'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                aria-label="Anthropic API key"
                className="pr-9 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? 'Hide key' : 'Show key'}
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button disabled={!keyDraft.trim()} loading={busy && Boolean(keyDraft)} onClick={() => void saveKey()}>
              Save
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!settings.hasApiKey || busy} onClick={() => void runTest()}>
              Test connection
            </Button>
            {settings.hasApiKey && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => {
                  setTest(null)
                  void setApiKey(null)
                }}
              >
                Remove key
              </Button>
            )}
          </div>

          {test && (
            <p className={`mt-3 flex items-center gap-1.5 text-sm ${test.ok ? 'text-primary' : 'text-danger'}`}>
              {test.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {test.message}
            </p>
          )}
          {keyError && <div className="mt-3"><Alert>{keyError}</Alert></div>}

          <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            The key is encrypted with your operating system's credential store and only ever read by the app's main
            process. It is never shown to the interface again.
          </p>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Defaults for new sessions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Model" htmlFor="default-model" hint={MODELS.find((m) => m.id === settings.defaultModel)?.hint}>
              <Select
                id="default-model"
                value={settings.defaultModel}
                onChange={(e) => void update({ defaultModel: e.target.value as ModelId })}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" htmlFor="default-language">
              <Select
                id="default-language"
                value={settings.defaultLanguage}
                onChange={(e) => void update({ defaultLanguage: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
            <div>
              <label htmlFor="auto-read" className="text-sm font-medium">
                Read questions aloud
              </label>
              <p className="text-xs text-muted-foreground">The interviewer speaks each new question using your system voice.</p>
            </div>
            <Switch
              id="auto-read"
              label="Read questions aloud"
              checked={settings.autoReadQuestions}
              onChange={(v) => void update({ autoReadQuestions: v })}
            />
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Live room</h2>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
            <div>
              <label htmlFor="inactivity-end" className="text-sm font-medium">
                End after inactivity
              </label>
              <p className="text-xs text-muted-foreground">
                Close the live room automatically after this many minutes without speech. 0 keeps it open until you
                end it.
              </p>
            </div>
            <Select
              id="inactivity-end"
              className="w-36"
              value={String(settings.inactivityEndMinutes)}
              onChange={(e) => void update({ inactivityEndMinutes: Number(e.target.value) })}
            >
              <option value="0">Never</option>
              <option value="3">3 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="20">20 minutes</option>
            </Select>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Answer coach</h2>
          <div className="space-y-2 rounded-lg border border-border px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Where suggestions go</div>
              <Segmented<CoachMode>
                label="Where suggestions go"
                value={settings.coachMode}
                onChange={(coachMode) => void update({ coachMode })}
                options={[
                  { value: 'live', label: 'On screen' },
                  { value: 'review', label: 'Saved for the debrief' }
                ]}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {settings.coachMode === 'live'
                ? 'Each suggestion is written into the live room and the coach window as it arrives.'
                : 'Suggestions are still written during the call, but nothing appears on the screen: the session lists them in its debrief afterwards. The coach window stays closed.'}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Both modes save every suggestion to the session. Neither hides the app: the windows are ordinary windows and
            whatever is on them is visible to anyone who can see your screen.
          </p>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Live transcription</h2>
          <p className="text-[13px] text-muted-foreground">
            Powers speech-to-text in the live room. Point it at any OpenAI-compatible
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">/audio/transcriptions</code>
            endpoint — audio chunks from "Share audio" are sent there while a session is open.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Endpoint base URL" htmlFor="transcribe-base">
              <Input
                id="transcribe-base"
                spellCheck={false}
                value={settings.transcribeBaseUrl}
                onChange={(e) => void update({ transcribeBaseUrl: e.target.value })}
                className="font-mono text-[13px]"
              />
            </Field>
            <Field label="Model" htmlFor="transcribe-model">
              <Input
                id="transcribe-model"
                spellCheck={false}
                value={settings.transcribeModel}
                onChange={(e) => void update({ transcribeModel: e.target.value })}
                className="font-mono text-[13px]"
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={tReveal ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={settings.hasTranscribeKey ? 'Paste a new key to replace the saved one' : 'sk-…'}
                value={tKeyDraft}
                onChange={(e) => setTKeyDraft(e.target.value)}
                aria-label="Transcription API key"
                className="pr-9 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => setTReveal((r) => !r)}
                aria-label={tReveal ? 'Hide key' : 'Show key'}
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                {tReveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button disabled={!tKeyDraft.trim()} loading={tBusy && Boolean(tKeyDraft)} onClick={() => void saveTranscribeKey()}>
              Save
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!settings.hasTranscribeKey || tBusy}
              onClick={async () => {
                setTBusy(true)
                setTTest(await window.rehearse.transcribe.test())
                setTBusy(false)
              }}
            >
              Test connection
            </Button>
            {settings.hasTranscribeKey && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => {
                  setTTest(null)
                  void setTranscribeKey(null)
                }}
              >
                Remove key
              </Button>
            )}
            {settings.hasTranscribeKey ? <Badge tone="success">Key saved</Badge> : <Badge tone="warning">No key</Badge>}
          </div>
          {tTest && (
            <p className={`flex items-center gap-1.5 text-sm ${tTest.ok ? 'text-primary' : 'text-danger'}`}>
              {tTest.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {tTest.message}
            </p>
          )}
          {tError && <Alert>{tError}</Alert>}
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            This key is encrypted with your OS credential store and only read by the app's main process. Audio is sent
            only to the endpoint above, never anywhere else.
          </p>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Meeting Detect</h2>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
            <div>
              <label htmlFor="meeting-detect" className="text-sm font-medium">
                Suggest a session when the mic is in use
              </label>
              <p className="text-xs text-muted-foreground">
                While no session is open, listen briefly for sustained microphone activity and offer a toast to start
                taking notes. Best effort: it hears sound arriving at the mic, not which app is holding it. Off by
                default.
              </p>
            </div>
            <Switch
              id="meeting-detect"
              label="Meeting Detect"
              checked={settings.meetingDetect}
              onChange={(v) => void update({ meetingDetect: v })}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Shortcuts:{' '}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">Ctrl/Cmd+Shift+H</kbd>{' '}
            shows or hides the app from anywhere;{' '}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">Ctrl/Cmd+Shift+O</kbd>{' '}
            toggles the companion transcript window;{' '}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">Ctrl/Cmd+Alt+Arrows</kbd>{' '}
            nudges the window while it is focused.
          </p>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Appearance</h2>
          <Segmented<ThemePref>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => void update({ theme })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' }
            ]}
          />
        </Card>

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Sessions, resumes and documents are stored only on this computer. Text you practise with is sent to Anthropic's
          API to generate questions and feedback.
        </p>
      </div>
    </div>
  )
}
