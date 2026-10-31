# Rehearse

An AI mock-interview coach for the desktop. Paste a job description, pick your resume, and an AI
interviewer asks you the questions that role would really ask. Answer out loud or by typing, get a
score and specific feedback on every answer, then a debrief that says what to drill next.

## Features

- **Three kinds of sessions**: *Interview* (a role you are preparing for), *Regular call* (notes for
  any meeting), and *Mock interview* (the AI plays the interviewer).
- **Fill fields from interview post URL**: paste a job-posting link and the role, company and job
  description are extracted for you.
- **Live room**: open any session live. It transcribes what you say (where the platform speech
  service is available), and shared call audio can be transcribed in ~12-second chunks through an
  OpenAI-compatible endpoint you configure in Settings — or kept just as a recording. The room
  shows a session timer, zooms the transcript in/out, ends itself after inactivity, and saves the
  transcript to the session. The screen always runs dark, whatever the shell theme.
- **AI write-ups**: live sessions end in written notes (summary, key points, action items); mock
  interviews end in a scored debrief. Every write-up is exportable as PDF.
- **Tailored mock interviews**: questions written from the job description, your resume and any
  reference documents. Choose a behavioral, technical, coding or mixed loop, and 3 to 12 questions.
- **Interviewer voice**: each question is read aloud with your system's text-to-speech (toggleable).
- **Speak or type**: dictation with a live mic meter where the platform's speech service is
  available; typing always works.
- **Scored feedback**: every answer gets a 1-10 score in one of three styles: *Quick essentials*,
  *Core answer with context*, or *Model answer* (adds a stronger example grounded in your resume).
- **Debrief**: overall readiness, strengths, the biggest opportunities with drills, and which
  questions to rehearse again. Exportable as PDF.
- **Resume tailor**: rewrites your resume for a job using only facts already in it, marks missing
  metrics as `[add metric]` instead of inventing them, and exports to PDF.
- **Library**: PDF, DOCX, TXT and Markdown resumes and documents, parsed once and stored locally.
- **Meeting Detect** (off by default): while no session is open, watches for sustained microphone
  activity and offers a toast to start taking notes. Best effort — it hears sound arriving at the
  mic, not which app holds it.
- **Window shortcuts**: `Ctrl/Cmd+Shift+H` shows/hides the app from anywhere;
  `Ctrl/Cmd+Shift+O` toggles the companion transcript window; `Ctrl/Cmd+Alt+Arrows` nudges the
  window while it is focused.
- **Answer coach**: while a live room is open, *Answer* reads the latest shared-audio line and
  suggests how to respond, and *Screenshot* takes one still of your screen and helps with what is
  on it (a problem statement, a coding prompt). Answers are kept as history you can step through,
  and *Auto-suggest* writes one per new shared line with a cooldown between runs. Answers are
  grounded in your resume and session notes, mark unknown details as `[placeholder]`, and decline
  graded or proctored assessments in favour of practice problems. *Settings → Answer coach* picks
  where suggestions go: **On screen** (the default) writes them into the room and the coach window,
  while **Saved for the debrief** keeps them off the display entirely and lists them in the session
  afterwards. Both modes save every suggestion with the session.
- **Live-room shortcuts**, held only while a room is open: `Ctrl/Cmd+Enter` answer,
  `Ctrl/Cmd+Shift+Enter` screenshot, `Ctrl/Cmd+Shift+Left/Right` previous/next answer,
  `Ctrl/Cmd+Shift+Backspace` clear, `Ctrl/Cmd+Shift+Space` show/hide the coach window. They are
  released the moment the room closes.
- **Companion window**: an always-on-top mirror of the live room's transcript (what was said and
  what you type — never generated answers). It is visible by design: no content protection,
  taskbar presence, normal focus, so screen sharing always shows it.
- **Coach window**: a second always-on-top window that shows the current answer beside the call.
  It is visible on the same terms as the companion: no content protection, no hidden or click-through
  mode, taskbar presence, and a footer that says so. The chevron in its header collapses it to a
  one-line bar when you would rather it took up less room.
- **Tray & single instance**, plus a first-run tour.
- **Light, dark and system themes.**

## Running it

Requires Node 22+.

```bash
npm install
```

```bash
npm run dev
```

Then open **Settings** and paste an Anthropic API key. It is encrypted with your OS credential store
(`safeStorage`) and only read by the main process.

Other scripts: `npm run build` (production bundles into `out/`), `npm start` (run the built app),
`npm run dist` (Windows NSIS installer into `release/`), `npm run icons` (regenerate the app
icon), `npm run typecheck`.

The product name lives in `src/shared/branding.ts` (window titles, tray menu, sidebar wordmark) and
in `package.json` (`build.productName`, `build.appId`, `build.nsis.artifactName`); the icons come
from `npm run icons`. Electron derives the folder it keeps user data in from the packaged product
name, so export sessions before shipping under a different one.

## How it's built

| Layer | Where | Notes |
|---|---|---|
| Main process | `src/main/` | Window, IPC, JSON store in `userData`, document parsing, Claude calls |
| Preload | `src/preload/index.ts` | Typed `window.rehearse` bridge; no raw `ipcRenderer` exposed |
| Renderer | `src/renderer/src/` | React 19, Tailwind v4, hash routing, Markdown output |
| Shared types | `src/shared/types.ts` | Single source of truth for both processes |

- **AI**: `@anthropic-ai/sdk` with streaming. Defaults to `claude-opus-5-5`; Sonnet 5.5 and Haiku
  5.5 are selectable per session. Question generation uses structured JSON output. Server-side
  refusal fallback is enabled for Opus and Sonnet (a declined request is re-run on a fallback model
  inside the same call). Streams are cancelled when you leave a screen.
- **Security**: context isolation and sandboxed renderer; the window cannot navigate away; external
  links open in your browser; permissions limited to microphone and clipboard; PDF export renders
  in a script-disabled window. Screen captures happen only when you press *Screenshot*, are
  downscaled before they leave the machine, and are sent only to Anthropic with that one request.
- **Data**: everything stays on this machine in `rehearse-data.json` under the app's `userData`
  folder. Text you practise with is sent to Anthropic's API to generate questions and feedback.

`docs/ANALYSIS.md` holds the notes from the original reverse-engineering pass.
