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
let targets: Record<string, ResolvedTarget>
try {
  targets = loadTargets()
} catch (e) {
  console.error(`x ${(e as Error).message}`)
  process.exit(1)
}

if (ALL && targetFlag) {
  console.error('   note: --target is ignored when --all is specified')
}

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
  // stdout/stderr MUST be ignored, not inherited: `connect` forks a persistent
  // daemon that would inherit our stdout and hold it open forever, hanging any
  // caller that reads our output to EOF (a shell pipe, or the agent's own tool
  // runner). We only need the exit code here.
  const conn = Bun.spawnSync(['agent-browser', 'connect', String(port)], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if ((conn.exitCode ?? 1) !== 0) {
    console.error('x agent-browser connect failed (is agent-browser on PATH?)')
    process.exit(1)
  }
}

/** Bring up one target: fast-path reconnect, reset wipe, launch, wait for CDP.
 *  Returns ok:false on CDP timeout (caller decides whether to abort). */
async function setupTarget(t: ResolvedTarget): Promise<{ fresh: boolean; ok: boolean }> {
  let killed = false
  // Fast path: already up and not resetting → leave it running.
  if (await cdpUp(t.cdpPort)) {
    if (!RESET) {
      console.error(`-> [${t.platform}] CDP already up on ${t.cdpPort}; leaving as-is.`)
      return { fresh: false, ok: true }
    }
    console.error(`-> [${t.platform}] --reset: stopping existing instance ...`)
    await killChromeForProfile(t.profile, cfg.host)
    killed = true
    await Bun.sleep(1000)
  }

  if (RESET && existsSync(t.profile)) {
    console.error(`-> [${t.platform}] --reset: wiping profile ${t.profile} ...`)
    if (!killed) {
      // Not already killed above (instance wasn't running) — ensure no stale
      // process holds the profile dir before we remove it.
      await killChromeForProfile(t.profile, cfg.host)
      await Bun.sleep(500)
    }
    rmSync(t.profile, { recursive: true, force: true })
  }

  const fresh = !existsSync(t.profile)
  if (fresh) {
    console.error(`-> [${t.platform}] creating fresh isolated profile ...`)
    mkdirSync(t.profile, { recursive: true })
  }

  console.error(`-> [${t.platform}] launching Chrome on ${t.cdpPort} ...`)
  // Must be DETACHED — on Windows a Bun-spawned child dies when this script
  // exits, tearing down the CDP endpoint the moment setup finishes (which sends
  // agent-browser back to its bundled Chrome for Testing). See launchChromeDetached.
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
      return { fresh, ok: true }
    }
    await Bun.sleep(1000)
  }
  console.error(`x [${t.platform}] CDP ${t.cdpPort} not ready after 15s`)
  console.error('  If an old instance is stuck, try: bun run setup-chrome --target ' + t.platform + ' --reset')
  return { fresh, ok: false }
}

// Launch every selected target. --all is RESILIENT: one target failing does not
// abort the others; failures are collected and reported, and we exit non-zero.
let anyFresh = false
const failed: string[] = []
for (const t of selected) {
  const { fresh, ok } = await setupTarget(t)
  anyFresh = anyFresh || fresh
  if (!ok) failed.push(t.platform)
}

// Connect the daemon only to the default target, and only if it launched OK.
const defaultTarget = selected.find(t => t.platform === DEFAULT_PLATFORM)
if (defaultTarget && !failed.includes(DEFAULT_PLATFORM)) {
  connectAgentBrowser(defaultTarget.cdpPort)
} else if (!defaultTarget) {
  console.error(`   note: agent-browser daemon left as-is ('${DEFAULT_PLATFORM}' not in this run); executors reach these targets via --cdp <port>.`)
}

console.error('')
console.error(failed.length ? `x setup-chrome: ${failed.length} target(s) failed: ${failed.join(', ')}` : 'OK Chrome setup complete.')
for (const t of selected) {
  const mark = failed.includes(t.platform) ? 'FAILED' : 'ok'
  console.error(`   ${t.platform} [${mark}]: CDP http://127.0.0.1:${t.cdpPort}  profile ${t.profile}`)
}
if (anyFresh) {
  console.error('')
  console.error('   FIRST RUN for one or more profiles: log into the relevant account ONCE')
  console.error('   in the window that just opened. The session persists across restarts.')
}
console.error('')
console.error('   Run: bun start')
process.exit(failed.length ? 1 : 0)
