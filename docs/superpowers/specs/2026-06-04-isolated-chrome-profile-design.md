# Isolated, persistent Chrome CDP profile — design

**Date:** 2026-06-04
**Branch:** fix/provider-config-clarity-and-tls (or a fresh `fix/isolated-chrome-profile`)
**Status:** approved, ready for implementation

## Problem

`scripts/setup-chrome.ts` conflicts with the user's normal Chrome and destroys
logged-in sessions. On every run it:

1. `killChrome()` → `taskkill /F /IM chrome.exe` (macOS `killall`, Linux `pkill`)
   — **kills the user's normal Chrome windows**.
2. Copies the real `Default` profile + `Local State` into the work dir — **useless**
   under Chrome 127+ App-Bound Encryption (ABE binds cookies to the original
   install, so the copy is logged-OUT), and the only reason the kill was needed
   (to read Chrome-locked files).
3. `rmSync(workProfile)` — **wipes any session the user logged into manually**.

This was already diagnosed on 2026-06-03 (see memory `windows-run-setup`): the
chosen approach is a fresh, isolated, *persistent* profile the user logs into
once. The code never got updated to match.

## Goal

`setup-chrome` becomes an **idempotent launcher for one persistent, isolated
profile** that never touches the user's normal Chrome and never wipes the
session except on an explicit `--reset`.

## New flow

```
bun run setup-chrome
  ├─ CDP already up on port?  ── yes ─► agent-browser connect; "reusing logged-in profile"; exit 0
  │                                      (never inspects or kills the user's normal Chrome)
  └─ no ─► ensure WORKPROFILE exists (mkdir if missing; NEVER wipe)
          launch:  chrome --remote-debugging-port=PORT --user-data-dir=WORKPROFILE
                          --no-first-run --no-default-browser-check --disable-default-apps
          wait for CDP ready ─► agent-browser connect
          fresh dir?  ─► "log into X/socials once; the session persists"
          existing?   ─► "reusing logged-in profile"

bun run setup-chrome --reset
  └─ killChromeForProfile(WORKPROFILE)  (kills ONLY the isolated-profile Chrome)
     wipe WORKPROFILE, then run the fresh-launch path (forces a clean re-login)
```

## Code changes

### `scripts/lib/host.ts`
- `defaultWorkProfile(host, env)` → **stable per-user dir** (persists across reboots
  and temp cleanup), host-aware:
  - Windows: `%LOCALAPPDATA%\locoagent-chrome-profile`
  - macOS:   `~/Library/Application Support/locoagent-chrome-profile`
  - Linux:   `${XDG_DATA_HOME:-~/.local/share}/locoagent-chrome-profile`
  - Defaults keep the no-arg call working (`detectHost()` / `process.env`).
- Add `killChromeForProfile(host, workProfile)` — **targeted** kill matched by the
  `--user-data-dir` value on the process command line:
  - Windows: `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"` →
    filter `CommandLine` contains the work dir → `Stop-Process -Force`.
  - macOS/Linux: `pkill -f "user-data-dir=<workProfile>"`.
  - Non-fatal; "no matching process" is success.
- Keep the old kill-all `killChrome` exported (no callers after this change) — or
  remove if nothing references it. It must NOT be used by setup-chrome.

### `scripts/lib/config.ts`
- Drop `sourceProfile` from `LocoConfig` and `loadConfig` (no more copying).
- `defaultSourceProfile` may stay in host.ts (documents the real profile path) but
  is no longer wired into config.

### `scripts/setup-chrome.ts` (rewrite)
- Parse `--reset` from argv.
- Probe CDP `http://127.0.0.1:PORT/json/version`.
  - up && !reset → connect + exit (idempotent fast path).
  - reset → `killChromeForProfile`, wipe, fall through to launch.
- Track whether WORKPROFILE existed *before* this run (`existsSync` before mkdir)
  to choose the first-run vs reused message.
- Launch with the flags above (no copy, no kill-all, no wipe-on-run).
- Reuse the existing 15s CDP-ready wait loop and `agent-browser connect`.

### Tests
- `scripts/lib/host.test.ts`: assert `defaultWorkProfile('windows', {LOCALAPPDATA})`
  lands under LOCALAPPDATA; mac/linux land under their per-user dirs. Keep the
  no-arg "contains locoagent-chrome-profile" test.
- `scripts/lib/config.test.ts`: unchanged behavior (already doesn't assert
  sourceProfile); confirm it still compiles with the type change.

## Docs / wiring (remove every "copies profile" claim)
- `.env.example` — drop `CHROME_SOURCE_PROFILE`; describe `CHROME_WORK_PROFILE` as
  the persistent isolated profile; add `--reset` note.
- `install.ps1`, `install.sh` — help line "copy Chrome profile + launch…" →
  "launch isolated Chrome with CDP on :9222".
- `CLAUDE.md` line ~36 — same help-line fix.
- `README.md`, `README.zh-CN.md` — setup-chrome description + "log in once, it
  persists" + `--reset`.
- `docs/cross-platform-guide.md` — remove `CHROME_SOURCE_PROFILE` table row, fix
  `CHROME_WORK_PROFILE` default, fix the "copy profile" line.
- `skills/x-com/SKILL.md:~1117` — expired cookies → re-login in the isolated
  window (or `setup-chrome --reset`), not "re-run setup-chrome" (which no longer
  wipes).

## Verification
- `bun test scripts` — updated unit tests pass.
- `bun run doctor` — all critical checks pass.
- Normal Chrome **open** → `bun run setup-chrome`: isolated instance launches
  side-by-side, user's windows survive, CDP up, `agent-browser connect` OK.
- Re-run → "reusing logged-in profile", session intact, normal Chrome untouched.
- `bun run setup-chrome --reset` → only the isolated profile is wiped; fresh login.

## Trade-off
First run with the new code starts from a blank isolated profile, so the user
logs into socials once. The old copy never carried logins anyway (ABE), so this
is strictly more honest and the session now persists indefinitely.
