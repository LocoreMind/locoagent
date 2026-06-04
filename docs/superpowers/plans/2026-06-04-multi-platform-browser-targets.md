# Multi-Platform Browser Targets & Platform-Aware Scheduling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give LocoAgent independent browser targets per platform (multi-Chrome / multi-CDP / multi-profile) and a scheduler that runs same-platform workflows serially and different-platform workflows in parallel, coordinated by per-platform file locks.

**Architecture:** A central registry (`config/browser-targets.json`) is the single source of truth mapping each platform to `{cdpPort, profile, proxy, device}`. A `BrowserTargetManager` resolves it (reusing the existing host/device layers) and health-checks CDP. `setup-chrome.ts` gains `--target`/`--all` to launch multiple isolated Chrome instances. The `workflow-engine` injects the resolved `cdpPort` into each executor's config, wraps every run in a per-platform file lock, and adds an `orchestrate` command that groups workflows by platform (serial within, parallel across) and aggregates results.

**Tech Stack:** Bun, TypeScript, `bun:test`, agent-browser CLI, Chrome CDP. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-06-04-multi-platform-browser-targets-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `config/browser-targets.json` | Registry data: platform → target | Create |
| `scripts/lib/browser-targets.ts` | Parse/resolve registry, CDP health probe | Create |
| `scripts/lib/browser-targets.test.ts` | Unit tests for resolution/defaults | Create |
| `scripts/lib/platform-lock.ts` | Cross-process per-platform file lock | Create |
| `scripts/lib/platform-lock.test.ts` | Unit tests for acquire/steal/release | Create |
| `scripts/setup-chrome.ts` | Multi-target launcher (`--target`/`--all`) | Modify |
| `scripts/doctor.ts` | `--check-cdp` iterates all targets | Modify |
| `scripts/workflow-engine.ts` | Inject target into config, lock runs, `orchestrate` | Modify |
| `workflows/*.json` | Add `platform`, drop `cdpPort`/`proxy` | Modify |
| `.gitignore` | Ignore `workflows/.locks/` | Modify |
| `docs/workflow-development-guide.md` | Executor contract: engine injects cdpPort | Modify |
| `CLAUDE.md` | Document targets + orchestrate + lock | Modify |

**Verification note:** `bun run typecheck` never exits 0 — there are ~5199 pre-existing `src/` errors. Gate on the **error-count delta** for files you touch, not on exit code. Unit tests run via `bun test scripts`.

---

## Task 1: BrowserTarget registry types, parser, and resolver

**Files:**
- Create: `scripts/lib/browser-targets.ts`
- Test: `scripts/lib/browser-targets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/browser-targets.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRegistry, loadTargets, resolveTarget } from './browser-targets'

function fixture(json: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'targets-'))
  const p = join(dir, 'browser-targets.json')
  writeFileSync(p, JSON.stringify(json))
  return p
}

const REGISTRY = {
  version: 1,
  targets: {
    x: { cdpPort: 9222, useLegacyProfile: true, proxy: 'http://127.0.0.1:6738', account: 'mashijiann' },
    linkedin: { cdpPort: 9223, proxy: null },
    reddit: { cdpPort: 9224 },
  },
}

test('parseRegistry rejects a non-object / missing targets', () => {
  expect(() => parseRegistry('[]')).toThrow()
  expect(() => parseRegistry('{"version":1}')).toThrow()
})

test('loadTargets derives a suffixed profile per platform', () => {
  const path = fixture(REGISTRY)
  const targets = loadTargets(path, {}, 'linux')
  expect(targets.linkedin!.cdpPort).toBe(9223)
  expect(targets.linkedin!.profile).toContain('locoagent-chrome-profile-linkedin')
  expect(targets.reddit!.profile).toContain('locoagent-chrome-profile-reddit')
})

test('useLegacyProfile derives the no-suffix profile (back-compat for x)', () => {
  const path = fixture(REGISTRY)
  const targets = loadTargets(path, {}, 'linux')
  expect(targets.x!.profile).toContain('locoagent-chrome-profile')
  expect(targets.x!.profile.endsWith('-x')).toBe(false)
})

test('loadTargets passes proxy through and defaults device to desktop', () => {
  const path = fixture(REGISTRY)
  const targets = loadTargets(path, {}, 'linux')
  expect(targets.x!.proxy).toBe('http://127.0.0.1:6738')
  expect(targets.linkedin!.proxy).toBeUndefined()
  expect(targets.x!.device).toBe('desktop')
})

test('explicit per-entry profile overrides derivation', () => {
  const path = fixture({ version: 1, targets: { x: { cdpPort: 9222, profile: '/custom/x-profile' } } })
  const targets = loadTargets(path, {}, 'linux')
  expect(targets.x!.profile).toBe('/custom/x-profile')
})

test('resolveTarget throws a clear error for an unknown platform', () => {
  const path = fixture(REGISTRY)
  expect(() => resolveTarget('tiktok', path, {}, 'linux')).toThrow(/Unknown platform "tiktok"/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test scripts/lib/browser-targets.test.ts`
Expected: FAIL — `Cannot find module './browser-targets'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/browser-targets.ts`:

```ts
/**
 * BrowserTargetManager — the per-platform browser-target layer.
 *
 * A "target" is one Chrome instance: its CDP port, isolated profile dir, optional
 * upstream proxy, and device emulation. The registry at config/browser-targets.json
 * is the single source of truth, read by setup-chrome.ts, workflow-engine.ts, and
 * doctor.ts so they never disagree about which port/profile a platform uses.
 *
 * Resolution reuses the existing host/device layers: a null/absent profile is
 * derived as `defaultWorkProfile(host)-<platform>` (isolated per platform → cookie
 * isolation). The `useLegacyProfile` flag derives the no-suffix path so the
 * pre-existing X login (in `locoagent-chrome-profile`) keeps working without a
 * re-login.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectHost, defaultWorkProfile, type HostOS } from './host'
import { resolveDevice, isDeviceTarget, type DeviceTarget } from './device'

export interface TargetEntry {
  cdpPort: number
  /** Explicit --user-data-dir. Null/absent → derived from host layer. */
  profile?: string | null
  /** Derive the no-suffix legacy profile (X back-compat) when no explicit profile. */
  useLegacyProfile?: boolean
  proxy?: string | null
  device?: DeviceTarget | null
  account?: string
}

export interface Registry {
  version: number
  targets: Record<string, TargetEntry>
}

export interface ResolvedTarget {
  platform: string
  cdpPort: number
  profile: string
  proxy?: string
  device: DeviceTarget
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Absolute path to the registry file shipped at the project root. */
export function defaultRegistryPath(): string {
  return join(PROJECT_ROOT, 'config', 'browser-targets.json')
}

/** Parse + validate registry JSON. Throws on malformed input. */
export function parseRegistry(json: string): Registry {
  const parsed = JSON.parse(json) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('browser-targets registry must be a JSON object')
  }
  const reg = parsed as Partial<Registry>
  if (!reg.targets || typeof reg.targets !== 'object') {
    throw new Error('browser-targets registry is missing a "targets" object')
  }
  return { version: reg.version ?? 1, targets: reg.targets }
}

/** Read the registry and resolve every entry into a concrete target. */
export function loadTargets(
  registryPath: string = defaultRegistryPath(),
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): Record<string, ResolvedTarget> {
  if (!existsSync(registryPath)) {
    throw new Error(`browser-targets registry not found at ${registryPath}`)
  }
  const reg = parseRegistry(readFileSync(registryPath, 'utf-8'))
  const out: Record<string, ResolvedTarget> = {}
  for (const [platform, entry] of Object.entries(reg.targets)) {
    out[platform] = resolveEntry(platform, entry, env, host)
  }
  return out
}

/** Resolve a single platform; throws a clear error if it is not in the registry. */
export function resolveTarget(
  platform: string,
  registryPath: string = defaultRegistryPath(),
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): ResolvedTarget {
  const all = loadTargets(registryPath, env, host)
  const t = all[platform]
  if (!t) {
    throw new Error(
      `Unknown platform "${platform}". Known: ${Object.keys(all).join(', ') || '(none)'}. ` +
        `Add it to ${registryPath}.`,
    )
  }
  return t
}

function resolveEntry(
  platform: string,
  entry: TargetEntry,
  env: NodeJS.ProcessEnv,
  host: HostOS,
): ResolvedTarget {
  const explicit = entry.profile?.trim()
  const base = defaultWorkProfile(host, env)
  const profile = explicit
    ? explicit
    : entry.useLegacyProfile
      ? base
      : `${base}-${platform}`
  const device =
    entry.device && isDeviceTarget(entry.device) ? entry.device : resolveDevice(env)
  const resolved: ResolvedTarget = { platform, cdpPort: entry.cdpPort, profile, device }
  const proxy = entry.proxy?.trim()
  if (proxy) resolved.proxy = proxy
  return resolved
}

/** True if Chrome's CDP endpoint is serving on this port. Shared health probe. */
export async function cdpUp(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`)
    return res.ok
  } catch {
    return false
  }
}

/** Per-platform health snapshot for doctor / status output. */
export async function healthCheck(
  platform: string,
  registryPath: string = defaultRegistryPath(),
): Promise<{ platform: string; port: number; profile: string; up: boolean }> {
  const t = resolveTarget(platform, registryPath)
  return { platform, port: t.cdpPort, profile: t.profile, up: await cdpUp(t.cdpPort) }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test scripts/lib/browser-targets.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/browser-targets.ts scripts/lib/browser-targets.test.ts
git commit -m "feat(targets): BrowserTargetManager — registry parse/resolve + CDP probe"
```

---

## Task 2: Ship the registry data file

**Files:**
- Create: `config/browser-targets.json`

- [ ] **Step 1: Create the registry**

Create `config/browser-targets.json`:

```json
{
  "version": 1,
  "targets": {
    "x": {
      "cdpPort": 9222,
      "useLegacyProfile": true,
      "proxy": "http://127.0.0.1:6738",
      "account": "mashijiann"
    },
    "linkedin": {
      "cdpPort": 9223,
      "proxy": null
    },
    "reddit": {
      "cdpPort": 9224,
      "proxy": null
    }
  }
}
```

- [ ] **Step 2: Verify it loads and resolves**

Run:
```bash
bun -e "import { loadTargets } from './scripts/lib/browser-targets'; console.log(JSON.stringify(loadTargets(), null, 2))"
```
Expected: prints three resolved targets; `x.profile` ends with `locoagent-chrome-profile` (no `-x`), `linkedin.profile` ends with `-linkedin`, `reddit.profile` ends with `-reddit`, `x.cdpPort` is 9222.

- [ ] **Step 3: Commit**

```bash
git add config/browser-targets.json
git commit -m "feat(targets): ship browser-targets registry (x/linkedin/reddit)"
```

---

## Task 3: Per-platform cross-process file lock

**Files:**
- Create: `scripts/lib/platform-lock.ts`
- Test: `scripts/lib/platform-lock.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/platform-lock.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireLock, releaseLock, lockPath } from './platform-lock'

function root(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lock-'))
  mkdirSync(join(dir, 'workflows'), { recursive: true })
  return dir
}

test('acquireLock succeeds when free, then blocks a second live holder', () => {
  const r = root()
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
  // Same process (alive pid) holds it → second acquire is refused.
  expect(acquireLock('x', 'wf-b', r)).toBe(false)
})

test('acquireLock steals a stale lock whose pid is dead', () => {
  const r = root()
  const path = lockPath('x', r)
  mkdirSync(join(r, 'workflows', '.locks'), { recursive: true })
  writeFileSync(path, JSON.stringify({ pid: 999999999, workflowId: 'ghost', acquiredAt: 'x' }))
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
})

test('releaseLock removes only a lock this process owns', () => {
  const r = root()
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
  releaseLock('x', 'wf-a', r)
  expect(existsSync(lockPath('x', r))).toBe(false)
})

test('releaseLock leaves a lock owned by another pid intact', () => {
  const r = root()
  const path = lockPath('x', r)
  mkdirSync(join(r, 'workflows', '.locks'), { recursive: true })
  writeFileSync(path, JSON.stringify({ pid: 999999999, workflowId: 'other', acquiredAt: 'x' }))
  releaseLock('x', 'wf-a', r)
  expect(existsSync(path)).toBe(true)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test scripts/lib/platform-lock.test.ts`
Expected: FAIL — `Cannot find module './platform-lock'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/platform-lock.ts`:

```ts
/**
 * Per-platform cross-process mutual exclusion. A lock file lives at
 * workflows/.locks/<platform>.lock and holds {pid, workflowId, acquiredAt}.
 *
 * Same-platform workflows must run serially (one active tab per profile); the
 * engine acquires this lock before spawning an executor and releases it after.
 * A file lock — not state.json — because `start` (detached child), `daemon`
 * (separate long-lived process), and `orchestrate` (another process) must
 * coordinate through a filesystem atomic primitive. `openSync(path, 'wx')` is
 * atomic create-exclusive on a single filesystem; state.json's non-atomic
 * read-modify-write would race when processes start simultaneously.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

interface LockData {
  pid: number
  workflowId: string
  acquiredAt: string
}

export function lockDir(root: string = PROJECT_ROOT): string {
  return join(root, 'workflows', '.locks')
}

export function lockPath(platform: string, root: string = PROJECT_ROOT): string {
  return join(lockDir(root), `${platform}.lock`)
}

/** True if a process with this pid is currently running. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e: any) {
    // ESRCH = no such process (dead). EPERM = exists but not signalable (alive).
    return e?.code === 'EPERM'
  }
}

function writeLock(path: string, workflowId: string): boolean {
  try {
    const fd = openSync(path, 'wx') // atomic: fails with EEXIST if present
    writeSync(
      fd,
      JSON.stringify({ pid: process.pid, workflowId, acquiredAt: new Date().toISOString() }),
    )
    closeSync(fd)
    return true
  } catch (e: any) {
    if (e?.code === 'EEXIST') return false
    throw e
  }
}

/**
 * Try to acquire the platform lock. Returns false if a LIVE process holds it.
 * A stale lock (dead pid) is stolen. Caller MUST releaseLock in a finally block.
 */
export function acquireLock(
  platform: string,
  workflowId: string,
  root: string = PROJECT_ROOT,
): boolean {
  const dir = lockDir(root)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = lockPath(platform, root)

  if (writeLock(path, workflowId)) return true

  // Held — inspect the holder.
  let holder: LockData | null = null
  try {
    holder = JSON.parse(readFileSync(path, 'utf-8')) as LockData
  } catch {
    /* unreadable lock → treat as stale */
  }
  if (holder && isAlive(holder.pid)) return false

  // Stale: remove and recreate.
  rmSync(path, { force: true })
  return writeLock(path, workflowId)
}

/** Release the lock only if this process+workflow owns it. */
export function releaseLock(
  platform: string,
  workflowId: string,
  root: string = PROJECT_ROOT,
): void {
  const path = lockPath(platform, root)
  try {
    const holder = JSON.parse(readFileSync(path, 'utf-8')) as LockData
    if (holder.pid === process.pid && holder.workflowId === workflowId) {
      rmSync(path, { force: true })
    }
  } catch {
    /* no lock or unparsable → nothing to release */
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test scripts/lib/platform-lock.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Ignore the lock directory**

In `.gitignore`, add a line after the existing `workflows/.tmp/` entry:

```
workflows/.locks/
```

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/platform-lock.ts scripts/lib/platform-lock.test.ts .gitignore
git commit -m "feat(targets): per-platform cross-process file lock"
```

---

## Task 4: Multi-target `setup-chrome` (`--target` / `--all`)

**Files:**
- Modify: `scripts/setup-chrome.ts` (full replacement below)

This refactors the single-target launcher into a registry-driven, multi-target one. It reuses the existing helpers (`launchChromeDetached`, `killChromeForProfile`, `syncAgentBrowserConfig`) and the shared `cdpUp` from Task 1. Chrome binary + host still come from `loadConfig()`. The agent-browser daemon pin/connect targets only the **default platform** (x); other targets are launched and CDP-verified, and executors reach them via `--cdp <port>`.

- [ ] **Step 1: Replace `scripts/setup-chrome.ts`**

```ts
#!/usr/bin/env bun
/**
 * setup-chrome.ts — registry-driven launcher for isolated, persistent Chrome
 * instances (one per platform target) with CDP enabled, so agent-browser can
 * drive logged-in social accounts WITHOUT touching the user's normal Chrome.
 *
 *   bun run setup-chrome                 # launch the default platform (x)
 *   bun run setup-chrome --target x      # launch one registry target
 *   bun run setup-chrome --all           # launch every registry target
 *   bun run setup-chrome --reset [...]   # wipe the selected profile(s) and relaunch
 *
 * Each target is a separate Chrome on its own port + isolated profile (cookie
 * isolation). agent-browser's single config pin points at the DEFAULT platform's
 * port; workflow executors reach other targets via `--cdp <port>`.
 *
 * Targets come from config/browser-targets.json; host/chrome paths from config.ts.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './lib/config'
import { killChromeForProfile, launchChromeDetached } from './lib/host'
import { syncAgentBrowserConfig } from './lib/agent-browser-config'
import { cdpUp, loadTargets, type ResolvedTarget } from './lib/browser-targets'

const DEFAULT_PLATFORM = 'x'
const RESET = process.argv.includes('--reset')
const ALL = process.argv.includes('--all')
const targetFlag = (() => {
  const i = process.argv.indexOf('--target')
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')
    ? process.argv[i + 1]!
    : undefined
})()

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cfg = loadConfig()
const targets = loadTargets()

// Decide which targets to bring up.
let selected: ResolvedTarget[]
if (ALL) {
  selected = Object.values(targets)
} else if (targetFlag) {
  const t = targets[targetFlag]
  if (!t) {
    console.error(`x Unknown --target "${targetFlag}". Known: ${Object.keys(targets).join(', ')}`)
    process.exit(1)
  }
  selected = [t]
} else {
  const def = targets[DEFAULT_PLATFORM] ?? Object.values(targets)[0]
  if (!def) {
    console.error('x No targets in config/browser-targets.json')
    process.exit(1)
  }
  selected = [def]
}

console.error(`-> host=${cfg.host} device=${cfg.device}`)
console.error(`   chrome: ${cfg.chromeBin}`)
console.error(`   launching: ${selected.map(t => `${t.platform}@${t.cdpPort}`).join(', ')}`)

// Pin agent-browser to the DEFAULT platform's port (the pin holds a single port;
// executors target others with --cdp). Done first so the pin is in place even if
// a launch below fails.
const pinPort = (targets[DEFAULT_PLATFORM] ?? selected[0]!).cdpPort
const pinPath = syncAgentBrowserConfig(PROJECT_ROOT, pinPort)
console.error(`   agent-browser pinned to default CDP ${pinPort} via ${pinPath}`)

/** Drop a stale agent-browser daemon so the next command honours the pin. */
function clearStaleDaemon(): void {
  Bun.spawnSync(['agent-browser', 'close', '--all'], { stdout: 'ignore', stderr: 'ignore' })
}

/** Connect the agent-browser daemon to a port (the default target). */
function connectAgentBrowser(port: number): void {
  clearStaleDaemon()
  console.error(`-> Connecting agent-browser daemon to CDP ${port} ...`)
  const conn = Bun.spawnSync(['agent-browser', 'connect', String(port)], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if ((conn.exitCode ?? 1) !== 0) {
    console.error('x agent-browser connect failed (is agent-browser on PATH?)')
    process.exit(1)
  }
}

/** Bring up one target: fast-path reconnect, reset wipe, launch, wait for CDP. */
async function setupTarget(t: ResolvedTarget): Promise<{ fresh: boolean }> {
  // Fast path: already up and not resetting → leave it running.
  if (await cdpUp(t.cdpPort)) {
    if (!RESET) {
      console.error(`-> [${t.platform}] CDP already up on ${t.cdpPort}; leaving as-is.`)
      return { fresh: false }
    }
    console.error(`-> [${t.platform}] --reset: stopping existing instance ...`)
    await killChromeForProfile(t.profile, cfg.host)
    await Bun.sleep(1000)
  }

  if (RESET && existsSync(t.profile)) {
    console.error(`-> [${t.platform}] --reset: wiping profile ${t.profile} ...`)
    await killChromeForProfile(t.profile, cfg.host)
    await Bun.sleep(500)
    rmSync(t.profile, { recursive: true, force: true })
  }

  const fresh = !existsSync(t.profile)
  if (fresh) {
    console.error(`-> [${t.platform}] creating fresh isolated profile ...`)
    mkdirSync(t.profile, { recursive: true })
  }

  console.error(`-> [${t.platform}] launching Chrome on ${t.cdpPort} ...`)
  launchChromeDetached(
    cfg.chromeBin,
    [
      `--remote-debugging-port=${t.cdpPort}`,
      `--user-data-dir=${t.profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
    ],
    cfg.host,
  )

  console.error(`-> [${t.platform}] waiting for CDP ${t.cdpPort} ...`)
  for (let i = 1; i <= 15; i++) {
    if (await cdpUp(t.cdpPort)) {
      console.error(`   [${t.platform}] CDP ready (${i}s)`)
      return { fresh }
    }
    await Bun.sleep(1000)
  }
  console.error(`x [${t.platform}] CDP ${t.cdpPort} not ready after 15s`)
  console.error('  If an old instance is stuck, try: bun run setup-chrome --target ' + t.platform + ' --reset')
  process.exit(1)
}

let anyFresh = false
for (const t of selected) {
  const { fresh } = await setupTarget(t)
  anyFresh = anyFresh || fresh
}

// Connect the daemon only to the default target if we launched it.
const defaultTarget = selected.find(t => t.platform === DEFAULT_PLATFORM)
if (defaultTarget) connectAgentBrowser(defaultTarget.cdpPort)

console.error('')
console.error('OK Chrome setup complete.')
for (const t of selected) {
  console.error(`   ${t.platform}: CDP http://127.0.0.1:${t.cdpPort}  profile ${t.profile}`)
}
if (anyFresh) {
  console.error('')
  console.error('   FIRST RUN for one or more profiles: log into the relevant account ONCE')
  console.error('   in the window that just opened. The session persists across restarts.')
}
console.error('')
console.error('   Run: bun start')
process.exit(0)
```

- [ ] **Step 2: Typecheck the touched file**

Run: `bun run typecheck 2>&1 | grep -c "setup-chrome.ts"`
Expected: `0` (no new errors attributed to `setup-chrome.ts`).

- [ ] **Step 3: Smoke test the default path**

Run: `bun run setup-chrome`
Expected: launches/reconnects the `x` target on 9222, prints `x: CDP http://127.0.0.1:9222`. (Your existing X login is preserved — the profile is the legacy no-suffix dir.)

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-chrome.ts
git commit -m "feat(setup-chrome): registry-driven multi-target launcher (--target/--all)"
```

---

## Task 5: `doctor --check-cdp` iterates all targets

**Files:**
- Modify: `scripts/doctor.ts:107-121`

- [ ] **Step 1: Replace the single-port CDP block**

In `scripts/doctor.ts`, replace the entire `if (process.argv.includes('--check-cdp')) { ... }` block (currently lines 107–121) with:

```ts
// Optional CDP reachability — probe every registered platform target.
if (process.argv.includes('--check-cdp')) {
  const { loadTargets, cdpUp } = await import('./lib/browser-targets')
  try {
    const targets = loadTargets()
    for (const t of Object.values(targets)) {
      const up = await cdpUp(t.cdpPort)
      add(
        `CDP ${t.platform}`,
        up,
        false,
        up ? `up on ${t.cdpPort}` : `port ${t.cdpPort} unreachable (run: bun run setup-chrome --target ${t.platform})`,
      )
    }
  } catch (e) {
    add('CDP targets', false, false, `registry error: ${(e as Error).message}`)
  }
}
```

- [ ] **Step 2: Typecheck the touched file**

Run: `bun run typecheck 2>&1 | grep -c "doctor.ts"`
Expected: `0`.

- [ ] **Step 3: Smoke test**

Run: `bun run doctor --check-cdp`
Expected: one `CDP x` / `CDP linkedin` / `CDP reddit` line each; `x` shows `up on 9222` if setup-chrome is running, others show `unreachable` until launched.

- [ ] **Step 4: Commit**

```bash
git add scripts/doctor.ts
git commit -m "feat(doctor): --check-cdp probes every platform target"
```

---

## Task 6: Engine injects target config + locks each run; workflows declare `platform`

**Files:**
- Modify: `scripts/workflow-engine.ts` (imports, `WorkflowDefinition`, config builder, `run`, `start`, `daemon`)
- Modify: `workflows/x-search-reply.json`, `workflows/linkedin-search-reply.json`, `workflows/hf-papers-to-x.json`, `workflows/hf-daily-papers.json`

- [ ] **Step 1: Add imports**

In `scripts/workflow-engine.ts`, after the existing `import { spawn, spawnSync } from 'node:child_process'` line (line 23), add:

```ts
import { resolveTarget } from './lib/browser-targets'
import { acquireLock, releaseLock } from './lib/platform-lock'
```

- [ ] **Step 2: Add `platform` to the definition type**

In the `WorkflowDefinition` interface (lines 32–39), add a `platform` field:

```ts
interface WorkflowDefinition {
  id: string
  name: string
  description: string
  schedule: string
  platform?: string
  executor: string
  config: Record<string, unknown>
}
```

- [ ] **Step 3: Add the config-builder helper**

Immediately after `getWorkflowDef` (after line 93), add:

```ts
/**
 * Build the --config JSON for an executor. When the workflow declares a platform,
 * the resolved target's cdpPort/profile/proxy/device are injected so the port
 * lives in exactly one place (the registry). Workflows without a platform fall
 * back to their own config (back-compat).
 */
function buildConfigJson(def: WorkflowDefinition): string {
  if (!def.platform) return JSON.stringify(def.config)
  const t = resolveTarget(def.platform)
  const merged: Record<string, unknown> = {
    ...def.config,
    cdpPort: t.cdpPort,
    profile: t.profile,
    device: t.device,
  }
  if (t.proxy) merged['proxy'] = t.proxy
  return JSON.stringify(merged)
}
```

- [ ] **Step 4: Use the builder in `prepareRun`**

In `prepareRun` (lines 160–186), change the returned `configJson` from `JSON.stringify(def.config)` to `buildConfigJson(def)`:

```ts
  return { def, ws, state, executorPath, configJson: buildConfigJson(def) }
```

- [ ] **Step 5: Wrap the synchronous `run` in a platform lock**

In the `run` command block (lines 228–255), replace the body from `const { def, ws, state, executorPath, configJson } = prepareRun(id)` through the final `process.exit(...)` with:

```ts
  const peek = getWorkflowDef(id)
  const platform = peek?.platform
  if (platform && !acquireLock(platform, id)) {
    console.error(`[workflow] Platform "${platform}" is busy (another workflow holds the lock). Try later.`)
    process.exit(1)
  }
  try {
    const { def, ws, state, executorPath, configJson } = prepareRun(id)
    console.log(`[workflow] Starting: ${def.name}`)

    const result = spawnSync('bun', ['run', executorPath, '--config', configJson], {
      stdio: ['inherit', 'pipe', 'inherit'],
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 10 * 60 * 1000, // 10 min max
    })

    // Re-read state (may have been modified by `stop` during execution)
    const freshState = loadState()
    const freshWs = freshState.workflows[id] ?? getDefaultWorkflowState()
    const run = finalizeRun(freshState, freshWs, result.stdout ?? '', result.status, result.stderr ?? '')
    delete (freshWs as any).pid
    delete (freshWs as any).startedAt
    saveState(freshState)
    console.log(`[workflow] Finished: ${run.status} (${run.stepsCompleted}/${run.stepsTotal} steps)`)
    process.exit(run.status === 'failed' ? 1 : 0)
  } finally {
    if (platform) releaseLock(platform, id)
  }
```

- [ ] **Step 6: Add the `platform` field to the workflow JSONs**

In `workflows/x-search-reply.json`: add `"platform": "x",` after the `"schedule"` line and **remove** the `"cdpPort": 9222,` line from `config`.

In `workflows/hf-papers-to-x.json`: add `"platform": "x",` after `"schedule"` and remove the `"cdpPort": 9222,` and `"proxy": "http://127.0.0.1:6738",` lines from `config` (the proxy now comes from the registry).

In `workflows/hf-daily-papers.json`: add `"platform": "x",` after `"schedule"` and remove the `"cdpPort": 9222,` and `"proxy": "http://127.0.0.1:6738",` lines from `config`.

In `workflows/linkedin-search-reply.json`: add `"platform": "linkedin",` after `"schedule"` and remove the `"cdpPort": 9222,` line from `config`.

- [ ] **Step 7: Typecheck + verify injection**

Run: `bun run typecheck 2>&1 | grep -c "workflow-engine.ts"`
Expected: `0`.

Run:
```bash
bun -e "const {execSync}=require('node:child_process'); const o=execSync('bun run scripts/workflow-engine.ts status --id linkedin-search-reply',{encoding:'utf8'}); const s=JSON.parse(o); console.log(s.definition.platform)"
```
Expected: prints `linkedin`.

- [ ] **Step 8: Commit**

```bash
git add scripts/workflow-engine.ts workflows/*.json
git commit -m "feat(engine): inject per-platform target into executor config + lock each run"
```

---

## Task 7: `orchestrate` command — serial within platform, parallel across

**Files:**
- Modify: `scripts/workflow-engine.ts` (add `executeWorkflow` helper + `orchestrate` command; update the unknown-command guard)

- [ ] **Step 1: Add an async single-run helper**

In `scripts/workflow-engine.ts`, immediately after `finalizeRun` (after line 224), add:

```ts
/**
 * Run one workflow to completion (async, lock-guarded). Used by `orchestrate`.
 * Acquires the platform lock, spawns the executor, finalizes state, releases.
 * Returns a labelled result for aggregation.
 */
async function executeWorkflow(def: WorkflowDefinition): Promise<{ id: string; platform: string | null; run: WorkflowRun | null; skipped?: string }> {
  const platform = def.platform ?? null
  if (platform && !acquireLock(platform, def.id)) {
    return { id: def.id, platform, run: null, skipped: 'platform busy' }
  }
  try {
    const executorPath = resolve(WORKFLOWS_DIR, def.executor)
    if (!existsSync(executorPath)) {
      return { id: def.id, platform, run: null, skipped: `executor not found: ${executorPath}` }
    }
    const state = loadState()
    if (!state.workflows[def.id]) state.workflows[def.id] = getDefaultWorkflowState()
    state.workflows[def.id]!.status = 'running'
    saveState(state)

    let stdout = ''
    let exitCode: number | null = null
    try {
      const proc = Bun.spawn(['bun', 'run', executorPath, '--config', buildConfigJson(def)], {
        cwd: ROOT,
        stdin: 'inherit',
        stdout: 'pipe',
        stderr: 'inherit',
      })
      const timeoutId = setTimeout(() => { proc.kill() }, 10 * 60 * 1000)
      stdout = await new Response(proc.stdout).text()
      exitCode = await proc.exited
      clearTimeout(timeoutId)
    } catch (e: any) {
      console.error(`[orchestrate] ${def.id} executor error: ${e.message}`)
      exitCode = 1
    }

    const freshState = loadState()
    const freshWs = freshState.workflows[def.id] ?? getDefaultWorkflowState()
    const run = finalizeRun(freshState, freshWs, stdout, exitCode)
    delete (freshWs as any).pid
    saveState(freshState)
    return { id: def.id, platform, run }
  } finally {
    if (platform) releaseLock(platform, def.id)
  }
}
```

- [ ] **Step 2: Add the `orchestrate` command**

In `scripts/workflow-engine.ts`, immediately before the `// ── unknown ──` section (before line 620), add:

```ts
// ── orchestrate ──────────────────────────────────────────────────────────────
// Run multiple workflows grouped by platform: SERIAL within a platform (one
// active tab per profile), PARALLEL across platforms. Aggregates a combined
// report. Interruptible: each platform queue checks the stop signal between runs.
//
// Usage: bun run workflow orchestrate --ids id1,id2,id3

if (command === 'orchestrate') {
  const idsArg = flags['ids']
  if (!idsArg) {
    console.error('Usage: workflow-engine.ts orchestrate --ids <id1,id2,...>')
    process.exit(2)
  }
  const ids = idsArg.split(',').map(s => s.trim()).filter(Boolean)
  const defs = loadWorkflowDefinitions()
  const byId = new Map(defs.map(d => [d.id, d]))

  // Group requested workflows by platform (unknown ids reported, not fatal).
  const groups = new Map<string, WorkflowDefinition[]>()
  const missing: string[] = []
  for (const id of ids) {
    const def = byId.get(id)
    if (!def) { missing.push(id); continue }
    const key = def.platform ?? '_none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(def)
  }
  for (const m of missing) console.error(`[orchestrate] Unknown workflow id: ${m}`)

  console.error(`[orchestrate] platforms: ${[...groups.keys()].join(', ')}`)

  // One serial queue per platform; run all queues in parallel.
  const results: Array<{ id: string; platform: string | null; run: WorkflowRun | null; skipped?: string }> = []
  await Promise.all(
    [...groups.entries()].map(async ([platform, list]) => {
      for (const def of list) {
        // Stop signal: a `stop --id <thisId>` flips status to 'stopped'.
        const st = loadState().workflows[def.id]
        if (st?.status === 'stopped') {
          results.push({ id: def.id, platform: def.platform ?? null, run: null, skipped: 'stopped' })
          continue
        }
        console.error(`[orchestrate] [${platform}] running ${def.id} ...`)
        results.push(await executeWorkflow(def))
      }
    }),
  )

  // Aggregate report — last stdout line is JSON for callers.
  const summary = {
    requested: ids.length,
    missing,
    results: results.map(r => ({
      id: r.id,
      platform: r.platform,
      status: r.run?.status ?? 'skipped',
      stepsCompleted: r.run?.stepsCompleted ?? 0,
      stepsTotal: r.run?.stepsTotal ?? 0,
      skipped: r.skipped,
    })),
  }
  for (const r of summary.results) {
    console.error(`[orchestrate] ${r.id} (${r.platform ?? '-'}): ${r.status}${r.skipped ? ` (${r.skipped})` : ''} ${r.stepsCompleted}/${r.stepsTotal}`)
  }
  console.log(JSON.stringify(summary))
  process.exit(summary.results.some(r => r.status === 'failed') ? 1 : 0)
}
```

- [ ] **Step 3: Update the unknown-command guard**

The final guard currently reads `if (command !== 'daemon') { ... }` (line 622). Replace it with:

```ts
// ── unknown ──────────────────────────────────────────────────────────────────

if (command !== 'daemon' && command !== 'orchestrate') {
  console.error(`Unknown command: ${command}. Use: list | status | start | stop | reset | run | history | summary | daemon | orchestrate`)
  process.exit(2)
}
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck 2>&1 | grep -c "workflow-engine.ts"`
Expected: `0`.

- [ ] **Step 5: Smoke test grouping (no browser needed for the grouping path)**

Run: `bun run scripts/workflow-engine.ts orchestrate --ids linkedin-search-reply,nonexistent`
Expected: stderr shows `Unknown workflow id: nonexistent` and `[linkedin] running linkedin-search-reply ...`; the executor itself will fail fast if CDP 9223 is down (that platform's result is `failed`), which is expected without `setup-chrome --target linkedin`. The last stdout line is a JSON summary object.

- [ ] **Step 6: Commit**

```bash
git add scripts/workflow-engine.ts
git commit -m "feat(engine): orchestrate command — same-platform serial, cross-platform parallel"
```

---

## Task 8: Update developer docs and CLAUDE.md

**Files:**
- Modify: `docs/workflow-development-guide.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the executor contract in the workflow guide**

In `docs/workflow-development-guide.md`, find the executor-contract section (the numbered list describing what an executor must do) and add a bullet:

```markdown
- The `cdpPort` (and `profile`/`proxy`/`device`) in your config are **injected by
  the engine** from `config/browser-targets.json` based on the workflow's
  `platform` field. Always call agent-browser with `--cdp <config.cdpPort>` — never
  a bare `agent-browser` command, which would hit the global default port and grab
  the wrong tab during concurrent multi-platform runs. Do NOT hard-code `cdpPort`
  in the workflow JSON; set `platform` instead.
```

- [ ] **Step 2: Document the registry + multi-target launch in the guide**

In `docs/workflow-development-guide.md`, add a short section near the top:

```markdown
## Browser targets (multi-platform)

`config/browser-targets.json` maps each platform to a `{cdpPort, profile, proxy,
device}`. Launch instances with `bun run setup-chrome --all` (all targets) or
`--target <platform>` (one). Each platform gets its own port + isolated profile →
cookie isolation. A workflow binds to a target by setting `"platform": "<name>"`.

Run several platforms together with the scheduler:

    bun run workflow orchestrate --ids x-search-reply,linkedin-search-reply

Same-platform workflows run serially (one active tab per profile); different
platforms run in parallel. Per-platform file locks (`workflows/.locks/<platform>.lock`)
coordinate `run`/`start`/`daemon`/`orchestrate` across processes.
```

- [ ] **Step 3: Update CLAUDE.md**

In `CLAUDE.md`, under the "What this repo actually is" → LocoAgent-specific layer list, add:

```markdown
- `config/browser-targets.json` — per-platform browser-target registry (cdpPort,
  profile, proxy, device); single source of truth for `setup-chrome --target/--all`,
  the workflow-engine's target injection + per-platform lock, and `doctor --check-cdp`
```

And in the "Common commands" block, add:

```bash
bun run setup-chrome --all             # launch every platform target (multi-Chrome)
bun run setup-chrome --target linkedin # launch one platform target
bun run workflow orchestrate --ids a,b # run workflows: same-platform serial, cross-platform parallel
```

And replace the "Workflow executor contract" intro note about `cdpPort` with a line noting that `cdpPort`/`profile`/`proxy` are injected by the engine from the registry based on the workflow's `platform` field, and the executor must use `--cdp <cdpPort>`.

- [ ] **Step 4: Commit**

```bash
git add docs/workflow-development-guide.md CLAUDE.md
git commit -m "docs: multi-platform browser targets, orchestrate, executor contract"
```

---

## Final verification (after all tasks)

- [ ] **Unit tests pass**

Run: `bun test scripts`
Expected: all `scripts/lib/*.test.ts` pass, including the new `browser-targets` and `platform-lock` suites.

- [ ] **Typecheck delta is zero for touched files**

Run: `bun run typecheck 2>&1 | grep -E "browser-targets|platform-lock|setup-chrome|doctor|workflow-engine" | grep -c "error"`
Expected: `0` (no errors attributed to the files this plan creates/modifies). The overall command still exits non-zero due to the ~5199 pre-existing `src/` errors — that is the known baseline.

- [ ] **End-to-end multi-platform smoke (manual, requires logged-in profiles)**

```bash
bun run setup-chrome --all          # bring up x@9222, linkedin@9223, reddit@9224
bun run doctor --check-cdp          # all three CDP lines show "up"
bun run workflow orchestrate --ids x-search-reply,linkedin-search-reply
```
Expected: X and LinkedIn workflows run concurrently (interleaved stderr); a JSON summary on the last stdout line; `workflows/.locks/` shows a lock per active platform during the run and is empty after. Running two X workflows together should serialize (only one `x.lock` at a time).
```

## Self-review notes

- **Spec coverage:** registry (Task 2 + 1), BrowserTargetManager (1), multi-Chrome setup (4), per-platform lock (3), workflow `platform` + injected cdpPort (6), executor contract (6 + 8), orchestrate serial/parallel + aggregate (7), doctor all-targets (5), error handling (lock busy/unknown platform/CDP down covered across 1/4/6/7), testing (1/3 unit + final smoke), docs (8). All spec sections map to a task.
- **Back-compat refinement:** spec example showed `x.profile: null`; the plan uses an explicit `useLegacyProfile: true` flag on the x entry to derive the no-suffix legacy profile cross-platform (an absolute path can't be hard-coded in JSON). Captured in Tasks 1 & 2.
- **Type consistency:** `ResolvedTarget`, `resolveTarget`, `loadTargets`, `cdpUp` (browser-targets); `acquireLock`/`releaseLock`/`lockPath` (platform-lock); `buildConfigJson`/`executeWorkflow` (engine) used with identical signatures across all tasks.
