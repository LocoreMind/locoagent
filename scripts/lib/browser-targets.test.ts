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

test('loadTargets rejects a non-numeric cdpPort', () => {
  const path = fixture({ version: 1, targets: { x: { cdpPort: 'oops' } } })
  expect(() => loadTargets(path, {}, 'linux')).toThrow(/invalid cdpPort/)
})
