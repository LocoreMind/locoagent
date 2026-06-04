#!/usr/bin/env bun
/**
 * setup-chrome.ts — idempotent launcher for ONE persistent, isolated Chrome
 * profile with CDP enabled, so agent-browser can drive logged-in social
 * accounts WITHOUT ever touching the user's normal Chrome.
 *
 * Design (see docs/superpowers/specs/2026-06-04-isolated-chrome-profile-design.md):
 *   - No copy of the real profile (Chrome 127+ App-Bound Encryption makes a
 *     copied profile logged-OUT anyway). Fresh isolated profile, log in once.
 *   - No kill-all of Chrome — the user's windows are never disturbed.
 *   - No wipe on every run — the manual login persists across restarts.
 *   - Idempotent: if CDP is already up, just (re)connect agent-browser.
 *   - `--reset` kills ONLY the isolated-profile Chrome and wipes it for a clean
 *     re-login.
 *
 * Config (host/device/chrome paths/port) comes from scripts/lib/config.ts.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './lib/config'
import { killChromeForProfile, launchChromeDetached } from './lib/host'
import { syncAgentBrowserConfig } from './lib/agent-browser-config'

const RESET = process.argv.includes('--reset')

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const cfg = loadConfig()
console.error(`-> host=${cfg.host} device=${cfg.device} port=${cfg.debugPort}`)
console.error(`   isolated profile: ${cfg.workProfile}`)

// Pin agent-browser to this CDP port so every command attaches to the isolated
// Chrome instead of launching its own bundled Chrome for Testing. Done first so
// the pin is in place even if Chrome launch/connect below fails.
const pinPath = syncAgentBrowserConfig(PROJECT_ROOT, cfg.debugPort)
console.error(`   agent-browser pinned to CDP ${cfg.debugPort} via ${pinPath}`)

/** True if Chrome's CDP endpoint is already serving on the configured port. */
async function cdpUp(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Drop any stale agent-browser session/daemon. A daemon that previously launched
 * its own Chrome for Testing is STICKY — `connect` won't migrate it — so we close
 * it first, letting the next command spawn a fresh daemon that honours the CDP
 * pin. Best-effort: a missing daemon is success.
 */
function clearStaleDaemon(): void {
  Bun.spawnSync(['agent-browser', 'close', '--all'], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

/** Connect agent-browser to the CDP port; exits the process on failure. */
function connectAgentBrowser(port: number): void {
  clearStaleDaemon()
  console.error(`-> Connecting agent-browser to CDP port ${port} ...`)
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

function done(freshProfile: boolean): never {
  console.error('')
  console.error('OK Chrome setup complete. agent-browser is ready.')
  console.error(`   Profile: ${cfg.workProfile}  (isolated, persistent)`)
  console.error(`   CDP:     http://127.0.0.1:${cfg.debugPort}`)
  console.error(`   Device:  ${cfg.device} (apply per-command with: agent-browser -p <profile> ...)`)
  console.error('')
  if (freshProfile) {
    console.error('   FIRST RUN: this is a fresh, isolated profile (separate from your normal')
    console.error('   Chrome). Log into X / your social accounts ONCE in the window that just')
    console.error('   opened — the session persists across restarts. It will not disturb your')
    console.error('   everyday Chrome.')
  } else {
    console.error('   Reusing your logged-in isolated profile. Your normal Chrome is untouched.')
    console.error('   (Need a clean slate? run: bun run setup-chrome --reset)')
  }
  console.error('')
  console.error('   Run: bun start')
  process.exit(0)
}

// ── Fast path: CDP already up ───────────────────────────────────────────────
// Reconnect and exit without launching or touching any Chrome. On --reset we
// fall through to tear down only the isolated instance.
if (await cdpUp(cfg.debugPort)) {
  if (!RESET) {
    console.error(`-> CDP already up on port ${cfg.debugPort}; reconnecting (no relaunch).`)
    connectAgentBrowser(cfg.debugPort)
    done(false)
  }
  console.error('-> --reset: stopping the existing isolated-profile Chrome ...')
  await killChromeForProfile(cfg.workProfile, cfg.host)
  await Bun.sleep(1000)
}

// ── Reset: wipe ONLY the isolated profile (never the user's real profile) ───
if (RESET && existsSync(cfg.workProfile)) {
  console.error(`-> --reset: wiping isolated profile ${cfg.workProfile} ...`)
  // Make sure no stale isolated Chrome is holding the dir, then remove it.
  await killChromeForProfile(cfg.workProfile, cfg.host)
  await Bun.sleep(500)
  rmSync(cfg.workProfile, { recursive: true, force: true })
}

// Did the profile exist before this run? Decides the first-run vs reused message.
const freshProfile = !existsSync(cfg.workProfile)
if (freshProfile) {
  console.error('-> Creating fresh isolated profile (you will log in once) ...')
  mkdirSync(cfg.workProfile, { recursive: true })
} else {
  console.error('-> Reusing existing isolated profile (session preserved).')
}

console.error(`-> Launching isolated Chrome on port ${cfg.debugPort} ...`)
// Launch DETACHED — on Windows a Bun-spawned child dies when this script exits,
// which would tear down the CDP endpoint the moment setup finishes (and send
// agent-browser back to its bundled Chrome for Testing). See launchChromeDetached.
launchChromeDetached(
  cfg.chromeBin,
  [
    `--remote-debugging-port=${cfg.debugPort}`,
    `--user-data-dir=${cfg.workProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
  ],
  cfg.host,
)

console.error(`-> Waiting for CDP port ${cfg.debugPort} to be ready...`)
let ready = false
for (let i = 1; i <= 15; i++) {
  if (await cdpUp(cfg.debugPort)) {
    console.error(`   Chrome CDP ready (${i}s)`)
    ready = true
    break
  }
  await Bun.sleep(1000)
}
if (!ready) {
  console.error(`x Chrome CDP port ${cfg.debugPort} did not become ready after 15s`)
  console.error('  If an old isolated Chrome is stuck, try: bun run setup-chrome --reset')
  process.exit(1)
}

connectAgentBrowser(cfg.debugPort)
done(freshProfile)
