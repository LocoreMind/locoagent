#!/usr/bin/env bun
/**
 * tail-agent.ts — Real-time trajectory monitor for LocoAgent
 *
 * Watches the latest (or specified) session .jsonl file and prints
 * agent status as it executes: text output, tool calls, tool results.
 *
 * Usage:
 *   bun run scripts/tail-agent.ts               # auto-detect latest session
 *   bun run scripts/tail-agent.ts <session-id>  # watch specific session
 *   bun run scripts/tail-agent.ts --list        # list recent sessions
 */

import { readdir, stat, open } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const PROJECT_DIR = join(homedir(), '.claude', 'projects', '-Users-jason-Projects-msj-locoremind-locoagent')
const POLL_INTERVAL_MS = 200

// ANSI colors
const C = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function ts(timestamp?: string): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return C.dim + C.gray + `[${d.toLocaleTimeString()}] ` + C.reset
}

function printEntry(entry: Record<string, unknown>): void {
  const type = entry.type as string
  const timestamp = entry.timestamp as string | undefined

  if (type === 'assistant') {
    const msg = entry.message as Record<string, unknown> | undefined
    if (!msg) return
    const content = msg.content as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(content)) return

    for (const block of content) {
      const btype = block.type as string

      if (btype === 'text' && block.text) {
        const text = (block.text as string).trim()
        if (text) {
          process.stdout.write(
            ts(timestamp) + C.cyan + C.bold + '● Agent: ' + C.reset + C.cyan + text + C.reset + '\n'
          )
        }
      } else if (btype === 'tool_use') {
        const name = block.name as string
        const input = block.input as Record<string, unknown>

        if (name === 'Bash') {
          const cmd = (input.command as string | undefined) ?? ''
          process.stdout.write(
            ts(timestamp) + C.yellow + '⚡ Bash: ' + C.reset + C.dim + cmd.slice(0, 120) + C.reset + '\n'
          )
        } else if (name === 'TodoWrite') {
          const todos = input.todos as Array<{ content: string; status: string }> | undefined
          if (todos) {
            const active = todos.find(t => t.status === 'in_progress')
            if (active) {
              process.stdout.write(
                ts(timestamp) + C.blue + '📋 Todo: ' + C.reset + active.content + '\n'
              )
            }
          }
        } else {
          process.stdout.write(
            ts(timestamp) + C.magenta + `🔧 Tool[${name}]: ` + C.reset + C.dim +
            JSON.stringify(input).slice(0, 100) + C.reset + '\n'
          )
        }
      } else if (btype === 'thinking' && block.thinking) {
        const thinking = (block.thinking as string).trim()
        if (thinking) {
          process.stdout.write(
            ts(timestamp) + C.gray + C.dim + '💭 ' + thinking.slice(0, 150) + (thinking.length > 150 ? '...' : '') + C.reset + '\n'
          )
        }
      }
    }
  } else if (type === 'user') {
    const msg = entry.message as Record<string, unknown> | undefined
    if (!msg) return
    const content = msg.content as unknown
    const isMeta = entry.isMeta as boolean | undefined

    // Skip skill injection noise (long playbook content)
    if (isMeta) return

    if (Array.isArray(content)) {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block.type === 'tool_result') {
          const toolResult = block.content as string | undefined
          if (toolResult && toolResult.length < 300) {
            process.stdout.write(
              ts(timestamp) + C.green + '✓ Result: ' + C.reset + C.dim + toolResult.slice(0, 200) + C.reset + '\n'
            )
          } else if (toolResult) {
            process.stdout.write(
              ts(timestamp) + C.green + `✓ Result: ` + C.reset + C.dim + `(${toolResult.length} chars)` + C.reset + '\n'
            )
          }
        }
      }
    }
  } else if (type === 'queue-operation') {
    const op = entry.operation as string
    if (op === 'enqueue') {
      const content = entry.content as string
      console.log('\n' + C.bold + C.green + '═══ New Task ═══' + C.reset)
      console.log(C.green + content + C.reset + '\n')
    }
  }
}

async function getLatestSession(): Promise<string | null> {
  const entries = await readdir(PROJECT_DIR)
  const jsonlFiles = entries.filter(f => f.endsWith('.jsonl'))

  let latest: { name: string; mtime: number } | null = null
  for (const f of jsonlFiles) {
    const s = await stat(join(PROJECT_DIR, f))
    if (!latest || s.mtimeMs > latest.mtime) {
      latest = { name: f, mtime: s.mtimeMs }
    }
  }
  return latest ? join(PROJECT_DIR, latest.name) : null
}

async function listSessions(): Promise<void> {
  const entries = await readdir(PROJECT_DIR)
  const jsonlFiles = entries.filter(f => f.endsWith('.jsonl'))

  const sessions: Array<{ name: string; mtime: Date; size: number }> = []
  for (const f of jsonlFiles) {
    const s = await stat(join(PROJECT_DIR, f))
    sessions.push({ name: f.replace('.jsonl', ''), mtime: s.mtime, size: s.size })
  }
  sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  console.log(C.bold + 'Recent sessions:' + C.reset)
  for (const s of sessions.slice(0, 10)) {
    console.log(`  ${C.cyan}${s.name}${C.reset}  ${C.gray}${s.mtime.toLocaleString()}  ${(s.size / 1024).toFixed(1)}KB${C.reset}`)
  }
}

async function watchFile(filePath: string, fromStart = false): Promise<void> {
  console.log(C.bold + `Watching: ${filePath}` + C.reset + '\n')

  let offset = 0
  let buffer = ''

  if (!fromStart) {
    // Start from end of file — only show new entries
    const s = await stat(filePath)
    offset = s.size
    console.log(C.gray + `(skipping ${(offset / 1024).toFixed(1)}KB of existing content, waiting for new entries...)` + C.reset + '\n')
  }

  const seenUuids = new Set<string>()

  while (true) {
    const fh = await open(filePath, 'r')
    const s = await fh.stat()

    if (s.size > offset) {
      const newBytes = s.size - offset
      const buf = Buffer.alloc(newBytes)
      await fh.read(buf, 0, newBytes, offset)
      offset = s.size
      buffer += buf.toString('utf8')

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const entry = JSON.parse(trimmed) as Record<string, unknown>
          const uuid = entry.uuid as string | undefined
          if (uuid && seenUuids.has(uuid)) continue
          if (uuid) seenUuids.add(uuid)
          printEntry(entry)
        } catch {
          // skip malformed lines
        }
      }
    }

    await fh.close()
    await Bun.sleep(POLL_INTERVAL_MS)
  }
}

async function watchLatest(): Promise<void> {
  console.log(C.gray + 'Looking for latest session...' + C.reset)

  let currentFile: string | null = null
  let watchPromise: Promise<void> | null = null

  // Poll for new sessions
  while (true) {
    const latest = await getLatestSession()
    if (latest && latest !== currentFile) {
      currentFile = latest
      console.log(C.bold + C.green + `\n→ New session detected` + C.reset)
      // Start watching the new file from start if first detection, else from end
      watchFile(latest, false).catch(console.error)
    }
    await Bun.sleep(1000)
  }
}

// Main
const args = process.argv.slice(2)

if (args.includes('--list')) {
  await listSessions()
  process.exit(0)
}

if (args[0] && !args[0].startsWith('-')) {
  // Specific session ID provided
  const sessionId = args[0].endsWith('.jsonl') ? args[0] : `${args[0]}.jsonl`
  const filePath = join(PROJECT_DIR, sessionId)
  const fromStart = args.includes('--from-start')
  await watchFile(filePath, fromStart)
} else {
  // Auto-detect latest, watch for new sessions
  const latest = await getLatestSession()
  if (latest) {
    const fromStart = args.includes('--from-start')
    await watchFile(latest, fromStart)
  } else {
    console.log(C.red + 'No session files found. Start LocoAgent first.' + C.reset)
    process.exit(1)
  }
}
