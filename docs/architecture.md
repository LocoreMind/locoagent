# LocoAgent - Architecture Documentation

A comprehensive architecture analysis of LocoAgent, an AI-powered social media agent built on top of a privacy-focused Claude Code fork.

## Project Overview

- **Language:** TypeScript (TSX)
- **Runtime:** Bun
- **UI Framework:** React + Ink (terminal rendering)
- **CLI Framework:** Commander.js
- **Source Files:** ~1,962 files
- **Lines of Code:** ~374,000 lines
- **Dependencies:** 84 packages
- **Project Scale:** Large

---

## Table of Contents

- [0. Quick Start for Developers](#0-quick-start-for-developers)
  - [0.1 Prerequisites](#01-prerequisites)
  - [0.2 Install and Run](#02-install-and-run)
  - [0.3 Project Structure](#03-project-structure)
  - [0.4 Build-time Configuration](#04-build-time-configuration)
  - [0.5 Feature Flags](#05-feature-flags)
  - [0.6 Key Environment Variables](#06-key-environment-variables)
- [1. Entry Point and Startup Flow](#1-entry-point-and-startup-flow)
  - [1.1 Overall Call Chain](#11-overall-call-chain)
  - [1.2 Layer 1: cli.tsx - Route Dispatcher](#12-layer-1-clitsx---route-dispatcher)
  - [1.3 Layer 2: main.tsx - Core Orchestrator](#13-layer-2-maintsx---core-orchestrator)
  - [1.4 Layer 3: init.ts - Low-level Initialization](#14-layer-3-initts---low-level-initialization)
  - [1.5 Layer 4: setup.ts - Session-level Initialization](#15-layer-4-setupts---session-level-initialization)
  - [1.6 Layer 5: replLauncher.tsx - UI Rendering](#16-layer-5-replaunchertsx---ui-rendering)
  - [1.7 Key Findings for Secondary Development](#17-key-findings-for-secondary-development)
- [2. Core Architecture Skeleton](#2-core-architecture-skeleton)
  - [2.1 Services Layer (API & Model Interaction)](#21-services-layer-api--model-interaction)
  - [2.2 Tools System](#22-tools-system)
  - [2.3 Query & Conversation Processing](#23-query--conversation-processing)
  - [2.4 Context Management](#24-context-management)
  - [2.5 Commands System (Slash Commands)](#25-commands-system-slash-commands)
  - [2.6 Data Flow Summary](#26-data-flow-summary)
  - [2.7 Key Findings for Secondary Development](#27-key-findings-for-secondary-development)
- [3. UI Layer](#3-ui-layer)
  - [3.1 Architecture Overview](#31-architecture-overview)
  - [3.2 Ink Engine (Custom Fork)](#32-ink-engine-custom-fork)
  - [3.3 Design System](#33-design-system)
  - [3.4 App Component and State Management](#34-app-component-and-state-management)
  - [3.5 Screens](#35-screens)
  - [3.6 Components (130+)](#36-components-130)
  - [3.7 Hooks (80+)](#37-hooks-80)
  - [3.8 Key Findings for Secondary Development](#38-key-findings-for-secondary-development)
- [4. Extension Subsystems](#4-extension-subsystems)
  - [4.1 Skills System](#41-skills-system)
  - [4.2 Hooks System](#42-hooks-system)
  - [4.3 MCP (Model Context Protocol)](#43-mcp-model-context-protocol)
  - [4.4 Plugins System](#44-plugins-system)
  - [4.5 Vim Mode](#45-vim-mode)
  - [4.6 Voice](#46-voice)
  - [4.7 Remote & Bridge](#47-remote--bridge)
  - [4.8 Key Findings for Secondary Development](#48-key-findings-for-secondary-development)
- [5. Common Modification Recipes](#5-common-modification-recipes)
  - [5.1 Add a New Model Provider](#51-add-a-new-model-provider)
  - [5.2 Add a New Tool](#52-add-a-new-tool)
  - [5.3 Add a New Skill](#53-add-a-new-skill)
  - [5.4 Add a New Slash Command](#54-add-a-new-slash-command)
  - [5.5 Enable a Feature Flag](#55-enable-a-feature-flag)
  - [5.6 LocoAgent: agent-browser Integration](#56-locoagent-agent-browser-integration)
  - [5.7 LocoAgent: Chrome CDP Pre-launch Setup](#57-locoagent-chrome-cdp-pre-launch-setup)
  - [5.8 LocoAgent: Digital Persona System](#58-locoagent-digital-persona-system)
  - [5.9 LocoAgent: Operation Log & State](#59-locoagent-operation-log--state)
  - [5.10 LocoAgent: Task Scheduling](#510-locoagent-task-scheduling)
  - [5.11 LocoAgent: Realtime Trajectory Monitor](#511-locoagent-realtime-trajectory-monitor)
  - [5.12 LocoAgent: Workflow Automation System](#512-locoagent-workflow-automation-system)
- [6. Deep Dive: query.ts — The Agentic Loop Engine](#6-deep-dive-queryts--the-agentic-loop-engine)
  - [6.1 Architecture Overview](#61-architecture-overview)
  - [6.2 Key Types](#62-key-types)
  - [6.3 The While Loop: Iteration-by-Iteration Walkthrough](#63-the-while-loop-iteration-by-iteration-walkthrough)
  - [6.4 Control Flow Diagram](#64-control-flow-diagram)
  - [6.5 The Error Recovery State Machine](#65-the-error-recovery-state-machine)
  - [6.6 Concurrency & Async Patterns](#66-concurrency--async-patterns)
  - [6.7 Feature Flag Impact Map](#67-feature-flag-impact-map)
  - [6.8 Key Findings for Secondary Development](#68-key-findings-for-secondary-development)
- [7. Deep Dive: main.tsx — The Core Orchestrator](#7-deep-dive-maintsx--the-core-orchestrator)
  - [7.1 Architecture Overview](#71-architecture-overview)
  - [7.2 File Structure Map](#72-file-structure-map)
  - [7.3 The Startup Pipeline: Step by Step](#73-the-startup-pipeline-step-by-step)
  - [7.4 The Action Handler: The 2800-Line Decision Tree](#74-the-action-handler-the-2800-line-decision-tree)
  - [7.5 AppState Construction](#75-appstate-construction)
  - [7.6 Session Launch Paths — The Terminal Branching Tree](#76-session-launch-paths--the-terminal-branching-tree)
  - [7.7 Subcommand Registration](#77-subcommand-registration)
  - [7.8 Concurrency & Async Patterns](#78-concurrency--async-patterns)
  - [7.9 Feature Flag Impact Map](#79-feature-flag-impact-map)
  - [7.10 Key Findings for Secondary Development](#710-key-findings-for-secondary-development)
- [8. REPL.tsx Deep Dive — The UI Heart (5005 Lines)](#8-repltsx-deep-dive--the-ui-heart-5005-lines)
  - [8.1 Architecture Overview](#81-architecture-overview)
  - [8.2 Props Interface & State Model](#82-props-interface--state-model)
  - [8.3 The Render Pipeline & Dialog Focus System](#83-the-render-pipeline--dialog-focus-system)
  - [8.4 Input Processing & Command Handling](#84-input-processing--command-handling)
  - [8.5 The Query Lifecycle in REPL](#85-the-query-lifecycle-in-repl)
  - [8.6 Side Effects & Integration Hooks](#86-side-effects--integration-hooks)
  - [8.7 Feature Flags in REPL & Secondary Development Guide](#87-feature-flags-in-repl--secondary-development-guide)
  - [8.8 Key Architectural Insights for Secondary Development](#88-key-architectural-insights-for-secondary-development)

---

## 0. Quick Start for Developers

### 0.1 Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Bun** | Latest | Runtime and package manager. Install: `curl -fsSL https://bun.sh/install \| bash` |
| **Node.js** | >= 18 | Required by some dependencies, checked at startup |
| **Git** | Any | For git status context and version control features |

### 0.2 Install and Run

```bash
# 1. Install dependencies
cd locoagent
bun install

# 2. Run the CLI
bun run start

# 3. Or run directly
bun run --preload ./stubs/globals.ts ./src/entrypoints/cli.tsx

# 4. Type check (no emit)
bun run typecheck
```

**Authentication / Configuration:** Create a `.env` file in the project root — it is automatically loaded at startup via `stubs/globals.ts` preload. No need to export variables in the shell.

```env
# Option A: OpenRouter (any model)
CLAUDE_CODE_USE_OPENAI=1
SKIP_PERMISSIONS=1
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-sonnet-4.5

# Option B: DeepSeek direct (thinking mode supported)
CLAUDE_CODE_USE_OPENAI=1
SKIP_PERMISSIONS=1
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
```

`SKIP_PERMISSIONS=1` bypasses all tool permission prompts — required for non-interactive `--print` mode (e.g. automated LocoAgent tasks). Remove or set to `0` to restore interactive confirmation.

For direct Anthropic API access, set `ANTHROPIC_API_KEY` instead (and omit `CLAUDE_CODE_USE_OPENAI`).

**Note on DeepSeek thinking models:** `deepseek-v4-flash` and similar models that return `reasoning_content` are fully supported. The `openaiShim.ts` correctly handles thinking + tool_use streaming (see section 2.1.2 and 2.1.4 for details).

### 0.3 Project Structure

```
locoagent/
├── src/
│   ├── entrypoints/         # Entry points (cli.tsx, init.ts, SDK)
│   ├── main.tsx             # Core orchestrator (785KB)
│   ├── setup.ts             # Session initialization
│   ├── query.ts             # Agentic query loop
│   ├── context.ts           # Prompt context (CLAUDE.md, git status)
│   ├── Tool.ts              # Tool interface definition
│   ├── tools.ts             # Tool registry
│   ├── tools/               # Tool implementations (43 tools)
│   ├── commands.ts          # Command registry
│   ├── commands/            # Slash command implementations (90+)
│   ├── services/            # API, MCP, plugins, compaction, voice
│   │   ├── api/             # Model API layer (claude.ts, openaiShim.ts, client.ts)
│   │   ├── mcp/             # MCP server management
│   │   ├── plugins/         # Plugin operations
│   │   ├── compact/         # Conversation compaction
│   │   └── tools/           # Tool orchestration
│   ├── components/          # React/Ink UI components (130+)
│   ├── screens/             # Screen components (REPL, Doctor, Resume)
│   ├── ink/                 # Custom Ink fork (terminal renderer)
│   ├── ink.ts               # Ink public API (always import from here)
│   ├── state/               # AppState management
│   ├── context/             # React context providers
│   ├── hooks/               # React hooks (80+)
│   ├── skills/              # Skills system (bundled + loader)
│   ├── plugins/             # Built-in plugins
│   ├── vim/                 # Vim mode state machine
│   ├── remote/              # Remote session management
│   ├── ssh/                 # SSH sessions
│   ├── bridge/              # Bridge to Claude.ai
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Utilities (hooks, permissions, settings, etc.)
│   ├── constants/           # Constants and prompts
│   └── _stubs/              # Build-time stubs (feature flags)
├── stubs/                   # Runtime stubs
│   ├── globals.ts           # MACRO definitions + .env auto-loader (preloaded by Bun)
│   ├── macro.d.ts           # MACRO type declarations
│   ├── @ant/               # Stub packages for internal Anthropic modules
│   └── @anthropic-ai/      # Stub packages for SDK modules
├── .env                     # Local environment config (auto-loaded, not committed)
├── docs/
│   ├── architecture.md      # This file
│   ├── agent-browser-help.txt  # Full agent-browser CLI reference
│   └── msj-cv.html          # Source CV used to generate the persona
├── persona/
│   ├── persona.md           # Digital persona document (editable, auto-loaded into system prompt)
│   ├── tasks.md             # Task schedule: daily/weekly tasks + session constraints (editable)
│   └── operation-log.json   # Social agent state: every action logged here for dedup + history
├── scripts/
│   ├── setup-chrome.sh      # Chrome CDP pre-launch setup script
│   ├── log-operation.ts     # Operation log CLI helper (add / check / recent / summary)
│   ├── run-tasks.ts         # Task runner: reads tasks.md and executes daily/weekly session
│   └── workflow-engine.ts   # Workflow lifecycle manager (list/start/stop/reset/run/history/summary)
├── workflows/
│   ├── hf-daily-papers.json       # Workflow definition: HuggingFace data fetch
│   ├── hf-papers-to-x.json       # Workflow definition: HuggingFace → X.com posting pipeline
│   ├── state.json                 # Workflow state persistence (run history, status)
│   ├── executors/
│   │   ├── hf-daily-papers.ts     # Executor: fetch papers, abstracts, thumbnails
│   │   ├── hf-papers-to-x.ts     # Executor: fetch + post to X.com end-to-end
│   │   └── post-hf-paper.ts      # Executor: post a single paper to X.com
│   └── .tmp/                      # Workflow output data (thumbnails, papers.json per date)
├── bunfig.toml              # Bun config (preload: globals.ts)
└── package.json             # Dependencies and scripts
```

### 0.4 Build-time Configuration

Two key configuration mechanisms:

**1. MACRO globals + .env loader** (`stubs/globals.ts`):

This file is the first code executed (via `bunfig.toml` preload). It does three things:

1. **Loads `.env`** from the project root into `process.env` (keys already set in the environment are not overridden)
2. **Injects MACRO globals** used throughout the codebase
3. **Injects `--dangerously-skip-permissions` into `process.argv`** when `SKIP_PERMISSIONS=1` is set — enabling fully non-interactive operation for automated LocoAgent tasks

| Macro | Default | Purpose |
|-------|---------|---------|
| `MACRO.VERSION` | `'2.0.0'` | CLI version string |
| `MACRO.BUILD_TIME` | Auto-generated | Build timestamp |
| `MACRO.PACKAGE_URL` | `'@anthropic-ai/claude-code'` | Package identifier |
| `MACRO.FEEDBACK_CHANNEL` | GitHub issues URL | Where to report issues |

Modify `stubs/globals.ts` to change branding or adjust `.env` loading behavior.

**2. Stub packages** (`stubs/@ant/`, `stubs/@anthropic-ai/`):

Internal Anthropic packages are replaced with empty stubs. This is how the fork removes proprietary dependencies. If you see import errors for `@ant/*` packages, the stub is missing or incomplete.

### 0.5 Feature Flags

**File:** `src/_stubs/bun-bundle.ts`

The `feature()` function controls all optional features. In this fork, **all features return `false`** — only core functionality is active.

```typescript
// Current: everything off
export function feature(_name: string): boolean {
  return false
}
```

To selectively enable features, modify this function:

```typescript
const ENABLED_FEATURES = new Set([
  'VOICE_MODE',
  'BRIDGE_MODE',
  // add features you want
])

export function feature(name: string): boolean {
  return ENABLED_FEATURES.has(name)
}
```

**Complete Feature Flag Reference (86 flags):**

| Category | Flags |
|----------|-------|
| **Assistant/Kairos** | `KAIROS`, `KAIROS_BRIEF`, `KAIROS_CHANNELS`, `KAIROS_DREAM`, `KAIROS_GITHUB_WEBHOOKS`, `KAIROS_PUSH_NOTIFICATION`, `PROACTIVE` |
| **Remote/Bridge** | `BRIDGE_MODE`, `DAEMON`, `SSH_REMOTE`, `CCR_AUTO_CONNECT`, `CCR_MIRROR`, `CCR_REMOTE_SETUP`, `DIRECT_CONNECT`, `SELF_HOSTED_RUNNER`, `BYOC_ENVIRONMENT_RUNNER` |
| **Tools** | `WEB_BROWSER_TOOL`, `MONITOR_TOOL`, `OVERFLOW_TEST_TOOL`, `TERMINAL_PANEL`, `POWERSHELL_AUTO_MODE` |
| **Agent/Team** | `COORDINATOR_MODE`, `AGENT_TRIGGERS`, `AGENT_TRIGGERS_REMOTE`, `FORK_SUBAGENT`, `UDS_INBOX`, `BUDDY`, `TEAMMEM`, `BUILTIN_EXPLORE_PLAN_AGENTS` |
| **Context/Memory** | `CONTEXT_COLLAPSE`, `REACTIVE_COMPACT`, `CACHED_MICROCOMPACT`, `HISTORY_SNIP`, `AGENT_MEMORY_SNAPSHOT`, `EXTRACT_MEMORIES`, `COMPACTION_REMINDERS`, `TOKEN_BUDGET` |
| **Skills/Workflows** | `EXPERIMENTAL_SKILL_SEARCH`, `SKILL_IMPROVEMENT`, `WORKFLOW_SCRIPTS`, `TEMPLATES`, `RUN_SKILL_GENERATOR`, `MCP_SKILLS` |
| **Voice** | `VOICE_MODE` |
| **UI** | `AUTO_THEME`, `QUICK_SEARCH`, `HISTORY_PICKER`, `MESSAGE_ACTIONS`, `STREAMLINED_OUTPUT`, `SHOT_STATS`, `AWAY_SUMMARY` |
| **Security/Policy** | `NATIVE_CLIENT_ATTESTATION`, `BASH_CLASSIFIER`, `TRANSCRIPT_CLASSIFIER`, `ANTI_DISTILLATION_CC`, `VERIFICATION_AGENT` |
| **Infrastructure** | `SLOW_OPERATION_LOGGING`, `PROMPT_CACHE_BREAK_DETECTION`, `BREAK_CACHE_COMMAND`, `HARD_FAIL`, `LODESTONE`, `FILE_PERSISTENCE`, `DOWNLOAD_USER_SETTINGS`, `UPLOAD_USER_SETTINGS`, `BG_SESSIONS`, `UNATTENDED_RETRY` |
| **Build/Platform** | `IS_LIBC_GLIBC`, `IS_LIBC_MUSL`, `TREE_SITTER_BASH`, `TREE_SITTER_BASH_SHADOW`, `NATIVE_CLIPBOARD_IMAGE` |
| **Misc** | `ABLATION_BASELINE`, `BUILDING_CLAUDE_APPS`, `CHICAGO_MCP`, `CONNECTOR_TEXT`, `DUMP_SYSTEM_PROMPT`, `HOOK_PROMPTS`, `MEMORY_SHAPE_TELEMETRY`, `MCP_RICH_OUTPUT`, `NEW_INIT`, `REVIEW_ARTIFACT`, `TORCH`, `ULTRAPLAN`, `ULTRATHINK`, `COMMIT_ATTRIBUTION`, `ALLOW_TEST_VERSIONS` |

### 0.6 Key Environment Variables

All variables can be set in the project root `.env` file (automatically loaded at startup). Variables already present in the shell environment take precedence over `.env`.

**Authentication / Provider:**

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CODE_USE_OPENAI` | Set to `1` to use OpenAI-compatible provider instead of Anthropic |
| `OPENAI_API_KEY` | API key for OpenAI-compatible provider (e.g. OpenRouter) |
| `OPENAI_BASE_URL` | Base URL for OpenAI-compatible endpoint (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | Model ID for OpenAI-compatible provider (default: `gpt-4o`) |
| `ANTHROPIC_API_KEY` | Anthropic API key (used when `CLAUDE_CODE_USE_OPENAI` is not set) |
| `ANTHROPIC_BASE_URL` | Override Anthropic API base URL for the SDK client (takes priority over staging OAuth config) |
| `ANTHROPIC_AUTH_TOKEN` | Override Anthropic auth token (used as `authToken` in SDK client when not a Claude AI subscriber) |

**Behavior:**

| Variable | Purpose |
|----------|---------|
| `SKIP_PERMISSIONS` | Set to `1` to inject `--dangerously-skip-permissions` at startup — bypasses all tool permission prompts for non-interactive/automated use |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Max parallel tool executions (default: 10) |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Disable CLAUDE.md loading |
| `CLAUDE_CODE_REMOTE` | Mark as remote session |
| `CLAUDE_CODE_VERIFY_PLAN` | Enable plan verification tool |
| `CLAUDE_CODE_API_BASE_URL` | Override Anthropic API base URL |
| `ENABLE_LSP_TOOL` | Enable LSP tool |
| `USER_TYPE` | `ant` for internal Anthropic features, anything else for external |
| `NODE_ENV` | `test` for test mode |

---

## 1. Entry Point and Startup Flow

### 1.1 Overall Call Chain

```
bun start
  -> stubs/globals.ts (preload)
  -> src/entrypoints/cli.tsx (entry point)
    -> src/main.tsx: main()
      -> src/main.tsx: run()
        -> Commander preAction hook -> init() + setup()
        -> Commander action handler -> showSetupScreens() -> launchRepl()
```

### 1.2 Layer 1: cli.tsx - Route Dispatcher

**File:** `src/entrypoints/cli.tsx`

**Responsibility:** Route based on CLI arguments quickly, avoiding full CLI loading overhead.

**Design Pattern:** Fast-path pattern. All imports are **dynamic imports** that only load the corresponding module when a branch is hit.

**Route Branches (by priority):**

| Argument | Behavior | Load Cost |
|----------|----------|-----------|
| `--version` | Print version, exit immediately | Zero imports |
| `--dump-system-prompt` | Output system prompt | Light |
| `--claude-in-chrome-mcp` | Start Chrome MCP server | Light |
| `--daemon-worker` | Start daemon worker process | Light |
| `remote-control/bridge` | Remote control mode | Medium |
| `daemon` | Long-running supervisor process | Medium |
| `ps/logs/attach/kill/--bg` | Background session management | Light |
| `new/list/reply` | Template tasks | Medium |
| `environment-runner` | Headless BYOC runner | Medium |
| `self-hosted-runner` | Self-hosted runner | Medium |
| `--worktree --tmux` | tmux worktree mode | Medium |
| **Default (no special args)** | **Load full CLI -> `main()`** | **Full** |

**Default path final steps:**

1. `startCapturingEarlyInput()` - Start capturing user keystrokes during CLI loading
2. `import('../main.js')` - Load main.tsx (triggers heavy module evaluation)
3. `cliMain()` - Execute the main function

### 1.3 Layer 2: main.tsx - Core Orchestrator

**File:** `src/main.tsx` (785KB - the single largest and most important file)

This file has three major responsibilities:

#### 1.3.1 Module Loading Phase (Lines 1-200)

During `import` statement execution, three side effects are triggered to maximize parallelism:

1. `profileCheckpoint('main_tsx_entry')` - Mark entry timestamp
2. `startMdmRawRead()` - Launch MDM config subprocess reads (macOS/Windows)
3. `startKeychainPrefetch()` - Prefetch Keychain credentials (OAuth + API key)

Then ~200 imports load covering nearly all subsystems.

#### 1.3.2 main() Function (Lines 585-856)

1. Security setup (prevent Windows PATH hijacking)
2. Register warning handler and SIGINT handler
3. Handle special URL protocols (`cc://`, `ssh`, `assistant`)
4. Determine interactive vs. non-interactive mode
5. Determine client type (cli / sdk / remote / github-action, etc.)
6. Call `eagerLoadSettings()` - Parse settings early
7. **Call `run()`**

#### 1.3.3 run() Function (Line 884+)

The actual command building and execution:

**Step 1: Create Commander program** - `new CommanderCommand()` registers 50+ CLI options.

**Step 2: Register `preAction` hook** - Runs before any command execution:
- `ensureMdmSettingsLoaded()` + `ensureKeychainPrefetchCompleted()` - Wait for prefetch completion
- **`init()`** - Core initialization (see Layer 3)
- `initSinks()` - Initialize logging/analytics sinks
- `runMigrations()` - Run data migrations
- `loadRemoteManagedSettings()` / `loadPolicyLimits()` - Load remote policies

**Step 3: Register default action handler** - Handles the main command logic (~2,700 lines):
- Parse all options (model, permission-mode, resume, mcp-config, etc.)
- Call `setup()` - Environment initialization
- `showSetupScreens()` - Display trust dialog / onboarding
- **`launchRepl()`** - Start the interactive REPL

### 1.4 Layer 3: init.ts - Low-level Initialization

**File:** `src/entrypoints/init.ts`

**Responsibility:** One-time infrastructure initialization (memoized, runs only once).

**Execution order:**

1. `enableConfigs()` - Enable configuration system
2. `applySafeConfigEnvironmentVariables()` - Apply safe environment variables
3. `applyExtraCACertsFromConfig()` - TLS certificates
4. `setupGracefulShutdown()` - Graceful exit handling
5. `configureGlobalMTLS()` - mTLS configuration
6. `configureGlobalAgents()` - Proxy configuration
7. `preconnectAnthropicApi()` - Pre-connect to API (overlap TCP/TLS handshake)
8. `setShellIfWindows()` - Windows shell adaptation
9. Register cleanup callbacks (LSP, team cleanup, etc.)
10. `ensureScratchpadDir()` - Initialize scratchpad if enabled

### 1.5 Layer 4: setup.ts - Session-level Initialization

**File:** `src/setup.ts`

**Responsibility:** Per-session environment preparation.

**Execution order:**

1. Node.js version check (>=18)
2. Session ID setup
3. UDS messaging server startup (inter-process communication)
4. Terminal backup restoration (iTerm2 / Terminal.app)
5. **`setCwd()`** - Set working directory (all subsequent operations depend on this)
6. Hooks configuration snapshot
7. Worktree creation (if enabled)
8. Background task registration (session memory, context collapse, attribution hooks, etc.)
9. `initSinks()` - Activate logging system
10. Permission mode security check (Docker/sandbox verification for bypass mode)

### 1.6 Layer 5: replLauncher.tsx - UI Rendering

**File:** `src/replLauncher.tsx`

The final step, very concise:

```tsx
<App {...appProps}>
  <REPL {...replProps} />
</App>
```

Loads the `App` component and `REPL` screen, rendering to the terminal via Ink (React terminal rendering library).

### 1.7 Key Findings for Secondary Development

1. **`feature()` function** is the core mechanism for feature flags. All advanced features (DAEMON, BRIDGE_MODE, SSH_REMOTE, KAIROS, etc.) are controlled by feature flags. You can control which features are enabled/disabled by modifying `src/_stubs/bun-bundle.js`.

2. **main.tsx is the bottleneck** - A single 785KB file carrying too many responsibilities. If you're doing secondary development, this is the file you most need to understand and potentially split.

3. **`preAction` hook is the core initialization entry point** - If you need to inject your own initialization logic, this is the best place (`main.tsx:907`).

4. **Startup performance is highly optimized** - Dynamic imports, prefetching, parallel subprocesses. Be careful not to break these optimizations when making changes.

---

## 2. Core Architecture Skeleton

This section covers the five core subsystems that form the backbone of the application: how the model is called, what tools the model can use, how the conversation loop works, how context is managed, and how slash commands are registered.

### 2.1 Services Layer (API & Model Interaction)

**Directory:** `src/services/api/`

This layer handles all communication with LLM providers. It is the **most critical layer for secondary development** if you want to switch or add model providers.

#### 2.1.1 Provider Architecture

The system supports multiple API providers through a unified client interface:

| Provider | Auth Method | Key Files |
|----------|-------------|-----------|
| **Anthropic Direct** | `ANTHROPIC_API_KEY` or OAuth | `client.ts` |
| **AWS Bedrock** | AWS SDK credentials | `client.ts` |
| **Google Vertex AI** | GCP credentials | `client.ts` |
| **Azure Foundry** | API key or Azure AD | `client.ts` |
| **OpenAI-compatible** | `OPENAI_API_KEY` | `openaiShim.ts` |
| **Codex (OpenAI)** | Codex auth / `~/.codex/auth.json` | `codexShim.ts` |

#### 2.1.2 Key Files

- **`client.ts`** - Factory function `getAnthropicClient()` that creates an Anthropic SDK client configured for the active provider (Direct, Bedrock, Vertex, Foundry). Handles credential refresh, proxy settings, and region selection.

- **`claude.ts`** - The core API call layer. Contains the main query functions:
  - `queryModelWithoutStreaming()` (line 709) - Single-shot API call
  - `queryModelWithStreaming()` (line 752) - Streaming API call (primary path), returns `AsyncGenerator<StreamEvent>`
  - `queryHaiku()` (line 3241) - Utility for fast/cheap Haiku model queries
  - `queryWithModel()` (line 3300) - Generic model query with model override

  This file handles: system prompt construction, message normalization, tool schema conversion, beta header injection, effort level, thinking config, caching, retry logic, and rate limit handling.

- **`openaiShim.ts`** - Translates Anthropic SDK calls into OpenAI-compatible chat completion requests and streams back events in Anthropic format. Supports OpenAI, Azure OpenAI, Ollama, LM Studio, OpenRouter, Together, Groq, Fireworks, DeepSeek, Mistral, and any OpenAI-compatible API. The rest of the codebase is unaware of which provider is being used.

  **DeepSeek Thinking Mode Fix (critical for `deepseek-v4-flash` and similar models):**

  Models that return `reasoning_content` (thinking/reasoning tokens) alongside `tool_calls` in streaming mode require special handling. The original code had a **content block index collision bug**: when DeepSeek returned `reasoning_content` → `tool_calls` without any text content in between, both the thinking block and the first tool_use block were assigned index 0 in the Anthropic stream format. This caused the tool_use block to overwrite the thinking block in `claude.ts`'s `contentBlocks[]` array. On the next API call, `reasoning_content` was missing from the conversation history, triggering a 400 error: *"The reasoning_content in the thinking mode must be passed back to the API"*.

  **Fix (streaming — `openaiStreamToAnthropic`):** Before starting any `tool_use` content block, the shim now checks if a thinking block is still open (`hasEmittedThinkingStart && !hasClosedThinkingBlock`) and emits a `content_block_stop` event for it, then increments `contentBlockIndex`. This ensures thinking, text, and tool_use blocks each get unique sequential indices.

  **Fix (message conversion — `convertMessages`):** When an assistant message has `tool_calls` but empty text content, `content` is set to `null` (not empty string `""`). DeepSeek's API rejects empty-string content on assistant messages that carry `reasoning_content`.

- **`providerConfig.ts`** - Resolves model names, base URLs, and transport type (chat completions vs. Codex responses). Handles Codex alias models (`codexplan` -> `gpt-5.4`, `codexspark` -> `gpt-5.3-codex-spark`).

- **`withRetry.ts`** - Retry logic with exponential backoff and fallback model support.

- **`errors.ts`** - API error classification (rate limits, overloaded, prompt too long, etc.).

#### 2.1.3 Other Services

| Directory | Purpose |
|-----------|---------|
| `services/compact/` | Conversation compaction (auto-compact when context exceeds token limits) |
| `services/mcp/` | MCP (Model Context Protocol) server management |
| `services/tools/` | Tool orchestration (parallel/serial execution) |
| `services/lsp/` | Language Server Protocol integration |
| `services/oauth/` | OAuth authentication flow |
| `services/plugins/` | Plugin management |
| `services/voice.ts` | Voice input/output |
| `services/rateLimitMessages.ts` | Rate limit messaging |
| `services/tokenEstimation.ts` | Token count estimation |

#### 2.1.4 Provider Compatibility Notes

When using OpenAI-compatible providers via `openaiShim.ts`, be aware of provider-specific quirks:

| Provider | Quirk | Handling |
|----------|-------|----------|
| **DeepSeek (thinking models)** | Returns `reasoning_content` field; requires it to be passed back in conversation history. Empty-string `content` on assistant messages with `reasoning_content` causes 400 errors. | Shim preserves `reasoning_content` as `thinking` blocks. Assistant `content` set to `null` (not `""`) when empty. See DeepSeek Thinking Mode Fix in section 2.1.2. |
| **DeepSeek (thinking + tool_use)** | Streaming may emit `reasoning_content` → `tool_calls` without any text `content` in between, causing content block index collisions. | Shim closes the thinking block and increments block index before starting tool_use blocks. |
| **OpenRouter** | Passes through various model providers; behavior depends on underlying model. | Use `OPENAI_BASE_URL=https://openrouter.ai/api/v1` with the full model path (e.g., `anthropic/claude-sonnet-4.5`). |
| **Ollama / LM Studio** | Local models; may not support all features (thinking, tool_use). | Works for basic chat; tool_use support varies by model. |

### 2.2 Tools System

**Key Files:** `src/Tool.ts` (interface), `src/tools.ts` (registry), `src/tools/` (implementations)

Tools are the capabilities that the model can invoke. This is the system you modify to add or remove what the AI can do.

#### 2.2.1 Tool Interface (`Tool.ts`)

Every tool implements the `Tool` type, which defines:

```
Tool {
  name: string                    // Unique identifier (e.g., "Bash", "Edit", "Read")
  description: string             // Shown to the model in system prompt
  inputJSONSchema: object         // JSON Schema for parameters
  isEnabled(): boolean            // Whether tool is available
  isReadOnly(): boolean           // Whether tool only reads (affects concurrency)
  call(input, context): result    // Execute the tool
  validateInput?(input): result   // Optional input validation
}
```

Key associated types:
- **`ToolUseContext`** - The rich execution context passed to every tool call, containing: commands list, debug flags, model info, tools list, MCP clients, agent definitions, abort controller, file state cache, app state getters/setters, and more.
- **`ToolPermissionContext`** - Permission rules (allow/deny/ask) that control which tools can run without asking the user.

#### 2.2.2 Tool Registry (`tools.ts`)

`getAllBaseTools()` (line 193) returns the complete list of available tools. Tools are conditionally included based on feature flags and environment:

**Always-on Core Tools:**

| Tool | Purpose |
|------|---------|
| `AgentTool` | Launch sub-agents for complex tasks |
| `TaskOutputTool` | Read output from background tasks |
| `BashTool` | Execute shell commands |
| `GlobTool` | File pattern matching |
| `GrepTool` | Content search (ripgrep) |
| `FileReadTool` | Read files |
| `FileEditTool` | Edit files (string replacement) |
| `FileWriteTool` | Write/create files |
| `NotebookEditTool` | Edit Jupyter notebooks |
| `WebFetchTool` | Fetch web content |
| `WebSearchTool` | Web search |
| `TodoWriteTool` | Task list management |
| `TaskStopTool` | Stop background tasks |
| `AskUserQuestionTool` | Ask user for input |
| `SkillTool` | Execute skills (slash commands) |
| `EnterPlanModeTool` | Enter planning mode |
| `ExitPlanModeV2Tool` | Exit planning mode |
| `BriefTool` | Send brief messages to user |
| `SendMessageTool` | Inter-agent messaging |
| `ListMcpResourcesTool` | List MCP resources |
| `ReadMcpResourceTool` | Read MCP resources |

**Feature-gated Tools:**

| Tool | Gate | Purpose |
|------|------|---------|
| `REPLTool` | `USER_TYPE=ant` | Interactive REPL |
| `ConfigTool` | `USER_TYPE=ant` | Config management |
| `TungstenTool` | `USER_TYPE=ant` | Internal tool |
| `WebBrowserTool` | `WEB_BROWSER_TOOL` | Browser automation |
| `SleepTool` | `PROACTIVE` / `KAIROS` | Delayed execution |
| `CronCreate/Delete/ListTool` | `AGENT_TRIGGERS` | Scheduled tasks |
| `WorkflowTool` | `WORKFLOW_SCRIPTS` | Workflow execution |
| `EnterWorktreeTool` / `ExitWorktreeTool` | Worktree mode | Git worktree management |
| `TeamCreateTool` / `TeamDeleteTool` | Agent swarms | Multi-agent teams |
| `SnipTool` | `HISTORY_SNIP` | History management |
| `OverflowTestTool` | `OVERFLOW_TEST_TOOL` | Testing |

#### 2.2.3 Tool Implementations (`src/tools/`)

Each tool lives in its own directory (e.g., `src/tools/BashTool/BashTool.ts`). There are **43 tool directories** plus a `shared/` directory and `utils.ts` for common utilities.

#### 2.2.4 Tool Orchestration (`src/services/tools/toolOrchestration.ts`)

`runTools()` is the engine that executes tool calls from the model:

1. **Partition** tool calls into concurrency-safe (read-only) and non-safe (write) batches
2. **Read-only tools** run concurrently (up to `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`, default 10)
3. **Write tools** run serially to prevent conflicts
4. Each tool execution updates the `ToolUseContext` via context modifiers

#### 2.2.5 Permission System

Tools are filtered by permission rules before being sent to the model:
- `filterToolsByDenyRules()` strips tools that are blanket-denied
- Runtime permission checks happen via `canUseTool()` callback
- Permission modes: `default`, `bypassPermissions`, `auto`

### 2.3 Query & Conversation Processing

**Key File:** `src/query.ts`

This is the **agentic loop** - the core conversation engine that drives the entire application.

#### 2.3.1 The Query Loop

The main function `query()` (line 219) is an `AsyncGenerator` that yields stream events and messages. It wraps `queryLoop()` which implements the actual agentic while-loop:

```
User sends message
  -> queryLoop starts (while true)
    -> Build system prompt + user context + system context
    -> Attach memory files (CLAUDE.md, relevant memories)
    -> Call claude.ts queryModelWithStreaming()
    -> Stream back model response tokens
    -> If model invokes tools:
        -> runTools() executes them (parallel/serial)
        -> Append tool results to messages
        -> Continue loop (next iteration)
    -> If model returns text only (no tool calls):
        -> Return (loop ends)
    -> If auto-compact triggers:
        -> Compact conversation history
        -> Continue loop
```

#### 2.3.2 Loop State

The loop maintains mutable state across iterations:

| State | Purpose |
|-------|---------|
| `messages` | Full conversation history |
| `toolUseContext` | Execution context (updated per tool) |
| `autoCompactTracking` | Token warning state for auto-compaction |
| `turnCount` | Current agentic turn number |
| `maxOutputTokensRecoveryCount` | Recovery attempts for max output token errors |
| `hasAttemptedReactiveCompact` | Whether reactive compaction was tried |
| `pendingToolUseSummary` | Deferred tool use summary |
| `stopHookActive` | Whether a stop hook is active |

#### 2.3.3 Key Features in the Loop

- **Auto-compaction** - When context tokens exceed thresholds, the conversation is summarized to free up space (`services/compact/`)
- **Reactive compaction** - Triggered when the model hits max output tokens
- **Memory prefetch** - Relevant CLAUDE.md files are prefetched in the background while the model streams
- **Skill discovery prefetch** - Skills are discovered during streaming
- **Tool use summaries** - Long tool outputs are summarized to save context
- **Max turns limit** - In non-interactive mode, the loop can be capped via `--max-turns`
- **Budget tracking** - Token budget tracking across compaction boundaries

### 2.4 Context Management

**Key File:** `src/context.ts`, `src/context/`

Context management has two distinct parts:

#### 2.4.1 Prompt Context (`context.ts`)

Two memoized functions build the context that is prepended to every API call:

- **`getUserContext()`** (line 155) - User-facing context:
  - Reads CLAUDE.md files (project instructions) from the working directory tree
  - Injects current date
  - Respects `--bare` mode (skip auto-discovery) and `CLAUDE_CODE_DISABLE_CLAUDE_MDS`

- **`getSystemContext()`** (line 116) - System-facing context:
  - Git status snapshot (branch, status, recent commits, git user)
  - Cache breaker injection (if enabled)

- **`getGitStatus()`** (line 36) - Gathers git state:
  - Current branch, default branch, short status, recent 5 commits, user name
  - Truncates status at 2,000 chars

These contexts are cached (memoized) for the duration of the conversation. They do not update mid-session.

#### 2.4.2 UI Context (`src/context/`)

React context providers for the Ink UI layer:

| File | Purpose |
|------|---------|
| `QueuedMessageContext.tsx` | Message queue for pending user messages |
| `fpsMetrics.tsx` | FPS tracking for UI performance |
| `mailbox.tsx` | Inter-component messaging |
| `modalContext.tsx` | Modal dialog state |
| `notifications.tsx` | Notification system |
| `overlayContext.tsx` | Overlay UI state |
| `promptOverlayContext.tsx` | Prompt overlay state |
| `stats.tsx` | Statistics tracking |
| `voice.tsx` | Voice mode state |

### 2.5 Commands System (Slash Commands)

**Key Files:** `src/commands.ts` (registry), `src/commands/` (implementations)

Commands are slash commands the user types in the REPL (e.g., `/help`, `/compact`, `/commit`).

#### 2.5.1 Command Loading

`getCommands()` (line 476) loads and filters all available commands:

1. Load all commands from `loadAllCommands()` (built-in + plugin + skill-based)
2. Filter by availability requirements and enabled state
3. Merge in dynamic skills (discovered during file operations)
4. Deduplicate and order: plugin skills first, then built-in commands

#### 2.5.2 Built-in Commands (~90+)

Core commands are statically imported. A sample of key ones:

| Command | Purpose |
|---------|---------|
| `/help` | Show help |
| `/compact` | Compact conversation history |
| `/commit` | Create a git commit |
| `/clear` | Clear conversation |
| `/config` | Manage configuration |
| `/cost` | Show session cost |
| `/diff` | Show file diffs |
| `/doctor` | Diagnose issues |
| `/ide` | Connect to IDE |
| `/init` | Initialize project |
| `/login` / `/logout` | Authentication |
| `/mcp` | Manage MCP servers |
| `/memory` | Manage memory files |
| `/model` | Switch model |
| `/resume` | Resume a session |
| `/review` | Code review |
| `/share` | Share conversation |
| `/skills` | List skills |
| `/status` | Show session status |
| `/theme` | Change theme |
| `/vim` | Toggle vim mode |
| `/voice` | Toggle voice mode |

#### 2.5.3 Feature-gated Commands

Many commands are conditionally loaded via `feature()` flags:

| Command | Gate |
|---------|------|
| `/proactive` | `PROACTIVE` / `KAIROS` |
| `/brief` | `KAIROS` / `KAIROS_BRIEF` |
| `/bridge` | `BRIDGE_MODE` |
| `/voice` | `VOICE_MODE` |
| `/workflows` | `WORKFLOW_SCRIPTS` |
| `/ultraplan` | `ULTRAPLAN` |
| `/torch` | `TORCH` |
| `/peers` | `UDS_INBOX` |
| `/fork` | `FORK_SUBAGENT` |

#### 2.5.4 Command Sources

Commands can come from multiple sources:
- **Built-in** - Statically imported in `commands.ts`
- **Plugin** - Loaded from installed plugins
- **Skill** - Generated from skill definitions
- **MCP** - Provided by MCP servers (prompt-type)
- **Dynamic** - Discovered during file operations

### 2.6 Data Flow Summary

Here is how data flows through the core subsystems during a typical interaction:

```
User types a message in REPL
  |
  v
[Commands System] - Check if it's a slash command (/compact, /help, etc.)
  |                  If yes -> execute command directly
  | (if not a command)
  v
[Context Management] - Build system prompt
  |                    Attach getUserContext() (CLAUDE.md, date)
  |                    Attach getSystemContext() (git status)
  v
[Query Loop] - Prepare messages array
  |            Add memory attachments
  v
[Services Layer] - queryModelWithStreaming()
  |                Send to Anthropic/Bedrock/Vertex/OpenAI
  |                Stream back tokens
  v
[Query Loop] - Receive model response
  |            If tool_use blocks present:
  |              v
  |            [Tools System] - runTools()
  |              |               Partition into read/write batches
  |              |               Execute with permission checks
  |              |               Return tool results
  |              v
  |            [Query Loop] - Append results, continue loop
  |
  | (if no more tool calls)
  v
Display final response in REPL
```

### 2.7 Key Findings for Secondary Development

1. **To add a new model provider** - Create a new shim similar to `openaiShim.ts` that translates to/from Anthropic stream format. The rest of the codebase remains untouched. Alternatively, modify `client.ts` to add a new provider branch. **Important:** If your provider supports thinking/reasoning tokens (like DeepSeek's `reasoning_content`), ensure the streaming shim correctly manages content block indices — thinking, text, and tool_use blocks must each get unique sequential indices. See section 2.1.4 for known provider quirks.

2. **To add a new tool** - Create a directory under `src/tools/YourTool/`, implement the `Tool` interface, and register it in `getAllBaseTools()` in `tools.ts`. Use feature flags for conditional inclusion.

3. **To add a new slash command** - Create a file under `src/commands/your-command/`, define the command object, and import it in `commands.ts`.

4. **The query loop is the heart** - `src/query.ts` is where all the agentic behavior lives. Understanding this file is essential for modifying conversation behavior, adding pre/post processing, or changing how tools are orchestrated.

5. **Tool concurrency matters** - Read-only tools run in parallel (up to 10), write tools run serially. Mark your tool's `isReadOnly()` correctly to get the best performance.

6. **Context is cached per session** - `getUserContext()` and `getSystemContext()` are memoized. They won't reflect mid-session changes to CLAUDE.md or git state. If you need dynamic context, you'll need to modify this caching strategy.

---

## 3. UI Layer

### 3.1 Architecture Overview

The UI is built entirely in **React**, rendered to the terminal via **Ink** (a custom fork). This is not a web app — it's a React component tree that outputs ANSI escape sequences to stdout.

```
ink.ts (entry point - wraps all renders with ThemeProvider)
  |
  v
ink/root.ts -> ink/ink.tsx (Ink engine: reconciler, renderer, DOM)
  |
  v
components/App.tsx (root component: providers wrapper)
  |
  v
screens/REPL.tsx (main interactive screen: ~3000+ lines)
  |
  +-- components/PromptInput/   (user input area)
  +-- components/Messages.tsx    (message list display)
  +-- components/Spinner.tsx     (loading indicators)
  +-- components/permissions/    (permission dialogs)
  +-- components/Markdown.tsx    (markdown rendering)
  +-- ...130+ other components
```

### 3.2 Ink Engine (Custom Fork)

**Directory:** `src/ink/`

This project includes a **heavily customized fork of Ink** (the React terminal renderer). It is NOT the upstream `ink` npm package — it's been extended with:

#### 3.2.1 Core Rendering Pipeline

| File | Purpose |
|------|---------|
| `ink.tsx` | Main Ink class — manages React fiber reconciler, renders component tree to output |
| `reconciler.ts` | React reconciler implementation (createContainer, updateContainer) |
| `dom.ts` | Virtual DOM nodes (DOMElement, DOMNode, TextNode) |
| `renderer.ts` | Converts virtual DOM to screen output |
| `render-node-to-output.ts` | Recursive node-to-string conversion |
| `render-to-screen.ts` | Final ANSI output to terminal |
| `render-border.ts` | Box border rendering |
| `output.ts` | Output buffer management |
| `frame.ts` | Frame scheduling and timing |
| `root.ts` | Root creation and render lifecycle (`createRoot`, `render`) |

#### 3.2.2 Layout System

| File | Purpose |
|------|---------|
| `layout/` | Yoga-based flexbox layout engine |
| `measure-element.ts` | Element dimension measurement |
| `measure-text.ts` | Text width measurement |
| `styles.ts` | Style properties (flexbox, padding, margin, etc.) |
| `get-max-width.ts` | Terminal width calculation |
| `wrap-text.ts` | Text wrapping |
| `tabstops.ts` | Tab stop handling |
| `stringWidth.ts` | String width (accounting for CJK, emoji) |

#### 3.2.3 Base Components (`ink/components/`)

| Component | Purpose |
|-----------|---------|
| `Box.tsx` | Flexbox container (like `<div>`) |
| `Text.tsx` | Text node (like `<span>`) |
| `App.tsx` | Ink app wrapper with exit/error handling |
| `Button.tsx` | Clickable button |
| `Link.tsx` | Hyperlink (terminal hyperlinks) |
| `ScrollBox.tsx` | Scrollable container |
| `Newline.tsx` | Line break |
| `Spacer.tsx` | Flex spacer |
| `RawAnsi.tsx` | Raw ANSI escape sequence pass-through |
| `NoSelect.tsx` | Non-selectable text |
| `AlternateScreen.tsx` | Alternate terminal screen buffer |

#### 3.2.4 Events and Input

| File | Purpose |
|------|---------|
| `events/input-event.ts` | Keyboard input events |
| `events/click-event.ts` | Mouse click events |
| `events/terminal-focus-event.ts` | Terminal focus/blur events |
| `events/emitter.ts` | Event emitter |
| `parse-keypress.ts` | Raw keypress parsing |
| `termio.ts` / `termio/` | Low-level terminal I/O |
| `cursor.ts` | Cursor management |
| `terminal.ts` | Terminal capability detection |

#### 3.2.5 Custom Hooks (`ink/hooks/`)

| Hook | Purpose |
|------|---------|
| `use-input.ts` | Key input handling (the primary input hook) |
| `use-app.ts` | Access Ink app instance (exit) |
| `use-stdin.ts` | Raw stdin access |
| `use-animation-frame.ts` | Animation frame scheduling |
| `use-interval.ts` | Timer intervals |
| `use-selection.ts` | Text selection |
| `use-search-highlight.ts` | Search text highlighting |
| `use-terminal-focus.ts` | Terminal focus detection |
| `use-terminal-title.ts` | Set terminal title |
| `use-terminal-viewport.ts` | Viewport tracking |
| `use-tab-status.ts` | Terminal tab status |
| `use-declared-cursor.ts` | Cursor position declaration |

### 3.3 Design System

**Directory:** `src/components/design-system/`

A thin design system layer that provides themed wrappers:

| Component | Purpose |
|-----------|---------|
| `ThemeProvider.tsx` | Theme context provider (light/dark themes) |
| `ThemedBox.tsx` | Theme-aware Box (`<Box>` replacement exported as `Box` from `ink.ts`) |
| `ThemedText.tsx` | Theme-aware Text (`<Text>` replacement exported as `Text` from `ink.ts`) |
| `color.ts` | Color palette definitions |
| `Dialog.tsx` | Dialog/modal component |
| `Divider.tsx` | Horizontal divider |
| `FuzzyPicker.tsx` | Fuzzy search picker |
| `KeyboardShortcutHint.tsx` | Keyboard shortcut display |
| `ListItem.tsx` | List item |
| `LoadingState.tsx` | Loading state component |
| `Pane.tsx` | Panel/pane container |
| `ProgressBar.tsx` | Progress bar |
| `StatusIcon.tsx` | Status indicator icon |
| `Tabs.tsx` | Tab navigation |
| `Byline.tsx` | Byline text |

**Important:** `ink.ts` re-exports `ThemedBox` as `Box` and `ThemedText` as `Text`. All application code should import from `ink.ts`, not from `ink/components/` directly. This ensures theming is always applied.

### 3.4 App Component and State Management

#### 3.4.1 App Component (`components/App.tsx`)

The root component is a pure provider wrapper:

```tsx
<FpsMetricsProvider>      // FPS tracking
  <StatsProvider>          // Statistics
    <AppStateProvider>     // Global app state
      {children}           // -> screens/REPL.tsx
    </AppStateProvider>
  </StatsProvider>
</FpsMetricsProvider>
```

#### 3.4.2 AppState (`state/AppStateStore.ts`)

`AppState` is the global state type — a large immutable object containing everything the UI needs:

**Core State:**

| Field | Type | Purpose |
|-------|------|---------|
| `settings` | `SettingsJson` | User settings |
| `verbose` | `boolean` | Verbose mode |
| `mainLoopModel` | `ModelSetting` | Current model |
| `toolPermissionContext` | `ToolPermissionContext` | Permission rules |
| `agent` | `string?` | Active agent name |
| `kairosEnabled` | `boolean` | Assistant mode |

**MCP State:**

| Field | Purpose |
|-------|---------|
| `mcp.clients` | Connected MCP servers |
| `mcp.tools` | MCP-provided tools |
| `mcp.commands` | MCP-provided commands |
| `mcp.resources` | MCP server resources |

**Plugin State:**

| Field | Purpose |
|-------|---------|
| `plugins.enabled` | Enabled plugins |
| `plugins.disabled` | Disabled plugins |
| `plugins.commands` | Plugin commands |
| `plugins.errors` | Plugin errors |

**Task/Agent State:**

| Field | Purpose |
|-------|---------|
| `tasks` | Background task states (Agent, async jobs) |
| `agentNameRegistry` | Name -> AgentId mapping |
| `foregroundedTaskId` | Currently viewed task |
| `viewingAgentTaskId` | Teammate transcript being viewed |

**Remote/Bridge State:**

| Field | Purpose |
|-------|---------|
| `remoteSessionUrl` | Remote session URL |
| `remoteConnectionStatus` | WebSocket status |
| `replBridgeEnabled` | Bridge enabled flag |
| `replBridgeConnected` | Bridge connected flag |

**State Management Pattern:** Uses a custom `Store` implementation (`state/store.ts`) with `AppStateProvider` context. State is updated via `setAppState(prev => next)` callbacks. Changes trigger `onChangeAppState` side effects.

### 3.5 Screens

**Directory:** `src/screens/`

Only three screen components exist:

| Screen | Purpose |
|--------|---------|
| **`REPL.tsx`** | The main interactive screen — handles everything: message display, prompt input, tool execution feedback, permission dialogs, voice, IDE integration, MCP, tasks, teams, keyboard shortcuts, and more. This is the **largest React component** (~3000+ lines). |
| `Doctor.tsx` | Diagnostic screen (for `claude doctor` subcommand) |
| `ResumeConversation.tsx` | Session resume picker |

`REPL.tsx` is effectively the entire interactive UI. It orchestrates:
- Message list rendering (`VirtualMessageList`)
- User prompt input (`PromptInput`)
- Permission request dialogs
- Spinner/loading states
- Keyboard shortcut handling
- Voice integration
- IDE connection
- MCP server management
- Background task display
- Cost tracking
- Session management (resume, fork, rewind)

### 3.6 Components (130+)

**Directory:** `src/components/`

The project has 130+ component files. Key categories:

#### Message Display
| Component | Purpose |
|-----------|---------|
| `Messages.tsx` | Message list container |
| `Message.tsx` | Single message |
| `MessageRow.tsx` | Message layout row |
| `MessageResponse.tsx` | Assistant response display |
| `MessageModel.tsx` | Model name badge |
| `MessageTimestamp.tsx` | Message timestamp |
| `MessageSelector.tsx` | Message selection for rewind |
| `VirtualMessageList.tsx` | Virtualized scrollable message list |
| `Markdown.tsx` | Markdown renderer |
| `MarkdownTable.tsx` | Table renderer |
| `HighlightedCode.tsx` | Syntax-highlighted code blocks |

#### Input
| Component | Purpose |
|-----------|---------|
| `PromptInput/` | User text input area (directory with sub-components) |
| `TextInput.tsx` | Base text input |
| `BaseTextInput.tsx` | Low-level text input |
| `VimTextInput.tsx` | Vim-mode text input |
| `SearchBox.tsx` | Search input |

#### Tool Feedback
| Component | Purpose |
|-----------|---------|
| `ToolUseLoader.tsx` | Tool execution spinner |
| `FileEditToolDiff.tsx` | File edit diff display |
| `StructuredDiff.tsx` | Structured diff viewer |
| `CompactSummary.tsx` | Compaction summary |
| `TaskListV2.tsx` | Task list display |

#### Dialogs & Overlays
| Component | Purpose |
|-----------|---------|
| `TrustDialog/` | Workspace trust confirmation |
| `Onboarding.tsx` | First-run onboarding |
| `CostThresholdDialog.tsx` | Cost warning dialog |
| `GlobalSearchDialog.tsx` | Global search overlay |
| `HistorySearchDialog.tsx` | History search |
| `ModelPicker.tsx` | Model selection |
| `ThemePicker.tsx` | Theme selection |
| `ExportDialog.tsx` | Export conversation |
| `QuickOpenDialog.tsx` | Quick open |

#### Permissions
| Component | Purpose |
|-----------|---------|
| `permissions/PermissionRequest.tsx` | Tool permission request UI |
| `BypassPermissionsModeDialog.tsx` | Bypass mode dialog |
| `AutoModeOptInDialog.tsx` | Auto mode opt-in |

#### Sub-directories
| Directory | Purpose |
|-----------|---------|
| `agents/` | Agent-related UI |
| `teams/` | Team/swarm UI |
| `tasks/` | Task management UI |
| `memory/` | Memory management UI |
| `skills/` | Skills UI |
| `mcp/` | MCP server UI |
| `permissions/` | Permission UI |
| `sandbox/` | Sandbox UI |
| `shell/` | Shell-related UI |
| `diff/` | Diff viewer components |
| `grove/` | Grove (file tree) UI |
| `ui/` | Generic UI utilities |
| `hooks/` | Component-level hooks |
| `wizard/` | Setup wizard |
| `HelpV2/` | Help display |
| `LogoV2/` | Logo rendering |
| `Spinner/` | Spinner variants |
| `Settings/` | Settings UI |
| `Passes/` | Pass system UI |
| `FeedbackSurvey/` | Feedback UI |

### 3.7 Hooks (80+)

**Directory:** `src/hooks/`

Application-level React hooks (separate from Ink hooks). Key ones:

#### Core Interaction
| Hook | Purpose |
|------|---------|
| `useCanUseTool.tsx` | Tool permission checking |
| `useCancelRequest.ts` | Cancel in-progress requests |
| `useCommandQueue.ts` | Slash command queue processing |
| `useQueueProcessor.ts` | Message queue processing |
| `useTextInput.ts` | Text input state management |
| `useVimInput.ts` | Vim mode input handling |

#### State & Settings
| Hook | Purpose |
|------|---------|
| `useSettings.ts` | Settings access and updates |
| `useSettingsChange.ts` | Settings change detection |
| `useMainLoopModel.ts` | Current model tracking |

#### UI Features
| Hook | Purpose |
|------|---------|
| `useTerminalSize.ts` | Terminal dimensions |
| `useVirtualScroll.ts` | Virtual scrolling for message list |
| `useSearchInput.ts` | Search input handling |
| `useHistorySearch.ts` | Conversation history search |
| `useArrowKeyHistory.tsx` | Arrow key history navigation |
| `usePasteHandler.ts` | Clipboard paste handling |
| `useCopyOnSelect.ts` | Copy on text selection |
| `useGlobalKeybindings.tsx` | Global keyboard shortcuts |
| `useCommandKeybindings.tsx` | Command-specific shortcuts |

#### Integrations
| Hook | Purpose |
|------|---------|
| `useIDEIntegration.tsx` | IDE connection management |
| `useIdeLogging.ts` | IDE logging |
| `useRemoteSession.ts` | Remote session management |
| `useSSHSession.ts` | SSH session |
| `useDirectConnect.ts` | Direct connect |
| `useVoice.ts` | Voice mode |
| `useVoiceIntegration.tsx` | Voice keyboard integration |
| `useReplBridge.tsx` | REPL bridge to Claude.ai |

#### Background & Tasks
| Hook | Purpose |
|------|---------|
| `useSwarmInitialization.ts` | Multi-agent swarm setup |
| `useSwarmPermissionPoller.ts` | Swarm permission sync |
| `useBackgroundTaskNavigation.ts` | Background task navigation |
| `useScheduledTasks.ts` | Scheduled task management |
| `useTasksV2.ts` | Task system V2 |
| `useLogMessages.ts` | Log message collection |

### 3.8 Key Findings for Secondary Development

1. **REPL.tsx is the UI monolith** — At 3000+ lines, `screens/REPL.tsx` handles almost everything in the interactive UI. If you need to modify user interaction behavior, this is where you'll spend most time. Consider splitting it if you're adding major UI features.

2. **Ink is forked, not vendored** — The `src/ink/` directory is a custom fork with significant extensions (events, scrolling, selection, focus, terminal detection). Upgrading to upstream Ink is not feasible. Treat it as internal code.

3. **Import from `ink.ts`, not `ink/`** — Always import `Box`, `Text`, hooks, etc. from `src/ink.ts`. This ensures theming and other wrappers are applied. Direct imports from `src/ink/components/` bypass the theme system.

4. **AppState is the single source of truth** — All UI state flows through `AppState`. To add new global UI state, extend `AppState` in `state/AppStateStore.ts` and access it via the state provider.

5. **React Compiler is active** — Components like `App.tsx` use `react/compiler-runtime`, meaning React automatically memoizes. Don't manually wrap with `React.memo()` — the compiler handles it.

6. **Feature-gated UI** — Many hooks and components are conditionally imported via `feature()` or `process.env.USER_TYPE` checks. This keeps the bundle small for external users but means you need to check which features are active when debugging UI behavior.

---

## 4. Extension Subsystems

These are the modular subsystems that plug into the core architecture (Sections 1-2) and UI (Section 3). Each can be understood independently.

### 4.1 Skills System

**Directory:** `src/skills/`

Skills are reusable prompt templates that can be invoked by the model (via `SkillTool`) or by the user (via slash commands like `/commit`, `/review`). They are the primary extensibility mechanism for adding new AI behaviors.

#### 4.1.1 Skill Sources

Skills can come from five sources:

| Source | Location | Description |
|--------|----------|-------------|
| **Bundled** | `src/skills/bundled/` | Ship with the CLI binary, always available |
| **Project** | `.claude/skills/` in repo | Project-specific, checked into version control |
| **User** | `~/.claude/skills/` | Per-user, available across all projects |
| **Plugin** | Plugin packages | Provided by installed plugins |
| **MCP** | MCP servers | Provided via MCP prompt protocol |

#### 4.1.2 Skill Definition

A skill is a markdown file with YAML frontmatter:

```markdown
---
description: "What this skill does"
allowed-tools: [Bash, Edit, Read]
model: claude-sonnet-4-20250514
---

The prompt template goes here.
Arguments can be substituted with $ARGUMENTS.
```

Or programmatically via `BundledSkillDefinition`:

```typescript
{
  name: string
  description: string
  allowedTools?: string[]
  model?: string
  disableModelInvocation?: boolean   // Hide from model's tool list
  userInvocable?: boolean            // Available as /command
  hooks?: HooksSettings              // Attach hooks to this skill
  files?: Record<string, string>     // Reference files extracted to disk
  getPromptForCommand: (args, ctx) => ContentBlockParam[]
}
```

#### 4.1.3 Bundled Skills (20)

| Skill | Purpose |
|-------|---------|
| `claudeApi.ts` | Claude API usage |
| `claudeApiContent.ts` | Claude API content helpers |
| `claudeInChrome.ts` | Chrome extension integration |
| `debug.ts` | Debugging assistance |
| `keybindings.ts` | Keybinding help |
| `loop.ts` | Agentic loop explanation |
| `loremIpsum.ts` | Test placeholder |
| `remember.ts` | Memory/CLAUDE.md management |
| `scheduleRemoteAgents.ts` | Remote agent scheduling |
| `simplify.ts` | Code simplification |
| `skillify.ts` | Convert prompts to skills |
| `stuck.ts` | Help when stuck |
| `updateConfig.ts` | Config updates |
| `verify.ts` / `verify/` | Plan verification |
| `batch.ts` | Batch operations |
| `index.ts` | Registration entry point |

#### 4.1.4 Skill Loading (`loadSkillsDir.ts`)

Skills are loaded via `loadSkillsDir()`:

1. Scan directories: project `.claude/skills/`, user `~/.claude/skills/`, plugin dirs
2. Parse markdown frontmatter (description, allowed-tools, model, hooks)
3. Convert to `Command` objects (type: `'prompt'`)
4. Register hooks from skill frontmatter
5. Merge with bundled skills

Skills support argument substitution, shell command execution within prompts, and nested file references.

### 4.2 Hooks System

**Directory:** `src/utils/hooks/`

Hooks are shell commands or functions that execute in response to lifecycle events. They allow users and skills to inject custom behavior at specific points in the execution flow.

#### 4.2.1 Hook Events (27)

The complete list of hook events:

| Event | When Fired |
|-------|------------|
| **`PreToolUse`** | Before a tool executes (can block) |
| **`PostToolUse`** | After a tool executes successfully |
| **`PostToolUseFailure`** | After a tool execution fails |
| **`UserPromptSubmit`** | When user submits a prompt (can modify) |
| **`Stop`** | When the model stops generating (can force continuation) |
| **`StopFailure`** | When stop hook itself fails |
| **`SessionStart`** | When a session begins |
| **`SessionEnd`** | When a session ends |
| **`SubagentStart`** | When a sub-agent starts |
| **`SubagentStop`** | When a sub-agent stops |
| **`PreCompact`** | Before conversation compaction |
| **`PostCompact`** | After conversation compaction |
| **`PermissionRequest`** | When a permission is requested |
| **`PermissionDenied`** | When a permission is denied |
| **`Notification`** | On notification events |
| **`Setup`** | During setup phase |
| **`TeammateIdle`** | When a teammate agent becomes idle |
| **`TaskCreated`** | When a task is created |
| **`TaskCompleted`** | When a task completes |
| **`Elicitation`** | On MCP elicitation |
| **`ElicitationResult`** | On MCP elicitation result |
| **`ConfigChange`** | When config changes |
| **`WorktreeCreate`** | When a git worktree is created |
| **`WorktreeRemove`** | When a git worktree is removed |
| **`InstructionsLoaded`** | When CLAUDE.md files are loaded |
| **`CwdChanged`** | When working directory changes |
| **`FileChanged`** | When a file is modified |

#### 4.2.2 Hook Types

Hooks can be:

- **Shell commands** — Defined in settings.json, executed via `execAgentHook()` / `execHttpHook()`
- **Function hooks** — In-memory callbacks registered by skills/plugins via `addFunctionHook()`, session-scoped
- **Prompt hooks** — Execute a prompt (LLM call) as the hook action via `execPromptHook()`

#### 4.2.3 Hook Configuration

Hooks are configured in `settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "echo 'About to run bash'"
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": "run-my-tests.sh"
      }
    ]
  }
}
```

The `matcher` field filters which tools/events trigger the hook (empty = all).

#### 4.2.4 Hook Architecture

| File | Purpose |
|------|---------|
| `hookEvents.ts` | Event system for broadcasting hook execution |
| `hookHelpers.ts` | Shared utilities |
| `hooksConfigManager.ts` | Config loading and management |
| `hooksConfigSnapshot.ts` | Config snapshot for consistency |
| `hooksSettings.ts` | Settings integration |
| `sessionHooks.ts` | Session-scoped hook registration/removal |
| `postSamplingHooks.ts` | Hooks that run after model sampling |
| `registerFrontmatterHooks.ts` | Auto-register hooks from skill frontmatter |
| `registerSkillHooks.ts` | Skill hook registration |
| `execAgentHook.ts` | Execute shell command hooks |
| `execHttpHook.ts` | Execute HTTP webhook hooks |
| `execPromptHook.ts` | Execute prompt-based hooks |
| `AsyncHookRegistry.ts` | Async hook coordination |
| `ssrfGuard.ts` | SSRF protection for HTTP hooks |
| `fileChangedWatcher.ts` | File change detection for FileChanged hooks |

### 4.3 MCP (Model Context Protocol)

**Directory:** `src/services/mcp/`

MCP allows external servers to provide tools, resources, and prompts (skills) to Claude Code. This is the standard protocol for extending AI assistants with external capabilities.

#### 4.3.1 Transport Types

| Transport | Schema | Use Case |
|-----------|--------|----------|
| `stdio` | `McpStdioServerConfigSchema` | Local process (most common) |
| `sse` | `McpSSEServerConfigSchema` | Server-Sent Events (remote) |
| `sse-ide` | - | IDE-provided SSE transport |
| `http` | `McpHTTPServerConfigSchema` | Streamable HTTP |
| `ws` | - | WebSocket |
| `sdk` | `SdkControlTransport` | In-process SDK control |

#### 4.3.2 Config Scopes

MCP servers can be configured at multiple scopes:

| Scope | Description |
|-------|-------------|
| `local` | `.claude/mcp.json` in project |
| `project` | `.claude/settings.json` in project |
| `user` | `~/.claude/settings.json` |
| `enterprise` | Managed enterprise config |
| `managed` | Remote managed settings |
| `claudeai` | Claude.ai-provided servers |
| `dynamic` | Runtime-added servers |

#### 4.3.3 MCP Client (`client.ts`)

The MCP client manages server connections:

1. **Connection** — Spawn stdio process or connect to SSE/HTTP endpoint
2. **Capability discovery** — List tools, prompts, and resources from server
3. **Tool wrapping** — MCP tools are wrapped as `MCPTool` instances (same interface as built-in tools)
4. **Prompt wrapping** — MCP prompts become `Command` objects (slash commands / skills)
5. **Resource access** — `ListMcpResourcesTool` and `ReadMcpResourceTool` expose MCP resources to the model
6. **Auth** — OAuth support for authenticated MCP servers (with token refresh, XAA/cross-app access)
7. **Elicitation** — Handle server-initiated URL elicitation requests

#### 4.3.4 Key Files

| File | Purpose |
|------|---------|
| `client.ts` | Core MCP client (connection, tool/prompt/resource discovery) |
| `types.ts` | Config schemas, transport types, server definitions |
| `config.ts` | MCP config loading from settings |
| `MCPConnectionManager.tsx` | React hook for managing MCP connections lifecycle |
| `auth.ts` | MCP OAuth authentication |
| `channelPermissions.ts` | Channel-specific permission handling |
| `channelAllowlist.ts` | Allowed channel list |
| `elicitationHandler.ts` | URL elicitation flow |
| `normalization.ts` | Config normalization |
| `envExpansion.ts` | Environment variable expansion in configs |
| `officialRegistry.ts` | Official MCP server registry |
| `InProcessTransport.ts` | In-process MCP transport |
| `SdkControlTransport.ts` | SDK control channel transport |

### 4.4 Plugins System

**Directories:** `src/plugins/`, `src/services/plugins/`, `src/commands/plugin/`

Plugins are installable packages that can provide skills, hooks, MCP servers, and UI components. They are the highest-level extensibility mechanism.

#### 4.4.1 Plugin Types

| Type | ID Format | Source |
|------|-----------|--------|
| **Built-in** | `name@builtin` | Ship with CLI, toggle via `/plugin` UI |
| **Marketplace** | `name@marketplace` | Installed from marketplace registries |
| **Local** | Path-based | Local directory plugins |

#### 4.4.2 Plugin Capabilities

A plugin can provide any combination of:

- **Skills** — Prompt templates (same as skill system)
- **Hooks** — Lifecycle hooks (same as hooks system)
- **MCP Servers** — MCP server configurations
- **Commands** — Slash commands

#### 4.4.3 Plugin Lifecycle

| Phase | Description |
|-------|-------------|
| **Discovery** | Scan marketplace registries + local paths |
| **Installation** | Download, verify, cache in versioned directory |
| **Loading** | Read manifest, register skills/hooks/MCP configs |
| **Enable/Disable** | User toggle persisted to settings |
| **Update** | Check marketplace for new versions, re-install |
| **Uninstall** | Remove from disk and settings |

#### 4.4.4 Plugin Architecture

| File/Dir | Purpose |
|----------|---------|
| `plugins/builtinPlugins.ts` | Built-in plugin registry |
| `plugins/bundled/` | Bundled plugin implementations |
| `services/plugins/pluginOperations.ts` | Core operations (install, uninstall, enable, disable, update) |
| `services/plugins/PluginInstallationManager.ts` | Installation lifecycle management |
| `services/plugins/pluginCliCommands.ts` | CLI command integration |
| `commands/plugin/` | Interactive plugin management UI (18 files) |
| `utils/plugins/` | Plugin utilities (marketplace, cache, loader, policy, versioning) |

#### 4.4.5 Plugin Scopes

Plugins can be installed at different scopes:

| Scope | Visibility |
|-------|------------|
| `user` | Available in all projects for this user |
| `project` | Available only in this project |
| `local` | Local development plugins |
| `managed` | Enterprise-managed plugins |

### 4.5 Vim Mode

**Directory:** `src/vim/`

A full vim emulation layer for the text input area, implemented as a finite state machine.

#### 4.5.1 State Machine

```
VimState
  ├── INSERT mode
  │     └── tracks: insertedText (for dot-repeat)
  └── NORMAL mode
        └── CommandState machine:
              idle ──┬── [d/c/y] ──► operator
                     ├── [1-9]   ──► count
                     ├── [fFtT]  ──► find
                     ├── [g]     ──► g-prefix
                     ├── [r]     ──► replace
                     └── [><]    ──► indent
              operator ──┬── [motion]  ──► execute
                         ├── [0-9]     ──► operatorCount
                         ├── [ia]      ──► operatorTextObj
                         └── [fFtT]    ──► operatorFind
```

#### 4.5.2 Files

| File | Purpose |
|------|---------|
| `types.ts` | State machine type definitions (VimState, CommandState, Operator, FindType) |
| `motions.ts` | Cursor motion implementations (w, b, e, 0, $, f, t, gg, G, etc.) |
| `operators.ts` | Operator implementations (delete, change, yank) |
| `textObjects.ts` | Text object implementations (iw, aw, i", a", i(, a(, etc.) |
| `transitions.ts` | State machine transitions (key → new state) |

#### 4.5.3 Integration

- `components/VimTextInput.tsx` — Vim-aware text input component
- `hooks/useVimInput.ts` — React hook bridging vim state to input events
- `commands/vim/` — `/vim` slash command to toggle vim mode
- State persisted in user settings

### 4.6 Voice

**Files:** `src/services/voice.ts`, `src/hooks/useVoice.ts`, `src/hooks/useVoiceIntegration.tsx`, `src/context/voice.tsx`

Push-to-talk voice input system.

#### 4.6.1 Recording Pipeline

```
User holds voice key
  -> voice.ts: startRecording()
    -> Native audio (cpal via audio-capture-napi) [preferred]
    -> OR SoX `rec` fallback (Linux)
    -> OR arecord (ALSA) fallback (Linux)
  -> 16kHz, mono, WAV format
User releases key
  -> voice.ts: stopRecording()
  -> Send audio to transcription API
  -> Insert transcribed text into prompt input
```

#### 4.6.2 Platform Support

| Platform | Primary | Fallback |
|----------|---------|----------|
| macOS | `audio-capture-napi` (CoreAudio) | — |
| Linux | `audio-capture-napi` (ALSA/PulseAudio) | SoX `rec` / `arecord` |
| Windows | `audio-capture-napi` (WASAPI) | — |

#### 4.6.3 Feature Gate

Voice mode is gated behind `feature('VOICE_MODE')`. All voice-related imports are conditional:
- `useVoiceIntegration` hook
- `VoiceKeybindingHandler` component
- `/voice` command

### 4.7 Remote & Bridge

**Directories:** Multiple directories handle remote functionality:

| Directory | Purpose |
|-----------|---------|
| `src/remote/` | Remote session management (`RemoteSessionManager.ts`) |
| `src/ssh/` | SSH session management (`SSHSessionManager.ts`, `createSSHSession.ts`) |
| `src/bridge/` | Bridge system for connecting to Claude.ai (~25 files) |

#### 4.7.1 Remote Sessions

`RemoteSessionManager.ts` manages remote Claude Code sessions:
- Connect to a running remote session via WebSocket
- View/control a session running on another machine
- Event-sourced state synchronization

#### 4.7.2 SSH Sessions

`SSHSessionManager.ts` / `createSSHSession.ts`:
- Create SSH tunnels to remote machines
- Run Claude Code on remote hosts
- Manage session lifecycle over SSH

#### 4.7.3 Bridge System

The bridge connects the local CLI to Claude.ai, enabling web-based interaction:

| File | Purpose |
|------|---------|
| `bridgeMain.ts` | Bridge entry point |
| `bridgeApi.ts` | Bridge API client |
| `bridgeConfig.ts` | Bridge configuration |
| `bridgeMessaging.ts` | Message protocol |
| `bridgePermissionCallbacks.ts` | Permission handling over bridge |
| `bridgeUI.ts` | Bridge UI state |
| `replBridge.ts` | REPL-side bridge integration |
| `replBridgeHandle.ts` | Bridge handle management |
| `replBridgeTransport.ts` | WebSocket transport |
| `initReplBridge.ts` | Bridge initialization |
| `inboundMessages.ts` | Inbound message handling from Claude.ai |
| `inboundAttachments.ts` | Attachment handling |
| `remoteBridgeCore.ts` | Core bridge logic |
| `sessionRunner.ts` | Remote session runner |
| `capacityWake.ts` | Capacity-based wake |
| `trustedDevice.ts` | Device trust management |
| `jwtUtils.ts` | JWT token handling |
| `codeSessionApi.ts` | Code session API |
| `createSession.ts` | Session creation |

#### 4.7.4 Feature Gates

| Feature | Gate |
|---------|------|
| Bridge mode | `feature('BRIDGE_MODE')` |
| Daemon | `feature('DAEMON')` |
| SSH remote | `feature('SSH_REMOTE')` |
| Remote setup | `feature('CCR_REMOTE_SETUP')` |

### 4.8 Key Findings for Secondary Development

1. **Skills are the easiest extension point** — To add new AI behaviors, create a markdown file in `.claude/skills/` or register a `BundledSkillDefinition`. No core code changes needed. Skills can specify allowed tools, model, and even hooks.

2. **Hooks are the most powerful interception point** — With 27 hook events covering the entire lifecycle (tool execution, prompt submission, session start/end, compaction, permissions, file changes), you can inject custom behavior without modifying core code. `PreToolUse` and `Stop` are the most commonly used.

3. **MCP is the standard extension protocol** — If you're building integrations with external services, use MCP. It's the cleanest way to add tools and resources. Configure via `settings.json` or `.claude/mcp.json`.

4. **Plugins bundle everything** — If you need to distribute a combination of skills, hooks, and MCP servers as a single package, use the plugin system. Built-in plugins are the simplest path for internal features.

5. **Vim mode is self-contained** — The 5 files in `src/vim/` form a complete, well-typed state machine with no dependencies on the rest of the codebase. Easy to extend with new motions or operators.

6. **Remote/Bridge is the most complex subsystem** — With ~25 files handling WebSocket connections, JWT auth, permission bridging, and session management, the bridge system is deeply integrated. Modify with caution.

7. **Feature flags control everything** — Almost every extension subsystem is behind a `feature()` gate. To enable/disable subsystems for your fork, edit `src/_stubs/bun-bundle.ts`. This is the single most important file for controlling what ships in your build.

---

## 5. Common Modification Recipes

Step-by-step guides for the most common secondary development tasks.

### 5.1 Add a New Model Provider

**Goal:** Support a new LLM API (e.g., a custom endpoint, local model, or new cloud provider).

**Approach A: OpenAI-compatible API (simplest)**

If your provider supports the OpenAI chat completions format, no code changes needed:

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_BASE_URL="https://your-provider.com/v1"
bun run start -- --model "your-model-name"
```

The existing `openaiShim.ts` handles the translation automatically. This includes support for providers with thinking/reasoning tokens (e.g., DeepSeek's `reasoning_content`) — see section 2.1.4 for provider-specific compatibility notes.

**Approach B: Custom provider with unique API format**

Files to modify:

| Step | File | Action |
|------|------|--------|
| 1 | `src/services/api/` | Create `yourProviderShim.ts` following the pattern of `openaiShim.ts` |
| 2 | `yourProviderShim.ts` | Implement two functions: `queryModelWithoutStreaming()` and `queryModelWithStreaming()` that return Anthropic-format events |
| 3 | `src/services/api/claude.ts` | In `queryModelWithStreaming()` (~line 752), add a condition to route to your shim based on model name or env var |
| 4 | `src/services/api/providerConfig.ts` | Add model name resolution if your provider uses aliases |

**Key principle:** The rest of the codebase only understands Anthropic stream events. Your shim must translate your provider's response format into `StreamEvent` objects that match the Anthropic SDK types.

**Example routing in `claude.ts`:**

```typescript
// In queryModelWithStreaming():
if (isYourProvider(model)) {
  yield* yourProviderQuery(messages, tools, options)
  return
}
```

### 5.2 Add a New Tool

**Goal:** Give the AI a new capability it can invoke (e.g., a database query tool, deployment tool).

Files to create/modify:

| Step | File | Action |
|------|------|--------|
| 1 | `src/tools/YourTool/` | Create directory |
| 2 | `src/tools/YourTool/YourTool.ts` | Implement the tool |
| 3 | `src/tools.ts` | Register in `getAllBaseTools()` |

**Tool implementation template:**

```typescript
// src/tools/YourTool/YourTool.ts
import type { Tool } from '../../Tool.js'

export const YourTool: Tool = {
  name: 'YourTool',

  description: 'Description shown to the model in the system prompt.',

  inputJSONSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The query to execute',
      },
    },
    required: ['query'],
  },

  isEnabled() {
    return true // or check env vars, feature flags, etc.
  },

  isReadOnly() {
    return true // true = can run in parallel with other read-only tools
  },

  validateInput(input) {
    if (!input.query) {
      return { result: false, message: 'query is required', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input, context) {
    // `input` is the parsed JSON from the model
    // `context` is ToolUseContext with all runtime state
    const result = await doYourWork(input.query)
    return {
      type: 'tool_result',
      tool_use_id: '', // filled by caller
      content: [{ type: 'text', text: result }],
    }
  },
}
```

**Register in `tools.ts`:**

```typescript
import { YourTool } from './tools/YourTool/YourTool.js'

export function getAllBaseTools(): Tools {
  return [
    // ... existing tools
    YourTool,
    // ...
  ]
}
```

**Important considerations:**
- Set `isReadOnly()` correctly — returning `true` allows concurrent execution with other read-only tools
- Tool `name` must be unique across all tools (including MCP tools)
- The `description` is injected into the system prompt, so keep it concise but informative
- For feature-gated tools, use conditional require (see existing patterns in `tools.ts`)

### 5.3 Add a New Skill

**Goal:** Add a reusable prompt template the model can invoke or users can trigger via slash command.

**Approach A: Markdown file (no code changes)**

Skills must use the **directory format**: `.claude/skills/<name>/SKILL.md`. Single `.md` files directly in `/skills/` are NOT supported by `loadSkillsDir.ts`.

```bash
# Project-level skill — directory format required
mkdir -p .claude/skills/my-skill
```

```markdown
# .claude/skills/my-skill/SKILL.md
---
description: "Deploy the application to production"
allowed-tools:
  - Bash
  - Read
---

You are a deployment assistant. Deploy the application by:
1. Running the test suite
2. Building the production bundle
3. Deploying to the configured target

User request: $ARGUMENTS
```

The skill will appear as `/my-skill` (directory name = command name) and the model can invoke it via `SkillTool`.

**Platform Operation Playbooks (LocoAgent pattern)**

For social media platforms, skills serve as full operation playbooks injected on demand. This is different from the persona approach — playbooks should be injected in full because composite tasks (like + reply + repost) require all operation sections to be available simultaneously.

Current platform skills:

| Platform | Path | Command | Sections | Operations |
|----------|------|---------|----------|-----------|
| X.com | `.claude/skills/x-com/SKILL.md` | `/x-com` | 7 | 32+ |

The X.com skill covers: Browse & Read, Navigation, Content Creation, Engagement, Social Graph, Profile Management, and Lists. Tested with agent-browser 0.24.0, Chrome CDP on port 9222.

**Why full injection (not partial loading):**
- Composite tasks like like+comment+repost require multiple playbook sections simultaneously
- Full injection enables one-pass completion with no mid-task skill lookups
- Token cost of ~1500 lines is acceptable within x.com automation scope

To add a new platform skill:
```bash
mkdir -p .claude/skills/linkedin
# Create .claude/skills/linkedin/SKILL.md with frontmatter + playbook content
```

**Approach B: Bundled skill (compiled into CLI)**

| Step | File | Action |
|------|------|--------|
| 1 | `src/skills/bundled/yourSkill.ts` | Create skill definition |
| 2 | `src/skills/bundled/index.ts` | Register the skill |

```typescript
// src/skills/bundled/yourSkill.ts
import { registerBundledSkill } from '../bundledSkills.js'

registerBundledSkill({
  name: 'your-skill',
  description: 'What this skill does',
  allowedTools: ['Bash', 'Read', 'Edit'],
  userInvocable: true,  // available as /your-skill

  async getPromptForCommand(args, context) {
    return [{
      type: 'text',
      text: `Your prompt template here. User said: ${args}`,
    }]
  },
})
```

### 5.4 Add a New Slash Command

**Goal:** Add a new `/command` that users can type in the REPL.

| Step | File | Action |
|------|------|--------|
| 1 | `src/commands/your-command/index.ts` | Create command definition |
| 2 | `src/commands.ts` | Import and register |

**Command definition:**

```typescript
// src/commands/your-command/index.ts
import type { Command } from '../../types/command.js'

const yourCommand: Command = {
  type: 'local',         // 'local' = runs locally, 'prompt' = sends to model
  name: 'your-command',
  description: 'What this command does',
  isEnabled: true,
  isHidden: false,

  async call({ args, abortController }) {
    // For 'local' commands: execute logic directly
    // Return display result
    return {
      type: 'local-jsx',
      jsx: null,          // React element to display, or null
      display: 'success', // 'success' | 'error' | 'info'
      message: 'Done!',
    }
  },
}

export default yourCommand
```

**Register in `commands.ts`:**

```typescript
import yourCommand from './commands/your-command/index.js'

// Add to the COMMANDS array inside the function
```

**Command types:**
- `'local'` — Runs JavaScript directly (e.g., `/clear`, `/cost`, `/theme`)
- `'prompt'` — Sends a prompt to the model (e.g., `/commit`, `/review`) — this is the same as a skill

### 5.5 Enable a Feature Flag

**Goal:** Turn on one of the 86 feature-gated capabilities.

**File:** `src/_stubs/bun-bundle.ts`

**Before:**

```typescript
export function feature(_name: string): boolean {
  return false
}
```

**After (selective):**

```typescript
const ENABLED = new Set([
  'VOICE_MODE',        // Push-to-talk voice input
  'CONTEXT_COLLAPSE',  // Advanced context management
  'REACTIVE_COMPACT',  // Reactive conversation compaction
  'WORKFLOW_SCRIPTS',  // Workflow tool
])

export function feature(name: string): boolean {
  return ENABLED.has(name)
}
```

**Caution:** Some features have dependencies on internal Anthropic infrastructure (API endpoints, auth systems) that are not available in this fork. Features most likely to work in the fork:

| Likely to work | May need adaptation | Unlikely to work (infra dependency) |
|----------------|--------------------|------------------------------------|
| `VOICE_MODE` | `BRIDGE_MODE` | `KAIROS` (full assistant mode) |
| `CONTEXT_COLLAPSE` | `DAEMON` | `CCR_REMOTE_SETUP` |
| `REACTIVE_COMPACT` | `SSH_REMOTE` | `KAIROS_CHANNELS` |
| `HISTORY_SNIP` | `WORKFLOW_SCRIPTS` | `NATIVE_CLIENT_ATTESTATION` |
| `CACHED_MICROCOMPACT` | `COORDINATOR_MODE` | `SELF_HOSTED_RUNNER` |
| `TOKEN_BUDGET` | `EXPERIMENTAL_SKILL_SEARCH` | `BYOC_ENVIRONMENT_RUNNER` |
| `MCP_SKILLS` | `WEB_BROWSER_TOOL` | `CHICAGO_MCP` |

**Testing a feature flag:** Enable it, run `bun run start`, and watch for import errors. Missing dependencies indicate the feature requires internal packages that need stubs.

---

## 5.6 LocoAgent: agent-browser Integration

This project extends the base Claude Code fork into **LocoAgent** — a social media agent — by integrating `agent-browser` CLI as the primary browser automation tool.

### How It Works

The full `agent-browser` CLI reference is injected into the agent's system prompt at startup, so the agent natively knows how to use the tool without any extra instructions per-task.

**Injection point:** `src/constants/prompts.ts` — `getAgentBrowserSection()` function (called from `getSystemPrompt()`).

```
getSystemPrompt()
  → getSimpleIntroSection()
  → getSimpleSystemSection()
  → getSimpleDoingTasksSection()
  → getActionsSection()
  → getUsingYourToolsSection()
  → getAgentBrowserSection()        ← agent-browser full CLI reference
  → getSimpleToneAndStyleSection()
  → getOutputEfficiencySection()
  → [dynamic sections]
```

The section is placed in the **static (cacheable) region** of the system prompt — before `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` — so it benefits from prompt caching and doesn't re-compute each turn.

### Source of Truth

The raw CLI reference text lives in `docs/agent-browser-help.txt` (extracted from `agent-browser --help` output). The same content is embedded verbatim in `getAgentBrowserSection()`.

### Modifying the agent-browser Knowledge

To update the CLI reference (e.g. after an agent-browser upgrade):

1. Re-run `agent-browser --help` and update `docs/agent-browser-help.txt`
2. Update the string literal in `getAgentBrowserSection()` in `src/constants/prompts.ts`

### Typical LocoAgent Task Flow

```bash
# Agent executes these via the Bash tool:
agent-browser open https://twitter.com
agent-browser snapshot -i                           # perceive interactive elements
agent-browser --session-name twitter fill @e3 "..."  # act with session persistence
agent-browser click @e5
agent-browser screenshot result.png
```

---

## 5.7 LocoAgent: Chrome CDP Pre-launch Setup

To operate real social accounts (e.g. X/Twitter), `agent-browser` needs to connect to a Chrome instance that already holds the user's login session. This requires a one-time pre-launch setup before starting the agent.

### Why This Is Necessary

`agent-browser` by default launches a fresh headless Chrome with no cookies or login state. To operate authenticated social accounts, it must connect via CDP to a Chrome instance launched from a copy of the user's real Chrome profile (which already contains session cookies).

### Setup Flow

```
scripts/setup-chrome.sh
  1. killall "Google Chrome"               # clean slate
  2. cp ~/Library/.../Chrome/Default  →  /tmp/locoagent-chrome-profile/Default
     cp ~/Library/.../Chrome/Local State → /tmp/locoagent-chrome-profile/
  3. Launch Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/locoagent-chrome-profile
  4. Wait for http://127.0.0.1:9222/json/version to respond
  5. agent-browser connect 9222            # register CDP session
```

After setup, all subsequent `agent-browser` commands reuse the connected Chrome session with full login state.

### Usage

```bash
# 1. (One-time) configure profile paths in .env if non-default:
# CHROME_SOURCE_PROFILE=/Users/you/Library/Application Support/Google/Chrome/Default
# CHROME_WORK_PROFILE=/tmp/locoagent-chrome-profile
# CHROME_DEBUG_PORT=9222

# 2. Run setup (do this before bun run start for social tasks)
bun run setup-chrome

# 3. Start the agent
bun run start
```

### Configuration Variables

| Variable | Default | Description |
|---|---|---|
| `CHROME_SOURCE_PROFILE` | `~/Library/Application Support/Google/Chrome/Default` | Source Chrome profile with real login sessions |
| `CHROME_WORK_PROFILE` | `/tmp/locoagent-chrome-profile` | Working copy used by the CDP-connected Chrome |
| `CHROME_DEBUG_PORT` | `9222` | CDP remote debugging port |
| `CHROME_BIN` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | Chrome binary path |

All variables are read from `.env` automatically (via `stubs/globals.ts` preload and the `source .env` in the script itself).

### Key Notes from Operational Experience

1. **Must copy `Local State`** alongside `Default/` — Chrome cannot read the profile correctly without it
2. **Profile copy is large (~2-3GB)** — `setup-chrome.sh` does a full `cp -r`, which takes time on first run
3. **agent-browser connects, not launches** — `agent-browser connect 9222` attaches to the already-running Chrome; does not launch a new one
4. **Session persists across commands** — the daemon architecture means CDP session stays alive between individual `agent-browser` commands
5. **Must kill Chrome first** — running Chrome will lock profile files; the script does `killall "Google Chrome"` before copying

### Files

| File | Purpose |
|---|---|
| `scripts/setup-chrome.sh` | The setup script |
| `.env` | Chrome config vars (commented defaults, uncomment to override) |
| `package.json` → `setup-chrome` | `bun run setup-chrome` shortcut |

---

## 5.8 LocoAgent: Digital Persona System

> **Status: DISABLED** — `persona/persona.md` and `persona/tasks.md` have been renamed to `.bak` and are not loaded.
>
> **Reason:** Testing showed that long persona documents (168 lines) hijack LLM attention weights, causing topic narrowing toward niche keywords in the persona instead of executing the actual task. Simple role prompts (e.g. "you are an AI researcher") outperform detailed persona documents. The platform skill approach (section 5.3) replaces this for operational context.
>
> To re-enable: rename `persona/persona.md.bak` → `persona/persona.md`.

The persona system gives the agent a stable, editable identity that persists across all social media sessions. It bridges the gap between a generic AI assistant and a branded social operator.

### Architecture

```
persona/persona.md          ← editable by the user (currently disabled: .bak)
  ↓ (read at startup)
getPersonaSection()         ← src/constants/prompts.ts
  ↓ (injected into)
getSystemPrompt()           ← static/cacheable region
  ↓
agent knows who it is before the first turn
```

### File: `persona/persona.md`

The persona document is structured into 8 sections:

| Section | Purpose |
|---------|---------|
| `1. Identity` | Real name, handle, social links, role |
| `2. Core Positioning` | One-line pitch, expertise pillars, differentiation |
| `3. Audience & Community` | Target communities, credibility signals to reference |
| `4. Voice & Tone` | Writing style, per-platform tone, what to avoid |
| `5. Content Themes` | Primary/secondary topics, topics to avoid |
| `6. Engagement Principles` | Reply guidelines, like/follow frequency limits |
| `7. Current Projects` | Active projects with stats and links |
| `8. Agent Operating Instructions` | Rules for the agent when using this persona |

### How It Works in Code

`getPersonaSection()` in `src/constants/prompts.ts` reads `persona/persona.md` at runtime using `import.meta.url` to resolve the project root. It wraps the content under the heading `# Personal Persona & LocoAgent Identity` and injects it into the static (cacheable) region of the system prompt — before the `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` marker.

If `persona/persona.md` is missing or unreadable, the function returns `''` silently and the agent operates without persona context.

### Editing the Persona

`persona/persona.md` is a plain Markdown file — edit it directly. Changes take effect on the next agent startup. Key things to keep updated:

- **Section 7 (Current Projects)** — update download counts, star counts after milestones
- **Section 6 (Engagement Principles)** — tune frequency limits to platform risk tolerance
- **Section 5 (Content Themes)** — adjust as research focus evolves

### Source

The initial persona was generated from `docs/msj-cv.html` (personal CV). The CV is kept in `docs/` as a reference for future persona updates.

---

## 5.9 LocoAgent: Operation Log & State

The operation log gives the agent persistent memory across sessions — it knows what it has already done and can avoid repeating actions on the same content.

### Design Philosophy

- **JSON file, not a database** — `persona/operation-log.json` is human-readable, editable, and zero-dependency. Sufficient for hundreds of operations per day.
- **Agent-driven writes** — the agent calls `scripts/log-operation.ts` via the Bash tool after each action. No automatic instrumentation.
- **Read at startup via system prompt** — a 30-day summary is injected into the system prompt so the agent has full context before the first turn.

### Data Model

Each entry in `operation-log.json` has:

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO string | When the action was taken |
| `platform` | string | `x`, `reddit`, `linkedin`, etc. |
| `action` | string | `like`, `comment`, `repost`, `follow`, `upvote`, `reply`, `post` |
| `url` | string | Canonical URL of the target post/user |
| `status` | string | `success`, `failed`, `skipped`, `restricted` |
| `note` | string? | Optional context (comment text summary, reason for skip, etc.) |

### CLI Helper: `scripts/log-operation.ts`

The agent uses this script via Bash tool for all log operations:

```bash
# Before acting — check if already done (exit 0 = done, exit 1 = not done)
bun run scripts/log-operation.ts check \
  --platform x --action like --url "https://x.com/.../status/123"

# After a successful action — record it
bun run scripts/log-operation.ts add \
  --platform x --action like --url "https://x.com/.../status/123" \
  --status success --note "Qwen3 perf post by @researcher"

# View recent 20 operations
bun run scripts/log-operation.ts recent --limit 20

# Get summary for system prompt (last N days)
bun run scripts/log-operation.ts summary --days 30
```

### System Prompt Injection

`getOperationLogSection()` in `src/constants/prompts.ts` runs `log-operation.ts summary` at startup and injects the result into the system prompt static region. This means the agent sees its full 30-day history before handling the first user message.

The injected section includes:
- Per-platform action counts
- Complete list of already-acted URLs (the agent must not repeat these)
- Instructions to `check` before acting and `add` after acting

### Agent Workflow Pattern

```
1. User gives task: "Go like 5 posts about agent training on X"
2. Agent opens X, finds candidate posts
3. For each post URL:
   a. bun run scripts/log-operation.ts check --platform x --action like --url <url>
   b. If exit 0 → skip (already liked)
   c. If exit 1 → agent-browser click <like-button>
   d. Verify like succeeded via snapshot
   e. bun run scripts/log-operation.ts add --platform x --action like --url <url> --status success
4. Report summary of what was done vs skipped
```

### Files

| File | Purpose |
|------|---------|
| `persona/operation-log.json` | The state store (JSON, human-editable) |
| `scripts/log-operation.ts` | CLI helper: add / check / recent / summary |
| `src/constants/prompts.ts` → `getOperationLogSection()` | Injects 30-day summary into system prompt |

---

## 5.10 LocoAgent: Task Scheduling

The task scheduling system replaces ad-hoc prompts with a structured, repeatable session workflow. Instead of writing a new prompt each time, you run one command and the agent executes today's appropriate tasks automatically.

### How It Works

```
persona/tasks.md            ← editable task definitions
  ↓ (read by run-tasks.ts)
scripts/run-tasks.ts        ← builds prompt from tasks.md + log summary + day context
  ↓ (launches)
agent (via --print)         ← executes tasks, checks/writes operation log
  ↓
persona/operation-log.json  ← updated with new actions
```

### Usage

```bash
# Run today's scheduled tasks (daily always, weekly only on Mondays)
bun run run-tasks

# Preview the prompt without running (for debugging)
bun run run-tasks:dry

# Restrict to one platform
bun run scripts/run-tasks.ts --platform x
bun run scripts/run-tasks.ts --platform reddit
```

### File: `persona/tasks.md`

The task schedule is a plain Markdown file with two sections:

**Daily Tasks** — run every session:
1. Engage with relevant content (like posts matching topic queries)
2. Monitor own project mentions (LocoOperator, LocoTrainer, LocoreMind)
3. Leave 1 technical comment on the most relevant post

**Weekly Tasks** — run on Monday sessions only:
4. Follow 3-5 relevant researchers
5. Post 1 original tweet about recent research findings

**Session Constraints** table limits per-session action counts to avoid platform risk (max 10 likes, 2 comments, 5 follows, 1 post per session).

### How `run-tasks.ts` Works

The script:
1. Reads `persona/tasks.md` in full
2. Runs `log-operation.ts summary --days 7` to get recent history
3. Detects the current day (Monday triggers weekly tasks)
4. Builds a structured prompt combining tasks + log context + execution rules
5. Launches the agent via `bun run --preload stubs/globals.ts src/entrypoints/cli.tsx --print <prompt>`
6. Streams agent output directly to stdout (10-minute timeout)

### System Prompt Integration

`getTasksSection()` in `src/constants/prompts.ts` reads `persona/tasks.md` at startup and injects it into the static system prompt region. This means the agent always has the task schedule available — even in interactive `bun run start` sessions, not just `run-tasks` sessions.

### Files

| File | Purpose |
|------|---------|
| `persona/tasks.md` | Task definitions (editable) |
| `scripts/run-tasks.ts` | Task runner script |
| `package.json` → `run-tasks` | `bun run run-tasks` shortcut |
| `package.json` → `run-tasks:dry` | `bun run run-tasks:dry` for prompt preview |
| `src/constants/prompts.ts` → `getTasksSection()` | Injects task schedule into system prompt |

---

## 5.11 LocoAgent: Realtime Trajectory Monitor

`scripts/tail-agent.ts` provides real-time visibility into agent execution by watching the session `.jsonl` file and printing structured output as entries are written (100ms flush interval).

### Problem it solves

`--print` mode is a black box: you launch the agent and wait for the final answer with no visibility into what's happening. `tail-agent.ts` solves this by tailing the `.jsonl` file that the agent writes to continuously during execution.

### Usage

```bash
# Watch latest session — only new entries from this point forward
bun run tail

# Watch latest session from the beginning (replay full history)
bun run tail:history

# List recent sessions with timestamps and file sizes
bun run tail:list

# Watch a specific session by ID
bun run tail <session-id>
bun run tail <session-id> --from-start
```

### Output Format

| Prefix | Color | Meaning |
|--------|-------|---------|
| `● Agent:` | Cyan | Agent's text output (what it's saying/doing) |
| `⚡ Bash:` | Yellow | Shell command being executed |
| `✓ Result:` | Green | Tool result (truncated if >300 chars) |
| `📋 Todo:` | Blue | Current in-progress todo item |
| `💭` | Gray/dim | DeepSeek reasoning_content (thinking) |
| `═══ New Task ═══` | Green bold | Task start marker |

### How It Works

The script polls the `.jsonl` file every 200ms. Each line is a JSON entry — it filters for `type: "assistant"` entries and extracts:
- `content[].type === "text"` → agent speech
- `content[].type === "tool_use"` → Bash commands, TodoWrite, other tools
- `content[].type === "thinking"` → DeepSeek reasoning

`type: "user"` entries with `tool_result` blocks show command results. `isMeta: true` entries (skill playbook injection) are skipped to avoid noise.

### Typical Workflow

```bash
# Terminal 1: start the tail monitor
bun run tail

# Terminal 2: launch the agent task
bun run --preload ./stubs/globals.ts ./src/entrypoints/cli.tsx --print \
  "/x-com open timeline, like first post, report result"
```

Terminal 1 shows live step-by-step execution. Terminal 2 shows the final output when done.

### Key Files

| File | Purpose |
|------|---------|
| `scripts/tail-agent.ts` | Realtime trajectory monitor |
| `package.json` → `tail` | `bun run tail` shortcut |
| `package.json` → `tail:history` | Replay from start |
| `package.json` → `tail:list` | List sessions |

---

## 5.12 LocoAgent: Workflow Automation System

Workflows are **pure browser-automation pipelines** that run without any LLM/agent involvement. They execute deterministic sequences of `agent-browser` commands and `curl` requests. The agent's role is limited to **sensing workflow state** (via system prompt injection) and **controlling workflows** (start/stop via the workflow-engine CLI).

### Design Philosophy

- **No LLM in the loop** — workflows are fully automated scripts, not agent-driven. This eliminates token cost, latency, and non-determinism.
- **Agent as supervisor** — the agent can inspect workflow status (injected into system prompt) and control lifecycle via Bash tool calls to `workflow-engine.ts`.
- **JSON definition + TypeScript executor** — each workflow is a JSON config file paired with a TypeScript executor script.
- **State persistence** — `workflows/state.json` tracks run history, status, and step counts across sessions.

### Architecture

```
workflows/<id>.json              ← workflow definition (config, schedule, executor path)
  ↓ (read by)
scripts/workflow-engine.ts       ← lifecycle CLI (start/stop/reset/run/status/history/summary)
  ↓ (spawns)
workflows/executors/<script>.ts  ← executor: pure browser automation, outputs JSON summary on stdout
  ↓ (results saved to)
workflows/state.json             ← persistent state (status, lastRun, history[])
  ↓ (read at startup by)
getWorkflowStatusSection()       ← src/constants/prompts.ts → injected into system prompt
```

### Workflow Definition Format

Each workflow is a JSON file in `workflows/`:

```json
{
  "id": "hf-papers-to-x",
  "name": "HuggingFace Daily Papers → X.com Post",
  "description": "Fetch top papers from HuggingFace, download thumbnails, and post each as image+text tweet to X.com",
  "schedule": "daily",
  "executor": "executors/hf-papers-to-x.ts",
  "config": {
    "maxPapers": 5,
    "minUpvotes": 5,
    "cdpPort": 9222,
    "proxy": "http://127.0.0.1:6738",
    "abstractMaxChars": 150,
    "outputDir": ".tmp",
    "xUsername": "mashijiann",
    "hfDate": "2026-05-06"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, used as `--id` argument |
| `name` | string | Human-readable name |
| `description` | string | What the workflow does |
| `schedule` | string | Intended frequency (`daily`, `weekly`, etc.) — informational only, not auto-scheduled |
| `executor` | string | Path to executor script relative to `workflows/` |
| `config` | object | Arbitrary config passed to executor as `--config` JSON |

**`hf-papers-to-x` config fields:**

| Field | Type | Description |
|-------|------|-------------|
| `maxPapers` | number | Max papers to select per run |
| `minUpvotes` | number | Minimum upvotes threshold |
| `cdpPort` | number | Chrome CDP port for agent-browser |
| `proxy` | string? | HTTP proxy for thumbnail downloads |
| `abstractMaxChars` | number | Max abstract length before truncation |
| `outputDir` | string? | Output directory relative to `workflows/` |
| `xUsername` | string? | X.com username for post URL extraction (default: `mashijiann`) |
| `hfDate` | string? | Override date (e.g. `"2026-05-06"`) — fetches that day's papers instead of auto-detecting from redirect |

### Executor Contract

Executor scripts must:

1. Accept `--config <json_string>` as a CLI argument
2. Write structured log output to **stderr** (visible during execution)
3. Write a **single JSON summary line** to **stdout** as the last line (parsed by workflow-engine)

The JSON summary must include:

```typescript
{
  stepsCompleted: number,
  stepsTotal: number,
  // ...any additional fields (papers, posted count, etc.)
}
```

### Workflow Engine CLI

```bash
bun run workflow list                     # list all workflows + status (JSON)
bun run workflow status [--id <id>]       # detailed status (one or all)
bun run workflow run --id <id>            # execute synchronously (blocking, one-shot)
bun run workflow start --id <id>          # start in background (one-shot, non-blocking, returns PID)
bun run workflow daemon --id <id> [--interval <min>]  # start long-running daemon (default: 60min)
bun run workflow stop --id <id>           # stop at next checkpoint + kill background process
bun run workflow reset --id <id>          # clear stopped state back to idle
bun run workflow history --id <id>        # show execution history
bun run workflow summary                  # compact summary for system prompt injection
```

**`run` vs `start` vs `daemon`**:
- `run` is synchronous (spawnSync, blocks until done, one-shot).
- `start` spawns `workflow-engine.ts run` as a detached background process, saves PID to state.json, and returns immediately. One-shot — exits after a single execution. Background output goes to `workflows/.tmp/<id>.log`.
- `daemon` runs the workflow repeatedly on a fixed interval (default 60 minutes). Each cycle: check stop signal → run executor → wait interval → repeat. Dedup in the executor ensures idempotent re-runs — if no new papers have appeared, the cycle completes in seconds with zero posts. The daemon checks for stop signals every 10 seconds during the wait interval, so `stop` takes effect within 10s even between cycles.

**`stop`**: Writes `stopped` to state.json (executor reads this at checkpoints and breaks the loop), then sends SIGTERM to kill the background process. Works for both `start` and `daemon` modes. Use `reset` to clear the stopped state back to idle.

### Agent-Workflow Integration

The agent interacts with workflows through three mechanisms:

**1. System prompt awareness** (`src/constants/prompts.ts` → `getWorkflowStatusSection()`):
- On every agent session start, `workflow-engine.ts summary` is executed and injected into the system prompt
- The agent sees: workflow status, last run time/result, PID if running in background, and available control commands
- This lets the agent answer questions like "did today's papers get posted?" and decide whether to trigger a workflow

**2. Task session auto-run** (`scripts/run-tasks.ts`):
- Before the agent's daily task session starts, `run-tasks.ts` automatically runs all `schedule: "daily"` workflows
- Skip conditions: already ran today, currently running/stopped
- Results are injected into the agent's session prompt under "Workflow Results (pre-session)"
- This means daily workflows like `hf-papers-to-x` run without LLM involvement, then the agent handles social engagement tasks

**3. Interactive control** (agent uses Bash tool):
- The agent can run `bun run workflow start/stop/reset/run/status` via the Bash tool during a conversation
- Example: user says "post today's HuggingFace papers" → agent runs `bun run workflow run --id hf-papers-to-x`
- Example: user says "stop the paper posting" → agent runs `bun run workflow stop --id hf-papers-to-x`

### Checkpoint Protocol

Executors must honor stop signals for the agent to have real control:

```typescript
// In executor: read state.json at safe points between expensive operations
function checkWorkflowStopped(): boolean {
  const state = JSON.parse(readFileSync('workflows/state.json', 'utf-8'))
  const ws = state.workflows?.['<workflow-id>']
  return ws?.status === 'stopped'
}

// Call between iterations (e.g. between posting papers)
if (checkWorkflowStopped()) { log('Workflow stopped'); break }
```

Checkpoints should be placed:
- Between processing individual items (papers, posts, etc.)
- Before expensive network operations
- NOT in the middle of an atomic operation (e.g. not between uploading an image and clicking Post)

### State Model

`workflows/state.json` persists per-workflow state:

```typescript
interface WorkflowState {
  status: 'idle' | 'running' | 'stopped'
  lastRun: {
    startedAt: string        // ISO timestamp
    finishedAt: string | null
    status: 'success' | 'failed' | 'partial'
    stepsCompleted: number
    stepsTotal: number
    error?: string
    output?: Record<string, unknown>  // Full executor JSON output
  } | null
  runCount: number
  history: WorkflowRun[]     // Last 30 runs
}
```

### System Prompt Injection

`getWorkflowStatusSection()` in `src/constants/prompts.ts` runs `workflow-engine.ts summary` at startup and injects the result into the system prompt static region (between `getOperationLogSection()` and `getAgentBrowserSection()`). This means the agent sees all workflow statuses before the first turn.

### HuggingFace Date Tracking

HuggingFace Daily Papers updates **Monday through Friday only**. Accessing `/papers` on a weekend redirects to the most recent Friday's page. Executors detect the **actual HF date** from the redirect URL rather than using the system date:

```
Request: https://huggingface.co/papers
Redirect: https://huggingface.co/papers/date/2026-05-08  ← actual date extracted from here
```

This means:
- Output directories use the HF date (`hf-2026-05-08/`), not system date — weekend runs correctly reuse Friday's directory
- The workflow can run any day of the week; it naturally handles weekends by seeing no date change
- Running multiple times per day is safe — the dedup layer prevents duplicate posts

### Dedup: posted-papers.json

`workflows/.tmp/posted-papers.json` is a global dedup store that tracks every paper posted to X.com by `arxivId`. This replaces the earlier `skipPaperIndices` approach which required manual index management.

```typescript
interface PostedStore {
  version: number
  papers: Array<{
    arxivId: string    // unique paper identifier
    title: string
    postedAt: string   // ISO timestamp of when it was posted
    hfDate: string     // HF daily papers date it appeared on
  }>
}
```

**How dedup works in `hf-papers-to-x.ts`:**
1. Load `posted-papers.json` at startup, build a `Set<arxivId>` of already-posted papers
2. After fetching the paper list, mark each paper as `skippedDedup: true` if its `arxivId` is in the set
3. Only fetch abstracts, download thumbnails, and post for papers NOT in the set
4. After each successful post, immediately append the `arxivId` to the store and save — so even a mid-run crash preserves partial progress
5. On the next run, those papers are automatically skipped

**Idempotent daily operation:** The workflow can be run at any frequency (hourly, multiple times daily, etc.). Each run fetches the current HF page, filters out already-posted papers, and only posts new ones. This handles:
- Papers whose upvotes cross the `minUpvotes` threshold later in the day
- Papers that failed to post in a previous run (not recorded in dedup store)
- Weekend/holiday runs (no new papers = all skipped, clean exit)

### X.com Search & AI Reply Workflow (`x-search-reply`)

This workflow searches X.com's Latest tab for a keyword, reads each post, generates a contextual reply using an LLM (DeepSeek v4 flash), and posts the reply. It is the first workflow to integrate an external LLM API for content generation (as opposed to the HF workflows which only use browser automation).

**4-step pipeline:**

| Step | Description |
|------|-------------|
| 1. Search | Open X.com Latest tab for `searchQuery`, extract post URLs via DOM query, scroll for more, deduplicate by status ID, filter own posts (`xUsername`) |
| 2. Read Posts | Navigate to each post detail page, read content via `ab("snapshot -i -c -s 'article'")`, cap at 1000 chars |
| 3. Generate Replies | Call DeepSeek API (`/chat/completions`) with post content + system prompt, cap reply at 280 chars |
| 4. Post Replies | Navigate to post → find reply textbox → `fill` reply text → click `button "Reply"` → verify textbox empty (3 retry attempts) |

**Config (`workflows/x-search-reply.json`):**

```json
{
  "searchQuery": "ai agent",
  "maxPosts": 5,
  "cdpPort": 9222,
  "xUsername": "mashijiann",
  "outputDir": ".tmp",
  "replySystemPrompt": "You are a knowledgeable AI enthusiast on X.com..."
}
```

**DeepSeek API integration:**
- Loads API config from `.env`: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (defaults to `https://api.deepseek.com`), `OPENAI_MODEL` (defaults to `deepseek-v4-flash`)
- Uses OpenAI-compatible chat completions endpoint
- System prompt instructs: 1-2 sentences, under 200 chars, no hashtags/emojis, reply in same language as post
- Temperature 0.8 for varied but coherent replies

**Dedup: replied-posts.json:**

`workflows/.tmp/replied-posts.json` tracks posts already replied to, preventing duplicate replies across daemon cycles.

```typescript
interface RepliedStore {
  version: number
  description: string
  posts: Array<{
    postUrl: string      // full X.com post URL
    repliedAt: string    // ISO timestamp
    searchQuery: string  // query used when this reply was made
  }>
}
```

Dedup is checked at search time (step 1) by comparing extracted URLs against the store. After each successful reply (step 4), the post is immediately appended and saved.

**Typical daemon usage:**

```bash
# Run every 3 minutes
bun run workflow daemon --id x-search-reply --interval 3

# Stop
bun run workflow stop --id x-search-reply
```

### Current Workflows

| Workflow | ID | Executor | Description |
|----------|----|----------|-------------|
| HuggingFace Daily Papers | `hf-daily-papers` | `executors/hf-daily-papers.ts` | Fetch paper list, abstracts, and thumbnails from HuggingFace (data only, no posting) |
| HuggingFace → X.com Pipeline | `hf-papers-to-x` | `executors/hf-papers-to-x.ts` | Full pipeline: fetch HF papers → download thumbnails → post as image+text tweets to X.com |
| X.com Search & AI Reply | `x-search-reply` | `executors/x-search-reply.ts` | Search X.com Latest tab → read posts → generate AI reply via DeepSeek → post reply |
| Post Single Paper | — | `executors/post-hf-paper.ts` | Standalone executor: post one paper to X.com (CLI args, not workflow-engine managed) |

### Executor Implementation Notes

**Browser automation via `agent-browser` CLI:**
- All executors use `agent-browser --cdp <port>` to connect to the existing Chrome CDP session
- The `ab()` helper wraps `execSync` calls with 30s timeout and error handling
- `abEval()` writes JavaScript to a temp file then runs `eval "$(cat 'file')"` to avoid shell quoting issues with Bun

**X.com posting pattern (in `hf-papers-to-x.ts` and `post-hf-paper.ts`):**
- **Post + self-reply**: Main tweet contains title + abstract + image (NO links, NO hashtags). Paper link is posted as a self-reply to avoid X.com link throttling.
- Upload image: `upload 'input[type="file"]' "<path>"`
- Fill text: find `textbox "Post text"` ref via snapshot, then `fill @ref "<text>"`
- Click Post: find `button "Post"` ref via snapshot, click, wait 5s, verify text cleared
- Extract post URL: after posting, query `a[href*="/<username>/status/"]` in timeline DOM, pick highest status ID
- Self-reply: navigate to post URL, find reply `textbox "Post text"`, fill with `Paper: <url>`, click `button "Reply"` (not "Post")
- Retry logic: up to 3 attempts with re-snapshot between each (refs change after DOM updates)
- Tweet auto-trimming: progressive shortening (cut abstract → drop abstract) to fit 280 char limit

**Date override (`hfDate` config):**
- When `hfDate` is set, the executor opens `https://huggingface.co/papers/date/<hfDate>` directly instead of `https://huggingface.co/papers` (which auto-redirects to today's date)
- Useful for backfilling past dates or testing with specific paper sets

**Proxy support:**
- Thumbnail downloads use `curl` with `--proxy` flag when `config.proxy` is set
- HuggingFace page loads go through the CDP Chrome instance (proxy configured at Chrome level)

### Adding a New Workflow

1. Create `workflows/<id>.json` with the definition
2. Create `workflows/executors/<script>.ts` implementing the executor contract
3. Test with: `bun run workflow run --id <id>`
4. Verify with: `bun run workflow status --id <id>`

The workflow will automatically appear in `workflow list` and the system prompt summary.

### Files

| File | Purpose |
|------|---------|
| `scripts/workflow-engine.ts` | Workflow lifecycle CLI |
| `workflows/*.json` | Workflow definitions (excluding `state.json`) |
| `workflows/state.json` | Persistent state store |
| `workflows/executors/*.ts` | Executor scripts |
| `workflows/.tmp/` | Output data directory (thumbnails, papers.json per date) |
| `workflows/.tmp/posted-papers.json` | Global dedup store for HF papers (arxivId → posted timestamp) |
| `workflows/.tmp/replied-posts.json` | Global dedup store for X.com replies (postUrl → replied timestamp) |
| `src/constants/prompts.ts` → `getWorkflowStatusSection()` | Injects workflow summary into system prompt |
| `package.json` → `workflow`, `workflow:*` | CLI shortcuts (`workflow:daemon` for long-running mode) |

### Daemon Mode

The `daemon` command enables long-running, unattended operation. Typical usage:

```bash
# Start daemon (runs every 60 minutes, checks for new papers)
nohup bun run workflow:daemon --id hf-papers-to-x --interval 60 > workflows/.tmp/hf-papers-to-x-daemon.log 2>&1 &

# Custom interval (every 30 minutes)
bun run workflow daemon --id hf-papers-to-x --interval 30

# Stop the daemon (responds within 10 seconds)
bun run workflow stop --id hf-papers-to-x

# After stopping, reset to idle before restarting
bun run workflow reset --id hf-papers-to-x
```

**How it works:**
1. Marks workflow as `running` with `mode: 'daemon'` in state.json
2. Runs the executor (same as `run` command)
3. Records run result in history, keeps status as `running`
4. Waits for the interval, checking stop signal every 10 seconds
5. Repeats from step 2

**Idempotent re-runs:** Each workflow has its own dedup store (`posted-papers.json` for HF papers, `replied-posts.json` for X.com replies) ensuring that re-running is safe. If all items are already processed, the cycle completes in seconds with zero actions and no side effects.

**State cleanup:** On stop, crash, or normal exit, the daemon cleans up its `pid` and `mode` metadata from state.json. If the process dies unexpectedly, state may show stale `running` — use `reset` to clear it.

---

## 6. Deep Dive: query.ts — The Agentic Loop Engine

**File:** `src/query.ts` (1,729 lines)
**Supporting files:** `src/query/config.ts`, `src/query/deps.ts`, `src/query/transitions.ts`, `src/query/stopHooks.ts`, `src/query/tokenBudget.ts`

This is the single most important file for understanding Claude Code's runtime behavior. Every user message, every tool call, every retry, every compaction — all flow through this file's `while(true)` loop.

### 6.1 Architecture Overview

The file exports one public function: `query()`, which is a thin wrapper around the internal `queryLoop()`. Both are `AsyncGenerator` functions that `yield` stream events, messages, and tool results back to the caller (REPL or SDK).

```
query(params)                     // Public entry — tracks command lifecycle
  └── queryLoop(params)           // The actual while(true) agentic loop
        ├── [Pre-iteration setup] // Context prep, compaction, blocking checks
        ├── [API streaming]       // Call model, stream tokens, collect tool_use
        ├── [Post-stream recovery]// Handle errors, withheld messages, retries
        ├── [Tool execution]      // Run tools (streaming or batch)
        ├── [Attachments]         // Memory, skills, queued commands
        └── [Continue decision]   // Build next State, continue or return
```

### 6.2 Key Types

#### 6.2.1 QueryParams — Input to the loop

```typescript
type QueryParams = {
  messages: Message[]              // Full conversation history
  systemPrompt: SystemPrompt       // Base system prompt
  userContext: { [k: string]: string }   // CLAUDE.md content, date
  systemContext: { [k: string]: string } // Git status snapshot
  canUseTool: CanUseToolFn         // Permission callback
  toolUseContext: ToolUseContext    // Rich execution context
  fallbackModel?: string           // Model to try if primary fails
  querySource: QuerySource         // 'repl_main_thread' | 'agent:xxx' | 'sdk' | etc.
  maxOutputTokensOverride?: number // Force output token cap
  maxTurns?: number                // Limit agentic loop iterations
  skipCacheWrite?: boolean         // Skip prompt cache write
  taskBudget?: { total: number }   // API-level task budget
  deps?: QueryDeps                 // Dependency injection (for tests)
}
```

#### 6.2.2 State — Mutable cross-iteration state

```typescript
type State = {
  messages: Message[]                // Grows each iteration (messages + assistant + toolResults)
  toolUseContext: ToolUseContext      // Updated after tool execution
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number    // 0-3, resets on tool turns
  hasAttemptedReactiveCompact: boolean    // Prevents infinite compact loops
  maxOutputTokensOverride: number | undefined
  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  stopHookActive: boolean | undefined     // Whether stop hook forced a retry
  turnCount: number                       // Current agentic turn (1-based)
  transition: Continue | undefined        // Why the previous iteration continued
}
```

#### 6.2.3 QueryConfig — Immutable environment snapshot

Snapshotted once at loop entry via `buildQueryConfig()` (line 295):

| Gate | Source | Purpose |
|------|--------|---------|
| `streamingToolExecution` | Statsig | Stream tool results while model streams |
| `emitToolUseSummaries` | Env var | Generate Haiku summaries of tool outputs |
| `isAnt` | `USER_TYPE=ant` | Enable Anthropic-internal features |
| `fastModeEnabled` | Env var | Fast mode toggle |

#### 6.2.4 QueryDeps — Dependency injection

4 injectable dependencies (line 21 of `deps.ts`):

| Dep | Production impl | Purpose |
|-----|-----------------|---------|
| `callModel` | `queryModelWithStreaming` | The API call |
| `microcompact` | `microcompactMessages` | Per-message compaction |
| `autocompact` | `autoCompactIfNeeded` | Full conversation compaction |
| `uuid` | `crypto.randomUUID` | Unique ID generation |

Tests can inject fakes via `params.deps` instead of monkey-patching modules.

### 6.3 The While Loop: Iteration-by-Iteration Walkthrough

Each iteration of the `while(true)` loop (line 307) represents one "agentic turn" — one API call plus optional tool execution. Here is exactly what happens:

#### Phase 1: Pre-Iteration Setup (lines 307-648)

```
1. Destructure state                          [307-321]
2. Start skill discovery prefetch             [323-335]
3. Yield stream_request_start event           [337]
4. Initialize/increment query tracking        [347-363]
5. Copy messages for query                    [365]
6. Apply tool result budget                   [369-394]
7. Apply snip compaction (HISTORY_SNIP)       [396-410]
8. Apply microcompact                         [412-426]
9. Apply context collapse (CONTEXT_COLLAPSE)  [440-447]
10. Build full system prompt                  [449-451]
11. Run auto-compact if needed                [453-543]
12. Update toolUseContext.messages             [546-549]
13. Initialize per-iteration variables        [551-568]
14. Resolve current model                     [570-578]
15. Check blocking token limit                [592-648]
```

**The compaction pipeline** is the most complex part of pre-iteration. Five stages run in sequence, each reducing context size:

```
Raw messages
  → applyToolResultBudget()     // Truncate oversized tool results
  → snipCompact()               // HISTORY_SNIP: remove old messages
  → microcompact()              // Per-message compression
  → contextCollapse()           // CONTEXT_COLLAPSE: collapse groups
  → autoCompactIfNeeded()       // Full conversation summarization
```

Each stage operates on `messagesForQuery` (a copy, not the canonical `messages`). The canonical messages grow monotonically; compacted views are ephemeral.

#### Phase 2: API Call & Streaming (lines 650-953)

```
16. Enter fallback retry loop                 [654]
17. Call deps.callModel() streaming            [659-708]
18. For each streamed message:
    a. Handle streaming fallback               [712-741]
    b. Backfill tool_use observable inputs      [747-787]
    c. Withhold recoverable errors             [799-822]
    d. Yield non-withheld messages             [823-825]
    e. Collect assistant messages & tool_use    [826-835]
    f. Feed to StreamingToolExecutor            [838-862]
19. Handle cached microcompact boundary        [870-892]
20. Catch FallbackTriggeredError → retry       [893-953]
21. Catch all other errors → yield error       [955-997]
```

**Streaming tool execution** (when `streamingToolExecution` gate is on): Tool execution starts _while the model is still streaming_. The `StreamingToolExecutor` receives `tool_use` blocks as they arrive and begins execution immediately. Read-only tools run concurrently. This overlaps model streaming time with tool I/O.

**Error withholding** is critical for recovery. Four types of errors are withheld (not yielded) during streaming:
1. `prompt_too_long` (413) — may recover via context collapse or reactive compact
2. `max_output_tokens` — may recover via escalation or multi-turn continuation
3. Media size errors — may recover via reactive compact strip-retry
4. Context collapse PTL — may recover via collapse drain

The withheld message is pushed to `assistantMessages` but NOT yielded. Recovery logic in Phase 3 decides whether to retry or surface the error.

#### Phase 3: Post-Stream Recovery (lines 999-1358)

This is the most complex control flow in the entire codebase. It handles six distinct recovery paths:

```
22. Execute post-sampling hooks                [999-1009]
23. Handle abort during streaming              [1011-1052]
24. Yield previous turn's tool use summary     [1054-1060]
25. If no tool calls (needsFollowUp=false):
    a. Context collapse drain retry            [1089-1117]
    b. Reactive compact retry                  [1119-1183]
    c. Max output tokens escalation            [1188-1221]
    d. Max output tokens multi-turn recovery   [1223-1256]
    e. Skip stop hooks on API errors           [1258-1265]
    f. Execute stop hooks                      [1267-1306]
    g. Token budget continuation               [1308-1355]
    h. Return { reason: 'completed' }          [1357]
```

**The 7 continue sites** — places where the loop `continue`s to a new iteration instead of returning:

| Continue Site | Line | `transition.reason` | Trigger |
|---|---|---|---|
| Context collapse drain | 1115 | `collapse_drain_retry` | 413 + staged collapses available |
| Reactive compact | 1165 | `reactive_compact_retry` | 413 + reactive compact succeeded |
| Max output escalation | 1220 | `max_output_tokens_escalate` | Hit 8k cap → retry at 64k |
| Max output recovery | 1251 | `max_output_tokens_recovery` | Hit cap → inject "resume" message (up to 3x) |
| Stop hook blocking | 1305 | `stop_hook_blocking` | Stop hook returned blocking error |
| Token budget continuation | 1340 | `token_budget_continuation` | Budget <90% consumed |
| Next turn (tools) | 1727 | `next_turn` | Tools executed, continue loop |

#### Phase 4: Tool Execution (lines 1360-1408)

```
26. Choose execution path:
    - StreamingToolExecutor.getRemainingResults()  // If streaming enabled
    - runTools(toolUseBlocks, ...)                 // If not
27. Yield tool result messages
28. Track hook_stopped_continuation
29. Update toolUseContext if tools modified it
```

If `streamingToolExecution` is enabled, most tools will have already finished during Phase 2. `getRemainingResults()` only yields the stragglers. If disabled, `runTools()` executes everything here (read-only tools concurrent, write tools serial).

#### Phase 5: Attachments & Continue (lines 1410-1728)

```
30. Generate tool use summary (async, for next turn)   [1412-1482]
31. Handle abort during tool execution                 [1484-1516]
32. Check hook_stopped_continuation                    [1519-1521]
33. Drain queued commands (notifications, prompts)     [1547-1578]
34. Get attachment messages (file changes, etc.)        [1580-1590]
35. Consume memory prefetch results                    [1599-1614]
36. Inject skill discovery prefetch                    [1620-1628]
37. Remove consumed commands from queue                [1632-1643]
38. Refresh tools (new MCP servers)                    [1659-1671]
39. Generate periodic task summary (BG_SESSIONS)       [1685-1702]
40. Check maxTurns limit                               [1705-1712]
41. Build next State, continue                         [1715-1727]
```

**Message accumulation pattern** — each iteration builds:
```
next.messages = [...messagesForQuery, ...assistantMessages, ...toolResults]
```
Where `messagesForQuery` already includes all prior iterations (post-compaction view), `assistantMessages` are this turn's model responses, and `toolResults` include tool outputs plus attachments.

### 6.4 Control Flow Diagram

```
                    ┌──────────────────────────────┐
                    │         while(true)           │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Phase 1: Pre-iteration       │
                    │  - Compaction pipeline         │
                    │  - Blocking limit check        │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Phase 2: API Streaming        │
                    │  - callModel() streaming       │
                    │  - Collect tool_use blocks     │
                    │  - Withhold recoverable errors │
                    │  - Streaming tool execution    │
                    └──────────────┬───────────────┘
                                   │
                          ┌────────▼────────┐
                          │  Was aborted?    │──yes──► return aborted_streaming
                          └────────┬────────┘
                                   │ no
                          ┌────────▼────────┐
                          │  Has tool calls? │
                          └───┬─────────┬───┘
                              │         │
                     no ◄─────┘         └─────► yes
                              │                   │
               ┌──────────────▼──────┐  ┌────────▼────────────┐
               │  Phase 3: Recovery   │  │  Phase 4: Run Tools  │
               │  - 413 recovery      │  │  - Streaming or batch│
               │  - Max tokens retry  │  │  - Yield results     │
               │  - Stop hooks        │  └────────┬────────────┘
               │  - Token budget      │            │
               └──────────┬──────────┘  ┌─────────▼───────────┐
                          │             │  Phase 5: Attachments │
                   return completed     │  - Memory prefetch    │
                                        │  - Skill discovery    │
                                        │  - Queued commands    │
                                        │  - maxTurns check     │
                                        └─────────┬───────────┘
                                                   │
                                           state = next
                                           continue ──────► back to top
```

### 6.5 The Error Recovery State Machine

Error recovery is the most subtle and bug-prone part of query.ts. Here's the decision tree for withheld errors:

```
Model returns error (withheld during streaming)
│
├── prompt_too_long (413)?
│   ├── Has staged context collapses AND didn't just try drain?
│   │   └── YES → drain collapses → continue (collapse_drain_retry)
│   ├── Reactive compact available AND hasn't attempted yet?
│   │   └── YES → run reactive compact → continue (reactive_compact_retry)
│   └── Neither → yield error, return prompt_too_long
│
├── Media size error (image/PDF too large)?
│   ├── Reactive compact available AND hasn't attempted yet?
│   │   └── YES → run reactive compact → continue (reactive_compact_retry)
│   └── NO → yield error, return image_error
│
└── max_output_tokens?
    ├── Using default 8k cap AND escalation enabled?
    │   └── YES → set override to 64k → continue (max_output_tokens_escalate)
    ├── Recovery count < 3?
    │   └── YES → inject "resume" meta message → continue (max_output_tokens_recovery)
    └── Recovery exhausted → yield error, fall through to stop hooks
```

**Key invariant:** `hasAttemptedReactiveCompact` prevents infinite compact loops. Once reactive compact runs (whether it succeeds or fails), the flag is set to `true` and won't be reset until the next tool-call turn (line 1720-1721).

### 6.6 Concurrency & Async Patterns

The loop uses several concurrent async patterns:

| Pattern | Where | Purpose |
|---------|-------|---------|
| `using` disposable | `pendingMemoryPrefetch` (line 301) | Auto-cleanup on generator exit |
| Fire-and-forget | `void executePostSamplingHooks(...)` (line 1001) | Non-blocking hook execution |
| Async prefetch + lazy consume | Memory prefetch (301→1599), Skill prefetch (331→1620) | Overlap I/O with model streaming |
| Promise pipeline | `nextPendingToolUseSummary` (1469→1055) | Haiku summary runs during next API call |
| StreamingToolExecutor | (562→838→1380) | Tools start during model streaming |

**The memory prefetch lifecycle:**
1. Started at loop entry (line 301) — fires a side-query to find relevant memories
2. Consumed at line 1599 — only if settled (zero-wait check), otherwise retries next iteration
3. Disposed via `using` when the generator exits (any path: return, throw, .return())

### 6.7 Feature Flag Impact Map

Which feature flags affect query.ts behavior:

| Feature Flag | Lines Affected | What It Does |
|---|---|---|
| `REACTIVE_COMPACT` | 15-17, 627, 811, 1119-1183 | Enables reactive compaction on 413/media errors |
| `CONTEXT_COLLAPSE` | 18-20, 440-447, 616-620, 800-810, 1089-1117, 1176-1183 | Enables context collapse + overflow drain |
| `HISTORY_SNIP` | 115-117, 401-410 | Enables snip compaction before microcompact |
| `CACHED_MICROCOMPACT` | 423-425, 870-892 | Defers microcompact boundary message |
| `EXPERIMENTAL_SKILL_SEARCH` | 66-68, 331-335, 1620-1628 | Enables skill discovery prefetch |
| `TOKEN_BUDGET` | 280, 1308-1355 | Enables auto-continue when budget underused |
| `TEMPLATES` | 69-71 | Enables job classification at turn end |
| `BG_SESSIONS` | 118-120, 1685-1702 | Enables periodic task summary |
| `CHICAGO_MCP` | 1033-1042, 1489-1498 | Cleanup computer-use locks on abort/turn-end |
| `EXTRACT_MEMORIES` | (stopHooks.ts:42-43, 141-153) | Auto-extract memories at turn end |

**In the fork, all flags return `false`**, so the effective code path is:
- No reactive compact, no context collapse, no snip, no cached microcompact
- No skill discovery, no token budget, no job classification, no BG sessions
- Core path: autocompact → API call → tool execution → attachments → continue

### 6.8 Key Findings for Secondary Development

1. **The 7 continue sites are the most dangerous modification points.** Each one must build a complete `State` object. Missing a field means the next iteration runs with stale data. If you add a new field to `State`, you must update all 7 sites.

2. **To add pre-processing before API calls** — inject between line 549 (toolUseContext updated with messages) and line 551 (assistant/tool result vars initialized). This is the last point before the API call where you can modify `messagesForQuery`.

3. **To add post-processing after model response** — inject at line 999, alongside `executePostSamplingHooks`. This runs after streaming completes but before tool execution.

4. **To add a new recovery path** — add it in the `!needsFollowUp` block (line 1062+), before the stop hooks check. Follow the pattern: check condition → build `State` → `state = next; continue`. Pick a unique `transition.reason` string for debugging.

5. **To add a new compaction stage** — insert it in the Phase 1 pipeline between lines 396-447. Order matters: snip → microcompact → context collapse → autocompact. Earlier stages reduce input for later stages.

6. **To modify tool execution behavior** — the branch point is line 1380. If `streamingToolExecutor` exists, tools were already running during streaming. `getRemainingResults()` yields stragglers. If null, `runTools()` handles everything.

7. **deps injection is the cleanest test path.** Instead of mocking modules, pass a custom `deps` object in `QueryParams`. Currently supports `callModel`, `microcompact`, `autocompact`, and `uuid`. Extend `QueryDeps` to add more.

8. **The message accumulation formula is:**
   ```
   next.messages = [...messagesForQuery, ...assistantMessages, ...toolResults]
   ```
   Where `messagesForQuery` = post-compaction view of all prior turns, `assistantMessages` = this turn's model output(s), `toolResults` = tool outputs + attachments + memory + skills. This is the canonical growth point of the conversation.

9. **`querySource` controls behavior branching.** Key values:
   - `'repl_main_thread'` / `'sdk'` — main conversation, full features
   - `'agent:xxx'` — subagent, no summaries, no memory extraction
   - `'compact'` / `'session_memory'` — forked compaction agents, skip blocking limit

10. **Stop hooks are the turn-end gate.** After the model responds with no tool calls, stop hooks run before the function returns. A blocking stop hook error causes a `continue` (the model sees the error and retries). A `preventContinuation` causes an early return. This is how users enforce "run tests before finishing" — the stop hook fails until tests pass.

---

## 7. Deep Dive: main.tsx — The Core Orchestrator

**File:** `src/main.tsx` (4,683 lines)
**Supporting files:** `src/entrypoints/init.ts`, `src/setup.ts`, `src/replLauncher.tsx`, `src/cli/print.ts`, `src/interactiveHelpers.tsx`, `src/dialogLaunchers.ts`, `src/bootstrap/state.ts`

This is the largest single file in the codebase and the central nervous system of Claude Code. It owns the entire lifecycle from process start to REPL render: CLI argument parsing, initialization orchestration, permission setup, MCP config loading, session resume/teleport/remote, AppState construction, and the branching tree that decides whether to launch an interactive REPL or headless print mode.

### 7.1 Architecture Overview

The file exports two key functions: `main()` (the process entry point called from `cli.tsx`) and `startDeferredPrefetches()` (called after first REPL render). Internally, `main()` delegates to `run()` which builds the Commander.js program with ~50 CLI options and ~15 subcommands.

```
main()                              // Process entry point (line 585)
  ├── [Security init]               // NoDefaultCurrentDirectoryInExePath, SIGINT
  ├── [Early argv rewriting]        // cc://, assistant, ssh → strip from argv
  ├── [Mode detection]              // -p/--print/--init-only/--sdk-url → isNonInteractive
  ├── [Client type resolution]      // cli/sdk-cli/remote/github-action/etc.
  ├── eagerLoadSettings()           // --settings/--setting-sources before init()
  └── run()                         // Commander.js program construction (line 884)
        ├── program.hook('preAction')   // init() + migrations + remote settings
        ├── program.action(handler)     // THE 2800-line default action (line 1007)
        │     ├── [Option extraction]           // ~300 lines
        │     ├── [Permission & MCP setup]      // ~500 lines
        │     ├── [setup() + commands/agents]   // ~200 lines
        │     ├── [Model & tool resolution]     // ~200 lines
        │     ├── [Headless branch]             // ~300 lines → runHeadless()
        │     ├── [AppState construction]       // ~100 lines
        │     └── [Session launch branches]     // ~700 lines → launchRepl()
        └── [Subcommand registration]   // mcp, auth, plugin, server, doctor, etc.
```

**Key insight for secondary development:** main.tsx is NOT a file you read linearly. It's a decision tree. The action handler has 8+ terminal branches (fresh session, --continue, --resume, --teleport, --remote, direct-connect, SSH, assistant), and each branch constructs slightly different initial state before calling `launchRepl()` or `runHeadless()`. Understanding which branch your use case hits is the first step.

### 7.2 File Structure Map

```
Line Range   | Section                    | Lines | Purpose
-------------|----------------------------|-------|------------------------------------------
1-207        | Imports & side effects     | 207   | 160+ imports, 3 prefetch side effects (MDM, keychain, profiling)
208-584      | Top-level helper functions  | 377   | logManagedSettings, isBeingDebugged, runMigrations, eagerLoadSettings, etc.
585-856      | main()                     | 272   | Process entry: security, argv rewriting, mode detection
857-883      | getInputPrompt()           | 27    | Stdin piping handler
884-967      | run() + preAction hook     | 84    | Commander.js setup, init(), migrations
968-1006     | CLI option registration    | 39    | ~50 options on the default command
1007-3808    | .action() handler          | 2801  | THE core decision tree (see 7.4)
3809-3873    | Post-action options        | 65    | --worktree, --advisor, ant-only flags
3874-4512    | Subcommand registration    | 639   | mcp, auth, plugin, server, doctor, etc.
4514-4610    | logTenguInit()             | 97    | Startup telemetry
4611-4683    | Utility functions          | 73    | maybeActivateProactive, maybeActivateBrief, extractTeammateOptions
```

**The 207-line import block** is not just imports — it includes 3 side effects that fire before any code runs:
1. `profileCheckpoint('main_tsx_entry')` (line 12) — marks entry time
2. `startMdmRawRead()` (line 16) — spawns MDM subprocess (macOS `plutil` / Windows `reg query`)
3. `startKeychainPrefetch()` (line 20) — fires both macOS keychain reads in parallel

These side effects are intentional performance optimizations: the subprocesses run during the remaining ~135ms of module evaluation.

### 7.3 The Startup Pipeline: Step by Step

From `main()` entry to REPL render, the startup pipeline has 6 stages:

```
Stage 1: main() — Process-level init (lines 585-856)
────────────────────────────────────────────────────
1. Set NoDefaultCurrentDirectoryInExePath (Windows PATH hijack prevention)
2. Install warning handler + SIGINT handler + exit cursor reset
3. Early argv rewriting:
   - cc:// URLs → strip or rewrite to `open` subcommand
   - --handle-uri → handleDeepLinkUri() → process.exit
   - `assistant [sessionId]` → strip from argv, stash in _pendingAssistantChat
   - `ssh <host> [dir]` → strip from argv, stash in _pendingSSH
4. Mode detection: -p/--print/--init-only/--sdk-url/!TTY → isNonInteractive
5. Client type resolution: cli/sdk-cli/sdk-typescript/remote/github-action/etc.
6. eagerLoadSettings() → parse --settings and --setting-sources BEFORE init()
7. Call run()

Stage 2: run() — Commander.js construction (lines 884-967)
──────────────────────────────────────────────────────────
1. Create Commander program with sorted help
2. Register preAction hook:
   a. await ensureMdmSettingsLoaded() + ensureKeychainPrefetchCompleted()
   b. await init()  (→ enableConfigs, applySafeConfigEnvironmentVariables, telemetry)
   c. Initialize sinks (logEvent/logError become functional)
   d. Wire --plugin-dir to setInlinePlugins()
   e. runMigrations() (version-gated, currently version 11)
   f. Fire-and-forget: loadRemoteManagedSettings(), loadPolicyLimits()
3. Register ~50 CLI options on the default command
4. Register .action(handler) — the 2800-line core

Stage 3: preAction → init() (in entrypoints/init.ts)
────────────────────────────────────────────────────
Called by the preAction hook. Key operations:
- enableConfigs() — allows config file reads
- applySafeConfigEnvironmentVariables() — apply non-dangerous env from settings
- Initialize telemetry, analytics stubs

Stage 4: .action() handler — Option extraction & validation (lines 1007-1800)
────────────────────────────────────────────────────────────────────────────
~800 lines of option extraction, validation, and early setup:
- KAIROS/assistant mode detection and activation
- Destructure all 30+ CLI options
- MCP config parsing (JSON strings or file paths, with policy filtering)
- Chrome integration setup
- Permission mode initialization (initializeToolPermissionContext)
- System prompt / append system prompt resolution
- Tool loading (getTools)

Stage 5: .action() handler — setup() + commands/agents (lines 1900-2100)
────────────────────────────────────────────────────────────────────────
- initBuiltinPlugins() + initBundledSkills() (in-memory, <1ms)
- setup() called (worktree, session ID, messaging socket)
- setup() parallelized with getCommands() + getAgentDefinitionsWithOverrides()
- Agent resolution: --agent flag or settings.agent → mainThreadAgentDefinition
- Model resolution: --model or agent model → setMainLoopModelOverride()

Stage 6: .action() handler — Branch to session type (lines 2200-3808)
───────────────────────────────────────────────────────────────────────
See section 7.6 for the full branching tree.
```

**The 11 sync migrations** (line 326, `CURRENT_MIGRATION_VERSION = 11`):

| Migration | Purpose |
|-----------|---------|
| `migrateAutoUpdatesToSettings` | Move auto-update config to settings.json |
| `migrateBypassPermissionsAcceptedToSettings` | Move bypass flag to settings |
| `migrateEnableAllProjectMcpServersToSettings` | Move MCP enablement to settings |
| `resetProToOpusDefault` | Reset Pro users to Opus default |
| `migrateSonnet1mToSonnet45` | Model string rename |
| `migrateLegacyOpusToCurrent` | Model string rename |
| `migrateSonnet45ToSonnet46` | Model string rename |
| `migrateOpusToOpus1m` | Model string rename |
| `migrateReplBridgeEnabledToRemoteControlAtStartup` | Config key rename |
| `resetAutoModeOptInForDefaultOffer` | Reset auto-mode opt-in (TRANSCRIPT_CLASSIFIER) |
| `migrateFennecToOpus` | Ant-only model rename |

### 7.4 The Action Handler: The 2800-Line Decision Tree

The `.action()` handler (lines 1007-3808) is the heart of main.tsx. It runs when no subcommand matches — i.e., for both interactive REPL sessions and headless `-p` mode. Here is its internal structure broken into logical blocks:

```
Block 1: Mode Flags & Early Options (lines 1007-1130)
─────────────────────────────────────────────────────
- --bare → CLAUDE_CODE_SIMPLE=1
- KAIROS/assistant detection and activation
- Destructure ~30 options: debug, print, verbose, model, effort, etc.
- File download promise kickoff (--file flag)
- Extract worktree, tmux, teammate options

Block 2: MCP Configuration (lines 1413-1630)
────────────────────────────────────────────
- Parse --mcp-config (JSON strings or file paths)
- Validate reserved MCP names (Chrome, Computer Use)
- Apply enterprise policy filter (filterMcpServersByPolicy)
- Chrome integration: setupClaudeInChrome() → inject MCP + tools + prompt
- Computer Use MCP (CHICAGO_MCP, macOS only)
- Strict MCP config validation

Block 3: Permission Setup (lines 1390-1770)
──────────────────────────────────────────
- initialPermissionModeFromCLI() → mode + notification
- Auto mode flag handling (TRANSCRIPT_CLASSIFIER)
- initializeToolPermissionContext() → toolPermissionContext
  - Processes --allowed-tools, --disallowed-tools, --tools
  - Applies add-dir allowlist
  - Returns warnings + dangerousPermissions
- Strip dangerous permissions for auto mode
- assertMinVersion() — fire-and-forget update check

Block 4: Setup & Commands (lines 1900-2080)
──────────────────────────────────────────
- initBuiltinPlugins() + initBundledSkills()
- setup() → worktree creation, session ID, UDS messaging
- Parallelize: setup() || getCommands() || getAgentDefinitionsWithOverrides()
- Agent resolution: agentSetting → mainThreadAgentDefinition
- Agent system prompt injection (non-interactive only)
- Model resolution chain: --model → agent.model → default

Block 5: System Prompt Assembly (lines 2080-2210)
────────────────────────────────────────────────
- Agent initial prompt prepend
- Teammate system prompt addendum
- Proactive mode prompt injection
- KAIROS assistant prompt addendum
- Brief mode activation

Block 6: Interactive Setup Screens (lines 2217-2380)
──────────────────────────────────────────────────
- Only for interactive (!isNonInteractiveSession)
- Create Ink root
- showSetupScreens() → trust dialog, OAuth, onboarding
- Post-onboarding: refresh managed settings, policy limits, GrowthBook
- Validate forceLoginOrgUUID
- LSP manager initialization (AFTER trust)
- Settings validation errors dialog
- Background prefetches: quota, bootstrap, fast mode, passes

Block 7: MCP Connection (lines 2380-2455)
────────────────────────────────────────
- Await mcpConfigPromise (started early for overlap)
- Merge file-based + dynamic (--mcp-config) configs
- Separate SDK configs from regular configs
- prefetchAllMcpResources (interactive) or defer (print)
- Start SessionStart hooks in parallel with MCP

Block 8: Headless Branch (lines 2585-2861)
─────────────────────────────────────────
- if (isNonInteractiveSession) → headless path
- Build headlessInitialState (simplified AppState)
- Create headlessStore
- Per-server MCP push into headlessStore (connectMcpBatch)
- claude.ai MCP with 5s timeout
- startDeferredPrefetches()
- import('src/cli/print.js') → runHeadless()
- return (never reaches interactive branch)

Block 9: Interactive Session Launch (lines 2862-3808)
───────────────────────────────────────────────────
- The branching tree (see 7.6)
- 8+ terminal paths, each calling launchRepl() with different config
```

**The critical ordering constraints:**
1. `eagerLoadSettings()` MUST run before `init()` — settings filter what init loads
2. `init()` MUST run before `setup()` — init enables config reading
3. `setup()` MUST run before `getCommands()` if worktree enabled — setup may chdir
4. `initBuiltinPlugins()` MUST run before `getCommands()` — commands read bundled skills
5. `showSetupScreens()` MUST run before LSP init — trust required for code execution
6. MCP prefetch MUST start after trust dialog — MCP servers execute code

### 7.5 AppState Construction

AppState is the global state object passed to the REPL. It's constructed differently for headless vs interactive mode.

#### 7.5.1 Headless AppState (lines 2623-2650)

Simplified — uses `getDefaultAppState()` as base, overlays only what's needed:

```typescript
const headlessInitialState: AppState = {
  ...getDefaultAppState(),
  mcp: { clients: [], commands: [], tools: [] },  // Populated incrementally
  toolPermissionContext,
  effortValue,
  fastMode?,          // If enabled
  advisorModel?,      // If enabled
  kairosEnabled?,     // If KAIROS feature
};
```

Managed by `headlessStore = createStore(headlessInitialState, onChangeAppState)`. MCP tools are pushed incrementally via `connectMcpBatch()` as servers connect.

#### 7.5.2 Interactive AppState (lines 2926-3036)

Full construction with ~50 fields. Key fields by category:

**Session identity:**
- `mainLoopModel` — resolved model string or null
- `agent` — agent type string if using --agent
- `agentDefinitions` — all loaded agent definitions
- `kairosEnabled` — whether assistant mode is active

**UI state:**
- `verbose`, `isBriefOnly`, `expandedView`
- `thinkingEnabled`, `promptSuggestionEnabled`
- `notifications.queue` — initial notifications (permission mode, deprecation warnings)
- `initialMessage` — if CLI prompt provided, pre-wrapped as UserMessage

**Permissions:**
- `toolPermissionContext` — the fully resolved permission context
- `effortValue`, `fastMode`, `advisorModel`

**MCP:**
- `mcp: { clients: [], tools: [], commands: [], resources: {}, pluginReconnectKey: 0 }`
- Starts empty — `useManageMCPConnections` hook populates async after REPL mounts

**Remote/Bridge:**
- `replBridgeEnabled` — true if --rc, remoteControlAtStartup, or kairosEnabled
- `replBridgeExplicit` — true only if user explicitly used --rc
- `remoteSessionUrl` — set only for --remote sessions

**Team context:**
- `teamContext` — from `assistantTeamContext` (KAIROS) or `computeInitialTeamContext` (swarms)

**History:**
- `fileHistory: { snapshots: [], trackedFiles: new Set(), snapshotSequence: 0 }`
- `attribution: createEmptyAttributionState()`

The key difference from headless: interactive state includes `initialMessage` (the user's CLI prompt wrapped as a message), `notifications.queue`, and all UI-related fields. Headless mode strips these because there's no UI to render them.

### 7.6 Session Launch Paths — The Terminal Branching Tree

After headless mode returns at line 2861, the remaining code (lines 2862-3808) is a branching tree for interactive sessions. Each branch constructs specific config and calls `launchRepl()`.

```
isNonInteractiveSession?
├── YES → runHeadless() → return                          [line 2585]
└── NO → Interactive branching tree:
    │
    ├── options.continue?                                  [line 3101]
    │   └── loadConversationForResume(undefined)
    │       → processResumedConversation()
    │       → launchRepl(initialMessages: loaded.messages)
    │
    ├── _pendingConnect?.url? (DIRECT_CONNECT)             [line 3156]
    │   └── createDirectConnectSession()
    │       → launchRepl(directConnectConfig, initialTools: [])
    │
    ├── _pendingSSH?.host? (SSH_REMOTE)                    [line 3193]
    │   └── createSSHSession() or createLocalSSHSession()
    │       → launchRepl(sshSession, initialTools: [])
    │
    ├── _pendingAssistantChat? (KAIROS)                    [line 3259]
    │   └── discoverAssistantSessions()
    │       → launchRepl(remoteSessionConfig, viewerOnly)
    │
    ├── options.resume || options.fromPr || teleport || remote?  [line 3355]
    │   ├── remote !== null?                               [line 3409]
    │   │   └── teleportToRemoteWithErrorHandling()
    │   │       → createRemoteSessionConfig()
    │   │       → launchRepl(remoteSessionConfig)
    │   │
    │   ├── teleport?                                      [line 3504]
    │   │   ├── teleport === true → launchTeleportResumeWrapper()
    │   │   └── teleport === string → fetchSession() + teleportWithProgress()
    │   │
    │   ├── resume by sessionId?                           [line 3668]
    │   │   └── loadConversationForResume(sessionId)
    │   │       → processResumedConversation()
    │   │       → launchRepl(initialMessages)
    │   │
    │   ├── resume by file? (ant-only)                     [line 3582]
    │   │   └── loadTranscriptFromFile() or loadCcshare()
    │   │       → processResumedConversation()
    │   │
    │   └── no specific target → launchResumeChooser()     [line 3747]
    │       (Interactive picker with search)
    │
    └── else → Fresh session                               [line 3760]
        └── launchRepl(initialMessages: hookMessages + deepLinkBanner)
```

**Each `launchRepl()` call receives:**
1. `root` — Ink render root
2. `{ getFpsMetrics, stats, initialState }` — render context
3. Session config object with:
   - `commands`, `initialTools`, `mcpClients`
   - `systemPrompt`, `appendSystemPrompt`
   - `thinkingConfig`, `mainThreadAgentDefinition`
   - Branch-specific: `initialMessages`, `directConnectConfig`, `sshSession`, `remoteSessionConfig`
4. `renderAndRun` — the function that mounts the REPL React component

**Resume flow details:**
- `loadConversationForResume()` reads the JSONL transcript file
- `processResumedConversation()` (from `sessionRestore.ts`) rebuilds messages, restores file history snapshots, detects agent definition, applies coordinator mode, and constructs a customized `initialState`
- Resume always clears session caches first (`clearSessionCaches()`) for fresh file/skill discovery
- `--fork-session` creates a new session ID instead of reusing the original

### 7.7 Subcommand Registration

Subcommands are registered after the main `.action()` handler (lines 3874-4512). **Critical optimization:** In `-p`/`--print` mode, subcommand registration is entirely skipped (line 3883-3890) to save ~65ms of startup time.

| Subcommand | Line | Handler Module | Description |
|------------|------|----------------|-------------|
| `mcp serve` | 3895 | `cli/handlers/mcp.js` | Start MCP server |
| `mcp add` | 3912 | `commands/mcp/addCommand.js` | Add MCP server |
| `mcp remove` | 3916 | `cli/handlers/mcp.js` | Remove MCP server |
| `mcp list` | 3924 | `cli/handlers/mcp.js` | List MCP servers |
| `mcp get` | 3930 | `cli/handlers/mcp.js` | Get MCP server details |
| `mcp add-json` | 3936 | `cli/handlers/mcp.js` | Add MCP via JSON |
| `mcp add-from-claude-desktop` | 3945 | `cli/handlers/mcp.js` | Import from Desktop |
| `mcp reset-project-choices` | 3953 | `cli/handlers/mcp.js` | Reset project MCP choices |
| `server` | 3961 | `server/server.js` | Start session server (DIRECT_CONNECT) |
| `ssh` | 4045 | (stub) | Usage hint — actual flow in main() argv rewriting |
| `open` | 4058 | `server/connectHeadless.js` | Connect to server (DIRECT_CONNECT, headless) |
| `auth login` | 4101 | `cli/handlers/auth.js` | OAuth login |
| `auth status` | 4122 | `cli/handlers/auth.js` | Show auth status |
| `auth logout` | 4131 | `cli/handlers/auth.js` | Log out |
| `plugin validate` | 4149 | `cli/handlers/plugins.js` | Validate plugin manifest |
| `plugin list` | 4159 | `cli/handlers/plugins.js` | List plugins |
| `plugin install` | 4209 | `cli/handlers/plugins.js` | Install plugin |
| `plugin uninstall` | 4220 | `cli/handlers/plugins.js` | Uninstall plugin |
| `plugin enable` | 4232 | `cli/handlers/plugins.js` | Enable plugin |
| `plugin disable` | 4243 | `cli/handlers/plugins.js` | Disable plugin |
| `plugin update` | 4255 | `cli/handlers/plugins.js` | Update plugin |
| `plugin marketplace *` | 4171 | `cli/handlers/plugins.js` | Marketplace CRUD |
| `setup-token` | 4267 | `cli/handlers/util.js` | Setup long-lived token |
| `agents` | 4278 | `cli/handlers/agents.js` | List agents |
| `auto-mode defaults/config/critique` | 4289 | `cli/handlers/autoMode.js` | Auto mode inspection (TRANSCRIPT_CLASSIFIER) |
| `remote-control` / `rc` | 4322 | `bridge/bridgeMain.js` | Bridge mode (BRIDGE_MODE) |
| `assistant` | 4334 | (stub) | Usage hint — actual flow in main() argv rewriting |
| `doctor` | 4346 | `cli/handlers/util.js` | Health check |
| `update` / `upgrade` | 4362 | `cli/update.js` | Check and install updates |
| `install` | 4395 | `cli/handlers/util.js` | Install native build |

**Pattern:** All handlers use dynamic `await import()` — modules are loaded only when the subcommand is invoked, not at registration time. This is important for startup performance.

**Ant-only subcommands** (gated by `"external" === 'ant'`): `log`, `error`, `export`, `task *`, `completion`, `up`, `rollback`. These are dead code in the fork.

### 7.8 Concurrency & Async Patterns

main.tsx uses aggressive parallelization to minimize startup latency. Here are the key patterns:

| Pattern | Where | What runs in parallel |
|---------|-------|-----------------------|
| Import-time side effects | Lines 12-20 | MDM read, keychain prefetch run during ~135ms of remaining imports |
| preAction parallel awaits | Line 914 | `ensureMdmSettingsLoaded()` ‖ `ensureKeychainPrefetchCompleted()` |
| setup ‖ commands ‖ agents | Lines 1927-1933 | `setup()` ‖ `getCommands()` ‖ `getAgentDefinitionsWithOverrides()` |
| MCP config ‖ setup | Lines 1809-1814 | `getClaudeCodeMcpConfigs()` starts before setup(), awaited after |
| claude.ai MCP ‖ local MCP | Lines 2408-2430 | Both prefetch in parallel, merged with dedup |
| Hooks ‖ MCP connect | Lines 2437-2452 | `processSessionStartHooks()` ‖ `prefetchAllMcpResources()` |
| File download ‖ startup | Lines 1328-1330 | `downloadSessionFiles()` starts early, awaited before REPL |
| claude.ai MCP with timeout | Lines 2738-2808 | 5s timeout race — proceed if not ready, background continues |

**Fire-and-forget operations** (void promises, never awaited):

| Operation | Line | Purpose |
|-----------|------|---------|
| `loadRemoteManagedSettings()` | 957 | Enterprise settings hot-reload |
| `loadPolicyLimits()` | 958 | Policy limits hot-reload |
| `checkQuotaStatus()` | 2350 | Cache-warm quota check |
| `fetchBootstrapData()` | 2353 | Bootstrap data from server |
| `prefetchPassesEligibility()` | 2356 | Passes eligibility cache |
| `prefetchFastModeStatus()` | 2358 | Fast mode status cache |
| `refreshExampleCommands()` | 2377 | Pre-fetch git log for examples |
| `registerSession()` | 2530 | PID file + concurrent session count |
| `initializeVersionedPlugins()` | 2565 | Plugin version sync (interactive) |
| `logStartupTelemetry()` | 3052 | Deferred to setImmediate |

**The `startDeferredPrefetches()` function** (line 388) runs AFTER the REPL's first render to avoid event loop contention during the critical startup path:
- `initUser()`, `getUserContext()`, `getSystemContext()` — process-spawning prefetches
- AWS/GCP credential prefetch (if Bedrock/Vertex)
- `countFilesRoundedRg()` — file count for context
- `refreshModelCapabilities()` — model capability cache
- `settingsChangeDetector.initialize()`, `skillChangeDetector.initialize()` — file watchers
- Skipped entirely in `--bare` mode or when `CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER` is set

### 7.9 Feature Flag Impact Map

Which feature flags control which code paths in main.tsx:

| Feature Flag | Lines Affected | What It Gates |
|---|---|---|
| `KAIROS` | 1042-1135, 2647, 2915, 3035, 3259-3354, 3841-3843, 4334-4343 | Assistant mode, kairosEnabled state, assistant subcommand, brief mode entitlement |
| `KAIROS_BRIEF` | 2915, 3838-3840, 4622-4652 | Brief mode activation (lighter than full KAIROS) |
| `KAIROS_CHANNELS` | 3844-3847 | Channel notification server registration |
| `DIRECT_CONNECT` | 3156-3192, 3961-4038, 4058-4096 | cc:// URLs, server subcommand, connect sessions |
| `SSH_REMOTE` | 3193-3258, 4045-4053 | SSH remote session launch path |
| `BRIDGE_MODE` | 3866-3869, 4322-4333 | --remote-control / --rc flag, remote-control subcommand |
| `TRANSCRIPT_CLASSIFIER` | 1714-1756, 2663-2676, 3829-3831, 4285-4312 | Auto mode, bypass permission verification |
| `PROACTIVE` | 3832-3834, 4611-4620 | Proactive autonomous mode flag |
| `COORDINATOR_MODE` | 2909-2912, 3770-3772 | Coordinator mode detection, plan mode enforcement |
| `CCR_MIRROR` | 2917-2925 | Bridge mirroring (outbound-only) |
| `LODESTONE` | 3781-3796 | Deep link banner display |
| `UDS_INBOX` | 3835-3837 | Unix domain socket messaging path |
| `HARD_FAIL` | 3870-3872 | Crash on logError instead of silently logging |
| `CHICAGO_MCP` | 1630-1650 | Computer Use MCP server (macOS + CHICAGO flag) |

**In the fork, all flags return `false`.** The effective code path is:
- No KAIROS/assistant/brief
- No DIRECT_CONNECT/SSH/BRIDGE
- No TRANSCRIPT_CLASSIFIER/auto-mode
- No PROACTIVE/COORDINATOR
- Fresh session → `launchRepl()` or `--continue`/`--resume` → `launchRepl()`
- Headless → `runHeadless()`

### 7.10 Key Findings for Secondary Development

1. **To add a new CLI flag** — register it in two places: the option declaration (lines 968-1006 or 3809-3873), and handle it in the action handler. If it affects AppState, update both `headlessInitialState` (line 2623) AND `initialState` (line 2926). Miss either and one mode silently ignores your flag.

2. **To add a new session launch path** — add a new `else if` branch in the Block 9 branching tree (after line 3355). Follow the pattern: validate → load/create session → construct custom config → `launchRepl()`. The branch must handle errors and call `gracefulShutdown()` on failure.

3. **To add a new subcommand** — add it in the subcommand registration section (after line 3874). Use dynamic `await import()` for the handler to avoid startup cost. Remember: subcommand registration is skipped in `-p` mode (line 3883), so if your subcommand must work in print mode, add it before the early-return.

4. **To modify the MCP setup** — the MCP pipeline has 4 stages:
   - Config loading: `getClaudeCodeMcpConfigs()` (line 1809) — returns raw configs
   - Policy filtering: `filterMcpServersByPolicy()` (line 1420) — enterprise policy
   - Connection: `prefetchAllMcpResources()` (line 2437, interactive) or `connectMcpBatch()` (line 2691, headless)
   - Dedup: claude.ai MCP servers deduplicate against manual + plugin servers (lines 2731-2808)

5. **To add new AppState fields** — update:
   - `AppState` type definition (in `bootstrap/state.ts`)
   - `getDefaultAppState()` (for headless base)
   - `headlessInitialState` construction (line 2623)
   - `initialState` construction (line 2926)
   - Any `processResumedConversation()` paths that override initialState

6. **To modify the startup sequence** — be aware of the ordering constraints listed in 7.4. The most common mistake is accessing config before `init()` runs (config reads throw before `enableConfigs()`), or spawning MCP servers before the trust dialog (security violation).

7. **The `--bare` / `CLAUDE_CODE_SIMPLE=1` mode** strips most startup overhead:
   - Skips `startDeferredPrefetches()`
   - Skips background housekeeping
   - Skips SDK heap dump monitor
   - Early-returns from many prefetch functions internally
   - Useful for scripted/embedded use cases where latency matters more than features

8. **The permission mode initialization** is the most security-critical path:
   - `initializeToolPermissionContext()` (line ~1700) resolves the effective mode from CLI flags, env vars, settings, and policy
   - `checkAndDisableBypassPermissions()` (line 2657) can asynchronously revoke bypass mode if a Statsig gate says so
   - `verifyAutoModeGateAccess()` (line 2663) can asynchronously downgrade auto mode
   - Both run as fire-and-forget after headless store creation — they may race with the first API call

9. **The `renderAndRun` callback** (line ~2320) is the bridge between Commander.js and Ink/React:
   - Created inside `showSetupScreens()` → returns a function
   - Passed to `launchRepl()` as the last argument
   - `launchRepl()` (in `replLauncher.tsx`) calls it to mount the `<REPL>` component
   - This indirection exists because the Ink root must be created once (during setup screens) and reused

10. **The `sessionConfig` object** (line 3071) is the shared config for all interactive session types:
    ```typescript
    const sessionConfig = {
      debug, commands, initialTools, mcpClients,
      autoConnectIdeFlag, mainThreadAgentDefinition,
      disableSlashCommands, dynamicMcpConfig, strictMcpConfig,
      systemPrompt, appendSystemPrompt, taskListId,
      thinkingConfig, onTurnComplete?
    };
    ```
    Each launch branch spreads `...sessionConfig` and adds branch-specific overrides (`initialMessages`, `directConnectConfig`, `sshSession`, etc.). To add a global session option, add it here. To add a branch-specific option, add it in the branch's `launchRepl()` call.

---

## 8. REPL.tsx Deep Dive — The UI Heart (5005 Lines)

`src/screens/REPL.tsx` is the single largest React component in the codebase. It is the **central nervous system** of the interactive CLI — it owns the conversation state, orchestrates the query lifecycle, manages all permission dialogs, renders the message stream, and wires up every keybinding. Understanding this file is essential for any UI-level modification.

### 8.1 Architecture Overview

**File stats:** ~5005 lines, 68 `useState`, 54 `useRef`, 44 `useCallback`, 43 `useEffect`, 18 `useMemo`.

**Conceptual layers** (top to bottom in the file):

| Line Range | Layer | Purpose |
|---|---|---|
| 1–525 | Imports + helpers | ~200 imports, `AnimatedTerminalTitle` helper component |
| 526–570 | `Props` type | Component interface definition |
| 572–1960 | State initialization | All `useState`/`useRef`/`useMemo`/custom hooks |
| 1960–2065 | Dialog focus system | `getFocusedInputDialog()` — the dialog priority queue |
| 2065–2523 | Permission & context | `canUseTool`, `getToolUseContext`, sandbox callbacks |
| 2524–2854 | Query execution | `onQueryEvent`, `onQueryImpl`, `onQuery` — the agentic loop bridge |
| 2855–3545 | Input handling | `onSubmit` — the user input processing pipeline |
| 3546–4116 | Side effects | Queue processing, idle detection, voice, swarm, scheduled tasks |
| 4117–4490 | Transcript mode | Search, less-style keybindings, virtual scroll, editor export |
| 4490–5005 | Main render | `FullscreenLayout` composition, dialog rendering, JSX return |

**Key architectural pattern:** REPL.tsx is a **God Component** by necessity — it's the single point where all subsystems converge. It doesn't delegate query orchestration to a separate class; instead, it uses `useCallback` closures that capture shared state. The `store` (via `useAppStateStore()`) serves as the out-of-React state escape hatch for timer callbacks and async closures that would otherwise capture stale state.

### 8.2 Props Interface & State Model

#### Props (line 526–570)

```typescript
type Props = {
  commands: Command[];            // Slash commands
  debug: boolean;                 // Debug mode flag
  initialTools: Tool[];           // Tools from main.tsx setup
  initialMessages?: MessageType[];// Restored conversation (resume)
  pendingHookMessages?: Promise<HookResultMessage[]>; // SessionStart hooks
  initialFileHistorySnapshots?: FileHistorySnapshot[];
  initialContentReplacements?: ContentReplacementRecord[];
  initialAgentName?: string;      // Session name (via /rename)
  initialAgentColor?: AgentColorName;
  mcpClients?: MCPServerConnection[];
  dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>;
  systemPrompt?: string;          // Custom system prompt override
  appendSystemPrompt?: string;    // Appended to system prompt
  onBeforeQuery?: (input: string, newMessages: MessageType[]) => Promise<boolean>;
  onTurnComplete?: (messages: MessageType[]) => void | Promise<void>;
  disabled?: boolean;             // Hides prompt (agent viewer mode)
  mainThreadAgentDefinition?: AgentDefinition;
  taskListId?: string;            // Tasks mode (auto-process task list)
  remoteSessionConfig?: RemoteSessionConfig;
  directConnectConfig?: DirectConnectConfig;
  sshSession?: SSHSession;
  thinkingConfig: ThinkingConfig;
};
```

**For secondary development:** To add a new global behavior to the REPL, add it to `Props`, pass it from `main.tsx`'s `sessionConfig` object (Section 7), and consume it in the appropriate layer of REPL.tsx.

#### State Categories

The ~68 `useState` calls organize into these groups:

| Category | Key State Variables | Purpose |
|---|---|---|
| **Conversation** | `messages` (via custom hook), `conversationId`, `streamingText`, `streamingToolUses`, `streamingThinking` | The conversation data model |
| **Loading** | `isExternalLoading`, `abortController`, `streamMode`, `responseLength` | Query lifecycle tracking |
| **Dialogs** | `toolUseConfirmQueue`, `promptQueue`, `sandboxPermissionRequestQueue`, `showCostDialog`, `idleReturnPending` | Permission & interaction overlays |
| **Input** | `inputValue`, `inputMode`, `pastedContents`, `stashedPrompt`, `submitCount` | User prompt state |
| **Screen** | `screen` (`'prompt'`\|`'transcript'`), `showAllInTranscript`, `dumpMode`, `frozenTranscriptState` | View mode |
| **UI Chrome** | `spinnerMessage`, `spinnerColor`, `showIdeOnboarding`, `showEffortCallout`, `showDesktopUpsellStartup` | Notifications & callouts |
| **Session** | `haikuTitle`, `lastQueryCompletionTime`, `autoUpdaterResult` | Session-level metadata |

**Critical refs** (54 `useRef`):

| Ref | Purpose |
|---|---|
| `messagesRef` | Synchronous access to latest messages (avoids stale closure) |
| `abortControllerRef` | Current abort controller for cancel |
| `inputValueRef` | Current input for timer/async callbacks |
| `responseLengthRef` | Streaming progress counter for spinner animation |
| `apiMetricsRef` | Per-request TTFT/OTPS tracking (ant-only) |
| `loadingStartTimeRef` / `totalPausedMsRef` / `pauseStartTimeRef` | Turn duration timing |
| `readFileState` | File content cache shared with tools |
| `focusedInputDialogRef` | Current dialog state for timer callbacks |
| `haikuTitleAttemptedRef` | One-shot guard for session title generation |

**The `QueryGuard` (line ~598, via `useRef`):** A state machine that prevents concurrent `onQuery` executions. It uses atomic `tryStart()`/`end()` transitions with generation numbers to handle cancel+resubmit races. When a second query arrives while one is running, the new messages are enqueued instead of starting a concurrent call.

### 8.3 The Render Pipeline & Dialog Focus System

#### Component Tree (JSX return, line ~4548–5004)

The final JSX return is **a single `<KeybindingSetup>` wrapper** containing:

```
<AlternateScreen> (fullscreen only)
  <KeybindingSetup>
    ├─ AnimatedTerminalTitle      # Terminal tab title (spinning dots while loading)
    ├─ GlobalKeybindingHandlers   # ctrl+o (transcript), ctrl+l (clear), etc.
    ├─ VoiceKeybindingHandler     # Voice mode (feature-gated)
    ├─ CommandKeybindingHandlers  # / slash-command shortcuts
    ├─ ScrollKeybindingHandler    # g/G/j/k/PgUp/PgDn, text selection copy
    ├─ MessageActionsKeybindings  # Message cursor actions (feature-gated)
    ├─ CancelRequestHandler       # Escape / double-ctrl+c
    └─ <MCPConnectionManager>
        └─ <FullscreenLayout scrollRef={scrollRef}>
            ├── scrollable:
            │   ├─ TeammateViewHeader
            │   ├─ Messages            # The conversation message list
            │   ├─ AwsAuthStatusBox
            │   ├─ UserTextMessage      # Placeholder while processing
            │   ├─ toolJSX              # Non-immediate slash command UI
            │   ├─ TungstenLiveMonitor  # (ant-only)
            │   ├─ WebBrowserPanel      # (feature-gated)
            │   ├─ <Box flexGrow={1} /> # Spacer pushes content up
            │   ├─ SpinnerWithVerb      # Loading indicator
            │   ├─ BriefIdleStatus      # Brief mode idle status
            │   └─ PromptInputQueuedCommands
            │
            ├── overlay: PermissionRequest  # Tool permission dialog
            ├── bottomFloat: CompanionSprite # (BUDDY feature)
            ├── modal: centeredModal         # Local-jsx commands in fullscreen
            │
            └── bottom:
                ├─ CompanionSprite (narrow)
                ├─ permissionStickyFooter
                ├─ toolJSX (immediate)  # /btw, /sandbox, /issue etc.
                ├─ TaskListV2           # Expanded todo list
                ├─ SandboxPermissionRequest
                ├─ PromptDialog         # Hook prompt dialogs
                ├─ ElicitationDialog    # MCP elicitation
                ├─ CostThresholdDialog
                ├─ IdleReturnDialog
                ├─ IdeOnboardingDialog
                ├─ EffortCallout / RemoteCallout
                ├─ UltraplanChoiceDialog / UltraplanLaunchDialog
                ├─ exitFlow
                ├─ PluginHintMenu / LspRecommendationMenu
                ├─ DesktopUpsellStartup
                ├─ MoreRight render
                ├─ AutoRunIssueNotification
                ├─ FeedbackSurvey (3 variants)
                ├─ SkillImprovementSurvey
                ├─ IssueFlagBanner
                ├─ PromptInput          # THE USER INPUT AREA
                ├─ SessionBackgroundHint
                ├─ MessageActionsBar
                └─ MessageSelector
```

**Two render modes:**
1. **Fullscreen** (`isFullscreenEnvEnabled()` — default): Wraps in `<AlternateScreen>`, uses `FullscreenLayout` with virtual scroll, modal overlay support.
2. **Scrollback** (legacy): No alt screen, content flows into terminal's native scrollback buffer.

**Transcript mode** (ctrl+o): Early-returns a completely separate JSX tree (line 4392–4490) with its own `less`-style keybindings (`/` search, `n`/`N` next/prev, `[` dump to scrollback, `v` open in editor, `q` quit).

#### The Dialog Priority Queue (`getFocusedInputDialog`, line 2017–2064)

This is the **single most important function for understanding UI behavior**. It returns which dialog should have input focus, following a strict priority order:

```
Priority (highest → lowest):
1. isExiting / exitFlow          → undefined (all input disabled)
2. message-selector              → MessageSelector (always wins)
3. isPromptInputActive           → undefined (user typing suppresses dialogs)
4. sandbox-permission            → SandboxPermissionRequest
5. tool-permission               → PermissionRequest
6. prompt                        → PromptDialog (hook prompts)
7. worker-sandbox-permission     → Worker sandbox approval
8. elicitation                   → MCP elicitation dialog
9. cost                          → CostThresholdDialog ($5 warning)
10. idle-return                  → IdleReturnDialog (75min idle)
11. ultraplan-choice / launch    → Ultraplan dialogs
12. ide-onboarding               → IDE onboarding
13. model-switch                 → Model switch callout (ant-only)
14. undercover-callout           → Undercover auto-enable (ant-only)
15. effort-callout               → Effort level callout
16. remote-callout               → Remote/bridge callout
17. lsp-recommendation           → LSP plugin suggestion
18. plugin-hint                  → Plugin hint from CLI stderr
19. desktop-upsell               → Desktop app upsell
20. undefined                    → No dialog, PromptInput has focus
```

**Key rule:** Dialogs at priority 5+ require `allowDialogsWithAnimation` to be true. This means they only show when either (a) no `toolJSX` is active, or (b) the toolJSX has `shouldContinueAnimation: true`. This prevents deadlocks where an agent sets a background hint while waiting for user interaction.

**For secondary development:** To add a new dialog:
1. Add state variable for the dialog's visibility/data
2. Add a new case in `getFocusedInputDialog()` at the appropriate priority level
3. Add the dialog's JSX in the `bottom` section of `FullscreenLayout`
4. The dialog component receives focus automatically when `focusedInputDialog` matches

### 8.4 Input Processing & Command Handling

#### The `onSubmit` Pipeline (line 3142–3545)

`onSubmit` is the **single entry point for all user input**. It's called by `PromptInput` when the user presses Enter. The processing pipeline is:

```
User presses Enter
  │
  ├─ 1. repinScroll()              # Scroll to bottom
  ├─ 2. Resume proactive mode      # If paused
  │
  ├─ 3. Immediate command check    # If /command AND query is active
  │   ├─ command.immediate=true OR fromKeybinding=true
  │   ├─ Execute command directly (no queue)
  │   └─ return early
  │
  ├─ 4. Remote mode early return   # Skip empty input
  │
  ├─ 5. Idle-return check          # If idle >75min AND >100k tokens
  │   ├─ willowMode='dialog' → show IdleReturnDialog
  │   └─ return early (input held in idleReturnPending)
  │
  ├─ 6. History management         # addToHistory() + shell cache
  │
  ├─ 7. Stash restore              # Restore stashed prompt if applicable
  │
  ├─ 8. State updates              # setInputMode('prompt'), setSubmitCount++,
  │                                # setUserInputOnProcessing(input), attribution
  │
  ├─ 9. Speculation accept         # If accepting speculative response
  │   └─ return early
  │
  ├─10. Remote mode send           # If remote session
  │   ├─ Build content blocks (text + images)
  │   ├─ activeRemote.sendMessage()
  │   └─ return early
  │
  ├─11. awaitPendingHooks()        # Ensure SessionStart hooks resolved
  │
  └─12. handlePromptSubmit()       # THE MAIN PATH
       ├─ Processes slash commands (/, /command)
       ├─ Processes bash mode (! prefix)
       ├─ Builds user messages (text + images + IDE selection)
       ├─ Creates AbortController
       └─ Calls onQuery(newMessages, abortController, shouldQuery, ...)
```

#### Command Execution Modes

| Mode | Trigger | Path | Example |
|---|---|---|---|
| **Immediate** | `/cmd` while loading + `cmd.immediate=true` | `onSubmit` → direct execute → `setToolJSX` | `/btw`, `/model` via keybinding |
| **Queued** | Any input while loading | `onSubmit` → `handlePromptSubmit` → `enqueue()` | User types while Claude is thinking |
| **Normal** | `/cmd` or text when idle | `onSubmit` → `handlePromptSubmit` → `onQuery()` | Standard interaction |
| **Forked** | Certain slash commands | `handlePromptSubmit` → `executeForkedSlashCommand` | Commands that create subagents |

#### The Queue System

When a query is already running (`queryGuard.isActive`), new input is enqueued via the command queue system. `useQueueProcessor` (line 3889–3893) watches for the queue to have items and the query guard to be idle, then calls `executeQueuedInput` to process them.

**Concurrency protection in `onQuery`** (line 2855–3024):
```
onQuery() called
  │
  ├─ queryGuard.tryStart()      # Atomic idle→running transition
  │   ├─ Returns generation# if succeeded
  │   └─ Returns null if already running → enqueue messages, return
  │
  ├─ try { ... onQueryImpl() }
  │
  └─ finally {
       ├─ queryGuard.end(generation)  # running→idle if same generation
       ├─ resetLoadingState()
       ├─ mrOnTurnComplete()          # MoreRight integration
       ├─ sendBridgeResult()          # Notify bridge clients
       ├─ Turn duration message       # If >30s
       └─ Auto-restore on cancel      # If interrupted before meaningful response
     }
```

**The auto-restore on cancel** (line 2999–3022): If the user presses Escape before any meaningful response arrived, REPL automatically rewinds the conversation and restores their prompt — as if the submission never happened. This runs OUTSIDE the `queryGuard.end()` check because `onCancel` calls `forceEnd()` which bumps the generation.

#### Message Selector & Conversation Rewind

`MessageSelector` (line 4911) allows users to pick a previous message and rewind. The rewind process (`rewindConversationTo`, line 3661–3707):
1. Slices `messages` array at the selected point
2. Resets `conversationId` (forces Messages.tsx row keys to change)
3. Resets microcompact state and context collapse
4. Restores permission mode from the rewound-to message
5. Clears stale prompt suggestion

### 8.5 The Query Lifecycle in REPL

The query lifecycle spans three functions that form a chain: `onQuery` → `onQueryImpl` → `query()` (from `query.ts`).

#### `onQuery` (line 2855–3024) — The Guard Layer

Responsibilities:
- **Concurrency guard**: `queryGuard.tryStart()` prevents parallel queries
- **Swarm activation**: Marks teammate as active if in swarm mode
- **State prep**: Resets timing refs, clears streaming state, sets messages
- **Token budget**: Parses budget from input if TOKEN_BUDGET feature enabled
- **Delegation**: Calls `onQueryImpl()` then handles cleanup in `finally`

#### `onQueryImpl` (line 2661–2854) — The Context Builder

This is where the actual API call setup happens:

```
onQueryImpl() called with (messages, newMessages, abortController, shouldQuery, ...)
  │
  ├─ 1. IDE integration prep     # diagnosticTracker, closeOpenDiffs
  ├─ 2. Mark onboarding complete  # maybeMarkProjectOnboardingComplete
  ├─ 3. Generate session title    # First user message → Haiku generates title
  ├─ 4. Update allowed tools      # Skill-scoped tools written to store
  │
  ├─ 5. Early return if !shouldQuery  # Bash commands, invalid slash commands
  │
  ├─ 6. Build toolUseContext      # getToolUseContext() — fresh tools from store
  │     ├─ tools (computeTools fresh from store)
  │     ├─ mcpClients (merged fresh)
  │     ├─ commands, debug, verbose, mainLoopModel
  │     ├─ thinkingConfig
  │     ├─ readFileState, setToolJSX, addNotification
  │     ├─ setMessages, setAppState
  │     └─ All callbacks tools need
  │
  ├─ 7. Scope effort override     # Wraps getAppState for turn-only effort
  │
  ├─ 8. Parallel context loading  # Promise.all:
  │     ├─ checkAndDisableBypassPermissions
  │     ├─ checkAndDisableAutoMode
  │     ├─ getSystemPrompt(tools, model, cwd, mcpClients)
  │     ├─ getUserContext()        # git status, project info
  │     └─ getSystemContext()      # OS, shell, etc.
  │
  ├─ 9. Build system prompt       # buildEffectiveSystemPrompt()
  │     ├─ Agent definition injection
  │     ├─ Custom system prompt override
  │     └─ Append system prompt
  │
  ├─10. Reset timing counters     # hooks, tools, classifiers
  │
  ├─11. THE QUERY LOOP            # for await (event of query({...}))
  │     └─ onQueryEvent(event)    # Each streaming event
  │
  ├─12. Companion observer        # BUDDY feature — fire reaction analysis
  ├─13. API metrics capture       # ant-only TTFT/OTPS tracking
  ├─14. resetLoadingState()
  ├─15. logQueryProfileReport()
  └─16. onTurnComplete()          # User-provided callback
```

#### `onQueryEvent` (line 2584–2660) — The Stream Handler

Processes each event from the `query()` generator. Delegates to `handleMessageFromStream()` which produces new messages, then applies them with special logic:

| Event Type | Handling |
|---|---|
| **Compact boundary** | Fullscreen: keep pre-compact messages for scrollback (capped at one interval). Non-fullscreen: replace all. Bump `conversationId`. |
| **Ephemeral progress** | Replace the previous progress tick for the same tool call (prevents array explosion — 13k+ sleep ticks observed). |
| **Normal message** | Append to messages array. |
| **API error** | Set `contextBlocked` to prevent proactive tick → error → tick runaway. |
| **Streaming text** | Update `responseLength` for spinner animation and API metrics. |

#### `getToolUseContext` (line 2392–2523) — The Bridge Object

This function builds the `ProcessUserInputContext` — the **bridge between REPL state and the query engine**. It's the most important function for understanding how the React world connects to the non-React query loop.

Key design: It reads `tools` and `mcpClients` **fresh from `store.getState()`** rather than from React closure state. This ensures that MCP connections that were established asynchronously after the last render are visible to the query.

The context object includes:
- `computeTools()` — a function (not a value) that re-reads tools from store on each call
- `setMessages`, `setAppState` — React state setters tunneled into query.ts
- `readFileState` — mutable file content cache
- `requestPrompt` — for hook prompts (tunneled back to UI as `PromptDialog`)
- `resume` — callback for session resume within a query
- `onCompactProgress` — spinner updates during compaction

**For secondary development:** To pass new data from REPL into the query loop, add it to `getToolUseContext`'s return value and consume it in `processUserInput.ts` or `query.ts`.

### 8.6 Side Effects & Integration Hooks

REPL.tsx contains ~43 `useEffect` calls. Here are the most architecturally significant grouped by concern:

#### Initialization (run once on mount)

| Effect (approx line) | Purpose |
|---|---|
| `onInit()` (4107) | Verify API key, load CLAUDE.md files into `readFileState`, populate memory file cache |
| Plugin install (797) | Start background plugin installations from repo/user settings |
| Sandbox init (2337) | Initialize `SandboxManager` with ask callback if sandboxing enabled |
| Consume early input (misc) | Process any input that arrived before REPL mounted |
| Session resume (misc) | Restore file history, content replacements, session state from disk |

#### Per-Turn Effects

| Effect | Trigger | Purpose |
|---|---|---|
| Initial message (3029) | `initialMessage` changes + `!isLoading` | Process CLI args / plan mode exit messages |
| Permission recheck (2365) | `toolPermissionContext` changes | Re-evaluate queued permission requests against new rules |
| Cost threshold (2203) | `messages` changes | Show $5 cost warning dialog when threshold reached |
| Turn duration (2973) | Query completes | Add duration message for turns >30s |
| Title generation (2684) | First user message | Fire Haiku model to generate session title |

#### Continuous Background Effects

| Effect | Purpose |
|---|---|
| Idle notification (3910) | Send OS notification when Claude is waiting and user is idle |
| Idle-return hint (3946) | Show "/clear to save tokens" notification after 75min idle |
| Activity tracking (3897) | Update last interaction time on input changes |
| Queue processing (3889) | `useQueueProcessor` — drain command queue when query completes |
| Transcript logging (3829) | `useLogMessages` — persist conversation to disk |
| REPL bridge (3833) | `useReplBridge` — replicate messages to bridge session for claude.ai |
| Inbox polling (4034) | `useInboxPoller` — poll teammate messages in swarm mode |
| Scheduled tasks (4055) | `useScheduledTasks` — cron-based triggers (AGENT_TRIGGERS feature) |
| Proactive ticks (4079) | `useProactive` — auto-tick in loop mode (/job command) |

#### Notification Hooks (line 745–776)

REPL.tsx mounts ~20 notification hooks that watch for various conditions and display status indicators:

```
useModelMigrationNotifications    useCanSwitchToExistingSubscription
useIDEStatusIndicator             useMcpConnectivityStatus
useAutoModeUnavailableNotification usePluginInstallationStatus
usePluginAutoupdateNotification   useSettingsErrors
useRateLimitWarningNotification   useFastModeNotification
useDeprecationWarningNotification useNpmDeprecationNotification
useAntOrgWarningNotification      useInstallMessages
useChromeExtensionNotification    useOfficialMarketplaceNotification
useLspInitializationNotification  useTeammateLifecycleNotification
```

These are all fire-and-forget — they read state via `useAppState` and call `addNotification()`. To add a new notification, create a custom hook following this pattern and mount it in the notification hooks section.

#### The `onCancel` Function (line 2106–2163)

Handles Escape/interrupt. Critical flow:

```
onCancel()
  ├─ Pause proactive mode
  ├─ queryGuard.forceEnd()         # Bump generation, force idle
  ├─ Preserve partial streaming text as assistant message
  ├─ resetLoadingState()
  ├─ Clear token budget
  ├─ Handle based on focusedInputDialog:
  │   ├─ 'tool-permission' → abort via onAbort(), clear queue
  │   ├─ 'prompt' → reject all pending prompts, abort
  │   ├─ remote mode → cancelRequest()
  │   └─ default → abort controller
  ├─ setAbortController(null)
  └─ mrOnTurnComplete(messages, aborted=true)
```

### 8.7 Feature Flags in REPL & Secondary Development Guide

#### Feature-Gated Code Blocks

REPL.tsx uses `feature()` (a compile-time constant) extensively. In the **external build**, many blocks are dead-code-eliminated. Key feature gates:

| Feature Flag | REPL Impact | Eliminated in External? |
|---|---|---|
| `VOICE_MODE` | Voice keybinding handler, `useVoiceIntegration` | Yes |
| `BUDDY` | Companion sprite rendering, floating bubble | Depends on config |
| `PROACTIVE` / `KAIROS` | Loop mode ticks, proactive module integration | Yes (external) |
| `AGENT_TRIGGERS` | `useScheduledTasks` hook | Yes |
| `ULTRAPLAN` | UltraplanChoiceDialog, UltraplanLaunchDialog | Yes |
| `BRIDGE_MODE` | Sandbox permission forwarding to bridge clients | Conditional |
| `TOKEN_BUDGET` | Token budget parsing and backstop | Conditional |
| `COORDINATOR_MODE` | Coordinator user context injection | Yes |
| `MESSAGE_ACTIONS` | Message cursor, copy/edit actions | Conditional |
| `TRANSCRIPT_CLASSIFIER` | Auto-mode safety checks | Conditional |
| `CONTEXT_COLLAPSE` | Context collapse reset on rewind | Conditional |
| `COMMIT_ATTRIBUTION` | Attribution tracking and snapshot | Conditional |
| `HOOK_PROMPTS` | requestPrompt tunneled to PromptDialog | Conditional |
| `WEB_BROWSER_TOOL` | WebBrowserPanel in scrollable area | Yes |
| `BG_SESSIONS` | Background session detach on exit | Conditional |

**`"external" === 'ant'` pattern:** Many blocks are wrapped in this string comparison. In external builds, `"external"` is literally the string `"external"`, so `"external" === 'ant'` is always `false`, and the entire block is dead-code-eliminated. This covers: DevBar, TungstenLiveMonitor, API metrics, frustration detection, task list watcher, model switch callout, undercover callout, skill improvement survey, etc.

#### Recipes for Common REPL Modifications

**Recipe: Add a new keybinding**
1. Define the keybinding action in `src/keybindings/` (see existing patterns)
2. Add a handler in either `GlobalKeybindingHandlers` (always active) or `CommandKeybindingHandlers` (when prompt has focus)
3. Wire it up in the `KeybindingSetup` section of REPL's JSX

**Recipe: Add a new persistent notification**
1. Create a hook: `src/hooks/notifs/useMyNotification.ts`
2. Use `useAppState()` to read the relevant state
3. Call `addNotification()` / `removeNotification()` from `useNotifications()`
4. Mount the hook in REPL.tsx at line ~745 (notification hooks section)

**Recipe: Modify the streaming behavior**
1. `onQueryEvent` (line 2584) handles all streaming events
2. `handleMessageFromStream()` (imported from `utils/messages.ts`) does the parsing
3. The `setMessages` callback inside `onQueryEvent` applies special rules (compact boundary handling, ephemeral progress dedup)
4. `streamingText`, `streamingToolUses`, `streamingThinking` drive the real-time UI

**Recipe: Add a new field to the tool context**
1. Add the field to `ProcessUserInputContext` type in `src/utils/processUserInput/processUserInput.ts`
2. Populate it in `getToolUseContext()` (REPL.tsx line ~2392)
3. Consume it in `query.ts` or tool implementations

**Recipe: Modify the cancel/interrupt behavior**
1. `onCancel` (line 2106) is the entry point
2. `CancelRequestHandler` (from `useCancelRequest.ts`) handles the keybinding
3. `cancelRequestProps` (line 2187) defines what the handler can access
4. Double-Escape triggers `handleExit` which shows exit flow

### 8.8 Key Architectural Insights for Secondary Development

1. **The `messagesRef` pattern**: Throughout REPL.tsx, `messages` state is accessed via `messagesRef.current` in callbacks to avoid stale closures. The `setMessages` wrapper updates `messagesRef` synchronously. This is the most common source of bugs when modifying REPL — always use `messagesRef.current` in async callbacks, never the closure-captured `messages`.

2. **The `store.getState()` escape hatch**: For values that change asynchronously (MCP connections, plugin state), REPL reads from the zustand-like store directly rather than from React state. This breaks React's unidirectional data flow but is necessary because `useEffect` runs after Ink's render cycle.

3. **The God Component tradeoff**: REPL.tsx is deliberately a single massive component because:
   - The query lifecycle needs access to ~20 pieces of state simultaneously
   - Breaking it up would require prop drilling or context providers that add overhead per Ink render frame
   - The `useCallback` dependency arrays already track all the needed state

   **Consequence for forks:** You cannot easily extract subsystems. Instead, identify the exact lines you need to modify using this guide, and make surgical edits.

4. **Memory management**: Multiple comments reference heap analysis and GC behavior. Key patterns:
   - `onSubmitRef` (line 3613) — stabilize callback to prevent pinning old REPL render scopes
   - `messagesRef.current` instead of `messages` in deps — prevents ~30× per-turn `onSubmit` recreation
   - Ephemeral progress replacement (line 2619) — prevents messages array from growing to 13k+

5. **The two-screen architecture**: REPL has exactly two screens (`'prompt'` | `'transcript'`). The transcript mode (ctrl+o) is a completely separate render path with its own keybinding set. There is no router — it's a simple if/else at line 4392. Adding a third screen means adding another early-return branch before the main render.

6. **Session backgrounding** (ctrl+b, line 2526–2583): Creates a full snapshot of the conversation state (messages, system prompt, user/system context, tools) and hands it to `startBackgroundSession`. The foreground query is aborted, and the background session continues independently. This is the mechanism behind `/bg` and tmux-based long-running sessions.
