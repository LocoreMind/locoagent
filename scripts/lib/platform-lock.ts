/**
 * Per-platform cross-process mutual exclusion. A lock file lives at
 * workflows/.locks/<platform>.lock and holds {pid, workflowId, acquiredAt}.
 *
 * Same-platform workflows must run serially (one active tab per profile); the
 * engine acquires this lock before spawning an executor and releases it after.
 * A file lock — not state.json — because `start` (detached child), `daemon`
 * (separate long-lived process), and `orchestrate` (another process) must
 * coordinate through a filesystem atomic primitive. `openSync(path, 'wx')` is
 * atomic create-exclusive on a single filesystem; state.json's non-atomic
 * read-modify-write would race when processes start simultaneously.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

interface LockData {
  pid: number
  workflowId: string
  acquiredAt: string
}

export function lockDir(root: string = PROJECT_ROOT): string {
  return join(root, 'workflows', '.locks')
}

export function lockPath(platform: string, root: string = PROJECT_ROOT): string {
  return join(lockDir(root), `${platform}.lock`)
}

/** True if a process with this pid is currently running. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e: any) {
    // ESRCH = no such process (dead). EPERM = exists but not signalable (alive).
    return e?.code === 'EPERM'
  }
}

function writeLock(path: string, workflowId: string): boolean {
  try {
    const fd = openSync(path, 'wx') // atomic: fails with EEXIST if present
    writeSync(
      fd,
      JSON.stringify({ pid: process.pid, workflowId, acquiredAt: new Date().toISOString() }),
    )
    closeSync(fd)
    return true
  } catch (e: any) {
    if (e?.code === 'EEXIST') return false
    throw e
  }
}

/**
 * Try to acquire the platform lock. Returns false if a LIVE process holds it.
 * A stale lock (dead pid) is stolen. Caller MUST releaseLock in a finally block.
 */
export function acquireLock(
  platform: string,
  workflowId: string,
  root: string = PROJECT_ROOT,
): boolean {
  const dir = lockDir(root)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = lockPath(platform, root)

  if (writeLock(path, workflowId)) return true

  // Held — inspect the holder.
  let holder: LockData | null = null
  try {
    holder = JSON.parse(readFileSync(path, 'utf-8')) as LockData
  } catch {
    /* unreadable lock → treat as stale */
  }
  if (holder && isAlive(holder.pid)) return false

  // Stale: remove and recreate.
  rmSync(path, { force: true })
  return writeLock(path, workflowId)
}

/** Release the lock only if this process+workflow owns it. */
export function releaseLock(
  platform: string,
  workflowId: string,
  root: string = PROJECT_ROOT,
): void {
  const path = lockPath(platform, root)
  try {
    const holder = JSON.parse(readFileSync(path, 'utf-8')) as LockData
    if (holder.pid === process.pid && holder.workflowId === workflowId) {
      rmSync(path, { force: true })
    }
  } catch {
    /* no lock or unparsable → nothing to release */
  }
}
