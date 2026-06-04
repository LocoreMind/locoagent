import { test, expect } from 'bun:test'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  detectHost,
  chromeBinaryCandidates,
  defaultSourceProfile,
  defaultWorkProfile,
  resolveChromeBinary,
} from './host'

test('detectHost maps node platforms', () => {
  expect(detectHost('win32')).toBe('windows')
  expect(detectHost('darwin')).toBe('macos')
  expect(detectHost('linux')).toBe('linux')
})

test('chromeBinaryCandidates(windows) includes chrome.exe', () => {
  const c = chromeBinaryCandidates('windows', { ProgramFiles: 'C:\\PF', LOCALAPPDATA: 'C:\\LA' })
  expect(c.some(p => p.toLowerCase().includes('chrome.exe'))).toBe(true)
})

test('chromeBinaryCandidates(macos) points at Google Chrome.app', () => {
  expect(chromeBinaryCandidates('macos')[0]).toContain('Google Chrome')
})

test('defaultSourceProfile differs per host', () => {
  expect(defaultSourceProfile('macos')).toContain('Application Support')
  expect(defaultSourceProfile('linux')).toContain('.config')
})

test('defaultWorkProfile lives under a stable per-user dir, not temp', () => {
  // no-arg still works (detects host + process.env)
  expect(defaultWorkProfile()).toContain('locoagent-chrome-profile')
  // windows → under LOCALAPPDATA
  expect(defaultWorkProfile('windows', { LOCALAPPDATA: 'C:\\LA' })).toBe(
    join('C:\\LA', 'locoagent-chrome-profile'),
  )
  // macos → under Application Support
  expect(defaultWorkProfile('macos')).toContain('Application Support')
  // linux → honours XDG_DATA_HOME
  expect(defaultWorkProfile('linux', { XDG_DATA_HOME: '/data' })).toBe(
    join('/data', 'locoagent-chrome-profile'),
  )
  // none of them live under the OS temp dir
  expect(defaultWorkProfile('windows', { LOCALAPPDATA: 'C:\\LA' })).not.toContain('Temp')
})

test('resolveChromeBinary returns an existing explicit path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-'))
  const fake = join(dir, 'chrome')
  writeFileSync(fake, 'x')
  expect(resolveChromeBinary(fake, 'linux')).toBe(fake)
})

test('resolveChromeBinary throws when explicit path is missing', () => {
  expect(() => resolveChromeBinary(join(tmpdir(), 'no-such-chrome-xyz'), 'linux')).toThrow()
})
