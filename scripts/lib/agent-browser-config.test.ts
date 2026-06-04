import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agentBrowserConfigPath, syncAgentBrowserConfig } from './agent-browser-config'

test('agentBrowserConfigPath is agent-browser.json under the project root', () => {
  expect(agentBrowserConfigPath('/proj')).toBe(join('/proj', 'agent-browser.json'))
})

test('syncAgentBrowserConfig writes cdp as a STRING (agent-browser rejects integers)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abc-'))
  const path = syncAgentBrowserConfig(dir, 9222)
  const parsed = JSON.parse(readFileSync(path, 'utf-8'))
  expect(parsed.cdp).toBe('9222')
  expect(typeof parsed.cdp).toBe('string')
})

test('syncAgentBrowserConfig preserves other keys and updates the port', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abc-'))
  writeFileSync(join(dir, 'agent-browser.json'), JSON.stringify({ headed: true, cdp: '1111' }))
  const path = syncAgentBrowserConfig(dir, 9333)
  const parsed = JSON.parse(readFileSync(path, 'utf-8'))
  expect(parsed.cdp).toBe('9333')
  expect(parsed.headed).toBe(true)
})

test('syncAgentBrowserConfig is idempotent — stable formatting, no rewrite churn', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abc-'))
  const path = syncAgentBrowserConfig(dir, 9222)
  const first = readFileSync(path, 'utf-8')
  syncAgentBrowserConfig(dir, 9222)
  expect(readFileSync(path, 'utf-8')).toBe(first)
  expect(first).toBe('{\n  "cdp": "9222"\n}\n')
})

test('syncAgentBrowserConfig recovers from a malformed file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abc-'))
  writeFileSync(join(dir, 'agent-browser.json'), '{ not json')
  const path = syncAgentBrowserConfig(dir, 9222)
  expect(JSON.parse(readFileSync(path, 'utf-8')).cdp).toBe('9222')
})
