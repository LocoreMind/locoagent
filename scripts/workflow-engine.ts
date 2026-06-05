#!/usr/bin/env bun
/**
 * workflow-engine.ts
 * Workflow lifecycle manager for LocoAgent.
 *
 * Workflows are pure browser-automation pipelines — no LLM involved.
 * The agent can sense workflow state and control them via this CLI.
 *
 * Usage:
 *   bun run scripts/workflow-engine.ts list                     # list all workflows + status
 *   bun run scripts/workflow-engine.ts status [--id <id>]       # detailed status (one or all)
 *   bun run scripts/workflow-engine.ts start --id <id>          # start in background (non-blocking)
 *   bun run scripts/workflow-engine.ts stop --id <id>           # stop at checkpoint + kill process
 *   bun run scripts/workflow-engine.ts reset --id <id>          # clear stopped state back to idle
 *   bun run scripts/workflow-engine.ts run --id <id>            # execute synchronously (blocking)
 *   bun run scripts/workflow-engine.ts history --id <id>        # show execution history
 *   bun run scripts/workflow-engine.ts summary                  # compact summary for system prompt
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { resolveTarget } from './lib/browser-targets'
import { acquireLock, releaseLock } from './lib/platform-lock'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const WORKFLOWS_DIR = resolve(ROOT, 'workflows')
const STATE_PATH = resolve(WORKFLOWS_DIR, 'state.json')

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkflowDefinition {
  id: string
  name: string
  description: string
  schedule: string
  platform?: string
  executor: string
  config: Record<string, unknown>
}

interface WorkflowRun {
  startedAt: string
  finishedAt: string | null
  status: 'success' | 'failed' | 'partial'
  stepsCompleted: number
  stepsTotal: number
  error?: string
  output?: Record<string, unknown>
}

interface WorkflowState {
  status: 'idle' | 'running' | 'stopped'
  lastRun: WorkflowRun | null
  runCount: number
  history: WorkflowRun[]
}

interface StateFile {
  version: number
  workflows: Record<string, WorkflowState>
}

// ── State helpers ────────────────────────────────────────────────────────────

function loadState(): StateFile {
  if (!existsSync(STATE_PATH)) {
    return { version: 1, workflows: {} }
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as StateFile
}

function saveState(state: StateFile): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8')
}

function getDefaultWorkflowState(): WorkflowState {
  return { status: 'idle', lastRun: null, runCount: 0, history: [] }
}

function loadWorkflowDefinitions(): WorkflowDefinition[] {
  const files = readdirSync(WORKFLOWS_DIR).filter(
    f => f.endsWith('.json') && f !== 'state.json'
  )
  return files.map(f => {
    const content = readFileSync(resolve(WORKFLOWS_DIR, f), 'utf-8')
    return JSON.parse(content) as WorkflowDefinition
  })
}

function getWorkflowDef(id: string): WorkflowDefinition | null {
  const defs = loadWorkflowDefinitions()
  return defs.find(d => d.id === id) ?? null
}

/**
 * Build the --config JSON for an executor. When the workflow declares a platform,
 * the resolved target's cdpPort/profile/proxy/device are injected so the port
 * lives in exactly one place (the registry). Workflows without a platform fall
 * back to their own config (back-compat).
 */
function buildConfigJson(def: WorkflowDefinition): string {
  if (!def.platform) return JSON.stringify(def.config)
  const t = resolveTarget(def.platform)
  const merged: Record<string, unknown> = {
    ...def.config,
    platform: def.platform,
    cdpPort: t.cdpPort,
    profile: t.profile,
    device: t.device,
  }
  if (t.proxy) merged['proxy'] = t.proxy
  return JSON.stringify(merged)
}

// ── Arg parsing ──────────────────────────────────────────────────────────────

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

// ── list ─────────────────────────────────────────────────────────────────────

if (command === 'list') {
  const defs = loadWorkflowDefinitions()
  const state = loadState()

  const rows = defs.map(d => {
    const ws = state.workflows[d.id] ?? getDefaultWorkflowState()
    return {
      id: d.id,
      name: d.name,
      schedule: d.schedule,
      status: ws.status,
      runCount: ws.runCount,
      lastRun: ws.lastRun?.finishedAt ?? 'never',
      lastResult: ws.lastRun?.status ?? '-',
    }
  })

  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

// ── status ───────────────────────────────────────────────────────────────────

if (command === 'status') {
  const state = loadState()
  const defs = loadWorkflowDefinitions()

  if (flags['id']) {
    const def = defs.find(d => d.id === flags['id'])
    const ws = state.workflows[flags['id']!] ?? getDefaultWorkflowState()
    console.log(JSON.stringify({ definition: def ?? null, state: ws }, null, 2))
  } else {
    const all: Record<string, { definition: WorkflowDefinition; state: WorkflowState }> = {}
    for (const def of defs) {
      all[def.id] = {
        definition: def,
        state: state.workflows[def.id] ?? getDefaultWorkflowState(),
      }
    }
    console.log(JSON.stringify(all, null, 2))
  }
  process.exit(0)
}

// ── Shared executor helpers ──────────────────────────────────────────────────

function prepareRun(id: string): { def: WorkflowDefinition; ws: WorkflowState; state: StateFile; executorPath: string; configJson: string } {
  const def = getWorkflowDef(id)
  if (!def) {
    console.error(`Workflow not found: ${id}`)
    process.exit(1)
  }

  const state = loadState()
  if (!state.workflows[id]) state.workflows[id] = getDefaultWorkflowState()
  const ws = state.workflows[id]!

  if (ws.status === 'running') {
    console.error(`Workflow ${id} is already running`)
    process.exit(1)
  }

  const executorPath = resolve(WORKFLOWS_DIR, def.executor)
  if (!existsSync(executorPath)) {
    console.error(`Executor not found: ${executorPath}`)
    process.exit(1)
  }

  ws.status = 'running'
  saveState(state)

  return { def, ws, state, executorPath, configJson: buildConfigJson(def) }
}

function finalizeRun(state: StateFile, ws: WorkflowState, stdout: string, exitCode: number | null, stderr?: string): WorkflowRun {
  let output: Record<string, unknown> = {}
  if (stdout) {
    try {
      const lines = stdout.trim().split('\n')
      const lastLine = lines[lines.length - 1]!
      output = JSON.parse(lastLine)
    } catch (_) {
      output = { rawOutput: stdout.slice(-500) }
    }
  }

  const run: WorkflowRun = {
    startedAt: ws.lastRun?.startedAt ?? new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: 'success',
    stepsCompleted: (output['stepsCompleted'] as number) ?? 0,
    stepsTotal: (output['stepsTotal'] as number) ?? 0,
    output,
  }

  if (exitCode !== 0) {
    run.status = 'failed'
    run.error = stderr?.slice(-300) || `exit code ${exitCode}`
  } else if (run.stepsCompleted < run.stepsTotal) {
    run.status = 'partial'
  }

  ws.status = 'idle'
  ws.lastRun = run
  ws.runCount++
  ws.history.push(run)
  if (ws.history.length > 30) ws.history = ws.history.slice(-30)
  saveState(state)

  return run
}

// In-process serialization for state.json read-modify-write. `orchestrate` runs
// executeWorkflow concurrently across platforms; since saveState rewrites the
// WHOLE file, two concurrent loadState→finalizeRun→saveState sequences would
// clobber each other's workflow entry. This mutex makes each such sequence atomic
// within the process. (run/daemon are single-workflow per process and don't need it.)
// NOTE: this does NOT guard against two SEPARATE processes — e.g. `start` for two
// different platforms at once — racing on the file; that pre-existing edge is
// uncommon (same-platform concurrency is already prevented by the platform lock).
let stateMutex: Promise<unknown> = Promise.resolve()
function withStateMutex<T>(fn: () => T): Promise<T> {
  const result = stateMutex.then(fn)
  stateMutex = result.then(() => {}, () => {})
  return result
}

/**
 * Run one workflow to completion (async, lock-guarded). Used by `orchestrate`.
 * Acquires the platform lock, spawns the executor, finalizes state, releases.
 * Returns a labelled result for aggregation.
 */
async function executeWorkflow(def: WorkflowDefinition): Promise<{ id: string; platform: string | null; run: WorkflowRun | null; skipped?: string }> {
  const platform = def.platform ?? null
  if (platform && !acquireLock(platform, def.id)) {
    return { id: def.id, platform, run: null, skipped: 'platform busy' }
  }
  try {
    const executorPath = resolve(WORKFLOWS_DIR, def.executor)
    if (!existsSync(executorPath)) {
      return { id: def.id, platform, run: null, skipped: `executor not found: ${executorPath}` }
    }
    await withStateMutex(() => {
      const state = loadState()
      if (!state.workflows[def.id]) state.workflows[def.id] = getDefaultWorkflowState()
      state.workflows[def.id]!.status = 'running'
      saveState(state)
    })

    let stdout = ''
    let exitCode: number | null = null
    try {
      const proc = Bun.spawn(['bun', 'run', executorPath, '--config', buildConfigJson(def)], {
        cwd: ROOT,
        stdin: 'inherit',
        stdout: 'pipe',
        stderr: 'inherit',
      })
      const timeoutId = setTimeout(() => { proc.kill() }, 10 * 60 * 1000)
      stdout = await new Response(proc.stdout).text()
      exitCode = await proc.exited
      clearTimeout(timeoutId)
    } catch (e: any) {
      console.error(`[orchestrate] ${def.id} executor error: ${e.message}`)
      exitCode = 1
    }

    const run = await withStateMutex(() => {
      const freshState = loadState()
      const freshWs = freshState.workflows[def.id] ?? getDefaultWorkflowState()
      const r = finalizeRun(freshState, freshWs, stdout, exitCode)
      delete (freshWs as any).pid
      saveState(freshState)
      return r
    })
    return { id: def.id, platform, run }
  } finally {
    if (platform) releaseLock(platform, def.id)
  }
}

// ── run (synchronous, blocking) ──────────────────────────────────────────────

if (command === 'run') {
  const id = flags['id']
  if (!id) {
    console.error('Usage: workflow-engine.ts run --id <workflow-id>')
    process.exit(2)
  }

  const peek = getWorkflowDef(id)
  const platform = peek?.platform
  if (platform && !acquireLock(platform, id)) {
    console.error(`[workflow] Platform "${platform}" is busy (another workflow holds the lock). Try later.`)
    process.exit(1)
  }
  try {
    const { def, ws, state, executorPath, configJson } = prepareRun(id)
    console.log(`[workflow] Starting: ${def.name}`)

    const result = spawnSync('bun', ['run', executorPath, '--config', configJson], {
      stdio: ['inherit', 'pipe', 'inherit'],
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 10 * 60 * 1000, // 10 min max
    })

    // Re-read state (may have been modified by `stop` during execution)
    const freshState = loadState()
    const freshWs = freshState.workflows[id] ?? getDefaultWorkflowState()
    const run = finalizeRun(freshState, freshWs, result.stdout ?? '', result.status, result.stderr ?? '')
    delete (freshWs as any).pid
    delete (freshWs as any).startedAt
    saveState(freshState)
    console.log(`[workflow] Finished: ${run.status} (${run.stepsCompleted}/${run.stepsTotal} steps)`)
    process.exit(run.status === 'failed' ? 1 : 0)
  } finally {
    if (platform) releaseLock(platform, id)
  }
}

// ── start (background, non-blocking) ────────────────────────────────────────
// Spawns `workflow-engine.ts run --id <id>` as a detached background process.
// The `run` command handles spawnSync + finalizeRun, so state.json gets updated
// properly when the executor finishes (even if the parent shell exits).

if (command === 'start') {
  const id = flags['id']
  if (!id) {
    console.error('Usage: workflow-engine.ts start --id <workflow-id>')
    process.exit(2)
  }

  const def = getWorkflowDef(id)
  if (!def) {
    console.error(`Workflow not found: ${id}`)
    process.exit(1)
  }

  // Check status before spawning (don't call prepareRun — `run` will do that)
  const state = loadState()
  const ws = state.workflows[id] ?? getDefaultWorkflowState()
  if (ws.status === 'running') {
    console.error(`Workflow ${id} is already running`)
    process.exit(1)
  }

  // Log file for background output
  const { openSync, mkdirSync: mkdirSyncFn } = require('node:fs') as typeof import('node:fs')
  const logDir = resolve(WORKFLOWS_DIR, '.tmp')
  if (!existsSync(logDir)) mkdirSyncFn(logDir, { recursive: true })
  const logFile = resolve(logDir, `${id}.log`)
  const logFd = openSync(logFile, 'w')

  // Spawn `workflow-engine.ts run` as detached process — it handles everything
  const selfScript = resolve(__dirname, 'workflow-engine.ts')
  const child = spawn('bun', ['run', selfScript, 'run', '--id', id], {
    stdio: ['ignore', logFd, logFd],
    cwd: ROOT,
    detached: true,
  })

  // Save PID and log path for stop/status commands
  if (!state.workflows[id]) state.workflows[id] = getDefaultWorkflowState()
  ;(state.workflows[id] as any).pid = child.pid
  ;(state.workflows[id] as any).logFile = logFile
  saveState(state)

  child.unref()

  console.log(`[workflow] Started in background: ${def.name}`)
  console.log(`[workflow] PID: ${child.pid}`)
  console.log(`[workflow] Log: ${logFile}`)
  console.log(`[workflow] Use 'workflow stop --id ${id}' to stop`)
  process.exit(0)
}

// ── stop ─────────────────────────────────────────────────────────────────────

if (command === 'stop') {
  const id = flags['id']
  if (!id) {
    console.error('Usage: workflow-engine.ts stop --id <workflow-id>')
    process.exit(2)
  }

  const state = loadState()
  if (!state.workflows[id]) {
    console.error(`No state for workflow: ${id}`)
    process.exit(1)
  }

  const ws = state.workflows[id]!

  // Signal the executor to stop at next checkpoint
  ws.status = 'stopped'
  saveState(state)

  // Also kill the background process if PID is recorded
  const pid = (ws as any).pid as number | undefined
  if (pid) {
    try {
      process.kill(pid, 'SIGTERM')
      console.log(`[workflow] Sent SIGTERM to PID ${pid}`)
    } catch (_) {
      // Process may have already exited
    }
    delete (ws as any).pid
    delete (ws as any).startedAt
    saveState(state)
  }

  console.log(`[workflow] Stopped: ${id}`)
  process.exit(0)
}

// ── reset ───────────────────────────────────────────────────────────────────
// Clears a stopped workflow back to idle so it can be started again.

if (command === 'reset') {
  const id = flags['id']
  if (!id) {
    console.error('Usage: workflow-engine.ts reset --id <workflow-id>')
    process.exit(2)
  }

  const state = loadState()
  if (!state.workflows[id]) {
    console.error(`No state for workflow: ${id}`)
    process.exit(1)
  }

  if (state.workflows[id]!.status !== 'stopped') {
    console.error(`Workflow ${id} is not stopped (current: ${state.workflows[id]!.status})`)
    process.exit(1)
  }

  state.workflows[id]!.status = 'idle'
  delete (state.workflows[id] as any).pid
  saveState(state)
  console.log(`[workflow] Reset to idle: ${id}`)
  process.exit(0)
}

// ── history ──────────────────────────────────────────────────────────────────

if (command === 'history') {
  const id = flags['id']
  if (!id) {
    console.error('Usage: workflow-engine.ts history --id <workflow-id>')
    process.exit(2)
  }

  const state = loadState()
  const ws = state.workflows[id]
  if (!ws) {
    console.log('[]')
  } else {
    console.log(JSON.stringify(ws.history, null, 2))
  }
  process.exit(0)
}

// ── summary (for system prompt injection) ────────────────────────────────────

if (command === 'summary') {
  const defs = loadWorkflowDefinitions()
  const state = loadState()

  const lines: string[] = [
    `## Workflow Status Summary`,
    `Total workflows: ${defs.length}`,
    '',
  ]

  for (const def of defs) {
    const ws = state.workflows[def.id] ?? getDefaultWorkflowState()
    lines.push(`### ${def.name} (\`${def.id}\`)`)
    lines.push(`- Schedule: ${def.schedule}`)
    lines.push(`- Status: **${ws.status}**`)
    lines.push(`- Total runs: ${ws.runCount}`)

    const pid = (ws as any).pid as number | undefined
    const mode = (ws as any).mode as string | undefined
    if (pid) {
      lines.push(`- PID: ${pid}`)
      if (mode === 'daemon') lines.push(`- Mode: daemon (long-running, polling)`)
      lines.push(`- Log: ${(ws as any).logFile ?? 'unknown'}`)
    }

    if (ws.lastRun) {
      lines.push(`- Last run: ${ws.lastRun.finishedAt ?? ws.lastRun.startedAt}`)
      lines.push(`- Last result: ${ws.lastRun.status} (${ws.lastRun.stepsCompleted}/${ws.lastRun.stepsTotal} steps)`)
      if (ws.lastRun.error) {
        lines.push(`- Last error: ${ws.lastRun.error.slice(0, 100)}`)
      }
    } else {
      lines.push(`- Last run: never`)
    }
    lines.push('')
  }

  lines.push('### Control commands')
  lines.push('```')
  lines.push('bun run workflow start --id <id>    # start in background (one-shot, non-blocking)')
  lines.push('bun run workflow daemon --id <id>   # start long-running daemon (polls every 60min)')
  lines.push('bun run workflow stop --id <id>     # stop at next checkpoint + kill process')
  lines.push('bun run workflow reset --id <id>    # clear stopped state back to idle')
  lines.push('bun run workflow run --id <id>      # run synchronously (blocking, one-shot)')
  lines.push('bun run workflow status --id <id>   # detailed status + definition')
  lines.push('bun run workflow history --id <id>  # execution history')
  lines.push('```')

  console.log(lines.join('\n'))
  process.exit(0)
}

// ── daemon (long-running polling mode) ────────────────────────────────────────
// Runs a workflow repeatedly on a fixed interval until stopped.
// Each cycle: check if stopped → run executor → wait interval → repeat.
// Dedup in the executor ensures idempotent re-runs (no duplicate posts).
//
// Usage:
//   bun run workflow daemon --id <id> [--interval <minutes>]
//   Default interval: 60 minutes
//
// Stop with: bun run workflow stop --id <id>

if (command === 'daemon') {
  const id = flags['id']
  if (!id) {
    console.error('Usage: workflow-engine.ts daemon --id <workflow-id> [--interval <minutes>]')
    process.exit(2)
  }

  const intervalMinutes = parseInt(flags['interval'] ?? '60', 10)
  if (isNaN(intervalMinutes) || intervalMinutes < 1) {
    console.error('--interval must be a positive integer (minutes)')
    process.exit(2)
  }

  const def = getWorkflowDef(id)
  if (!def) {
    console.error(`Workflow not found: ${id}`)
    process.exit(1)
  }

  const executorPath = resolve(WORKFLOWS_DIR, def.executor)
  if (!existsSync(executorPath)) {
    console.error(`Executor not found: ${executorPath}`)
    process.exit(1)
  }

  const configJson = buildConfigJson(def)
  const platform = def.platform

  console.log(`[daemon] Starting daemon for: ${def.name}`)
  console.log(`[daemon] Interval: ${intervalMinutes} minutes`)
  console.log(`[daemon] Stop with: bun run workflow stop --id ${id}`)

  // Mark as running in state
  const initState = loadState()
  if (!initState.workflows[id]) initState.workflows[id] = getDefaultWorkflowState()
  const initWs = initState.workflows[id]!
  if (initWs.status === 'running') {
    console.error(`Workflow ${id} is already running`)
    process.exit(1)
  }
  initWs.status = 'running'
  ;(initWs as any).pid = process.pid
  ;(initWs as any).mode = 'daemon'
  saveState(initState)

  let cycleCount = 0

  async function daemonLoop() {
    while (true) {
      // Check stop signal
      const currentState = loadState()
      const ws = currentState.workflows[id!]
      if (!ws || ws.status === 'stopped') {
        console.log(`[daemon] Stop signal received after ${cycleCount} cycles. Exiting.`)
        break
      }

      cycleCount++
      const now = new Date().toISOString()
      console.log(`\n[daemon] ═══ Cycle ${cycleCount} at ${now} ═══`)

      // Acquire the platform lock for THIS cycle so a same-platform run/orchestrate
      // (or another daemon) won't drive the same profile concurrently. The lock is
      // released between cycles (during the wait), so the platform is free while idle.
      // If busy, skip this cycle and retry next interval.
      if (platform && !acquireLock(platform, id!)) {
        console.log(`[daemon] Platform "${platform}" busy; skipping cycle ${cycleCount}.`)
      } else {
        try {
          // Run the executor asynchronously (spawnSync blocks event loop, breaking setTimeout)
          const startedAt = new Date().toISOString()
          let execStdout = ''
          let execExitCode: number | null = null
          try {
            const proc = Bun.spawn(['bun', 'run', executorPath, '--config', configJson], {
              cwd: ROOT,
              stdin: 'inherit',
              stdout: 'pipe',
              stderr: 'inherit',
            })
            // Set a 10-minute timeout
            const timeoutId = setTimeout(() => { proc.kill() }, 10 * 60 * 1000)
            execStdout = await new Response(proc.stdout).text()
            execExitCode = await proc.exited
            clearTimeout(timeoutId)
          } catch (e: any) {
            console.error(`[daemon] Executor error: ${e.message}`)
            execExitCode = 1
          }

          // Finalize this run in state
          const freshState = loadState()
          const freshWs = freshState.workflows[id!] ?? getDefaultWorkflowState()

          // If stopped during execution, finalize and exit
          if (freshWs.status === 'stopped') {
            console.log(`[daemon] Stopped during execution. Finalizing and exiting.`)
            finalizeRun(freshState, freshWs, execStdout, execExitCode)
            break
          }

          // Save run result but keep status as 'running' for daemon mode
          const run = finalizeRun(freshState, freshWs, execStdout, execExitCode)
          // Re-mark as running (finalizeRun sets it to idle)
          freshWs.status = 'running'
          ;(freshWs as any).pid = process.pid
          ;(freshWs as any).mode = 'daemon'
          saveState(freshState)

          console.log(`[daemon] Cycle ${cycleCount} done: ${run.status} (${run.stepsCompleted}/${run.stepsTotal} steps)`)
          console.log(`[daemon] Next cycle in ${intervalMinutes} minutes...`)
        } finally {
          if (platform) releaseLock(platform, id!)
        }
      }

      // Wait for interval, checking stop signal every 10 seconds
      const intervalMs = intervalMinutes * 60 * 1000
      const checkIntervalMs = 10_000
      let waited = 0
      while (waited < intervalMs) {
        await new Promise(r => setTimeout(r, Math.min(checkIntervalMs, intervalMs - waited)))
        waited += checkIntervalMs

        // Check stop signal during wait
        const checkState = loadState()
        const checkWs = checkState.workflows[id!]
        if (!checkWs || checkWs.status === 'stopped') {
          console.log(`[daemon] Stop signal received during wait. Exiting.`)
          // Clean up daemon metadata
          if (checkWs) {
            delete (checkWs as any).pid
            delete (checkWs as any).mode
            saveState(checkState)
          }
          return
        }
      }
    }

    // Clean up daemon metadata on normal exit
    const exitState = loadState()
    const exitWs = exitState.workflows[id!]
    if (exitWs) {
      if (exitWs.status === 'running') exitWs.status = 'idle'
      delete (exitWs as any).pid
      delete (exitWs as any).mode
      saveState(exitState)
    }
  }

  daemonLoop().catch(e => {
    console.error(`[daemon] Fatal error: ${e.message}`)
    // Clean up state on crash
    const crashState = loadState()
    const crashWs = crashState.workflows[id]
    if (crashWs) {
      crashWs.status = 'idle'
      delete (crashWs as any).pid
      delete (crashWs as any).mode
      saveState(crashState)
    }
    process.exit(1)
  })

  // Prevent immediate exit (daemon loop is async)
  // The process will exit when daemonLoop() returns or throws
}

// ── orchestrate ──────────────────────────────────────────────────────────────
// Run multiple workflows grouped by platform: SERIAL within a platform (one
// active tab per profile), PARALLEL across platforms. Aggregates a combined
// report. Interruptible: each platform queue checks the stop signal between runs.
//
// Usage: bun run workflow orchestrate --ids id1,id2,id3

if (command === 'orchestrate') {
  const idsArg = flags['ids']
  if (!idsArg) {
    console.error('Usage: workflow-engine.ts orchestrate --ids <id1,id2,...>')
    process.exit(2)
  }
  const ids = idsArg.split(',').map(s => s.trim()).filter(Boolean)
  const defs = loadWorkflowDefinitions()
  const byId = new Map(defs.map(d => [d.id, d]))

  // Group requested workflows by platform (unknown ids reported, not fatal).
  const groups = new Map<string, WorkflowDefinition[]>()
  const missing: string[] = []
  for (const id of ids) {
    const def = byId.get(id)
    if (!def) { missing.push(id); continue }
    const key = def.platform ?? '_none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(def)
  }
  for (const m of missing) console.error(`[orchestrate] Unknown workflow id: ${m}`)

  console.error(`[orchestrate] platforms: ${[...groups.keys()].join(', ')}`)

  // One serial queue per platform; run all queues in parallel.
  const results: Array<{ id: string; platform: string | null; run: WorkflowRun | null; skipped?: string }> = []
  await Promise.all(
    [...groups.entries()].map(async ([platform, list]) => {
      for (const def of list) {
        // Stop signal: a `stop --id <thisId>` flips status to 'stopped'.
        const st = loadState().workflows[def.id]
        if (st?.status === 'stopped') {
          results.push({ id: def.id, platform: def.platform ?? null, run: null, skipped: 'stopped' })
          continue
        }
        console.error(`[orchestrate] [${platform}] running ${def.id} ...`)
        results.push(await executeWorkflow(def))
      }
    }),
  )

  // Aggregate report — last stdout line is JSON for callers.
  const summary = {
    requested: ids.length,
    missing,
    results: results.map(r => ({
      id: r.id,
      platform: r.platform,
      status: r.run?.status ?? 'skipped',
      stepsCompleted: r.run?.stepsCompleted ?? 0,
      stepsTotal: r.run?.stepsTotal ?? 0,
      skipped: r.skipped,
    })),
  }
  for (const r of summary.results) {
    console.error(`[orchestrate] ${r.id} (${r.platform ?? '-'}): ${r.status}${r.skipped ? ` (${r.skipped})` : ''} ${r.stepsCompleted}/${r.stepsTotal}`)
  }
  console.log(JSON.stringify(summary))
  process.exit(summary.results.some(r => r.status === 'failed') ? 1 : 0)
}

// ── unknown ──────────────────────────────────────────────────────────────────

if (command !== 'daemon' && command !== 'orchestrate') {
  console.error(`Unknown command: ${command}. Use: list | status | start | stop | reset | run | history | summary | daemon | orchestrate`)
  process.exit(2)
}
