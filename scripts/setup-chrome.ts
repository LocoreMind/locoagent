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
