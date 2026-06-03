# LocoAgent One-Click Install — Design

**Date:** 2026-06-03
**Branch:** `feature/one-click-setup`
**Status:** Approved (design), pending implementation

## Goal

Give LocoAgent the same "paste one command" onboarding that OpenClaw and Claude
Code offer, with a Windows (PowerShell) variant and a macOS/Linux/WSL2 (bash)
variant. The command must install the runtime + dependencies, clone the repo,
scaffold and optionally fill in `.env`, and verify the environment.

## Why this is a bootstrap, not a binary installer

OpenClaw and Claude Code ship **published, self-updating binaries**, so their
install scripts just drop an executable on `PATH`. LocoAgent is a **source tree
run under Bun** (`git clone` → `bun install` → `bun start`) with local stub
packages and a `.env` for configuration. Therefore each one-click script is a
**bootstrap**: it is fetched via GitHub raw URL *before the repo exists*, and is
itself responsible for cloning the repo and performing all setup. The scripts
must be fully standalone — they cannot depend on anything inside the repo until
after the clone step.

## User-facing commands

```bash
# macOS / Linux / WSL2
curl -fsSL https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.sh | bash
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.ps1 | iex
```

Hosting: **GitHub raw URL** (`raw.githubusercontent.com/LocoreMind/locoagent/main/...`).
No custom domain, no extra infrastructure. A custom domain can later redirect to
these paths without changing the scripts.

## Files to add / change

| File | Purpose |
|------|---------|
| `install.sh` | macOS/Linux/WSL2 bootstrap. Standalone POSIX-ish bash. Served via raw URL. |
| `install.ps1` | Windows PowerShell bootstrap. Standalone. Served via raw URL. |
| `.env.example` | Committed config template: every key documented with safe defaults. Source for the scaffolded `.env`. |
| `README.md` / `README.zh-CN.md` | Add a "⚡ One-click install" subsection above the existing manual **📥 Setup**. |

Note: today `.env` is gitignored and there is **no** `.env.example`. Adding one is
part of this work; the installer copies it to `.env`.

## Script flow (both platforms, same logic)

Each step logs a clear progress line. All progress/diagnostic output goes to
stderr-style human messages; there is no machine-parsed stdout contract (these
are user-facing installers, not workflow executors).

1. **Detect OS / arch.** bash: `uname -s` / `uname -m` (Darwin/Linux, detect
   WSL via `/proc/version` containing "microsoft"). ps1: `$PSVersionTable` +
   `[Environment]::Is64BitOperatingSystem`.

2. **Install Bun if missing.** Check for `bun` on PATH.
   - bash: `curl -fsSL https://bun.sh/install | bash`, then add
     `~/.bun/bin` to PATH for the current process.
   - ps1: `irm bun.sh/install.ps1 | iex`, then add `~/.bun/bin` to
     `$env:PATH` for the current process.

3. **Ensure `agent-browser`.** Check `agent-browser --version`.
   - If absent: prefer `npm i -g agent-browser` when `npm` is on PATH; else
     `bun install -g agent-browser`. If neither npm nor a working bun-global
     install is available, warn and continue (non-fatal — doctor will flag it).

4. **Detect Chrome & Git** (detect-only, do not auto-install).
   - Chrome: probe known binary locations per OS (reuse the same locations
     `scripts/lib/host.ts` checks). If missing, print an install hint
     (winget / brew / download URL) and continue (non-fatal).
   - Git: required for `git clone`. If missing, print a hint AND fall back to
     downloading the GitHub tarball
     (`https://codeload.github.com/LocoreMind/locoagent/tar.gz/refs/heads/main`)
     and extracting it, so the install still completes. Re-run updates then use
     `git pull` only when git is present.

5. **Clone / update.** Target dir = first positional arg, else `$LOCO_DIR`
   env var, else `~/locoagent`.
   - If dir does not exist: clone (or tarball-extract).
   - If dir exists and is a git repo: `git pull --ff-only`.
   - If dir exists and is NOT a git repo: warn and skip re-fetch (use as-is).

6. **Install deps.** `cd` into the dir, run `bun install`.

7. **Scaffold + configure `.env`.**
   - If `.env` absent: copy `.env.example` → `.env`.
   - **Interactive path** (a real terminal is attached — bash: `/dev/tty`
     readable; ps1: `$Host.UI.RawUI` available and not piped):
     prompt for the essentials and write them into `.env`:
     - Provider: OpenAI-compatible (DeepSeek/etc.) vs native Anthropic.
       Choosing OpenAI-compatible sets `CLAUDE_CODE_USE_OPENAI=1`.
     - `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` for native path)
     - `OPENAI_BASE_URL` (default offered, e.g. DeepSeek)
     - `OPENAI_MODEL` (default offered)
     Values are written by key-replacement into the existing `.env` line, not
     blind-appended (avoid duplicate keys on re-run). On re-run, a key that
     already holds a non-empty, non-placeholder value is offered as the prompt
     default (press Enter to keep) — the installer never silently overwrites an
     existing configured value.
   - **Non-interactive path** (piped, no tty): skip all prompts, leave the
     `.env.example` placeholders in place, and print
     `→ edit .env and set OPENAI_API_KEY before running`.
   - Windows only: auto-detect git-bash (`git.exe` location → sibling
     `bash.exe`, or known install paths) and set `CLAUDE_CODE_GIT_BASH_PATH`
     in `.env` when found (per known Windows runtime requirement).

8. **Verify.** Run `bun run doctor`. Print its output. A doctor failure is
   reported but does **not** abort the installer (the user may still need to add
   their API key / run setup-chrome).

9. **Print next steps:**
   ```
   cd <install-dir>
   bun run setup-chrome     # copy Chrome profile + launch with CDP on :9222
   bun start                # interactive REPL
   ```
   The installer does **not** auto-launch the agent — a logged-in Chrome over
   CDP is required first.

## Defaults

- **Install directory:** `~/locoagent` (override: first arg, or `LOCO_DIR`).
- **Branch:** `main`.
- **No auto-launch** at the end; print next steps only.
- **Idempotent:** re-running updates an existing checkout and re-runs doctor;
  it does not clobber an existing `.env` (only fills missing/placeholder keys).

## `.env.example` contents (documented template)

Keys, with comments and safe defaults (no secrets):

```
# --- LLM provider -----------------------------------------------------------
# Set to 1 to use an OpenAI-compatible endpoint (DeepSeek, etc.) via the shim.
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
# (Native Anthropic path instead: unset CLAUDE_CODE_USE_OPENAI, set ANTHROPIC_API_KEY)

# --- Windows runtime --------------------------------------------------------
# Path to git-bash; auto-detected by install.ps1 when possible.
CLAUDE_CODE_GIT_BASH_PATH=

# --- TLS (optional) ---------------------------------------------------------
# Extra CA bundle, e.g. behind a corporate proxy.
NODE_EXTRA_CA_CERTS=

# --- Chrome / CDP -----------------------------------------------------------
CHROME_DEBUG_PORT=9222
CHROME_BIN=
CHROME_WORK_PROFILE=
CHROME_SOURCE_PROFILE=
```

Exact default values to be confirmed against `scripts/lib/host.ts` /
`setup-chrome.ts` during implementation so they match what the code already
expects.

## Error handling

- Each external command checked for success; failures in **non-fatal** steps
  (agent-browser, Chrome detect, doctor) print a warning and continue.
- **Fatal** failures (cannot obtain the repo at all; `bun install` fails) print
  a clear error and exit non-zero.
- bash: `set -u` and explicit per-command checks (avoid `set -e` swallowing the
  interactive-prompt logic). ps1: `$ErrorActionPreference = 'Stop'` with
  try/catch around fatal steps.

## Out of scope

- Custom domain / short link (raw URL only for now).
- Auto-installing Chrome or Git (detect-and-warn only; Git has a tarball
  fallback).
- Windows native (non-WSL) vs WSL2 recommendation messaging beyond what already
  exists — the script runs natively on Windows via PowerShell.
- Any change to the agent runtime, tools, or workflow engine.

## Verification plan

There is no unit-test suite for shell scripts. Verify by:
1. `bun run typecheck` — no new errors vs baseline (scripts are shell, so this
   should be unaffected; confirm `.env.example` / README changes don't break
   anything).
2. Lint the scripts: `bash -n install.sh` (syntax) and PowerShell parse check.
3. Dry-run review of each step against a clean-ish environment; full E2E on a
   real Windows + macOS box is the user's acceptance step.
