# Architecture — ParakeetAI Desktop Installed Artifact

## Scope and identity

The target is the shipped ParakeetAI Desktop 3.9.141 installation at `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop`, not the workspace source project. The Electron archive enters at `dist/main/main.js`; its preload exposes the renderer bridge and the renderer implements live-session workflows. No prior audit ledger exists.

## Principals and protected resources

The ordinary principal is the local desktop user operating a live interview/assessment session. Relevant resources are the user's display pixels, microphone/share transcription, generated answers and history, session identifiers, window visibility, and the AI service session. Important boundaries are renderer-to-main IPC, transcription/screenshot-to-AI transport, Windows window/capture policy, global OS shortcut registration, and packaged-artifact integrity.

The reviewed behavior is largely intentional same-user authority. No lower-trust principal crossing into another principal's resources was established, so intended overlay/capture/answer capabilities are architecture observations rather than vulnerabilities.

## Main lifecycle and controls

`dist/main/main.js` creates a transparent, frameless, taskbar-hidden BrowserWindow. On Windows it applies `screen-saver` always-on-top level, enables all-workspace/full-screen visibility, and starts click-through with forwarded mouse events. Window creation calls `setPrivateMode(true)`, which invokes `setContentProtection(true)` and persists `isPrivate`. Renderer IPC can query/change privacy and click-through state; live-session visibility can force privacy back on and controls shortcut registration.

The preload's `contextBridge` exposes a generic `ipcRendererProxy` for invoke/listen operations. This makes packaged renderer integrity security-relevant. No attacker-controlled navigation or remote-content principal was established in this scoped review.

REA PE evidence shows that the matching `⠀.exe` delay-imports `GetWindowDisplayAffinity` and `SetWindowDisplayAffinity`. It does not establish call arguments. No `WDA_EXCLUDEFROMCAPTURE` literal was found in the searched JavaScript/native source.

## Answer and capture flows

Share transcription delivers completed utterances to an Auto Answer gate. With `autoAnswer` enabled, the shared generator emits an `auto-ai-help` request through `DefaultChatTransport`. Manual Ctrl+Enter/Answer actions emit `ai-help`; screenshot actions emit `analyze-screen` with JPEG data URLs. The transport body includes call-session ID, pending transcript entries, trigger metadata, and session metadata. Existing assistant messages are queried by session and hydrated into history.

Electron `globalShortcut` registers the requested answer, screenshot, chat, clear, scroll, and history controls while the live screen is active. The main screenshot handler uses `desktopCapturer` for the current display, validates/resizes the image, encodes JPEG quality 85, and returns a data URL. The renderer attaches that image to the same generation path. “Coding (LeetCode-style)” is a client category; no local solver was established.

## Executable and packaging

The executable filename and FileDescription begin with U+2800 BRAILLE PATTERN BLANK; OriginalFilename is empty. Its extracted 32×32 icon is nonblank, refuting the blank-icon premise. Window `skipTaskbar` does not establish Task Manager process invisibility.

REA reported an ASAR integrity mismatch for `dist/main/parakeetai-native.win32-x64-msvc.node`; analysis continued in record-and-continue mode. The mismatch is retained as a provenance limitation, not proof of tampering.

## Validation boundaries

No target code or external service was executed. Third-party screen-share claims, shortcut registration success, Task Manager appearance, exact native affinity flags, and server-side AI/history semantics remain unobserved. REA CLI was available, but MCP registration and a native analysis provider were not. Selected companions were Desktop/Local IPC for bridge authority, AI/LLM for transcript/screenshot transport, and Supply Chain/Release for the packaged integrity exception.
