# ParakeetAI Desktop 3.9.141 — Security Architecture Audit

## 1. Scope and result

This is a **scoped, quick, static architecture audit** of the installed ParakeetAI Desktop artifact requested by the user. It is a partial pass, not a comprehensive vulnerability assessment or a runtime compatibility certification.

- **Installed target:** `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop`
- **Application version:** 3.9.141 (`resources/app.asar` internal `package.json`; executable ProductVersion 3.9.141.0)
- **Profile:** quick, scoped to window privacy, answer automation/history, global hotkeys, overlay behavior, screenshot/coding assistance, screen-share stealth, executable disguise, and directly related packaging evidence
- **Budget:** none set
- **Execution policy:** sandboxed-source-and-local-only; actual work was static only. No target-controlled application code was executed.
- **Prior runs:** none; no prior coverage ledger or findings were available.
- **Out of scope:** server-side AI prompts/models/storage, source build pipeline, update/signing infrastructure, comprehensive IPC vulnerability hunting, and live Zoom/Teams/Meet/HackerRank/CoderPad testing.
- **Formal run limitation:** the available toolset did not provide a separate research/coverage-critic agent. A second direct source-and-evidence pass reconciled the checklist, but this is not represented as fresh-agent review. The run metadata therefore records the formal audit as incomplete while retaining the completed architecture report.

**Result:** the requested client-side mechanisms are present in the shipped Electron code. The report confirms the window privacy initialization, overlay configuration, answer flows, hotkeys, screenshot path, coding category, and U+2800 executable name as static observations. It does **not** confirm the exact `WDA_EXCLUDEFROMCAPTURE` argument, third-party screen-share behavior, Task Manager invisibility, or a blank icon. No vulnerability met the evidence bar for a confirmed security finding.

## 2. Artifacts and evidence conventions

### 2.1 Artifact identity

| Artifact | Size | SHA-256 |
|---|---:|---|
| `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\resources\app.asar` | 178,320,849 bytes | `63E2C3FB1A23751C3382E6CCEB17B06A4821B484D704A09FD8E7C00CA053DB7F` |
| `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\⠀.exe` | 210,293,504 bytes | `61B8597C165A1D98F54861DF83CB10AB861B6FF44BE090DDE6E04FD6634691C9` |

The executable's first filename character is **U+2800 BRAILLE PATTERN BLANK**, not an ordinary space.

### 2.2 Exact paths used for line references

The shipped webpack bundles are minified. The extracted `dist/main/main.js` has five physical lines, and the relevant main-process code is on line 3. Readable audit derivatives were therefore generated without executing the application.

**Packaged files (archive-internal paths):**

- `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\resources\app.asar\dist\main\main.js`
- `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\resources\app.asar\dist\main\preload.js`
- `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\resources\app.asar\dist\renderer\renderer.js`

**Readable audit copies cited below:**

- Main: `C:\Users\thaku\hackathon-projects\Parakeet-AI\security-audit-skill\parakeetai-desktop\run-1\scratch\formatted\main\main.js`
- Preload: `C:\Users\thaku\hackathon-projects\Parakeet-AI\security-audit-skill\parakeetai-desktop\run-1\scratch\formatted\main\preload.js`
- Renderer: `C:\Users\thaku\hackathon-projects\Parakeet-AI\security-audit-skill\parakeetai-desktop\run-1\scratch\formatted\renderer\renderer.js`
- REA PE imports: `C:\Users\thaku\hackathon-projects\Parakeet-AI\security-audit-skill\parakeetai-desktop\run-1\scratch\rea-main-pe-imports.formatted.json`

Unless explicitly labeled “packaged original,” line numbers below refer to these readable audit copies. Direct string-to-position checks against the packaged original main bundle independently located:

| Packaged original token | Line:column |
|---|---|
| `new i.BrowserWindow` | `dist/main/main.js:3:1829193` |
| `setContentProtection` | `dist/main/main.js:3:1849031` |
| `renderer/capture-screenshot` | `dist/main/main.js:3:1857926` |
| `CommandOrControl+Enter` | `dist/main/main.js:3:1864282` |

### 2.3 REA evidence

REA 6.8.0 CLI was used because REA MCP registration was unavailable. The PE import parser returned Evidence ID:

`ev_619f35a0417d9d59210210c996b37c3826196ce2074e695dfafa87bfbced7920`

The evidence digest matches the audited executable. REA's JSON display mangled the Unicode executable name, but its SHA-256 and byte size match the independently hashed `⠀.exe`.

## 3. Findings overview

| Requested item | Static conclusion | Validation state |
|---|---|---|
| Window privacy | Window creation calls `setPrivateMode(true)`, which calls `setContentProtection(true)` | Confirmed static path |
| Native anti-capture | `USER32.dll` delay-imports `GetWindowDisplayAffinity` and `SetWindowDisplayAffinity` | Confirmed imports; call arguments unknown |
| `WDA_EXCLUDEFROMCAPTURE` | No literal found in the extracted JavaScript/native source searched | **Unresolved**, not inferred |
| Always-on-top overlay | Transparent, frameless, taskbar-hidden, click-through; Windows `screen-saver` level; all workspaces/full-screen | Confirmed static configuration |
| Auto Answer | End-of-utterance callback can issue `auto-ai-help` when `autoAnswer` is enabled | Confirmed static path; not per-token generation |
| Manual answer/history | `ai-help` uses the shared chat transport; assistant history is loaded and navigable | Confirmed static path |
| Global hotkeys | All requested accelerators are registered through Electron `globalShortcut` | Confirmed registrations; OS runtime success untested |
| Screenshot answers | Current-display `desktopCapturer` capture becomes JPEG and enters `analyze-screen` | Confirmed static path |
| Coding mode | `Coding (LeetCode-style)` category exists | Confirmed label/category; no local solver established |
| Screen-share stealth | Privacy implementation and product claims exist | Third-party behavior **not runtime-tested** |
| Disguised executable | U+2800 filename and blank FileDescription confirmed | Confirmed metadata |
| Blank icon / Task Manager invisibility | Extracted icon is a nonblank blue-square icon | Blank-icon claim **refuted**; Task Manager claim untested |

## 4. Window privacy and always-on-top overlay

### 4.1 Initialization locations

All references in this table are in the readable main audit copy unless noted otherwise.

| Lines | Initialization |
|---|---|
| `main.js:69327-69344` | Constructs `BrowserWindow` with `transparent: true`, `alwaysOnTop: true`, `frame: false`, `resizable: false`, `skipTaskbar: true`, `hiddenInMissionControl: true`, `movable: false`, `hasShadow: false`, and `type: "panel"` |
| `main.js:69345-69349` | On Windows calls `setAlwaysOnTop(true, "screen-saver", 1)`, disables background throttling, and reapplies the level every second |
| `main.js:69351-69353` | Calls `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` |
| `main.js:69364-69366` | Calls `setIgnoreMouseEvents(true, { forward: true })`, stores the main window, then calls `setPrivateMode(true)` |
| `main.js:70052-70055` | `setPrivateMode(e)` calls `mainWindow.setContentProtection(e)`, emits `main/private-mode-changed`, and persists `isPrivate` |
| `main.js:70420-70423` | Renderer IPC can change click-through state with `setIgnoreMouseEvents(t, { forward: true })` |
| `main.js:70432-70438` | Live-session visibility can reset private mode to true and registers/unregisters live-session shortcuts |
| `main.js:70552-70554` | `renderer/set-is-private` and `renderer/get-is-private` IPC handlers |
| `renderer.js:86251-86275` | Privacy switch invokes the setter, loads the setting, and listens for changes |
| `renderer.js:86392-86404` | UI states that private mode cannot be disabled in interview mode and links disabling it to screen-share visibility |

**Privacy initialization chain:**

`create/focus main window` → `new BrowserWindow(...)` → `setMainWindow(r)` → `setPrivateMode(true)` → `mainWindow.setContentProtection(true)`.

This is the exact source-level initialization requested. Static analysis establishes the call path, not a runtime observation of Windows accepting or enforcing the setting.

### 4.2 Native display-affinity evidence

REA's PE import evidence contains:

- `USER32.dll` delay-import descriptor: `rea-main-pe-imports.formatted.json:7566-7580`
- `GetWindowDisplayAffinity`: `rea-main-pe-imports.formatted.json:8398-8404`
- `SetWindowDisplayAffinity`: `rea-main-pe-imports.formatted.json:9078-9084`

Bounded searches of the extracted application and readable bundles found no `WDA_EXCLUDEFROMCAPTURE`, `SetWindowDisplayAffinity`, or `GetWindowDisplayAffinity` JavaScript/native-source literal. The unpacked native module exports audio bindings only at:

`C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\resources\app.asar.unpacked\node_modules\@parakeetai-desktop\native-modules\prebuilt\index.js:794-800`

**Conclusion:** the executable contains the native API imports, and Electron content protection is enabled in JavaScript. The exact native flag, including whether it is `WDA_EXCLUDEFROMCAPTURE`, remains unverified because no native call-site provider/disassembler was available and import presence does not reveal call arguments.

### 4.3 Zoom/Teams/Meet/HackerRank/CoderPad claims

The renderer contains product/tutorial claims, not independent test evidence:

| Product claim | Renderer lines |
|---|---|
| Invisible during screen share/dock/Task Manager | `79579-79583` |
| Hidden on Zoom screen share | `79593-79598` |
| Hidden on Microsoft Teams screen share | `79600-79605` |
| Hidden on Google Meet screen share | `79607-79612` |
| Hidden during CoderPad | `79635-79640` |
| Hidden during HackerRank | `79642-79647` |

These strings should not be quoted as measured compatibility. Actual behavior depends on the OS, Electron version, capture path, and third-party application and was not tested.

## 5. Auto Answer, manual answers, and answer history

### 5.1 Auto Answer flow

1. The setting UI binds `autoAnswer` and labels it “Auto Answer (Beta)” at `renderer.js:61867-61873`.
2. Share/interviewer transcription invokes `onEndOfUtterance` at `renderer.js:73457-73474`; partial transcripts have a separate callback at `73466-73470`.
3. The end-of-utterance callback reaches `me.current` at `renderer.js:73535-73538`. When `j?.autoAnswer` is true and the callback value is falsy, it calls `generateAiResponse({ kind: "auto-ai-help" })`.
4. The shared generator checks the Auto Answer flag again, prevents overlapping submitted/streaming requests, and applies a five-second recheck/cooldown path at `renderer.js:72229-72245`.
5. `DefaultChatTransport` sends the session ID, pending transcript entries, trigger, and session metadata to the configured AI API at `renderer.js:72149-72189`.
6. Assistant responses are exposed as answer history at `renderer.js:72281`.

**Interpretation:** generation is triggered after eligible completed utterances, not automatically on every spoken partial token. The client initiates an `auto-ai-help` request; question classification and answer generation involve the configured AI transport, whose server-side implementation was not available.

### 5.2 Manual answer and shared generation path

- Manual wrapper: `renderer.js:83904-83906`
- Ctrl+Enter handler emits `kind: "ai-help"`: `renderer.js:83945-83949`
- Answer button emits the same kind without shortcut marking: `renderer.js:84181-84191`
- Shared manual/automatic/screenshot generator: `renderer.js:72229-72276`
- Text and screenshot parts are added at `renderer.js:72248-72256`; request trigger metadata is attached at `72258-72272`

### 5.3 Answer history and clearing

- Existing AI messages are queried by `callSessionId`: `renderer.js:72064-72073`
- Returned messages are hydrated into chat state: `renderer.js:72213-72219`
- Only assistant messages are exposed as `aiMessages`: `renderer.js:72281`
- Previous/next/clear shortcut listeners: `renderer.js:81942-81948`
- Previous/next controls operate on the selected history index: `renderer.js:81995-82024`

Clearing answers stops streaming, clears local messages, and writes an `aiMessagesClearedAt` timestamp through session metadata at `renderer.js:72282-72290`. The inspected client path does **not** establish physical deletion of server-side history.

## 6. Global answer hotkeys

Registrations are in readable `main.js:70504-70532`. `CommandOrControl` is Electron's cross-platform accelerator; on Windows these are the requested Ctrl combinations.

| Hotkey | Main-process registration | Renderer effect |
|---|---|---|
| Ctrl+Enter | `70505-70506` → `main/primary-ai-message-shortcut-pressed` | Generates manual `ai-help` at `renderer.js:83945-83949` |
| Ctrl+Shift+Enter | `70507-70508` → `main/secondary-ai-message-shortcut-pressed` | Captures and submits `analyze-screen` at `renderer.js:83951-83954` and `83907-83920` |
| Ctrl+Alt+Enter | `70528-70529` → `main/add-screenshot-shortcut-pressed` | Adds a screenshot to chat at `renderer.js:83103-83105`; it does not by itself prove immediate submission |
| Ctrl+Shift+Space | `70523-70527` → `main/chat-shortcut-pressed` | Creates/focuses the main window and opens chat at `renderer.js:83959-83960` |
| Ctrl+Backspace | `70519-70520` → `main/clear-ai-messages-shortcut-pressed` | Clears the answer list through `renderer.js:81948` and `72282-72290` |
| Ctrl+Up / Ctrl+Down | `70509-70512` | Emits live-screen scroll events |
| Ctrl+Left / Ctrl+Right | `70515-70518` | Previous/next answer at `renderer.js:81942-81947` |
| Ctrl+H | `70513-70514` | Toggles live-screen visibility at `renderer.js:83940-83944` |
| Ctrl+Shift+Backspace | `70521-70522` | Clears the transcript through `renderer.js:83956-83957` |

The live-session visibility IPC registers these shortcuts when visible and unregisters them when hidden at `main.js:70432-70438`; explicit unregistration is at `70531-70532`.

These are static calls to Electron's **global** shortcut API, which is the no-focus control mechanism by design. Actual registration success, conflicts with other software, and end-to-end delivery were not runtime-tested.

## 7. Screenshot capture and Coding (LeetCode-style) mode

### 7.1 Screenshot answer chain

1. Ctrl+Shift+Enter or the Screenshot button reaches `Ot` at `renderer.js:83907-83920` and `84192-84201`.
2. The renderer mutation invokes `renderer/capture-screenshot` at `renderer.js:89339-89363`.
3. The main handler begins at `main.js:70320` and calls `desktopCapturer.getSources({ types: ["screen"], ... })` at `70340-70346`.
4. It selects the current display with fallbacks at `70329-70359`, validates the thumbnail at `70360-70377`, and caps resized output to 3840×2160 at `70378-70390`.
5. It encodes JPEG quality 85 and returns a base64 data URL at `70391-70404`.
6. `Ot` submits that image with `kind: "analyze-screen"` at `renderer.js:83916-83920`; the shared generator attaches it as `mediaType: "image/jpeg"` at `72252-72256`.

The separate chat attachment UI allows at most 10 screenshots and enforces a 4 MB aggregate limit at `renderer.js:83081-83094`.

### 7.2 Coding mode

`renderer.js:75644-75652` defines the `coding` preview category with label **“Coding (LeetCode-style)”** and a sample two-sum question. Renderer tutorial text also says the app can read code shared on screen at `79566-79570`.

This establishes a coding category and screenshot-to-AI path. It does **not** establish a local LeetCode-solving engine. The solving intelligence and server-side prompt/model implementation are behind the configured AI transport and were not present in the inspected client path.

## 8. Disguised executable and icon

Verified executable properties:

- Path: `C:\Users\thaku\AppData\Local\Programs\parakeetai-desktop\⠀.exe`
- Filename code points: `U+2800 U+002E U+0065 U+0078 U+0065`
- ProductVersion: `3.9.141.0`
- FileDescription: the same U+2800 blank character
- OriginalFilename: empty
- SHA-256: `61B8597C165A1D98F54861DF83CB10AB861B6FF44BE090DDE6E04FD6634691C9`

The associated icon was extracted to:

`C:\Users\thaku\hackathon-projects\Parakeet-AI\security-audit-skill\parakeetai-desktop\run-1\scratch\associated-icon.png`

It is a **32×32 nonblank blue-square icon**. Therefore, the blank-filename portion of the premise is supported, but the blank-icon portion is not. `skipTaskbar: true` is a window property and does not prove Task Manager process invisibility; no such runtime guarantee is made here.

## 9. Security architecture notes

### 9.1 Renderer-to-main authority

The preload exposes a generic `ipcRendererProxy.invoke(channel, ...args)` and `.on(channel, callback)` at `preload.js:94-102`, then exposes it as `window.electron` through `contextBridge` at `151-160`.

This makes renderer origin/content integrity a critical trust boundary: renderer code can reach privileged operations including screenshot capture, privacy changes, and window behavior by design. This is a hardening observation, **not a confirmed vulnerability**, because this scoped review did not establish attacker-controlled renderer content or a cross-principal result.

### 9.2 AI/data boundary

The client sends call-session IDs, pending transcript entries, trigger metadata, optional text, and JPEG screenshots through `DefaultChatTransport` (`renderer.js:72149-72189` and `72248-72272`). Server-side retention, authorization, prompt construction, and model behavior were not available and are not assessed.

### 9.3 Package integrity exception

The initial REA ASAR analysis returned `artifact_integrity_mismatch` for:

`dist/main/parakeetai-native.win32-x64-msvc.node`

- Declared SHA-256: `a2fca0ac2db730e4ba8ec89723c092c9e2b6e6a2bd11cd8962449bae3892c803`
- Calculated SHA-256: `9021925c17c37906b4a2b37c7bf017c122b6658372af7a5eb189a0f6d532a78f`

Analysis was rerun with record-and-continue. This exception is not proof of tampering, but the package must not be described as integrity-clean. Its build/package provenance requires owner verification.

### 9.4 Positive static patterns

- Privacy is enabled during window creation and can be reset on live-session entry.
- Live-session global shortcuts have explicit unregistration.
- Screenshot capture validates empty/missing images and reports errors.
- Chat screenshot attachments have count and aggregate-size limits.
- The preload uses `contextBridge` rather than directly assigning the Electron module to the page.

These are source patterns, not comprehensive security certification.

## 10. Confirmed vulnerability findings

**None.** No confirmed vulnerability records are present in `findings.json`. Intended same-user capabilities and unresolved compatibility questions were not converted into vulnerability claims without a demonstrated trust-boundary violation.

## 11. Needs validation

| Lead | Exact blocker | Safe resolution |
|---|---|---|
| Exact native affinity flag | PE imports do not reveal call-site arguments; no native disassembly provider was available | Owner-controlled native call-site inspection or an instrumented test build on a disposable Windows test system |
| Third-party screen-share stealth | Static API configuration cannot prove Zoom/Teams/Meet/HackerRank/CoderPad behavior | Owner-observed test with dummy content on an owner-controlled system and versions recorded |
| Global hotkey operation | Registration success and conflicts were not observed at runtime | Owner-observed local session with dummy data; record any registration failure |
| Task Manager appearance | Filename metadata does not establish process-list behavior | Owner-observed local process-list inspection without assuming invisibility |
| Server-side AI/history behavior | Server source and retention controls are absent from the installed client | Owner review of API authorization, prompt/model path, retention, and deletion semantics |
| ASAR integrity mismatch | Installed-artifact review cannot identify whether packaging or post-packaging modification caused it | Reproduce the package from trusted source and compare the native-module digest and ASAR integrity metadata |

These leads have no severity and are not confirmed vulnerabilities.

## 12. Coverage and limitations

- **Ledger:** 1 covered scoped static unit; 2 explicit out-of-scope units; 0 candidates; 0 blocked; 0 deferred.
- **Checklist:** every user-requested feature was traced or explicitly marked unresolved/refuted.
- **Final critic:** no separate coverage-critic agent was available; no clean or exhaustive coverage claim is made.
- **Validation of artifacts:** `findings.json` and `coverage-ledger.json` pass the skill's own validation functions (0 findings; 3 coverage units). The validator CLI entry points refuse every input on Windows because Node exposes no `O_NOFOLLOW`/`O_NONBLOCK` constants, so the equivalent exported validation functions were invoked directly; only the file-read guard was bypassed.
- **REA environment:** CLI used directly; REA doctor reported unsupported Node.js 25.2.1 and no configured native analysis provider. PE parsing still produced digest-bound evidence.
- **Runtime:** no application, meeting service, assessment platform, external endpoint, or paid AI service was executed or contacted.
- **Scope:** this report does not assess unrelated application features, server-side controls, installer/update policy, or all possible IPC/security boundaries.
