# Cross-Platform Compatibility Design — LocoAgent

**Date:** 2026-06-03
**Status:** Approved (design phase)
**Author:** brainstorming session (Helios + Claude)

## 1. Goal & Scope

Make LocoAgent run cleanly and identically across desktop host operating systems,
and make mobile (iOS/Android) a first-class *browser-emulation target* — not a new
automation backend, and not a native mobile runtime.

Two **orthogonal axes** that the codebase currently conflates or ignores:

- **Host axis** — where the agent process runs: `windows` | `macos` (first-class),
  `linux` (not blocked, not verified). Affects Chrome binary path, profile path,
  temp dir, process kill, and shell-out behavior.
- **Target axis** — what the browser emulates: `desktop` | `ios` | `android`.
  Affects the `agent-browser -p <profile>` argument and operation-log provenance.

### In scope
- First-class Windows + macOS host support via a single code path (no divergent scripts).
- A first-class device-target abstraction layered over `agent-browser`'s device profiles.
- Hardening the four synchronous shell-outs in `src/constants/prompts.ts`.
- A cross-platform verification/health-check harness (`doctor`).
- Documentation of the platform layer and onboarding flow.

### Out of scope (explicit non-goals)
- Running the Bun CLI natively on iOS/Android (impossible; not attempted).
- Real-device / native-app automation (Appium / WebDriver / adb).
- Linux verification (the abstraction must not actively block Linux, but Linux is
  not a verified target this cycle).
- Refactoring vendored Claude Code code in `src/` beyond the four shell-outs.

### Decisions captured during brainstorming
1. iOS/Android = **browser-side device emulation** via agent-browser profiles.
2. First-class hosts = **Windows + macOS** (Linux: don't block, don't verify).
3. Device layer = **first-class "target" abstraction**.
4. **Approach A** chosen: a thin LocoAgent platform layer outside `src/`.
5. **`device` is recorded as metadata, NOT part of the dedup key.** Social actions
   (like/follow/comment) are *account-level*, not device-level — the same tweet liked
   from the desktop and the iOS surface is one like. Putting `device` in the dedup key
   would wrongly permit double-actions. (User agreed.)

## 2. Architecture Overview

```
                         .env  ──►  stubs/globals.ts  ──►  process.env
                                                              │
                                          ┌───────────────────┴───────────────────┐
                                          ▼                                        ▼
                              scripts/lib/config.ts                       src/constants/prompts.ts
                              (loadConfig: host+device+chrome)             (execFileSync(process.execPath,…))
                                 │            │                                     │
                    ┌────────────┘            └───────────┐                  shells out to ▼
                    ▼                                     ▼                  scripts/log-operation.ts
          scripts/lib/host.ts                    scripts/lib/device.ts       scripts/workflow-engine.ts
          (HostOS, chrome paths,                 (DeviceTarget registry,
           profile, temp, kill)                   agent-browser -p args)
                    │                                     │
                    └──────────────┬──────────────────────┘
                                   ▼
                         scripts/setup-chrome.ts      scripts/doctor.ts
                         (single cross-platform)      (health-check / verify)
```

The new code lives entirely under `scripts/lib/` and `scripts/` — the LocoAgent
layer — honoring the CLAUDE.md rule that `src/` is treated as a vendored dependency.
The only `src/` change is hardening the four shell-out call sites.

## 3. Components

### 3.1 `scripts/lib/host.ts` — host OS single source of truth

Responsibilities: detect the host OS and provide all host-specific filesystem and
process defaults. No side effects on import.

```ts
export type HostOS = 'windows' | 'macos' | 'linux'

export function detectHost(): HostOS
// process.platform: 'win32'→'windows', 'darwin'→'macos', else 'linux'

export function chromeBinaryCandidates(host: HostOS): string[]
// Ordered default chrome.exe / Google Chrome paths to probe, per OS.
//   windows: %ProgramFiles%, %ProgramFiles(x86)%, %LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
//   macos:   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
//   linux:   google-chrome / google-chrome-stable / chromium on PATH

export function defaultSourceProfile(host: HostOS): string
//   windows: %LOCALAPPDATA%\Google\Chrome\User Data\Default
//   macos:   ~/Library/Application Support/Google/Chrome/Default
//   linux:   ~/.config/google-chrome/Default

export function defaultWorkProfile(): string
// join(os.tmpdir(), 'locoagent-chrome-profile') — replaces hardcoded /tmp

export function resolveChromeBinary(explicit?: string): string
// explicit (CHROME_BIN) if it exists → first existing candidate → throw with
// an actionable message ("set CHROME_BIN in .env").

export async function killChrome(host: HostOS): Promise<void>
// windows: taskkill /F /IM chrome.exe ; macos: killall "Google Chrome" ;
// linux: pkill -f chrome. Non-fatal: swallow "no such process".
```

### 3.2 `scripts/lib/device.ts` — device-target registry

```ts
export type DeviceTarget = 'desktop' | 'ios' | 'android'

export const DEVICE_REGISTRY: Record<DeviceTarget, { abProfile: string | null; label: string }>
// desktop → { abProfile: null,      label: 'Desktop Chrome' }
// ios     → { abProfile: 'ios',     label: 'iPhone (mobile web)' }
// android → { abProfile: 'android', label: 'Android (mobile web)' }

export function resolveDevice(env: NodeJS.ProcessEnv): DeviceTarget
// reads DEVICE_PROFILE; defaults to 'desktop'; unknown value → throw with valid list.

export function agentBrowserProfileArgs(target: DeviceTarget): string[]
// returns ['-p', <abProfile>] or [] for desktop.
```

The `abProfile` strings correspond to `agent-browser -p <profile>` device profiles.

### 3.3 `scripts/lib/config.ts` — central resolved config

```ts
export interface LocoConfig {
  host: HostOS
  device: DeviceTarget
  chromeBin: string
  sourceProfile: string
  workProfile: string
  debugPort: number      // CHROME_DEBUG_PORT, default 9222
}

export function loadConfig(): LocoConfig
// Pure function over process.env (already populated by globals.ts from .env).
// Applies host-aware defaults from host.ts; honors CHROME_* / DEVICE_PROFILE overrides.
// One resolver shared by setup-chrome.ts and doctor.ts so they never disagree.
```

### 3.4 `scripts/setup-chrome.ts` — unified launcher (replaces `.sh` + `.ps1`)

Single Bun script. Steps mirror the existing scripts but driven by `loadConfig()`:

1. `killChrome(host)`.
2. **Copy profile** (host-conditional for resilience):
   - **Windows:** `robocopy <src> <work>\Default /E …` (skips Chrome-locked cache files;
     exit codes 0–7 are success, ≥8 warn).
   - **macOS/Linux:** `fs.cpSync(src, work/Default, { recursive: true, force: true })`.
   - Copy `Local State` from the profile's parent dir when present.
3. **Launch Chrome** detached via `Bun.spawn` with `--remote-debugging-port`,
   `--user-data-dir=<work>`, `--no-first-run`, `--disable-default-apps`.
4. **Poll CDP** `http://127.0.0.1:<port>/json/version` via `fetch` (15× 1s).
5. `agent-browser connect <port>` (append `agentBrowserProfileArgs(device)` so a
   mobile target connects with the right emulation profile).

`package.json`: `setup-chrome` → `bun run scripts/setup-chrome.ts` (all OSes).
`setup-chrome:win` retained as an alias for the same command (muscle-memory compat).
The `.sh` and `.ps1` scripts are **deleted** (single source of truth).

### 3.5 `src/constants/prompts.ts` — shell-out hardening (only `src/` change)

- `getOperationLogSection()` and `getWorkflowStatusSection()`:
  replace `execSync(\`bun run ${scriptPath} …\`)` with
  `execFileSync(process.execPath, ['run', scriptPath, ...args], { encoding: 'utf-8', timeout: 5000 })`.
  - `process.execPath` is the running Bun binary → no PATH dependency, no shell
    quoting bugs (paths with spaces, e.g. `C:\Users\Some Name\…`, are safe).
- `getScratchpadInstructions()`: reword `/tmp`-specific text to OS-neutral
  ("system temporary directories"). The directory itself already comes from the
  cross-platform `getScratchpadDir()`; only the prose changes.
- `getPersonaSection()` / `getTasksSection()`: already use `node:path.join` — unchanged.

### 3.6 `scripts/log-operation.ts` — `device` metadata

- Extend `Operation` with optional `device?: string`.
- `add` accepts `--device <d>` (default: omit; absence ⇒ treated as `desktop`).
- **`check` dedup key is unchanged**: `platform + action + url + status === 'success'`.
  `device` is NOT part of the key.
- `summary` may annotate device when present. Backward compatible: pre-existing
  log entries without `device` continue to load and match.
- `LOG_PATH` becomes overridable via an env var (e.g. `LOCO_OP_LOG_PATH`) so
  `doctor`'s round-trip check can target an isolated temp file. Default unchanged.

### 3.7 `scripts/doctor.ts` — cross-platform health check / verification

`bun run doctor [--check-cdp]`. Prints a status table; exits non-zero if any
**critical** check fails. Checks:

| Check | Critical | Detail |
|-------|----------|--------|
| Bun present + version | yes | `process.versions.bun` |
| `agent-browser` on PATH | yes | `agent-browser --version` via execFile |
| Chrome binary resolvable | yes | `resolveChromeBinary()` |
| Host detected | yes | `detectHost()` |
| Device resolved | yes | `resolveDevice(process.env)` |
| `.env` present + required keys | warn | OPENAI/ANTHROPIC creds, CHROME_* hints |
| `persona/` dir | warn | onboarding hint if absent |
| log-operation round-trip | yes | write a probe entry to an **isolated temp log** (never `persona/operation-log.json`) → `check` returns done → discard. Validates fs/JSON round-trip without polluting real dedup state. |
| CDP port reachable | only with `--check-cdp` | `fetch /json/version` |

Doubles as the portable replacement for the bash-only `tests/*.sh` and as new-machine
onboarding.

### 3.8 Documentation

- New `docs/cross-platform-guide.md`: Windows + macOS install → `setup-chrome` →
  `doctor` → `start`, plus the host/device/config model and `DEVICE_PROFILE` usage.
- `CLAUDE.md`: add a "Platform abstraction layer" subsection pointing at `scripts/lib/`.
- `README.md`: add `bun run doctor` to the command table.
- `tests/*.sh`: add a header note that they are bash-only (macOS/Linux); `doctor`
  is the cross-platform check.
- `skills/x-com/SKILL.md`: note (non-breaking) that operations may target a device
  via `DEVICE_PROFILE` / agent-browser `-p`.

## 4. Data Flow

1. Startup: `globals.ts` loads `.env` into `process.env`.
2. System prompt assembly: `prompts.ts` shells out via `execFileSync(process.execPath…)`
   to `log-operation.ts summary` and `workflow-engine.ts summary`.
3. `setup-chrome.ts` / `doctor.ts`: `loadConfig()` → host+device-aware Chrome launch /
   health report.
4. Agent runtime: skills/workflows call `agent-browser` (optionally with
   `agentBrowserProfileArgs(device)`); after a successful action, log via
   `log-operation.ts add … [--device <d>]`.

## 5. Error Handling

- `resolveChromeBinary` / `resolveDevice`: throw with actionable messages (what to set,
  where) rather than failing deep in a launch.
- `killChrome`: non-fatal; "no matching process" is success.
- Profile copy: Windows robocopy ≥8 ⇒ warn but continue; cpSync errors ⇒ surface.
- `prompts.ts` shell-outs keep their existing try/catch → empty-string fallback, so a
  missing Bun/script never breaks session startup.
- `doctor`: each check isolated; one failure doesn't abort the rest; aggregate exit code.

## 6. Testing & Verification

No automated unit suite exists. Verification per `verification-before-completion`:

1. `bun run typecheck` — must pass clean.
2. `bun run doctor` on **Windows** — all critical checks green (this machine).
3. `bun start -p "summarize your current state"` — confirm the four injected prompt
   sections (persona/tasks/operation-log/workflow) render without shell errors.
4. macOS steps documented in `cross-platform-guide.md` for the user to run on the
   `main`-branch mac box.

Explicitly NOT claimed: "passes tests" (there are none) or Linux verification.

## 7. Risks & Mitigations

- **Deleting `.sh`/`.ps1`** could surprise existing muscle memory → keep
  `setup-chrome:win` alias; document the single command.
- **robocopy absence** (non-standard Windows) → present on all supported Windows SKUs;
  doctor can flag if missing.
- **agent-browser device-profile names** (`ios`/`android`) must match the installed
  agent-browser version → doctor surfaces `agent-browser --version`; registry is the
  single place to adjust if upstream renames profiles.
- **Upstream `src/` rebase** touching `prompts.ts` → change is minimal and localized to
  four call sites to ease future merges.

## 8. File Manifest

New:
- `scripts/lib/host.ts`
- `scripts/lib/device.ts`
- `scripts/lib/config.ts`
- `scripts/setup-chrome.ts`
- `scripts/doctor.ts`
- `docs/cross-platform-guide.md`

Modified:
- `src/constants/prompts.ts` (4 shell-outs + scratchpad prose)
- `scripts/log-operation.ts` (`device` metadata)
- `package.json` (`setup-chrome` → `.ts`, add `doctor`)
- `CLAUDE.md`, `README.md`, `tests/*.sh` (notes), `skills/x-com/SKILL.md` (note)

Deleted:
- `scripts/setup-chrome.sh`
- `scripts/setup-chrome.ps1`
