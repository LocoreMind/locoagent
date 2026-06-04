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
