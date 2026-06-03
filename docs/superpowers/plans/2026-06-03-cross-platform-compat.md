# Cross-Platform Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LocoAgent run identically on Windows + macOS hosts via a single code path, with iOS/Android as first-class browser-emulation targets, plus a cross-platform health-check.

**Architecture:** A thin LocoAgent platform layer under `scripts/lib/` (host / device / config), a single unified `setup-chrome.ts` replacing the divergent `.sh`/`.ps1`, hardened prompt shell-outs in `src/constants/prompts.ts`, device provenance in the operation log, and a `doctor.ts` verification harness. `src/` is touched only at four call sites.

**Tech Stack:** Bun (runtime + `bun:test`), TypeScript, `agent-browser` CLI, Chrome CDP.

**Spec:** `docs/superpowers/specs/2026-06-03-cross-platform-compat-design.md`

**Conventions for this plan:**
- All `git commit` messages end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Tests are pure-function unit tests run with `bun test`. Integration pieces
  (`setup-chrome.ts`, `doctor.ts`) are verified by running them.
- `bun run typecheck` (= `tsc --noEmit`) must stay clean after every task.

---

## Task 1: Add the `bun test` script

**Files:**
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Add the `test` script**

In `package.json`, inside `"scripts"`, add this line after `"typecheck": "tsc --noEmit"` (add a comma to the typecheck line):

```json
    "typecheck": "tsc --noEmit",
    "test": "bun test scripts"
```

- [ ] **Step 2: Verify the test runner is wired (no tests yet)**

Run: `bun test scripts`
Expected: exits cleanly with `0 tests` (or "no tests found") — confirms the command resolves.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add bun test script for scripts/

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `scripts/lib/device.ts` — device-target registry (TDD)

**Files:**
- Create: `scripts/lib/device.ts`
- Test: `scripts/lib/device.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/device.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { resolveDevice, agentBrowserProfileArgs, DEVICE_REGISTRY } from './device'

test('DEVICE_REGISTRY maps every target', () => {
  expect(DEVICE_REGISTRY.desktop.abProfile).toBeNull()
  expect(DEVICE_REGISTRY.ios.abProfile).toBe('ios')
  expect(DEVICE_REGISTRY.android.abProfile).toBe('android')
})

test('resolveDevice defaults to desktop', () => {
  expect(resolveDevice({})).toBe('desktop')
})

test('resolveDevice reads DEVICE_PROFILE (case-insensitive)', () => {
  expect(resolveDevice({ DEVICE_PROFILE: 'iOS' })).toBe('ios')
})

test('resolveDevice rejects unknown values', () => {
  expect(() => resolveDevice({ DEVICE_PROFILE: 'tablet' })).toThrow()
})

test('agentBrowserProfileArgs returns -p flags', () => {
  expect(agentBrowserProfileArgs('desktop')).toEqual([])
  expect(agentBrowserProfileArgs('ios')).toEqual(['-p', 'ios'])
  expect(agentBrowserProfileArgs('android')).toEqual(['-p', 'android'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/device.test.ts`
Expected: FAIL — `Cannot find module './device'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/device.ts`:

```ts
/**
 * Device-target abstraction. Maps LocoAgent's logical targets to the
 * `agent-browser -p <profile>` device-emulation profiles. The agent runs on a
 * desktop host; iOS/Android are browser emulations, not native runtimes.
 */

export type DeviceTarget = 'desktop' | 'ios' | 'android'

export interface DeviceSpec {
  /** agent-browser device profile name, or null for no emulation (desktop). */
  abProfile: string | null
  label: string
}

export const DEVICE_REGISTRY: Record<DeviceTarget, DeviceSpec> = {
  desktop: { abProfile: null, label: 'Desktop Chrome' },
  ios: { abProfile: 'ios', label: 'iPhone (mobile web)' },
  android: { abProfile: 'android', label: 'Android (mobile web)' },
}

export function isDeviceTarget(v: string): v is DeviceTarget {
  return v === 'desktop' || v === 'ios' || v === 'android'
}

/** Resolve the active device target from env (DEVICE_PROFILE), default desktop. */
export function resolveDevice(env: NodeJS.ProcessEnv = process.env): DeviceTarget {
  const raw = (env.DEVICE_PROFILE ?? 'desktop').trim().toLowerCase()
  if (!isDeviceTarget(raw)) {
    throw new Error(
      `Invalid DEVICE_PROFILE "${raw}". Valid values: desktop, ios, android.`,
    )
  }
  return raw
}

/** agent-browser CLI args to emulate this target, e.g. ['-p','ios'] or []. */
export function agentBrowserProfileArgs(target: DeviceTarget): string[] {
  const spec = DEVICE_REGISTRY[target]
  return spec.abProfile ? ['-p', spec.abProfile] : []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/device.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
bun run typecheck
git add scripts/lib/device.ts scripts/lib/device.test.ts
git commit -m "feat: device-target registry (desktop/ios/android)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `scripts/lib/host.ts` — host OS single source of truth (TDD)

**Files:**
- Create: `scripts/lib/host.ts`
- Test: `scripts/lib/host.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/host.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  detectHost,
  chromeBinaryCandidates,
  defaultSourceProfile,
  defaultWorkProfile,
  resolveChromeBinary,
} from './host'

test('detectHost maps node platforms', () => {
  expect(detectHost('win32')).toBe('windows')
  expect(detectHost('darwin')).toBe('macos')
  expect(detectHost('linux')).toBe('linux')
})

test('chromeBinaryCandidates(windows) includes chrome.exe', () => {
  const c = chromeBinaryCandidates('windows', { ProgramFiles: 'C:\\PF', LOCALAPPDATA: 'C:\\LA' })
  expect(c.some(p => p.toLowerCase().includes('chrome.exe'))).toBe(true)
})

test('chromeBinaryCandidates(macos) points at Google Chrome.app', () => {
  expect(chromeBinaryCandidates('macos')[0]).toContain('Google Chrome')
})

test('defaultSourceProfile differs per host', () => {
  expect(defaultSourceProfile('macos')).toContain('Application Support')
  expect(defaultSourceProfile('linux')).toContain('.config')
})

test('defaultWorkProfile lives under a temp dir', () => {
  expect(defaultWorkProfile()).toContain('locoagent-chrome-profile')
})

test('resolveChromeBinary returns an existing explicit path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-'))
  const fake = join(dir, 'chrome')
  writeFileSync(fake, 'x')
  expect(resolveChromeBinary(fake, 'linux')).toBe(fake)
})

test('resolveChromeBinary throws when explicit path is missing', () => {
  expect(() => resolveChromeBinary(join(tmpdir(), 'no-such-chrome-xyz'), 'linux')).toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/host.test.ts`
Expected: FAIL — `Cannot find module './host'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/host.ts`:

```ts
/**
 * Host OS single source of truth. Detects the operating system the agent runs
 * on and supplies all host-specific Chrome / profile / temp / process defaults.
 * Pure (no side effects) except killChrome(), which is only invoked explicitly.
 */
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

export type HostOS = 'windows' | 'macos' | 'linux'

export function detectHost(platform: NodeJS.Platform = process.platform): HostOS {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

/** Ordered list of default Chrome binary paths to probe for this host. */
export function chromeBinaryCandidates(
  host: HostOS,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (host === 'windows') {
    const pf = env['ProgramFiles'] ?? 'C:\\Program Files'
    const pf86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const local = env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local')
    return [
      join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
  }
  if (host === 'macos') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
}

/** Default path to the user's real Chrome profile dir for this host. */
export function defaultSourceProfile(
  host: HostOS,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (host === 'windows') {
    const local = env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local')
    return join(local, 'Google', 'Chrome', 'User Data', 'Default')
  }
  if (host === 'macos') {
    return join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default')
  }
  return join(homedir(), '.config', 'google-chrome', 'Default')
}

/** Cross-platform temp work-profile dir (replaces hardcoded /tmp). */
export function defaultWorkProfile(): string {
  return join(tmpdir(), 'locoagent-chrome-profile')
}

/** explicit (CHROME_BIN) if it exists → first existing candidate → throw. */
export function resolveChromeBinary(
  explicit: string | undefined,
  host: HostOS = detectHost(),
): string {
  if (explicit) {
    if (existsSync(explicit)) return explicit
    throw new Error(`CHROME_BIN is set to "${explicit}" but that file does not exist.`)
  }
  for (const candidate of chromeBinaryCandidates(host)) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    `Could not find Chrome on this ${host} host. Set CHROME_BIN in .env to the Chrome binary path.`,
  )
}

/** Host-aware best-effort kill of running Chrome. Non-fatal if none running. */
export async function killChrome(host: HostOS = detectHost()): Promise<void> {
  const cmd =
    host === 'windows'
      ? ['taskkill', '/F', '/IM', 'chrome.exe']
      : host === 'macos'
        ? ['killall', 'Google Chrome']
        : ['pkill', '-f', 'chrome']
  try {
    Bun.spawnSync(cmd, { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    /* "no matching process" is success */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/host.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
bun run typecheck
git add scripts/lib/host.ts scripts/lib/host.test.ts
git commit -m "feat: host OS abstraction (chrome paths, profile, temp, kill)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `scripts/lib/config.ts` — central resolved config (TDD)

**Files:**
- Create: `scripts/lib/config.ts`
- Test: `scripts/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/config.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from './config'

function fakeChrome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'))
  const p = join(dir, 'chrome')
  writeFileSync(p, 'x')
  return p
}

test('loadConfig resolves device, port, profiles, and host', () => {
  const chrome = fakeChrome()
  const cfg = loadConfig(
    { CHROME_BIN: chrome, DEVICE_PROFILE: 'android', CHROME_DEBUG_PORT: '9333' },
    'linux',
  )
  expect(cfg.host).toBe('linux')
  expect(cfg.device).toBe('android')
  expect(cfg.debugPort).toBe(9333)
  expect(cfg.chromeBin).toBe(chrome)
  expect(cfg.workProfile).toContain('locoagent-chrome-profile')
})

test('loadConfig applies defaults (desktop, 9222)', () => {
  const chrome = fakeChrome()
  const cfg = loadConfig({ CHROME_BIN: chrome }, 'linux')
  expect(cfg.device).toBe('desktop')
  expect(cfg.debugPort).toBe(9222)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/config.test.ts`
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/config.ts`:

```ts
/**
 * Central configuration resolver. One pure function over process.env (already
 * populated from .env by stubs/globals.ts) shared by setup-chrome.ts and
 * doctor.ts so they never disagree about host/device/chrome paths.
 */
import {
  detectHost,
  defaultSourceProfile,
  defaultWorkProfile,
  resolveChromeBinary,
  type HostOS,
} from './host'
import { resolveDevice, type DeviceTarget } from './device'

export interface LocoConfig {
  host: HostOS
  device: DeviceTarget
  chromeBin: string
  sourceProfile: string
  workProfile: string
  debugPort: number
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): LocoConfig {
  const device = resolveDevice(env)
  const sourceProfile = env.CHROME_SOURCE_PROFILE ?? defaultSourceProfile(host, env)
  const workProfile = env.CHROME_WORK_PROFILE ?? defaultWorkProfile()
  const debugPort = parseInt(env.CHROME_DEBUG_PORT ?? '9222', 10)
  const chromeBin = resolveChromeBinary(env.CHROME_BIN, host)
  return { host, device, chromeBin, sourceProfile, workProfile, debugPort }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
bun run typecheck
git add scripts/lib/config.ts scripts/lib/config.test.ts
git commit -m "feat: central LocoConfig resolver over env + host

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `scripts/log-operation.ts` — `device` metadata + overridable log path (TDD)

**Files:**
- Modify: `scripts/log-operation.ts:34` (LOG_PATH), `:36-43` (Operation), `:81-100` (add)
- Test: `scripts/log-operation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/log-operation.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve(import.meta.dir, 'log-operation.ts')

test('add --device records device; check dedups by url (device-agnostic)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oplog-'))
  const logPath = join(dir, 'op.json')
  const env = { ...process.env, LOCO_OP_LOG_PATH: logPath }
  const url = 'https://x.com/u/status/1'

  const add = Bun.spawnSync(
    [process.execPath, 'run', SCRIPT, 'add',
      '--platform', 'x', '--action', 'like', '--url', url,
      '--status', 'success', '--device', 'ios'],
    { env },
  )
  expect(add.exitCode).toBe(0)

  const saved = JSON.parse(readFileSync(logPath, 'utf-8'))
  expect(saved.operations[0].device).toBe('ios')

  // check is device-agnostic: same platform+action+url is "done" even with no --device
  const chk = Bun.spawnSync(
    [process.execPath, 'run', SCRIPT, 'check',
      '--platform', 'x', '--action', 'like', '--url', url],
    { env },
  )
  expect(chk.exitCode).toBe(0) // 0 = already done

  rmSync(dir, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/log-operation.test.ts`
Expected: FAIL — `saved.operations[0].device` is `undefined` (no `--device` support yet).

- [ ] **Step 3: Make LOG_PATH overridable**

In `scripts/log-operation.ts`, replace line 34:

```ts
const LOG_PATH = resolve(__dirname, '../persona/operation-log.json')
```

with:

```ts
// LOCO_OP_LOG_PATH lets doctor/tests target an isolated log without touching
// the real persona/operation-log.json. Default unchanged.
const LOG_PATH = process.env.LOCO_OP_LOG_PATH
  ? resolve(process.env.LOCO_OP_LOG_PATH)
  : resolve(__dirname, '../persona/operation-log.json')
```

- [ ] **Step 4: Add `device` to the Operation interface**

Replace the `Operation` interface (lines 36-43) with:

```ts
interface Operation {
  ts: string          // ISO timestamp
  platform: string   // x, reddit, linkedin, etc.
  action: string     // like, comment, repost, follow, upvote, reply, post
  url: string        // canonical URL of the target content/user
  status: string     // success, failed, skipped, restricted
  device?: string    // desktop | ios | android — provenance only, NOT a dedup key
  note?: string      // optional free-text context
}
```

- [ ] **Step 5: Record `device` in the `add` command**

In the `add` block, replace these lines:

```ts
  const { platform, action, url, status, note } = flags
```

with:

```ts
  const { platform, action, url, status, device, note } = flags
```

and replace the `op` object construction:

```ts
  const op: Operation = {
    ts: new Date().toISOString(),
    platform,
    action,
    url,
    status,
    ...(note ? { note } : {}),
  }
```

with:

```ts
  const op: Operation = {
    ts: new Date().toISOString(),
    platform,
    action,
    url,
    status,
    ...(device ? { device } : {}),
    ...(note ? { note } : {}),
  }
```

(The `check` command is intentionally left unchanged — dedup stays
platform+action+url+status.)

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test scripts/log-operation.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Typecheck + commit**

```bash
bun run typecheck
git add scripts/log-operation.ts scripts/log-operation.test.ts
git commit -m "feat: record device provenance in op-log; overridable log path

device is metadata only — dedup stays account-level (platform+action+url).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Harden the prompt shell-outs in `src/constants/prompts.ts`

No unit test (this lives in a large vendored file and shells out); verified by
typecheck + an actual headless run in Task 10.

**Files:**
- Modify: `src/constants/prompts.ts` (getOperationLogSection, getWorkflowStatusSection, getScratchpadInstructions)

- [ ] **Step 1: Harden `getOperationLogSection`**

In `getOperationLogSection`, replace:

```ts
    const { execSync } = require('node:child_process')
```

with:

```ts
    const { execFileSync } = require('node:child_process')
```

and replace:

```ts
    const summary = execSync(
      `bun run ${scriptPath} summary --days 30`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()
```

with:

```ts
    const summary = execFileSync(
      process.execPath,
      ['run', scriptPath, 'summary', '--days', '30'],
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()
```

- [ ] **Step 2: Harden `getWorkflowStatusSection`**

In `getWorkflowStatusSection`, replace:

```ts
    const { execSync } = require('node:child_process')
```

with:

```ts
    const { execFileSync } = require('node:child_process')
```

and replace:

```ts
    const summary = execSync(
      `bun run ${scriptPath} summary`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()
```

with:

```ts
    const summary = execFileSync(
      process.execPath,
      ['run', scriptPath, 'summary'],
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()
```

- [ ] **Step 3: Make the scratchpad prose OS-neutral**

In `getScratchpadInstructions`, replace:

```ts
IMPORTANT: Always use this scratchpad directory for temporary files instead of \`/tmp\` or other system temp directories:
```

with:

```ts
IMPORTANT: Always use this scratchpad directory for temporary files instead of the system temporary directory:
```

then replace:

```ts
- Any file that would otherwise go to \`/tmp\`
```

with:

```ts
- Any file that would otherwise go to a system temporary directory
```

then replace:

```ts
Only use \`/tmp\` if the user explicitly requests it.
```

with:

```ts
Only use a system temporary directory if the user explicitly requests it.
```

- [ ] **Step 4: Verify the shell-outs work cross-platform**

Run: `bun run typecheck`
Expected: clean (no errors).

Run (with a persona log present, else this prints nothing — that's fine):
```bash
bun run scripts/log-operation.ts add --platform doctor --action probe --url https://example.com/p --status success
bun start -p "Reply with exactly: STATE_OK" 2>&1 | tail -5
```
Expected: the run completes without a shell/quoting error; output contains `STATE_OK`.

- [ ] **Step 5: Commit**

```bash
git add src/constants/prompts.ts
git commit -m "fix: harden prompt shell-outs with execFileSync(process.execPath)

Avoids PATH dependency and shell-quoting bugs (paths with spaces) on Windows;
makes scratchpad prose OS-neutral.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Unify `setup-chrome` into a single Bun script

**Files:**
- Create: `scripts/setup-chrome.ts`
- Delete: `scripts/setup-chrome.sh`, `scripts/setup-chrome.ps1`
- Modify: `package.json` (`setup-chrome`, `setup-chrome:win`)

> Note on device profile at connect time: `agent-browser connect` attaches to an
> existing desktop Chrome over CDP; device emulation (`-p ios`) is applied by the
> agent/skills per browser command, not retroactively at connect. So setup-chrome
> **echoes** the resolved device for visibility but connects without `-p`. This is
> a deliberate, more-correct deviation from spec §3.4 step 5.

- [ ] **Step 1: Write the unified script**

Create `scripts/setup-chrome.ts`:

```ts
#!/usr/bin/env bun
/**
 * setup-chrome.ts — single cross-platform Chrome+CDP launcher (replaces the
 * old setup-chrome.sh / setup-chrome.ps1). Copies the real Chrome profile into
 * an isolated work dir and launches Chrome with remote debugging so
 * agent-browser can operate logged-in social accounts.
 *
 * Config is read from .env / env vars via scripts/lib/config.ts.
 */
import { existsSync, mkdirSync, rmSync, cpSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadConfig } from './lib/config'
import { killChrome } from './lib/host'

const cfg = loadConfig()
console.error(`-> host=${cfg.host} device=${cfg.device} port=${cfg.debugPort}`)

if (!existsSync(cfg.sourceProfile)) {
  console.error(
    `x Chrome source profile not found: ${cfg.sourceProfile}\n` +
    `  Set CHROME_SOURCE_PROFILE in .env to your real Chrome profile dir.`,
  )
  process.exit(1)
}

console.error('-> Killing any existing Chrome processes...')
await killChrome(cfg.host)
await Bun.sleep(1000)

console.error(`-> Copying Chrome profile to ${cfg.workProfile} ...`)
console.error(`   (source: ${cfg.sourceProfile})`)
if (existsSync(cfg.workProfile)) rmSync(cfg.workProfile, { recursive: true, force: true })
mkdirSync(cfg.workProfile, { recursive: true })
const destDefault = join(cfg.workProfile, 'Default')

if (cfg.host === 'windows') {
  // robocopy tolerates Chrome-locked cache files; exit codes 0-7 are success.
  const r = Bun.spawnSync(
    ['robocopy', cfg.sourceProfile, destDefault, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1'],
    { stdout: 'ignore', stderr: 'ignore' },
  )
  if ((r.exitCode ?? 0) >= 8) {
    console.error(`   ! robocopy reported issues (exit ${r.exitCode}) - profile may be partial`)
  }
} else {
  cpSync(cfg.sourceProfile, destDefault, { recursive: true, force: true })
}

const localStateSrc = join(dirname(cfg.sourceProfile), 'Local State')
if (existsSync(localStateSrc)) {
  copyFileSync(localStateSrc, join(cfg.workProfile, 'Local State'))
  console.error('   Local State copied')
} else {
  console.error(`   ! Local State not found at ${localStateSrc} (may cause profile read errors)`)
}

console.error(`-> Launching Chrome on port ${cfg.debugPort} ...`)
const chrome = Bun.spawn(
  [
    cfg.chromeBin,
    `--remote-debugging-port=${cfg.debugPort}`,
    `--user-data-dir=${cfg.workProfile}`,
    '--no-first-run',
    '--disable-default-apps',
  ],
  { stdout: 'ignore', stderr: 'ignore' },
)
chrome.unref()
console.error(`   Chrome PID: ${chrome.pid}`)

console.error(`-> Waiting for CDP port ${cfg.debugPort} to be ready...`)
let ready = false
for (let i = 1; i <= 15; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${cfg.debugPort}/json/version`)
    if (res.ok) {
      console.error(`   Chrome CDP ready (${i}s)`)
      ready = true
      break
    }
  } catch {
    /* not up yet */
  }
  await Bun.sleep(1000)
}
if (!ready) {
  console.error(`x Chrome CDP port ${cfg.debugPort} did not become ready after 15s`)
  process.exit(1)
}

console.error(`-> Connecting agent-browser to CDP port ${cfg.debugPort} ...`)
const conn = Bun.spawnSync(['agent-browser', 'connect', String(cfg.debugPort)], {
  stdout: 'inherit',
  stderr: 'inherit',
})
if ((conn.exitCode ?? 1) !== 0) {
  console.error('x agent-browser connect failed (is agent-browser on PATH?)')
  process.exit(1)
}

console.error('')
console.error('OK Chrome setup complete. agent-browser is ready.')
console.error(`   Profile: ${cfg.workProfile}`)
console.error(`   CDP:     http://127.0.0.1:${cfg.debugPort}`)
console.error(`   Device:  ${cfg.device} (apply per-command with: agent-browser -p <profile> ...)`)
console.error('')
console.error('   Run: bun start')
```

- [ ] **Step 2: Delete the old divergent scripts**

```bash
git rm scripts/setup-chrome.sh scripts/setup-chrome.ps1
```

- [ ] **Step 3: Repoint package.json**

In `package.json`, replace:

```json
    "setup-chrome": "bash ./scripts/setup-chrome.sh",
    "setup-chrome:win": "pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/setup-chrome.ps1",
```

with:

```json
    "setup-chrome": "bun run scripts/setup-chrome.ts",
    "setup-chrome:win": "bun run scripts/setup-chrome.ts",
```

- [ ] **Step 4: Verify it runs on this (Windows) host**

Run: `bun run typecheck`
Expected: clean.

Run: `bun run setup-chrome`
Expected: prints `host=windows device=desktop port=9222`, copies the profile,
launches Chrome, reports `Chrome CDP ready`, and `agent-browser is ready`.
(Requires real Chrome + a logged-in profile; if `CHROME_SOURCE_PROFILE` isn't
set it uses the host default.)

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-chrome.ts package.json
git commit -m "feat: unify setup-chrome into one cross-platform Bun script

Replaces divergent setup-chrome.sh/.ps1 with a single scripts/setup-chrome.ts
driven by the host/device/config layer. Windows uses robocopy; mac/linux cpSync.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `scripts/doctor.ts` — cross-platform health check

**Files:**
- Create: `scripts/doctor.ts`
- Modify: `package.json` (add `doctor`)

- [ ] **Step 1: Write the doctor script**

Create `scripts/doctor.ts`:

```ts
#!/usr/bin/env bun
/**
 * doctor.ts — cross-platform preflight / health check and onboarding aid.
 * Run: bun run doctor [--check-cdp]
 * Exits non-zero if any CRITICAL check fails.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectHost, resolveChromeBinary } from './lib/host'
import { resolveDevice } from './lib/device'

interface Check { name: string; ok: boolean; critical: boolean; detail: string }
const checks: Check[] = []
const add = (name: string, ok: boolean, critical: boolean, detail: string) =>
  checks.push({ name, ok, critical, detail })

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Bun runtime
add('Bun runtime', !!process.versions.bun, true, process.versions.bun ?? 'not running under Bun')

// Host
let host: ReturnType<typeof detectHost> = 'linux'
try {
  host = detectHost()
  add('Host OS', true, true, host)
} catch (e) {
  add('Host OS', false, true, String(e))
}

// Device
try {
  add('Device target', true, true, resolveDevice(process.env))
} catch (e) {
  add('Device target', false, true, (e as Error).message)
}

// Chrome binary
try {
  add('Chrome binary', true, true, resolveChromeBinary(process.env.CHROME_BIN, host))
} catch (e) {
  add('Chrome binary', false, true, (e as Error).message)
}

// agent-browser CLI
{
  const r = Bun.spawnSync(['agent-browser', '--version'], { stdout: 'pipe', stderr: 'pipe' })
  const ok = (r.exitCode ?? 1) === 0
  add('agent-browser CLI', ok, true,
    ok ? new TextDecoder().decode(r.stdout).trim() : 'not on PATH (npm i -g agent-browser)')
}

// .env
add('.env file', existsSync(join(root, '.env')), false, join(root, '.env'))

// persona dir
add('persona/ dir', existsSync(join(root, 'persona')), false,
  'optional; created automatically on first operation-log write')

// Operation-log round-trip (isolated temp log; never touches persona/)
{
  const dir = mkdtempSync(join(tmpdir(), 'loco-doctor-'))
  const logPath = join(dir, 'op.json')
  const script = join(root, 'scripts', 'log-operation.ts')
  const env = { ...process.env, LOCO_OP_LOG_PATH: logPath }
  const url = 'https://example.com/doctor-probe'
  const a = Bun.spawnSync(
    [process.execPath, 'run', script, 'add',
      '--platform', 'doctor', '--action', 'probe', '--url', url, '--status', 'success'],
    { env, stdout: 'ignore', stderr: 'ignore' },
  )
  const c = Bun.spawnSync(
    [process.execPath, 'run', script, 'check',
      '--platform', 'doctor', '--action', 'probe', '--url', url],
    { env, stdout: 'ignore', stderr: 'ignore' },
  )
  const ok = (a.exitCode ?? 1) === 0 && (c.exitCode ?? 1) === 0 // check exits 0 = done
  rmSync(dir, { recursive: true, force: true })
  add('Operation-log round-trip', ok, true, ok ? 'write+check OK' : 'failed')
}

// Optional CDP reachability
if (process.argv.includes('--check-cdp')) {
  const port = parseInt(process.env.CHROME_DEBUG_PORT ?? '9222', 10)
  let ok = false
  let detail = `port ${port} unreachable (run: bun run setup-chrome)`
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`)
    ok = res.ok
    if (ok) detail = `CDP up on ${port}`
  } catch {
    /* unreachable */
  }
  add('CDP reachable', ok, false, detail)
}

// Report
let failed = false
for (const c of checks) {
  const mark = c.ok ? 'OK ' : c.critical ? 'XX ' : '!! '
  if (!c.ok && c.critical) failed = true
  console.log(`${mark} ${c.name.padEnd(26)} ${c.detail}`)
}
console.log('')
console.log(failed ? 'DOCTOR: critical checks FAILED' : 'DOCTOR: all critical checks passed')
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Add the `doctor` script to package.json**

In `package.json` scripts, add after `"setup-chrome:win"`:

```json
    "setup-chrome:win": "bun run scripts/setup-chrome.ts",
    "doctor": "bun run scripts/doctor.ts",
```

- [ ] **Step 3: Verify**

Run: `bun run typecheck`
Expected: clean.

Run: `bun run doctor`
Expected: a table of `OK`/`!!` lines; with Chrome + agent-browser installed,
final line is `DOCTOR: all critical checks passed` and exit code 0.

Run: `bun run doctor --check-cdp` (after `bun run setup-chrome`)
Expected: an extra `CDP reachable ... CDP up on 9222` line.

- [ ] **Step 4: Commit**

```bash
git add scripts/doctor.ts package.json
git commit -m "feat: add cross-platform doctor health-check / verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Documentation

**Files:**
- Create: `docs/cross-platform-guide.md`
- Modify: `CLAUDE.md`, `README.md`, `tests/runtime-test.sh`, `tests/simple-runtime-test.sh`, `tests/verify-privacy.sh`, `skills/x-com/SKILL.md`

- [ ] **Step 1: Write the cross-platform guide**

Create `docs/cross-platform-guide.md`:

````markdown
# Cross-Platform Guide

LocoAgent runs on **Windows** and **macOS** (Linux works but is unverified). The
agent process always runs on a desktop host; **iOS/Android are browser-emulation
targets**, not native runtimes.

## Two axes

- **Host** — where the agent runs (`windows` / `macos` / `linux`). Auto-detected.
  Controls Chrome binary path, profile location, temp dir, process kill.
- **Target device** — what the browser emulates (`desktop` / `ios` / `android`),
  set via `DEVICE_PROFILE` in `.env`. Maps to `agent-browser -p <profile>`.

The platform layer lives in `scripts/lib/` (`host.ts`, `device.ts`, `config.ts`)
and is shared by `setup-chrome.ts` and `doctor.ts`.

## First run (any OS)

```bash
bun install
bun run doctor            # verify bun, agent-browser, Chrome, env
bun run setup-chrome      # copy profile + launch Chrome with CDP on :9222
bun start                 # interactive REPL
```

`bun run setup-chrome` is the same command on every OS. `setup-chrome:win` is a
retained alias.

## Configuration (`.env`)

| Var | Default (Windows) | Default (macOS) |
|-----|-------------------|-----------------|
| `CHROME_BIN` | `C:\Program Files\Google\Chrome\Application\chrome.exe` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| `CHROME_SOURCE_PROFILE` | `%LOCALAPPDATA%\Google\Chrome\User Data\Default` | `~/Library/Application Support/Google/Chrome/Default` |
| `CHROME_WORK_PROFILE` | `%TEMP%\locoagent-chrome-profile` | `$TMPDIR/locoagent-chrome-profile` |
| `CHROME_DEBUG_PORT` | `9222` | `9222` |
| `DEVICE_PROFILE` | `desktop` | `desktop` |

Any value left unset falls back to the host-aware default; override only what you need.

## Targeting a mobile device

Set `DEVICE_PROFILE=ios` (or `android`) in `.env`, or pass `-p ios` directly to
agent-browser per command:

```bash
agent-browser -p ios open https://x.com
```

When an action is logged, record the surface with `--device`:

```bash
bun run scripts/log-operation.ts add --platform x --action like \
  --url <url> --status success --device ios
```

`device` is provenance only — dedup remains account-level (a like is a like
regardless of which surface performed it).

## Verifying

```bash
bun run typecheck         # tsc --noEmit
bun test scripts          # unit tests for the platform layer
bun run doctor            # host health check
bun run doctor --check-cdp  # also probe the running CDP port
```

`tests/*.sh` are bash-only smoke scripts (macOS/Linux); `doctor` is the portable
equivalent.
````

- [ ] **Step 2: Add a platform-layer section to CLAUDE.md**

In `CLAUDE.md`, after the bullet list that ends with the `scripts/tail-agent.ts`
line (the "LocoAgent-specific layer" list), add this paragraph:

```markdown

**Platform abstraction layer** (`scripts/lib/`): `host.ts` (OS detection + Chrome/profile/temp/kill defaults), `device.ts` (desktop/ios/android → agent-browser `-p` profiles), `config.ts` (`loadConfig()` over env). `scripts/setup-chrome.ts` (single cross-platform launcher; replaces the old `.sh`/`.ps1`) and `scripts/doctor.ts` (`bun run doctor` health check) both consume it. iOS/Android are browser-emulation targets, not native runtimes. See `docs/cross-platform-guide.md`.
```

- [ ] **Step 3: Update the CLAUDE.md "Common commands" block**

In `CLAUDE.md`, replace:

```bash
bun run setup-chrome                   # copy Chrome profile + launch with CDP on :9222
```

with:

```bash
bun run setup-chrome                   # copy Chrome profile + launch with CDP on :9222 (all OSes)
bun run doctor                         # cross-platform health check (bun/agent-browser/Chrome/env)
bun test scripts                       # unit tests for the platform layer (scripts/lib)
```

- [ ] **Step 4: Update README command table**

In `README.md`, find the line documenting `bun run setup-chrome` and add directly
after it:

```markdown
- `bun run doctor` — cross-platform health check (Bun, agent-browser, Chrome, `.env`); add `--check-cdp` to probe the debug port.
```

(If the README lists commands in a code block rather than bullets, match the
surrounding format: add `bun run doctor` on its own line with an aligned comment.)

- [ ] **Step 5: Mark the bash smoke tests as bash-only**

At the top of each of `tests/runtime-test.sh`, `tests/simple-runtime-test.sh`,
and `tests/verify-privacy.sh`, insert this comment immediately after the
`#!/usr/bin/env bash` (or `#!/bin/bash`) shebang line:

```bash
# NOTE: bash-only smoke test (macOS/Linux). On Windows use `bun run doctor`,
# which is the cross-platform health-check equivalent.
```

- [ ] **Step 6: Note device targeting in the x-com skill**

In `skills/x-com/SKILL.md`, add this note near the top of the operations section
(after the frontmatter / intro, before the first operation):

```markdown
> **Device targeting:** Operations run against desktop Chrome by default. To
> operate the mobile web surface, set `DEVICE_PROFILE=ios|android` in `.env` or
> prefix agent-browser commands with `-p ios|android`. When logging an action,
> pass `--device <target>` for provenance (it does not change dedup — a like is
> account-level).
```

- [ ] **Step 7: Commit**

```bash
git add docs/cross-platform-guide.md CLAUDE.md README.md tests/ skills/x-com/SKILL.md
git commit -m "docs: cross-platform guide + platform-layer notes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final verification

No new files. This task runs the full verification gate per
`superpowers:verification-before-completion`.

- [ ] **Step 1: Typecheck**

Run: `bun run typecheck`
Expected: no output, exit 0.

- [ ] **Step 2: Unit tests**

Run: `bun test scripts`
Expected: all tests pass (device 5, host 7, config 2, log-operation 1 = 15 tests),
exit 0.

- [ ] **Step 3: Doctor**

Run: `bun run doctor`
Expected: `DOCTOR: all critical checks passed`, exit 0. If any critical line
shows `XX`, fix the underlying cause (missing agent-browser / Chrome / etc.)
before proceeding — do not claim success with a red line.

- [ ] **Step 4: Headless smoke run (verifies prompt shell-outs)**

Run:
```bash
bun start -p "Reply with exactly: STATE_OK" 2>&1 | tail -15
```
Expected: the session **starts cleanly** — no `execFileSync`/`ENOENT`/shell-quoting
error during system-prompt assembly (which is what exercises the hardened
`getOperationLogSection` / `getWorkflowStatusSection`). Ideally the output contains
`STATE_OK`.

Caveat: if the LLM endpoint is unreachable (e.g. DeepSeek blocked on a restricted
network), the model *call* may fail — that is environmental, not a defect in this
work. The prompt-assembly shell-outs run before the model call, so a clean startup
with only a downstream network/auth error still passes this step. To isolate the
shell-outs from the network, you can instead confirm the two sections build:
```bash
bun run scripts/log-operation.ts summary --days 30
bun run scripts/workflow-engine.ts summary
```
Expected: both print without error.

- [ ] **Step 5: Confirm no stray artifacts**

Run: `git status`
Expected: clean tree (all work committed); `persona/`, `workflows/.tmp/`,
`workflows/state.json`, `certs/` remain gitignored and uncommitted.

- [ ] **Step 6: Integrate the branch**

Invoke `superpowers:finishing-a-development-branch` to choose how to integrate
`feature/windows-adapter` (merge / PR / cleanup).

---

## Self-review notes (for the implementer)

- **Spec coverage:** §3.1 host → Task 3; §3.2 device → Task 2; §3.3 config →
  Task 4; §3.4 setup-chrome → Task 7; §3.5 prompts → Task 6; §3.6 op-log device
  + LOG_PATH override → Task 5; §3.7 doctor → Task 8; §3.8 docs → Task 9;
  §6 verification → Task 10.
- **Deliberate spec deviation:** §3.4 step 5 suggested appending `-p` at
  `connect`; Task 7 instead connects without `-p` and applies device emulation
  per-command (correct behavior; noted inline).
- **Type consistency:** `HostOS`, `DeviceTarget`, `LocoConfig`, `loadConfig`,
  `resolveChromeBinary`, `agentBrowserProfileArgs` names match across Tasks 2-4,
  7, 8.
