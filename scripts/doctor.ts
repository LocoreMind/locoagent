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
  // Blank/whitespace (empty placeholder or exported-empty var) → default, not NaN.
  const port = parseInt(process.env.CHROME_DEBUG_PORT?.trim() || '9222', 10)
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
