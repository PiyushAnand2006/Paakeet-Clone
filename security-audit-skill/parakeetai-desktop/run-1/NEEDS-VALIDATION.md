# Needs Validation

These are unresolved architecture and compatibility questions, not confirmed vulnerabilities and not `needs_validation` vulnerability records in `findings.json`. They have no severity.

## 1. Exact Windows display-affinity argument

**Verified evidence:** `setPrivateMode(true)` reaches `setContentProtection(true)` in readable `scratch/formatted/main/main.js:69364-69366` and `70052-70055`. REA Evidence `ev_619f35a0417d9d59210210c996b37c3826196ce2074e695dfafa87bfbced7920` confirms `GetWindowDisplayAffinity` and `SetWindowDisplayAffinity` delay imports in the digest-matched executable.

**Blocker:** import tables do not contain call arguments, no native call-site provider was available, and bounded source searches found no `WDA_EXCLUDEFROMCAPTURE` literal.

**Resolution:** the application owner should inspect the Electron/native call site or use an owner-controlled instrumented test build on a disposable Windows system. Record the actual affinity value rather than inferring it from API presence.

## 2. Zoom/Teams/Meet/HackerRank/CoderPad capture behavior

**Verified evidence:** content protection is enabled in source; renderer strings at `scratch/formatted/renderer/renderer.js:79579-79647` claim compatibility.

**Blocker:** no third-party application or capture path was run, and product strings are not runtime evidence.

**Resolution:** on an owner-controlled test system, use dummy content and record OS, Electron, Parakeet, meeting/assessment application, and capture-mode versions. Observe whether the window appears in each supported capture mode. Do not use real interview or assessment data.

## 3. Global hotkey delivery

**Verified evidence:** registrations exist at `scratch/formatted/main/main.js:70504-70532`, with lifecycle control at `70432-70438` and renderer handlers identified in `REPORT.md`.

**Blocker:** static registration does not establish OS acceptance, accelerator conflicts, or end-to-end delivery.

**Resolution:** in a local dummy session, observe registration failures and each requested accelerator while another owner-controlled test window has focus. Stop after recording whether the corresponding event/action occurs.

## 4. Task Manager appearance

**Verified evidence:** the executable uses U+2800 in its filename and FileDescription; OriginalFilename is empty. The associated icon is nonblank.

**Blocker:** no process-list runtime observation was made, and window `skipTaskbar` is not a process-hiding control.

**Resolution:** the owner can inspect the local process list during a dummy run and record the displayed executable name/icon without assuming that a blank label means the process is absent.

## 5. Server-side AI and answer-history semantics

**Verified evidence:** the client sends session/transcript/trigger data and optional JPEG screenshots through `DefaultChatTransport`; clearing writes `aiMessagesClearedAt` at `scratch/formatted/renderer/renderer.js:72282-72290`.

**Blocker:** server-side prompt construction, coding solver, authorization, retention, and deletion implementation are absent from the installed artifact.

**Resolution:** the owner should review the corresponding API implementation and data-retention policy, especially whether clearing is filtering by timestamp or physical deletion.

## 6. ASAR native-module integrity mismatch

**Verified evidence:** REA reported declared SHA-256 `a2fca0ac2db730e4ba8ec89723c092c9e2b6e6a2bd11cd8962449bae3892c803` and calculated SHA-256 `9021925c17c37906b4a2b37c7bf017c122b6658372af7a5eb189a0f6d532a78f` for `dist/main/parakeetai-native.win32-x64-msvc.node`.

**Blocker:** installed-artifact inspection cannot determine whether the exception came from packaging, a post-packaging transformation, or another cause.

**Resolution:** reproduce the package from trusted source in the owner's build environment and compare the native-module bytes, declared ASAR integrity metadata, signing/packaging steps, and final installed digest. Do not treat the mismatch alone as proof of tampering.

## 7. Formal independent coverage review

**Blocker:** no separate research/coverage-critic agent was available in the toolset. The parent performed a second direct evidence pass and checklist reconciliation.

**Resolution:** a future review should give a fresh verifier this report, the artifact hashes, the readable derivatives, and the REA evidence, then independently check every cited path and the remaining exclusions.
