# Locoremind Social Agent

**An AI-powered social media agent built on a privacy-focused Claude Code fork, with browser automation capabilities via `agent-browser` CLI.**

[![License](https://img.shields.io/badge/license-See%20Original-blue)](https://github.com/anthropics/claude-code)
[![Privacy](https://img.shields.io/badge/privacy-100%25-green)](https://github.com/IIIIQIIII/claude-code-clean)
[![Telemetry](https://img.shields.io/badge/telemetry-removed-red)](https://github.com/IIIIQIIII/claude-code-clean)

---

## 🔒 Privacy First

This fork removes **all tracking and remote control mechanisms** found in the original Claude Code:

- ❌ **No telemetry** - Zero data sent to Anthropic's servers
- ❌ **No analytics** - No usage tracking or event logging
- ❌ **No fingerprinting** - No user or environment identification
- ❌ **No auto-updates** - No remote version control or forced updates
- ✅ **100% user control** - You own your installation

---

## 📊 What Was Removed

### Telemetry Infrastructure (~8,500+ lines)
- BigQuery metrics exporter
- Event logging to `api.anthropic.com/api/event_logging/batch`
- Session tracking and user identification
- Environment fingerprinting
- Performance tracing (Perfetto/OpenTelemetry)

### Anti-Distillation Tracking
- Message content fingerprinting (SHA256 of user prompts)
- Attribution tags sent with every API request

### Auto-Update & Remote Control
- Automatic downloads from Google Cloud Storage
- Remote version enforcement (can force-quit your app)
- Version kill switches
- Update notifications


---

## 🚀 Installation

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- macOS, Linux, or WSL2

### Quick Start

```bash
# Clone the repository
git clone https://github.com/IIIIQIIII/claude-code-clean.git
cd claude-code-clean

# Install dependencies
bun install

# Run
bun start
```

### Configuration

Create a `.env` file in the project root (automatically loaded at startup):

```env
# OpenAI-compatible provider (recommended: OpenRouter)
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-sonnet-4.5
```

Then just run:

```bash
bun start
```

No need to pass environment variables on the command line — `.env` is loaded automatically via `stubs/globals.ts` preload.

> For direct Anthropic API access, use `ANTHROPIC_API_KEY` instead (omit `CLAUDE_CODE_USE_OPENAI`).

---

## ✅ Verification

All privacy claims are **verifiable**:

```bash
# Run automated privacy tests (25 checks)
./tests/verify-privacy.sh

# Run runtime tests
./tests/simple-runtime-test.sh

# Monitor network traffic (requires mitmproxy)
# See tests/test-network-monitoring.md
```

**Test Results:** 100% pass rate ✅

---

## 🔍 What's Different

### Original Claude Code
- ✅ Telemetry enabled by default for API/Enterprise users
- ✅ Sends metrics every 5 minutes to BigQuery
- ✅ Tracks user ID, email, session IDs
- ✅ Fingerprints your environment
- ✅ Can be remotely disabled by Anthropic
- ✅ Auto-downloads updates

### Claude Code Clean
- ❌ All telemetry removed
- ❌ No data collection
- ❌ No user tracking
- ❌ No fingerprinting
- ❌ Cannot be remotely controlled
- ❌ No auto-updates (you control versions)

---

## 🛡️ Privacy Guarantees

### What This Fork Does NOT Do

- ❌ Send telemetry to Anthropic or third parties
- ❌ Collect session IDs or user identifiers
- ❌ Fingerprint your system or environment
- ❌ Track your usage patterns
- ❌ Extract characters from prompts for tracking
- ❌ Store failed telemetry events for retry
- ❌ Auto-update without your permission
- ❌ Phone home to any server (except Claude API for inference)

### What This Fork DOES Do

- ✅ Makes necessary API calls to Claude (required for functionality)
- ✅ Stores conversation history locally (user-controlled)
- ✅ Maintains all core Claude Code features
- ✅ Built-in computer use via open-source MCP server (no proprietary native modules)
- ✅ Respects your privacy and data ownership

---

## 🔧 Technical Details

### Implementation

- **Files deleted:** 19 (telemetry/analytics modules)
- **Files modified:** 408+ (import statements updated)
- **Lines removed:** ~8,500+ (tracking code)
- **Stub files created:** 4 (no-op replacements)

### Verification Methods

1. **Static Analysis** - `./tests/verify-privacy.sh` (25 automated checks)
2. **Runtime Testing** - `./tests/simple-runtime-test.sh`
3. **Network Monitoring** - mitmproxy/tcpdump/Wireshark guides provided
4. **Code Review** - All changes documented

---

## 🖥️ Computer Use (Screen Control)

Claude Code Clean includes built-in computer use support via [computer-use-mcp](https://github.com/domdomegg/computer-use-mcp), pre-configured in `.mcp.json`. This allows Claude to take screenshots, move the mouse, click, type, scroll, and drag on your desktop.

### Prerequisites

- **Node.js** (v18+) — required for the MCP server (runs via `npx`)
- **macOS Accessibility permission** — grant your terminal app access in System Settings > Privacy & Security > Accessibility

### How It Works

On startup, Claude Code Clean automatically launches the `computer-control` MCP server. No manual setup needed — just start a session and ask Claude to interact with your screen:

```
> Take a screenshot and tell me what you see
> Open Safari and navigate to github.com
> Click on the search bar and type "claude code"
```

The tool is exposed as `mcp__computer-control__computer` with actions: `get_screenshot`, `left_click`, `right_click`, `middle_click`, `double_click`, `mouse_move`, `left_click_drag`, `scroll`, `key`, `type`, `get_cursor_position`.

### Safety Notes

- The MCP server controls your real mouse and keyboard — **no sandbox isolation**
- Always supervise Claude during computer use sessions
- Use `Ctrl+C` to stop at any time
- Consider using a dedicated macOS user account for testing

---

## 🌍 Browser Automation via agent-browser

Locoremind Social Agent uses [`agent-browser`](https://github.com/browserbase/agent-browser) CLI as the primary browser automation tool for social media interactions. The agent has full knowledge of the CLI built into its system prompt.

### Prerequisites

Install agent-browser:

```bash
npm install -g agent-browser
agent-browser install   # Download Chrome binaries (first time)
```

### How It Works

The agent uses `agent-browser` via the `Bash` tool. The core workflow is:

```bash
agent-browser open <url>         # Navigate
agent-browser snapshot -i        # Perceive: get interactive elements with @ref IDs
agent-browser click @e2          # Act by @ref
agent-browser fill @e3 "text"
```

Session persistence for social platforms:

```bash
# Save login state once
agent-browser --session-name twitter open https://twitter.com

# Reused automatically in subsequent runs
agent-browser --session-name twitter snapshot -i
```

Full CLI reference is available at `docs/agent-browser-help.txt`.

---

## 🌐 OpenAI-Compatible Model Support

Locoremind Social Agent supports **any OpenAI-compatible API** as the backend LLM, including OpenAI, OpenRouter, DeepSeek, Ollama, LM Studio, Together AI, Groq, Mistral, Azure OpenAI, and more.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_CODE_USE_OPENAI` | Yes | Set to `1` to enable |
| `OPENAI_API_KEY` | Yes* | API key (* optional for local models) |
| `OPENAI_BASE_URL` | No | API base URL (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | No | Model ID (default: `gpt-4o`) |

### Examples

**OpenAI directly:**

```env
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

All other provider examples below also use `.env` file configuration. Create `.env` in the project root and run `bun start`.

**OpenRouter (access 200+ models):**

```env
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-sonnet-4.5
```

**DeepSeek:**

```env
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

**Ollama (local):**

```env
CLAUDE_CODE_USE_OPENAI=1
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.3
```

**LM Studio (local):**

```env
CLAUDE_CODE_USE_OPENAI=1
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_MODEL=your-model-name
```

**Azure OpenAI:**

```env
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=your-azure-key
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment
OPENAI_MODEL=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

### How It Works

An API shim layer (`src/services/api/openaiShim.ts`) transparently translates between Anthropic message format and OpenAI Chat Completions format. All Claude Code tools (bash, file read/write, grep, glob, agents, MCP, etc.) work normally -- only the underlying LLM changes.

---

## 📝 Usage

### Interactive Mode (default)

```bash
bun start
```

### Print Mode (single query)

```bash
bun start -p "Explain quantum computing"
```

### With Specific Model

```bash
bun start --model claude-sonnet-4-6
```

### Resume Previous Session

```bash
bun start --continue
```

---

## ⚠️ Disclaimer

This is an **independent fork** and is **not affiliated with or endorsed by Anthropic**.

- Original Claude Code: Copyright Anthropic
- Privacy modifications: Community-maintained fork
- Use at your own risk

This fork removes telemetry but functionality may differ from official releases.

---

## 🤝 Contributing

Contributions welcome! Please ensure:

1. ✅ No telemetry, analytics, or tracking code is re-introduced
2. ✅ Privacy-respecting implementations only
3. ✅ All network requests are transparent and documented
4. ✅ Tests pass: `./tests/verify-privacy.sh`

---

## 📜 License

This is a derivative work of Anthropic's Claude Code. Please refer to the original license terms.

**Privacy modifications:** MIT License (see LICENSE file)

---

## 🙏 Credits

- **Anthropic** - For creating Claude Code
- **[@Fried_rice](https://x.com/Fried_rice)** - For discovering the source map exposure
- **Community** - For valuing privacy and transparency

---

## 🔗 Links

- **Original Source Discovery:** [Twitter/X Post](https://x.com/Fried_rice/status/2038894956459290963)
- **Original Claude Code:** [Anthropic Claude Code](https://claude.ai/code)
- **Issue Tracker:** [GitHub Issues](https://github.com/IIIIQIIII/claude-code-clean/issues)

---

## ❓ FAQ

### Q: Will this break functionality?
**A:** No. All tracking was side-effect code. Core features work normally.

### Q: Can I use my Anthropic API key?
**A:** Yes. Authentication and API access work as expected.

### Q: Is this legal?
**A:** This is a derivative work. The original source was publicly exposed. Check Claude Code's license for distribution terms.

### Q: How can I verify the privacy claims?
**A:** Run `./tests/verify-privacy.sh` or review the code yourself. All changes are documented.

### Q: Will you maintain this?
**A:** Community-maintained. Pull requests welcome.

### Q: What about future Claude Code updates?
**A:** You control when/if to merge upstream changes. No forced updates.

---

**Privacy matters. Your code, your data, your choice.** 🔒

---

## Star History

If you find this project useful, please consider giving it a star ⭐

---

**Version:** 1.0.0
**Last Updated:** 2026-05-03
**Status:** ✅ Active Development
