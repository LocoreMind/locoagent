# LocoAgent Workflow Development Guide

A guide for LocoAgent developers on creating, testing, and deploying custom Workflows.

---

## Table of Contents

- [1. What is a Workflow](#1-what-is-a-workflow)
- [2. Architecture](#2-architecture)
- [Browser Targets (Multi-Platform)](#browser-targets-multi-platform)
- [3. Creating a Workflow Step by Step](#3-creating-a-workflow-step-by-step)
  - [3.1 Step 1: Write the Workflow Definition](#31-step-1-write-the-workflow-definition)
  - [3.2 Step 2: Write the Executor Script](#32-step-2-write-the-executor-script)
  - [3.3 Step 3: Test and Run](#33-step-3-test-and-run)
- [4. Workflow Definition Specification](#4-workflow-definition-specification)
- [5. Executor Development Guide](#5-executor-development-guide)
  - [5.1 Executor Contract](#51-executor-contract)
  - [5.2 Browser Automation with agent-browser](#52-browser-automation-with-agent-browser)
  - [5.3 Checkpoint Protocol (Stoppable Workflows)](#53-checkpoint-protocol-stoppable-workflows)
  - [5.4 Deduplication Pattern](#54-deduplication-pattern)
  - [5.5 Integrating External LLM APIs](#55-integrating-external-llm-apis)
- [6. Workflow Engine CLI Reference](#6-workflow-engine-cli-reference)
- [7. Execution Modes](#7-execution-modes)
- [8. State Model](#8-state-model)
- [9. Agent Integration](#9-agent-integration)
- [10. Existing Workflow Reference](#10-existing-workflow-reference)
- [11. FAQ](#11-faq)

---

## 1. What is a Workflow

A Workflow is a **scripted automation pipeline** in LocoAgent. Unlike agent-driven conversations where the LLM decides what to do next in an agentic loop, Workflows follow a **predefined sequence of steps** — the control flow is deterministic even if individual steps may involve LLM calls or agent operations.

A Workflow can include:
- Browser automation steps (via `agent-browser`)
- LLM API calls (e.g., calling DeepSeek to generate a reply)
- Agent sub-tasks (delegating part of the pipeline to an agent)
- Pure data processing (file I/O, API calls, scraping, etc.)

The key distinction is **who controls the flow**: in a Workflow, the executor script drives the pipeline; in an agent session, the LLM decides the next action. Workflows are code-driven pipelines that may use LLMs as tools within their steps.

**Key advantages:**
- Predictable execution — follows a fixed pipeline, no LLM decision variance
- Cost-efficient — LLM calls are targeted and minimal (only where needed)
- Idempotent — built-in dedup mechanisms make repeated runs safe
- Interruptible — checkpoint protocol allows graceful stopping at any time

---

## 2. Architecture

```
workflows/<id>.json              ← Workflow definition (config, schedule, executor path)
  ↓ (read by)
scripts/workflow-engine.ts       ← Lifecycle CLI (start/stop/reset/run/status/history/summary)
  ↓ (spawns)
workflows/executors/<script>.ts  ← Executor: pure automation, outputs JSON summary to stdout
  ↓ (results saved to)
workflows/state.json             ← Persistent state (status, lastRun, history[])
  ↓ (read at startup by)
getWorkflowStatusSection()       ← src/constants/prompts.ts → injected into system prompt
```

**File structure:**

```
workflows/
├── hf-daily-papers.json         # Workflow definition
├── hf-papers-to-x.json          # Workflow definition
├── x-search-reply.json          # Workflow definition
├── state.json                   # Persistent state (gitignored)
├── executors/
│   ├── hf-daily-papers.ts       # Executor: fetch HuggingFace papers
│   ├── hf-papers-to-x.ts        # Executor: fetch + post to X.com
│   ├── post-hf-paper.ts         # Executor: post a single paper tweet
│   └── x-search-reply.ts        # Executor: search + AI reply
└── .tmp/                        # Runtime data (thumbnails, papers.json, etc.)
    ├── posted-papers.json       # Global dedup store: posted papers
    └── replied-posts.json       # Global dedup store: replied posts
```

---

## Browser Targets (Multi-Platform)

`config/browser-targets.json` maps each platform to its browser instance: `{cdpPort, profile, proxy, device}`. This is the single source of truth for `setup-chrome`, the workflow engine's target injection, and `doctor --check-cdp`.

- **Launching instances:** `bun run setup-chrome --all` starts every registered target; `bun run setup-chrome --target <platform>` starts one. Each platform gets its own port and isolated profile, giving full cookie isolation between accounts.
- **Binding a workflow to a target:** set `"platform": "<name>"` in the workflow JSON. The engine reads the registry and injects `cdpPort`, `profile`, `proxy`, and `device` into the executor's config automatically. Do **not** hard-code `cdpPort` in the workflow JSON.
- **Running multiple platforms together:** `bun run workflow orchestrate --ids x-search-reply,linkedin-search-reply` groups workflows by platform — same-platform workflows run serially (one active tab per profile); different platforms run in parallel. Per-platform file locks in `workflows/.locks/<platform>.lock` coordinate `run`, `start`, `daemon`, and `orchestrate` across processes.

---

## 3. Creating a Workflow Step by Step

### 3.1 Step 1: Write the Workflow Definition

Create `<your-id>.json` in `workflows/`:

```json
{
  "id": "my-workflow",
  "name": "My Custom Workflow",
  "description": "Describe what this workflow does",
  "schedule": "daily",
  "platform": "x",
  "executor": "executors/my-workflow.ts",
  "config": {
    "param1": "value1",
    "param2": 42
  }
}
```

Once created, the workflow automatically appears in `workflow list` and the system prompt summary.

### 3.2 Step 2: Write the Executor Script

Create `my-workflow.ts` in `workflows/executors/`:

```typescript
#!/usr/bin/env bun
/**
 * my-workflow.ts
 * Description of your workflow.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

// ── Parse config ─────────────────────────────────────────────────────────────

interface Config {
  param1: string
  param2: number
  cdpPort: number
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
if (!configArg) {
  console.error('Missing --config argument')
  process.exit(2)
}
const config: Config = JSON.parse(configArg)

// ── agent-browser helper ─────────────────────────────────────────────────────

function ab(cmd: string): string {
  try {
    return execSync(`agent-browser --cdp ${config.cdpPort} ${cmd}`, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: ROOT,
    }).trim()
  } catch (e: any) {
    console.error(`[ab] Failed: ${cmd}`)
    console.error(e.stderr?.slice(0, 200) || e.message)
    return ''
  }
}

// ── Logging helper ───────────────────────────────────────────────────────────

function log(msg: string): void {
  // Logs go to stderr (visible during execution, does not affect JSON summary)
  console.error(`[my-workflow] ${msg}`)
}

// ── Checkpoint check (optional, enables stop command support) ─────────────────

function isWorkflowStopped(): boolean {
  try {
    const statePath = resolve(ROOT, 'workflows/state.json')
    const state = JSON.parse(readFileSync(statePath, 'utf-8'))
    return state.workflows?.['my-workflow']?.status === 'stopped'
  } catch {
    return false
  }
}

// ── Step tracking ────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3
let completedSteps = 0

// ── Step 1 ───────────────────────────────────────────────────────────────────

log('Step 1/3: ...')
// ... your business logic
completedSteps++

// ── Checkpoint ──
if (isWorkflowStopped()) {
  log('Workflow stopped by user.')
  console.log(JSON.stringify({ stepsCompleted: completedSteps, stepsTotal: TOTAL_STEPS }))
  process.exit(0)
}

// ── Step 2 ───────────────────────────────────────────────────────────────────

log('Step 2/3: ...')
// ... your business logic
completedSteps++

// ── Step 3 ───────────────────────────────────────────────────────────────────

log('Step 3/3: ...')
// ... your business logic
completedSteps++

// ── Output final JSON summary (must be the last line on stdout) ──────────────

console.log(JSON.stringify({
  stepsCompleted: completedSteps,
  stepsTotal: TOTAL_STEPS,
  // you can add any additional fields
}))
```

### 3.3 Step 3: Test and Run

```bash
# Synchronous run (blocking, see output in real-time) — recommended during development
bun run workflow run --id my-workflow

# Check status
bun run workflow status --id my-workflow

# Background run (non-blocking)
bun run workflow start --id my-workflow

# Daemon mode (poll every 30 minutes)
bun run workflow daemon --id my-workflow --interval 30

# Stop
bun run workflow stop --id my-workflow

# Reset (stopped → idle)
bun run workflow reset --id my-workflow
```

---

## 4. Workflow Definition Specification

Each Workflow definition is a JSON file in `workflows/` (excluding `state.json`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier, used as the `--id` argument |
| `name` | string | Yes | Human-readable name |
| `description` | string | Yes | What the workflow does |
| `schedule` | string | Yes | Intended frequency (`daily`, `hourly`, `weekly`, etc.) — informational only, not auto-scheduled |
| `executor` | string | Yes | Executor script path, relative to `workflows/` |
| `config` | object | Yes | Arbitrary config object, passed to executor as `--config` JSON |

**Example references — existing definitions:**

```json
// hf-daily-papers.json — data fetching type
{
  "id": "hf-daily-papers",
  "name": "HuggingFace Daily Papers",
  "description": "Fetch today's top papers from HuggingFace...",
  "schedule": "daily",
  "platform": "x",
  "executor": "executors/hf-daily-papers.ts",
  "config": {
    "maxPapers": 3,
    "minUpvotes": 5,
    "abstractMaxChars": 200,
    "downloadThumbnails": true,
    "saveDataJson": true,
    "outputDir": ".tmp"
  }
}
```

```json
// x-search-reply.json — search + AI reply type
{
  "id": "x-search-reply",
  "name": "X.com Search & AI Reply",
  "description": "Search X.com for a keyword..., generate a reply using DeepSeek...",
  "schedule": "hourly",
  "platform": "x",
  "executor": "executors/x-search-reply.ts",
  "config": {
    "searchQuery": "ai agent",
    "maxPosts": 5,
    "xUsername": "mashijiann",
    "outputDir": ".tmp",
    "replySystemPrompt": "You are a knowledgeable AI enthusiast..."
  }
}
```

---

## 5. Executor Development Guide

### 5.1 Executor Contract

Executor scripts must satisfy the following contract:

| Requirement | Details |
|-------------|---------|
| **Accept `--config <json>`** | Parse config from CLI argument |
| **Log to stderr** | Use `console.error()` for logs (visible during execution) |
| **JSON summary to stdout** | Last line must be a JSON object via `console.log()` |
| **Include step counts in JSON** | Must contain `stepsCompleted` and `stepsTotal` fields |
| **Use `--cdp <config.cdpPort>`** | `cdpPort` (plus `profile`, `proxy`, `device`) is injected by the engine from `config/browser-targets.json` based on the workflow's `platform` field. Always call agent-browser with `--cdp <config.cdpPort>` — never a bare `agent-browser` command, which would hit the global default port and grab the wrong tab during concurrent multi-platform runs. Do **not** hard-code `cdpPort` in the workflow JSON; set `"platform"` instead. |

**JSON summary format:**

```typescript
{
  stepsCompleted: number,    // number of completed steps
  stepsTotal: number,        // total number of steps
  // ...any additional fields
}
```

**Critical rule: `console.error()` for logs, `console.log()` only for the final JSON summary.** The workflow-engine parses the last line of stdout as the result.

**Config parsing pattern:**

```typescript
const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
if (!configArg) {
  console.error('Missing --config argument')
  process.exit(2)
}
const config: Config = JSON.parse(configArg)
```

### 5.2 Browser Automation with agent-browser

Executors control the browser via the `agent-browser` CLI. Requires running `bun run setup-chrome` first to launch a CDP-connected Chrome instance.

**Standard helper functions:**

```typescript
// Basic command execution
function ab(cmd: string): string {
  try {
    return execSync(`agent-browser --cdp ${config.cdpPort} ${cmd}`, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: ROOT,
    }).trim()
  } catch (e: any) {
    console.error(`[ab] Failed: ${cmd}`)
    return ''
  }
}

// JavaScript evaluation (avoids shell escaping issues)
function abEval(js: string): string {
  const tmpJs = resolve(OUTPUT_DIR, '.eval-tmp.js')
  writeFileSync(tmpJs, js, 'utf-8')
  try {
    let result = execSync(
      `agent-browser --cdp ${config.cdpPort} eval "$(cat '${tmpJs}')"`,
      { encoding: 'utf-8', timeout: 30000, cwd: ROOT }
    ).trim()
    if (result.startsWith('"') && result.endsWith('"')) {
      try { result = JSON.parse(result) } catch (_) {}
    }
    return result
  } catch (e: any) {
    return ''
  }
}
```

**Common agent-browser commands:**

```bash
agent-browser open <url>                    # Navigate to URL
agent-browser snapshot -i                   # Get interactive elements with @ref IDs
agent-browser snapshot -i -c -s 'article'   # With content, scoped to selector
agent-browser click @e5                     # Click an element
agent-browser fill @e3 "text"               # Fill in text
agent-browser upload 'input[type="file"]' "path"  # Upload a file
agent-browser screenshot result.png         # Take screenshot
agent-browser wait 2000                     # Wait milliseconds
agent-browser get url                       # Get current URL
agent-browser eval "document.title"         # Execute JavaScript
```

### 5.3 Checkpoint Protocol (Stoppable Workflows)

To support graceful stopping via `workflow stop`, implement checkpoint checks in your executor:

```typescript
function isWorkflowStopped(): boolean {
  try {
    const statePath = resolve(ROOT, 'workflows/state.json')
    const state = JSON.parse(readFileSync(statePath, 'utf-8'))
    return state.workflows?.['<your-workflow-id>']?.status === 'stopped'
  } catch {
    return false
  }
}
```

**Where to place checkpoints:**
- Between processing individual items (e.g., between papers, between posts)
- Before expensive network operations
- **Never** in the middle of an atomic operation (e.g., not between uploading an image and clicking Post)

```typescript
for (const item of items) {
  // Checkpoint: check if stop was requested
  if (isWorkflowStopped()) {
    log('Workflow stopped by user')
    break
  }

  // Process this item (atomic operation, do not interrupt)
  await processItem(item)
}
```

### 5.4 Deduplication Pattern

For workflows that run repeatedly (especially in daemon mode), implement deduplication to ensure idempotency.

**Recommended pattern: JSON file store + Set lookup**

```typescript
interface DedupStore {
  version: number
  items: Array<{
    id: string          // unique identifier
    processedAt: string // processing timestamp
    // ...additional fields
  }>
}

const DEDUP_PATH = resolve(ROOT, 'workflows/.tmp/my-dedup.json')

function loadDedup(): Set<string> {
  if (!existsSync(DEDUP_PATH)) return new Set()
  const store: DedupStore = JSON.parse(readFileSync(DEDUP_PATH, 'utf-8'))
  return new Set(store.items.map(i => i.id))
}

function saveDedup(id: string, extra?: Record<string, unknown>): void {
  let store: DedupStore = existsSync(DEDUP_PATH)
    ? JSON.parse(readFileSync(DEDUP_PATH, 'utf-8'))
    : { version: 1, items: [] }
  store.items.push({ id, processedAt: new Date().toISOString(), ...extra })
  writeFileSync(DEDUP_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

// Usage
const processed = loadDedup()
for (const item of items) {
  if (processed.has(item.id)) {
    log(`Skipped (already processed): ${item.id}`)
    continue
  }
  // Process item ...
  saveDedup(item.id)  // Save immediately after each success to preserve progress on crash
}
```

**Key: call `saveDedup()` immediately after each successfully processed item** — this ensures progress is preserved even if the process crashes mid-run.

### 5.5 Integrating External LLM APIs

Some workflow steps may call an LLM for content generation (e.g., `x-search-reply` uses DeepSeek to generate replies). The LLM is used as a tool within the pipeline — the executor script controls when and how the LLM is called, not the other way around.

```typescript
// Read API config from .env
const API_KEY = process.env.OPENAI_API_KEY
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.OPENAI_MODEL || 'deepseek-v4-flash'

async function generateReply(postContent: string, systemPrompt: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: postContent },
      ],
      temperature: 0.8,
      max_tokens: 200,
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}
```

---

## 6. Workflow Engine CLI Reference

Invoked via `bun run workflow <command>` or `bun run scripts/workflow-engine.ts <command>`.

| Command | Usage | Description |
|---------|-------|-------------|
| `list` | `bun run workflow list` | List all workflows with status (JSON output) |
| `status` | `bun run workflow status [--id <id>]` | Detailed status for one or all workflows |
| `run` | `bun run workflow run --id <id>` | Execute synchronously (blocking, until completion) |
| `start` | `bun run workflow start --id <id>` | Start in background (non-blocking, one-shot) |
| `daemon` | `bun run workflow daemon --id <id> [--interval <min>]` | Long-running daemon, polls at interval (default 60 min) |
| `stop` | `bun run workflow stop --id <id>` | Stop at next checkpoint + kill process |
| `reset` | `bun run workflow reset --id <id>` | Reset stopped state back to idle |
| `history` | `bun run workflow history --id <id>` | Show execution history (up to 30 entries) |
| `summary` | `bun run workflow summary` | Compact summary for system prompt injection |

**`package.json` shortcuts:**

```bash
bun run workflow          # equivalent to bun run scripts/workflow-engine.ts
bun run workflow:list     # list
bun run workflow:status   # status
bun run workflow:summary  # summary
bun run workflow:run      # run
bun run workflow:daemon   # daemon
```

---

## 7. Execution Modes

### `run` — Synchronous Blocking

- Uses `spawnSync` to execute the executor
- Parent process blocks until completion
- Best for development, debugging, and manual triggers
- 10-minute timeout

### `start` — Background One-Shot

- Spawns `workflow-engine.ts run` as a detached child process
- Parent returns immediately, prints PID
- Logs written to `workflows/.tmp/<id>.log`
- Process exits automatically when executor finishes

### `daemon` — Long-Running Polling

- Runs executor repeatedly in a `while(true)` loop
- Each cycle: check stop signal → run executor → wait interval → repeat
- Checks stop signal every 10 seconds during the wait interval
- Combined with dedup, safe to run at high frequency

**Typical daemon usage:**

```bash
# Run daemon in foreground (Ctrl+C to stop)
bun run workflow daemon --id my-workflow --interval 30

# Run daemon in background
nohup bun run workflow:daemon --id my-workflow --interval 60 \
  > workflows/.tmp/my-workflow-daemon.log 2>&1 &

# Stop daemon (takes effect within 10 seconds)
bun run workflow stop --id my-workflow

# Reset before restarting
bun run workflow reset --id my-workflow
```

---

## 8. State Model

`workflows/state.json` persists per-workflow state:

```typescript
interface WorkflowState {
  status: 'idle' | 'running' | 'stopped'
  lastRun: {
    startedAt: string         // ISO timestamp
    finishedAt: string | null
    status: 'success' | 'failed' | 'partial'
    stepsCompleted: number
    stepsTotal: number
    error?: string
    output?: Record<string, unknown>  // full executor JSON output
  } | null
  runCount: number
  history: WorkflowRun[]      // last 30 run records
}
```

**State transitions:**

```
idle ──(run/start/daemon)──→ running
running ──(executor completes)──→ idle
running ──(stop command)──→ stopped
stopped ──(reset command)──→ idle
```

**Daemon mode additional metadata:**

| Field | Description |
|-------|-------------|
| `pid` | Background process PID |
| `mode` | `'daemon'` (daemon mode only) |
| `logFile` | Background log file path |

---

## 9. Agent Integration

Workflows integrate with the agent through three mechanisms:

### 9.1 System Prompt Injection

On every agent session start, `getWorkflowStatusSection()` (`src/constants/prompts.ts:311`) executes `workflow-engine.ts summary` and injects the result into the static region of the system prompt. The agent sees all workflow statuses before handling the first message.

### 9.2 Task Session Auto-Run

`scripts/run-tasks.ts` automatically runs all `schedule: "daily"` workflows before the daily task session starts. Skip conditions: already ran today, currently running, or stopped.

### 9.3 Interactive Control

The agent can execute workflow commands via the Bash tool during a conversation:

- User says "post today's HuggingFace papers" → Agent runs `bun run workflow run --id hf-papers-to-x`
- User says "stop the paper posting" → Agent runs `bun run workflow stop --id hf-papers-to-x`
- User asks "did today's papers get posted?" → Agent reads the workflow status from its system prompt

---

## 10. Existing Workflow Reference

| Workflow | ID | Type | Description |
|----------|----|------|-------------|
| HuggingFace Daily Papers | `hf-daily-papers` | Data fetching | Fetch paper list, abstracts, thumbnails; save as local data files |
| HuggingFace → X.com Pipeline | `hf-papers-to-x` | End-to-end publishing | Fetch HF papers → download thumbnails → post as image+text tweets to X.com |
| X.com Search & AI Reply | `x-search-reply` | Search + reply | Search X.com → read posts → generate AI reply via DeepSeek → post reply |
| Post Single Paper | — | Standalone script | Post a single paper to X.com (CLI args, not managed by workflow-engine) |

**Recommended learning order by complexity:**

1. `hf-daily-papers.ts` — Simplest; pure data fetching, no publishing
2. `hf-papers-to-x.ts` — Medium; includes publishing, dedup, self-reply pattern
3. `x-search-reply.ts` — Most complex; search + LLM integration + reply publishing + daemon dedup

---

## 11. FAQ

### Q: Does the workflow auto-run based on the schedule field?

No. The `schedule` field is informational only. Actual scheduling requires manual runs, `daemon` mode, or automatic triggering via `run-tasks.ts` in task sessions.

### Q: State shows `running` but the process is gone. What do I do?

Run `bun run workflow stop --id <id>` then `bun run workflow reset --id <id>`.

### Q: Can executors be written in Python or other languages?

Yes, as long as they satisfy the executor contract (accept `--config`, log to stderr, output JSON as the last stdout line). The workflow-engine runs them via `bun run <script>`, but you can call any command from within your executor. TypeScript is recommended for consistency.

### Q: Can I create a workflow without browser automation?

Yes. `agent-browser` is not required. You can create workflows with pure API calls, file processing, or any other automation. Just follow the executor contract.

### Q: How do I add error retry to a workflow?

Implement retry logic within your executor. Combined with the checkpoint + dedup pattern, re-running `bun run workflow run` after a failure will resume from where it left off (already-completed items are skipped via dedup).

### Q: How does daemon mode avoid duplicate processing?

Each workflow should maintain its own dedup store (see section 5.4). At the start of each cycle, load the set of already-processed records and only process new items.
