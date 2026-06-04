#!/usr/bin/env bun
/**
 * doctor.ts — cross-platform preflight / health check and onboarding aid.
 * Run: bun run doctor [--check-cdp]
 * Exits non-zero if any CRITICAL check fails.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectHost, resolveChromeBinary } from './lib/host'
import { resolveDevice } from './lib/device'
import { agentBrowserConfigPath } from './lib/agent-browser-config'
import { loadTargets } from './lib/browser-targets'

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

// agent-browser CDP pin — without it agent-browser launches its own bundled
// Chrome for Testing instead of attaching to the isolated CDP profile. The pin
// must match the DEFAULT platform's registry port (what setup-chrome pins to),
// not CHROME_DEBUG_PORT — the registry is the single source of truth.
{
  // Default-platform port from the registry (x), falling back to 9222 if the
  // registry is missing/unreadable so doctor still gives a sane answer.
  let port = 9222
  try {
    const targets = loadTargets()
    const def = targets['x'] ?? Object.values(targets)[0]
    if (def) port = def.cdpPort
  } catch {
    /* no registry → keep 9222 default */
  }
  const pinPath = agentBrowserConfigPath(root)
  let ok = false
  let detail = `missing ${pinPath} (run: bun run setup-chrome)`
  try {
    const cfg = JSON.parse(readFileSync(pinPath, 'utf-8'))
    if (String(cfg.cdp) === String(port)) {
      ok = true
      detail = `cdp pinned to ${port}`
    } else {
      detail = `cdp="${cfg.cdp}" but default target port=${port} (run: bun run setup-chrome)`
    }
  } catch {
    /* missing/malformed → not ok */
  }
  add('agent-browser CDP pin', ok, false, detail)
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
