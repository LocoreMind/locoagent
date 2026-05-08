#!/usr/bin/env bun
/**
 * run-tasks.ts
 * Social agent task runner.
 *
 * Reads persona/tasks.md and passes it to the agent as a structured prompt,
 * combined with the current operation log state. The agent executes the
 * appropriate daily/weekly tasks autonomously.
 *
 * Usage:
 *   bun run scripts/run-tasks.ts              # run today's tasks
 *   bun run scripts/run-tasks.ts --dry-run    # print the prompt without running
 *   bun run scripts/run-tasks.ts --platform x # filter to one platform
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const TASKS_PATH = resolve(ROOT, 'persona/tasks.md')
const LOG_SCRIPT = resolve(ROOT, 'scripts/log-operation.ts')
const CLI_ENTRY = resolve(ROOT, 'src/entrypoints/cli.tsx')
const GLOBALS = resolve(ROOT, 'stubs/globals.ts')

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const platformFilter = (() => {
  const idx = args.indexOf('--platform')
  return idx !== -1 ? args[idx + 1] : null
})()

// ── Load tasks.md ─────────────────────────────────────────────────────────────
if (!existsSync(TASKS_PATH)) {
  console.error(`✗ persona/tasks.md not found at ${TASKS_PATH}`)
  process.exit(1)
}
const tasksContent = readFileSync(TASKS_PATH, 'utf-8')

// ── Load recent operation log summary ─────────────────────────────────────────
let logSummary = ''
try {
  logSummary = execSync(`bun run ${LOG_SCRIPT} summary --days 7`, {
    encoding: 'utf-8',
    timeout: 5000,
  }).trim()
} catch (_) {
  logSummary = '(operation log unavailable)'
}

// ── Run due workflows (before agent session) ─────────────────────────────────
const WORKFLOW_ENGINE = resolve(ROOT, 'scripts/workflow-engine.ts')

function runDueWorkflows(): string {
  if (!existsSync(WORKFLOW_ENGINE)) return ''
  try {
    // Get workflow list as JSON
    const listJson = execSync(`bun run ${WORKFLOW_ENGINE} list`, {
      encoding: 'utf-8', timeout: 10000,
    }).trim()
    const workflows = JSON.parse(listJson) as Array<{
      id: string; name: string; schedule: string; status: string; lastRun: string; lastResult: string
    }>

    const results: string[] = []
    for (const wf of workflows) {
      // Skip non-daily or already running/stopped
      if (wf.schedule !== 'daily') continue
      if (wf.status === 'running' || wf.status === 'stopped') {
        results.push(`- ${wf.name}: skipped (status=${wf.status})`)
        continue
      }

      // Skip if already ran today
      const today = new Date().toISOString().split('T')[0]!
      if (wf.lastRun !== 'never' && wf.lastRun.startsWith(today)) {
        results.push(`- ${wf.name}: skipped (already ran today)`)
        continue
      }

      // Run synchronously
      console.log(`[run-tasks] Running workflow: ${wf.name}`)
      const wfResult = spawnSync('bun', ['run', WORKFLOW_ENGINE, 'run', '--id', wf.id], {
        stdio: 'inherit',
        encoding: 'utf-8',
        cwd: ROOT,
        timeout: 10 * 60 * 1000,
      })
      const status = wfResult.status === 0 ? 'success' : 'failed'
      results.push(`- ${wf.name}: ${status}`)
    }

    return results.length > 0 ? results.join('\n') : ''
  } catch (e: any) {
    console.error(`[run-tasks] Workflow pre-run failed: ${e.message}`)
    return ''
  }
}

const workflowResults = runDueWorkflows()

// ── Determine day context ─────────────────────────────────────────────────────
const today = new Date()
const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()]
const isMonday = today.getDay() === 1
const dateStr = today.toISOString().split('T')[0]

// ── Build agent prompt ────────────────────────────────────────────────────────
const platformNote = platformFilter
  ? `\nFocus only on platform: **${platformFilter}**`
  : ''

const weeklyNote = isMonday
  ? '\nToday is **Monday** — run both daily AND weekly tasks.'
  : `\nToday is **${dayName}** — run daily tasks only (skip weekly tasks).`

const prompt = `You are Ma Shijian (@mashijiann) running your scheduled social media session for ${dateStr}.
${weeklyNote}${platformNote}

## Your Task Schedule

${tasksContent}

## Workflow Results (pre-session)

${workflowResults || '(no workflows ran)'}

## Recent Operation Log (last 7 days)

${logSummary}

## Instructions

Execute the tasks above in order:
1. Monitor own project mentions first
2. Then engage with relevant content (like posts)
3. Then leave a technical comment (max 1 per session unless tasks.md says otherwise)
4. On Mondays: also follow researchers and consider posting original content

Rules:
- ALWAYS run \`bun run scripts/log-operation.ts check --platform <p> --action <a> --url <url>\` before each action
- ALWAYS run \`bun run scripts/log-operation.ts add --platform <p> --action <a> --url <url> --status <s> [--note <n>]\` after each successful action
- Respect the session constraints in tasks.md
- If a post URL is already in the operation log for that action, skip it silently

At the end, run \`bun run scripts/log-operation.ts recent --limit 20\` and report:
- What tasks were completed
- What actions were taken (with URLs)
- What was skipped and why
- Any errors or restrictions encountered`

// ── Dry run ───────────────────────────────────────────────────────────────────
if (isDryRun) {
  console.log('=== DRY RUN — prompt that would be sent to the agent ===\n')
  console.log(prompt)
  process.exit(0)
}

// ── Run agent ─────────────────────────────────────────────────────────────────
console.log(`[run-tasks] Starting session: ${dateStr} (${dayName})`)
console.log(`[run-tasks] Weekly tasks: ${isMonday ? 'YES' : 'NO'}`)
if (platformFilter) console.log(`[run-tasks] Platform filter: ${platformFilter}`)
console.log('[run-tasks] Launching agent...\n')

const result = spawnSync(
  'bun',
  ['run', '--preload', GLOBALS, CLI_ENTRY, '--print', prompt],
  {
    stdio: 'inherit',
    encoding: 'utf-8',
    cwd: ROOT,
    timeout: 30 * 60 * 1000, // 30 min max per session
  }
)

if (result.status !== 0) {
  console.error(`\n[run-tasks] Agent exited with code ${result.status}`)
  process.exit(result.status ?? 1)
}

console.log('\n[run-tasks] Session complete.')
