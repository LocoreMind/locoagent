# Multi-Platform Browser Targets & Platform-Aware Scheduling

**Date:** 2026-06-04
**Branch:** `feature/multi-platform`
**Status:** Design approved, pending implementation

## Problem

LocoAgent today runs every browser workflow against a single CDP target:
`config.ts` resolves one `debugPort` (9222) and one `workProfile`; `setup-chrome.ts`
launches one Chrome on one port with one profile; `agent-browser` is globally
pinned to 9222 via `agent-browser.json`; and `workflow-engine.ts` tracks only
per-workflow `status` with **no platform-level mutual exclusion**.

Consequently, running workflows for different platforms concurrently makes them
fight over a single active tab and share one cookie jar. There is no isolation
between X, LinkedIn, Reddit, etc.

The fix is **not** that Chrome CDP can't do multi-platform — it's that
LocoAgent's browser-target abstraction is too thin. We introduce a
**BrowserTarget** concept: each platform gets its own `cdpPort`, `profile`, and
`proxy`; multiple Chrome instances run side by side (9222/9223/9224); the
scheduler runs **same-platform workflows serially, different-platform workflows
in parallel**, coordinated by per-platform file locks.

## Goals

- Multi-Chrome / multi-CDP / multi-profile: independent port + profile + session
  per platform → cookie isolation, platform isolation.
- A single source of truth for platform → target mapping, shared by the setup
  launcher, the engine's lock manager, and config resolution.
- Platform-aware scheduling: same platform serial, different platforms parallel.
- Cross-process mutual exclusion that holds across the engine's `run`, `start`
  (detached), `daemon`, and the new `orchestrate` entry points.
- An Orchestrator that decomposes a high-level request into a set of workflow IDs,
  dispatches them grouped by platform, and aggregates a combined report.

## Non-goals

- Per-platform **LLM agent subprocesses**. A "worker" is a scripted workflow
  executor (per CLAUDE.md: workflows are pipelines, not agent loops). The LLM may
  be called as a step inside a workflow, never as the worker itself.
- Multi-target support for the **interactive agent** (`bun start`). The
  interactive agent keeps using the single default target (x/9222) via the global
  `agent-browser.json` pin. Multi-target applies to workflows.
- A Windows-only `setup-multi-chrome.ps1`. Multi-Chrome launch is implemented in
  the existing cross-platform `setup-chrome.ts` (Windows + macOS).

## Architecture

```
Orchestrator  (interactive agent, or `workflow orchestrate` command)
   │  group by platform → same-platform serial queue, cross-platform parallel
   ▼
workflow-engine  (scheduling + per-platform lock + result aggregation)
   │  acquire <platform>.lock before each executor spawn, release after
   ▼
BrowserTargetManager  (scripts/lib/browser-targets.ts)
   │  resolve registry → {cdpPort, profile, proxy, device} + CDP health check
   ▼
Multi-Chrome / multi-CDP / multi-profile  (9222/9223/9224, isolated profiles → cookie isolation)
```

### Roles

| Role | Responsibility |
|------|----------------|
| Orchestrator | Decompose intent → workflow IDs, dispatch, aggregate results |
| Workflow executor (worker) | Operate exactly one platform on its bound target |
| BrowserTargetManager | Resolve CDP port / session / profile, health check |
| Workflow Engine | Start / stop / schedule / lock / record workflows |
| Operation Log | Record per-platform actions already done (dedup) |

## Components

### 1. Central registry — `config/browser-targets.json`

Single source of truth. Read by `setup-chrome.ts`, `workflow-engine.ts`, and
`doctor.ts`.

```json
{
  "version": 1,
  "targets": {
    "x":        { "cdpPort": 9222, "profile": null, "proxy": "http://127.0.0.1:6738", "account": "mashijiann" },
    "linkedin": { "cdpPort": 9223, "profile": null, "proxy": null },
    "reddit":   { "cdpPort": 9224, "profile": null, "proxy": null }
  }
}
```

Per-entry fields:

- `cdpPort` (required) — the remote-debugging port for this platform's Chrome.
- `profile` (nullable) — explicit `--user-data-dir`. When `null`, derived as
  `defaultWorkProfile(host) + "-" + platform` (e.g. `locoagent-chrome-profile-linkedin`),
  giving each platform its own isolated profile dir → cookie/session isolation.
- `proxy` (nullable) — optional upstream proxy for that platform.
- `device` (nullable, optional) — device-emulation override; falls back to the
  host-layer default (`resolveDevice`).
- `account` (optional, informational) — the logged-in handle, for humans/logs.

**Backward compatibility:** existing users have logged into the legacy no-suffix
profile (`locoagent-chrome-profile`, 9222) for X. To avoid forcing a re-login,
the shipped registry sets `x.profile` to that **legacy no-suffix path explicitly**;
other platforms use the new suffixed dirs. (Approved.)

### 2. `BrowserTargetManager` — `scripts/lib/browser-targets.ts`

Pure, unit-testable resolution logic plus a small async health probe. Reuses the
existing host layer (`detectHost`, `defaultWorkProfile`, `resolveChromeBinary`)
and device layer (`resolveDevice`).

```ts
export interface ResolvedTarget {
  platform: string
  cdpPort: number
  profile: string      // always concrete after resolution
  proxy?: string
  device: DeviceTarget
}

// Read registry, fill defaults (profile suffix, device) from host/device layers.
export function loadTargets(env?, host?): Record<string, ResolvedTarget>

// Resolve one platform; throw a clear error on unknown platform.
export function resolveTarget(platform: string, env?, host?): ResolvedTarget

// CDP liveness probe (extracted from setup-chrome so all callers share it).
export async function cdpUp(port: number): Promise<boolean>
export async function healthCheck(platform: string): Promise<{ platform; port; profile; up: boolean }>
```

`config.ts` is retained as the single default-target fallback (host/device/chrome
binary); `browser-targets.ts` layers platform-specific resolution on top of it.
Nothing in the existing single-target path breaks.

### 3. Multi-Chrome launch — extend `setup-chrome.ts`

Registry-driven, cross-platform. Reuses the existing detached-launch
(`launchChromeDetached`), profile-isolation, CDP-ready-poll, and targeted-kill
machinery — applied per target.

- `bun run setup-chrome` (no args) → launch the **default platform** (x). Same as
  today; backward compatible.
- `bun run setup-chrome --target <platform>` → launch one registry target.
- `bun run setup-chrome --all` → launch every registry target, each on its own
  port with its own profile, detached, polling each CDP endpoint until ready.
- `--reset` combined with `--target`/`--all` → wipe only the corresponding
  profile(s); never the user's real Chrome (existing `killChromeForProfile`
  semantics, scoped per profile path).
- **agent-browser global pin** (`agent-browser.json` can hold only one `cdp`
  value) → pinned to the **default platform's port**. Workflow executors override
  it by passing `--cdp <resolvedPort>` explicitly (see §6).

### 4. Per-platform lock — `scripts/lib/platform-lock.ts`

Cross-process atomic exclusion. Lock file `workflows/.locks/<platform>.lock`
holds `{ pid, workflowId, acquiredAt }`.

```ts
export function acquireLock(platform: string, workflowId: string): boolean
export function releaseLock(platform: string, workflowId: string): void
```

- `acquireLock` creates the file with `fs.openSync(path, 'wx')` (O_EXCL — atomic
  on a single filesystem). If it already exists, read the holder's `pid` and probe
  with `process.kill(pid, 0)`:
  - holder alive → return `false` (platform busy);
  - holder dead → **steal** (remove + recreate), return `true`.
- `releaseLock` removes the file only if the recorded `pid` matches the caller
  (don't release someone else's lock).
- Always wrapped in `try/finally` at call sites so a crash still releases.
- `workflows/.locks/` is added to `.gitignore` (consistent with `state.json` and
  `.tmp/`).

**Why a file lock, not state.json:** `start` is a detached child, `daemon` is a
separate long-lived process, and `orchestrate` is yet another process. They must
coordinate through a filesystem atomic primitive; state.json's non-atomic
read-modify-write races when multiple processes start simultaneously.

### 5. Workflow definitions — add `platform`, derive `cdpPort`

Each workflow JSON gains `"platform": "x"` and **drops the hand-written
`cdpPort`/`proxy`**. Before spawning an executor, the engine calls
`resolveTarget(platform)` and **injects** `cdpPort`/`profile`/`proxy`/`device`
into the config JSON it passes to the executor. The port lives in exactly one
place — the registry.

Backward compatibility: a workflow with no `platform` field falls back to its
config's `cdpPort` (or default 9222), so existing executors keep working during
migration.

### 6. Executor contract update

(`docs/workflow-development-guide.md` and CLAUDE.md updated to match.)

- The `cdpPort` in an executor's config is **injected by the engine**; the
  executor **must** invoke agent-browser with `--cdp <cdpPort>` explicitly. The
  current X and LinkedIn executors already do
  `agent-browser --cdp ${config.cdpPort} ...` — compliant, no large change.
- Under concurrent multi-platform runs, an executor must **never** use a bare
  `agent-browser` command (it would hit the global pin's default port and grab the
  wrong tab).

### 7. Orchestrator — `workflow-engine.ts` new `orchestrate` command

```
bun run workflow orchestrate --ids x-search-reply,linkedin-search-reply,reddit-foo [--tasks persona/tasks.md]
```

- Group the requested workflows by `platform`.
- **Per platform: a serial queue** — one active tab per profile means
  same-platform workflows must run one after another.
- **Across platforms: parallel** — `Promise.all` over the per-platform queues.
- Each executor run: `acquireLock(platform)` → spawn → `finalizeRun` →
  `releaseLock` (in `finally`). The lock means a separately-started `start`/`daemon`
  for the same platform won't collide with `orchestrate`.
- Check the stop signal between steps; interruptible by `workflow stop`.
- **Aggregate:** collect each run's `WorkflowRun`, emit a combined report
  (per-platform success/partial/failed + steps) as the last stdout line (JSON) and
  persist into `state.json`.
- `run` / `start` / `daemon` are all wired through the same acquire/release pair.

**Task decomposition** lands as: mapping a high-level intent to a set of workflow
IDs (+ their platforms). The interactive agent (the "Orchestrator Agent") decides
which IDs to run and calls `workflow orchestrate`, or the command reads grouping
from `persona/tasks.md`. This is consistent with worker = workflow.

### 8. doctor + operation log

- `doctor --check-cdp` iterates every registry target and reports per-platform
  up/down (instead of probing only 9222).
- The operation log is already per-platform (`--platform` flag); no change. The
  dedup contract is unchanged — each platform workflow logs under its own platform.

## Data flow

1. Operator runs `setup-chrome --all` → N Chrome instances, one per registry
   target, each on its port + isolated profile.
2. Orchestrator (`workflow orchestrate --ids ...`) groups workflow IDs by platform.
3. For each platform queue (parallel across platforms, serial within):
   a. `acquireLock(platform)` (wait/skip if busy).
   b. `resolveTarget(platform)` → inject `cdpPort/profile/proxy/device` into config.
   c. Spawn executor; executor drives `agent-browser --cdp <port>` on its target.
   d. Executor emits final-line JSON `{stepsCompleted, stepsTotal, ...}`.
   e. `finalizeRun` records result; `releaseLock` in `finally`.
4. Orchestrator aggregates per-platform results → combined report → `state.json`.

## Error handling

| Scenario | Behavior |
|----------|----------|
| Unknown platform | fail-fast with a message naming the missing registry entry |
| Platform CDP down | that platform's queue fails fast ("run setup-chrome --target <p>"); other platforms keep running |
| Lock held by live process | orchestrate queues/waits within the platform; standalone `start` reports "platform busy" |
| Stale lock (dead pid) | auto-steal and proceed |
| Crash during run | `finally` runs `finalizeRun` + `releaseLock` |

## Testing

- **Unit** (`bun test scripts`, matching the existing `scripts/lib/*.test.ts`
  pattern):
  - registry parsing + default resolution (profile suffix derivation, device
    fallback, proxy passthrough);
  - legacy `x.profile` no-suffix override is honored;
  - `platform-lock` acquire / steal-dead-pid / release-only-if-owned.
- **Manual smoke:**
  - `setup-chrome --all` brings up all targets; `doctor --check-cdp` reports each;
  - `orchestrate` with X + LinkedIn → verify cross-platform parallel;
  - two X workflows → verify same-platform serial; inspect `workflows/.locks/`.
- **Typecheck:** `bun run typecheck` gated on error-count delta (baseline ~5199
  pre-existing `src/` errors; do not gate on exit code).

## Migration / rollout

1. Add registry with `x` pointing at the legacy no-suffix profile (no re-login).
2. Add `browser-targets.ts`, `platform-lock.ts`, `.gitignore` entry for `.locks/`.
3. Extend `setup-chrome.ts` (`--target`/`--all`) and `doctor` (`--check-cdp` all).
4. Add `platform` to each workflow JSON; remove hard-coded `cdpPort`/`proxy`.
5. Add `orchestrate` to `workflow-engine.ts`; wire lock into `run`/`start`/`daemon`.
6. Update `docs/workflow-development-guide.md` and CLAUDE.md executor contract.
7. For new platforms (LinkedIn/Reddit), log into each isolated profile once via
   `setup-chrome --target <platform>`.
