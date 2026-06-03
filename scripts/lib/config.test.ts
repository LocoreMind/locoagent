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
