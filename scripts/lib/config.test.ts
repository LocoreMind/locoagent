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

// Blank .env placeholders (e.g. `CHROME_WORK_PROFILE=`) arrive as empty strings.
// A blank value must mean "use the default", never the empty string — an empty
// workProfile caused `mkdirSync('')` to crash setup-chrome with ENOENT.
test('loadConfig treats a blank CHROME_WORK_PROFILE as unset', () => {
  const chrome = fakeChrome()
  const cfg = loadConfig({ CHROME_BIN: chrome, CHROME_WORK_PROFILE: '' }, 'linux')
  expect(cfg.workProfile).toContain('locoagent-chrome-profile')
  expect(cfg.workProfile.length).toBeGreaterThan('locoagent-chrome-profile'.length)
})

test('loadConfig treats a whitespace-only CHROME_WORK_PROFILE as unset', () => {
  const chrome = fakeChrome()
  const cfg = loadConfig({ CHROME_BIN: chrome, CHROME_WORK_PROFILE: '   ' }, 'linux')
  expect(cfg.workProfile).toContain('locoagent-chrome-profile')
})

test('loadConfig treats a blank CHROME_DEBUG_PORT as the 9222 default', () => {
  const chrome = fakeChrome()
  const cfg = loadConfig({ CHROME_BIN: chrome, CHROME_DEBUG_PORT: '' }, 'linux')
  expect(cfg.debugPort).toBe(9222)
})
