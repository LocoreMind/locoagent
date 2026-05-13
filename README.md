<p align="center">
  <img src="assets/banner.svg" alt="LocoAgent" width="800">
</p>

<p align="center">
  <a href="https://youtu.be/QesPS8xPaDA"><img src="https://img.shields.io/badge/demo-YouTube-red" alt="Demo"></a>
  <a href="#installation"><img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="Bun"></a>
  <a href="#installation"><img src="https://img.shields.io/badge/language-TypeScript-3178c6" alt="TypeScript"></a>
  <a href="#model-providers"><img src="https://img.shields.io/badge/LLM-multi--provider-00b4aa" alt="Multi-Provider"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
</p>

---

## What is LocoAgent?

LocoAgent is an AI-powered social media agent that autonomously operates social media accounts through real browser automation. It combines an LLM-driven agentic loop with [`agent-browser`](https://github.com/vercel-labs/agent-browser) CLI to perceive, decide, and act on live web pages — performing tasks like liking posts, writing replies, following users, and publishing content.

**Key differentiators:**

- **Real browser, real sessions** — Operates through Chrome CDP with your actual login cookies, not API hacks
- **Platform skill system** — Injects full platform operation playbooks (32+ operations for X.com) so the agent completes composite tasks in one pass
- **Workflow engine** — Pure browser-automation pipelines that run without LLM involvement, controlled by the agent as a supervisor
- **Operation log** — Persistent deduplication across sessions prevents repeated actions
- **Multi-provider LLM** — Works with any OpenAI-compatible API (OpenRouter, DeepSeek, Ollama, etc.)

---

## Installation

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| [Bun](https://bun.sh) | Latest | Runtime and package manager |
| Node.js | >= 18 | Required by some dependencies |
| [agent-browser](https://github.com/vercel-labs/agent-browser) | Latest | Browser automation CLI |
| Git | Any | For context features |

### Setup

```bash
git clone https://github.com/LocoreMind/locoagent.git
cd locoagent
bun install
```

### Configuration

Create a `.env` file in the project root (auto-loaded at startup):

```env
# LLM Provider (pick one)

# Option A: OpenRouter (access 200+ models)
CLAUDE_CODE_USE_OPENAI=1        # Enable OpenAI-compatible provider
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-sonnet-4.5

# Option B: DeepSeek (with thinking mode support)
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash

# Option C: Anthropic direct (omit CLAUDE_CODE_USE_OPENAI)
ANTHROPIC_API_KEY=sk-ant-...

# Agent behavior
SKIP_PERMISSIONS=1               # Required for non-interactive/automated mode
```

### Run

```bash
# Interactive mode
bun start

# Single query (headless)
bun start -p "open X.com and like the first post about AI agents"

# With specific model
bun start --model anthropic/claude-sonnet-4.5
```

---

## Model Providers

LocoAgent supports any OpenAI-compatible API through a built-in translation shim. The rest of the system is provider-agnostic.

| Provider | Base URL | Notes |
|----------|----------|-------|
| OpenRouter | `https://openrouter.ai/api/v1` | Access 200+ models |
| DeepSeek | `https://api.deepseek.com` | Thinking mode (`reasoning_content`) fully supported |
| OpenAI | `https://api.openai.com/v1` | GPT-4o, o1, etc. |
| Ollama | `http://localhost:11434/v1` | Local models |
| LM Studio | `http://localhost:1234/v1` | Local models |
| Anthropic | (native SDK) | Set `ANTHROPIC_API_KEY` only |
| AWS Bedrock | (native SDK) | AWS credentials |
| Google Vertex AI | (native SDK) | GCP credentials |

---

## Browser Automation

LocoAgent uses `agent-browser` CLI to control a real Chrome browser via CDP (Chrome DevTools Protocol).

### Why Chrome CDP?

Social media platforms detect and block headless browsers and API-based automation. LocoAgent operates through a copy of your real Chrome profile — same cookies, same login sessions, same fingerprint.

### Setup

```bash
# One-time: copy Chrome profile + launch with CDP
bun run setup-chrome

# agent-browser connects to the running Chrome
agent-browser connect 9222
```

### How the Agent Uses It

```bash
agent-browser open https://x.com/home        # Navigate
agent-browser snapshot -i                      # Perceive: get interactive elements with @ref IDs
agent-browser click @e5                        # Act: click a like button
agent-browser fill @e3 "Great research!"       # Act: type in a reply box
agent-browser screenshot result.png            # Verify: capture result
```

The full `agent-browser` CLI reference is embedded in the agent's system prompt, so it knows every command natively.

---

## Platform Skills

Skills are operation playbooks loaded on demand via slash commands. Each skill injects a complete manual into the agent's context, enabling composite task execution in one pass.

### Available Skills

| Platform | Command | Operations | Description |
|----------|---------|------------|-------------|
| X.com | `/x-com` | 32+ | Browse, engage, post, social graph, profile, navigation, lists |

### Usage

```bash
# Interactive: load skill then give task
> /x-com open home timeline, like first 3 posts about AI, reply to the best one

# Headless
bun start -p "/x-com like 5 posts about 'large language models', then follow the authors"
```

### Adding a New Platform

```bash
mkdir -p skills/linkedin
```

Create `skills/linkedin/SKILL.md`:

```markdown
---
description: "LinkedIn platform operations playbook"
allowed-tools:
  - Bash
user-invocable: true
---

# LinkedIn Operations

## 1. Navigation
...
```

The skill auto-discovers at startup and becomes available as `/linkedin`.

---

## Workflow Engine

Workflows are **deterministic browser-automation pipelines** that run without any LLM involvement. The agent acts as a supervisor — it can inspect status, start/stop workflows, but the execution is pure scripted automation.

### Built-in Workflows

| Workflow | ID | Schedule | Description |
|----------|----|----------|-------------|
| HuggingFace Papers Fetcher | `hf-daily-papers` | Daily | Fetch paper list, abstracts, and thumbnails from HuggingFace |
| HuggingFace → X.com | `hf-papers-to-x` | Daily | Full pipeline: fetch HF papers → download thumbnails → post as tweets |
| X.com Search & Reply | `x-search-reply` | Daemon | Search X.com → read posts → generate AI reply → post reply |

### CLI

```bash
bun run workflow list                          # List all workflows + status
bun run workflow run --id hf-papers-to-x       # Run once (blocking)
bun run workflow start --id hf-papers-to-x     # Run once (background)
bun run workflow daemon --id x-search-reply --interval 3   # Run every 3 min
bun run workflow stop --id x-search-reply      # Stop at next checkpoint
bun run workflow status                        # Show status of all workflows
bun run workflow history --id hf-papers-to-x   # Show execution history
```

### Adding a Workflow

1. Create `workflows/<id>.json` (definition with config)
2. Create `workflows/executors/<script>.ts` (executor that outputs JSON summary to stdout)
3. Test: `bun run workflow run --id <id>`

---

## Operation Log

Persistent memory across sessions. The agent checks the log before acting and records every action after — preventing duplicate likes, follows, and replies.

```bash
# Check before acting (exit 0 = already done, exit 1 = not done)
bun run scripts/log-operation.ts check \
  --platform x --action like --url "https://x.com/.../status/123"

# Record after acting
bun run scripts/log-operation.ts add \
  --platform x --action like --url "https://x.com/.../status/123" \
  --status success --note "AI agents research post"

# View recent operations
bun run scripts/log-operation.ts recent --limit 20

# 30-day summary (auto-injected into system prompt at startup)
bun run scripts/log-operation.ts summary --days 30
```

State stored in `persona/operation-log.json` (human-readable JSON).

---

## Task Scheduling

Structured daily/weekly task execution replaces ad-hoc prompts.

### Define Tasks

Edit `persona/tasks.md`:

```markdown
## Daily Tasks
1. Engage with relevant content (like posts matching topic queries)
2. Monitor own project mentions
3. Leave 1 technical comment on the most relevant post

## Weekly Tasks (Monday)
4. Follow 3-5 relevant researchers
5. Post 1 original tweet about recent research findings

## Session Constraints
| Action   | Max per session |
|----------|----------------|
| Likes    | 10             |
| Comments | 2              |
| Follows  | 5              |
| Posts    | 1              |
```

### Run

```bash
bun run run-tasks              # Execute today's tasks
bun run run-tasks:dry          # Preview the prompt without running
bun run run-tasks -- --platform x   # Restrict to one platform
```

---

## Realtime Trajectory Monitor

`--print` mode is a black box. The trajectory monitor watches the session log and prints live execution status.

```bash
# Terminal 1: start the monitor
bun run tail

# Terminal 2: run the agent
bun start -p "/x-com open timeline, like first post"
```

Output:

```
═══ New Task ═══
/x-com open timeline, like first post

[6:30:47 PM] ⚡ Bash: agent-browser connect 9222
[6:30:47 PM] ✓ Result: Done
[6:31:10 PM] ⚡ Bash: agent-browser open https://x.com/home
[6:31:27 PM] ⚡ Bash: agent-browser snapshot -i -c -s 'article'
[6:31:44 PM] ● Agent: Found first post, like button ref=e136
[6:31:44 PM] ⚡ Bash: agent-browser click e136
[6:31:45 PM] ✓ Result: Done
```

```bash
bun run tail:history           # Replay latest session from beginning
bun run tail:list              # List recent sessions
bun run tail <id>              # Watch specific session
```

---

## Project Structure

```
locoagent/
├── src/
│   ├── entrypoints/         # CLI entry point
│   ├── services/api/        # LLM provider layer (multi-provider shim)
│   ├── tools/               # 43 tool implementations
│   ├── skills/              # Bundled skills (20)
│   ├── commands/            # Slash commands (90+)
│   ├── components/          # Terminal UI components (130+)
│   ├── screens/             # REPL screen
│   ├── hooks/               # React hooks (80+)
│   ├── services/mcp/        # MCP server management
│   ├── query.ts             # Agentic loop engine
│   └── constants/prompts.ts # System prompt assembly
├── scripts/
│   ├── setup-chrome.sh      # Chrome CDP setup
│   ├── log-operation.ts     # Operation log CLI
│   ├── run-tasks.ts         # Task scheduler
│   ├── tail-agent.ts        # Trajectory monitor
│   └── workflow-engine.ts   # Workflow lifecycle manager
├── workflows/
│   ├── *.json               # Workflow definitions
│   ├── executors/           # Workflow executor scripts
│   └── state.json           # Workflow state persistence
├── persona/
│   ├── tasks.md             # Task schedule definitions
│   └── operation-log.json   # Action history for dedup
├── docs/
│   └── architecture.md      # Full architecture documentation
├── .env                     # Local config (auto-loaded)
└── package.json
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Bun |
| Language | TypeScript (TSX) |
| UI | React + Ink (terminal rendering, custom fork) |
| CLI | Commander.js |
| Browser automation | agent-browser + Chrome CDP |
| LLM integration | Multi-provider (Anthropic SDK + OpenAI-compatible shim) |
| Extension protocol | MCP (Model Context Protocol) |

---

## Documentation

- **[Architecture Guide](docs/architecture.md)** — Comprehensive deep dive into every subsystem, with recipes for common modifications
- **[agent-browser Reference](docs/agent-browser-help.txt)** — Full CLI reference for browser automation

---

## Contributing

Contributions welcome. Key areas:

- **New platform skills** — Add playbooks for LinkedIn, Reddit, etc.
- **New workflows** — Automated pipelines for content creation/distribution
- **New tools** — Extend agent capabilities
- **Bug fixes** — Especially in browser automation edge cases

---

## License

MIT License. See [LICENSE](LICENSE) for details.
