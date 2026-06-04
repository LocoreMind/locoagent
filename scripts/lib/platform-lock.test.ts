import { test, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireLock, releaseLock, lockPath } from './platform-lock'

function root(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lock-'))
  mkdirSync(join(dir, 'workflows'), { recursive: true })
  return dir
}

test('acquireLock succeeds when free, then blocks a second live holder', () => {
  const r = root()
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
  // Same process (alive pid) holds it → second acquire is refused.
  expect(acquireLock('x', 'wf-b', r)).toBe(false)
})

test('acquireLock steals a stale lock whose pid is dead', () => {
  const r = root()
  const path = lockPath('x', r)
  mkdirSync(join(r, 'workflows', '.locks'), { recursive: true })
  writeFileSync(path, JSON.stringify({ pid: 999999999, workflowId: 'ghost', acquiredAt: 'x' }))
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
})

test('acquireLock steals an unreadable/corrupt lock', () => {
  const r = root()
  const path = lockPath('x', r)
  mkdirSync(join(r, 'workflows', '.locks'), { recursive: true })
  writeFileSync(path, 'not-json')
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
})

test('releaseLock removes only a lock this process owns', () => {
  const r = root()
  expect(acquireLock('x', 'wf-a', r)).toBe(true)
  releaseLock('x', 'wf-a', r)
  expect(existsSync(lockPath('x', r))).toBe(false)
})

test('releaseLock leaves a lock owned by a different workflow intact', () => {
  const r = root()
  const path = lockPath('x', r)
  mkdirSync(join(r, 'workflows', '.locks'), { recursive: true })
  writeFileSync(path, JSON.stringify({ pid: 999999999, workflowId: 'other', acquiredAt: 'x' }))
  releaseLock('x', 'wf-a', r)
  expect(existsSync(path)).toBe(true)
})
