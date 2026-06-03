#!/usr/bin/env bun
/**
 * log-operation.ts
 * Social agent operation log CLI helper.
 *
 * Usage (the agent calls this via Bash tool):
 *
 *   # Append a new operation
 *   bun run scripts/log-operation.ts add \
 *     --platform x \
 *     --action like \
 *     --url "https://x.com/user/status/123" \
 *     --status success \
 *     [--note "optional context"]
 *
 *   # Check if a URL+action combo was already done (exits 0 = done, 1 = not done)
 *   bun run scripts/log-operation.ts check \
 *     --platform x \
 *     --action like \
 *     --url "https://x.com/user/status/123"
 *
 *   # Print recent N operations as JSON (default 50)
 *   bun run scripts/log-operation.ts recent [--limit 20]
 *
 *   # Print a compact summary for the system prompt context
 *   bun run scripts/log-operation.ts summary [--days 7]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// LOCO_OP_LOG_PATH lets doctor/tests target an isolated log without touching
// the real persona/operation-log.json. Default unchanged.
const LOG_PATH = process.env.LOCO_OP_LOG_PATH
  ? resolve(process.env.LOCO_OP_LOG_PATH)
  : resolve(__dirname, '../persona/operation-log.json')

interface Operation {
  ts: string          // ISO timestamp
  platform: string   // x, reddit, linkedin, etc.
  action: string     // like, comment, repost, follow, upvote, reply, post
  url: string        // canonical URL of the target content/user
  status: string     // success, failed, skipped, restricted
  device?: string    // desktop | ios | android — provenance only, NOT a dedup key
  note?: string      // optional free-text context
}

interface LogFile {
  version: number
  description: string
  operations: Operation[]
}

function loadLog(): LogFile {
  if (!existsSync(LOG_PATH)) {
    return { version: 1, description: 'Social agent operation log.', operations: [] }
  }
  return JSON.parse(readFileSync(LOG_PATH, 'utf-8')) as LogFile
}

function saveLog(log: LogFile): void {
  // persona/ is gitignored and absent from a fresh clone; create it so the
  // first `add` on a new machine doesn't crash with ENOENT (cross-platform).
  mkdirSync(dirname(LOG_PATH), { recursive: true })
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n', 'utf-8')
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) {
      const key = args[i]!.slice(2)
      const val = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'true'
      result[key] = val
    }
  }
  return result
}

const [,, command, ...rest] = process.argv
const flags = parseArgs(rest ?? [])

// ── add ───────────────────────────────────────────────────────────────────────
if (command === 'add') {
  const { platform, action, url, status, device, note } = flags
  if (!platform || !action || !url || !status) {
    console.error('Usage: log-operation.ts add --platform <p> --action <a> --url <u> --status <s> [--note <n>]')
    process.exit(2)
  }
  const log = loadLog()
  const op: Operation = {
    ts: new Date().toISOString(),
    platform,
    action,
    url,
    status,
    ...(device ? { device } : {}),
    ...(note ? { note } : {}),
  }
  log.operations.push(op)
  saveLog(log)
  console.log(JSON.stringify({ ok: true, operation: op }))
  process.exit(0)
}

// ── check ─────────────────────────────────────────────────────────────────────
if (command === 'check') {
  const { platform, action, url } = flags
  if (!platform || !action || !url) {
    console.error('Usage: log-operation.ts check --platform <p> --action <a> --url <u>')
    process.exit(2)
  }
  const log = loadLog()
  const found = log.operations.find(
    op => op.platform === platform && op.action === action && op.url === url && op.status === 'success'
  )
  if (found) {
    console.log(JSON.stringify({ done: true, operation: found }))
    process.exit(0)  // exit 0 = already done
  } else {
    console.log(JSON.stringify({ done: false }))
    process.exit(1)  // exit 1 = not done yet
  }
}

// ── recent ────────────────────────────────────────────────────────────────────
if (command === 'recent') {
  const limit = parseInt(flags['limit'] ?? '50', 10)
  const log = loadLog()
  const recent = log.operations.slice(-limit)
  console.log(JSON.stringify(recent, null, 2))
  process.exit(0)
}

// ── summary ───────────────────────────────────────────────────────────────────
if (command === 'summary') {
  const days = parseInt(flags['days'] ?? '7', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const log = loadLog()
  const recent = log.operations.filter(op => new Date(op.ts) >= since)

  // Count by platform+action
  const counts: Record<string, number> = {}
  const doneUrls: Record<string, Set<string>> = {}

  for (const op of recent) {
    if (op.status !== 'success') continue
    const key = `${op.platform}:${op.action}`
    counts[key] = (counts[key] ?? 0) + 1
    if (!doneUrls[op.platform]) doneUrls[op.platform] = new Set()
    doneUrls[op.platform]!.add(op.url)
  }

  const lines: string[] = [
    `## Operation Log Summary (last ${days} days)`,
    `Total operations: ${recent.length}`,
    '',
    '### Action counts (successful):',
    ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '### Already-acted URLs by platform (do not repeat):',
  ]

  for (const [platform, urls] of Object.entries(doneUrls)) {
    lines.push(`#### ${platform}`)
    for (const url of urls) {
      lines.push(`- ${url}`)
    }
  }

  console.log(lines.join('\n'))
  process.exit(0)
}

console.error(`Unknown command: ${command}. Use: add | check | recent | summary`)
process.exit(2)
