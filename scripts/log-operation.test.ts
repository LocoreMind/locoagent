import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve(import.meta.dir, 'log-operation.ts')

// Windows subprocess startup is slow; 30 s covers bun cold-start × 2 processes
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
}, 30_000)
