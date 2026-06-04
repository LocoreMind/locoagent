# Changelog

All notable changes to LocoAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-04

Cross-platform support, one-click installation, and provider configuration overhaul.
Contributed by [@SparkyWen](https://github.com/SparkyWen).

### Added

- **Cross-platform support** (PR #2): LocoAgent now runs on Windows, macOS, and Linux from a single codebase.
  - Platform abstraction layer (`scripts/lib/host.ts`, `device.ts`, `config.ts`) with host OS detection, Chrome binary resolution, and device-target registry (desktop/ios/android).
  - Unified `scripts/setup-chrome.ts` replaces the old macOS-only `setup-chrome.sh`, handling Chrome profile setup across all platforms.
  - `bun run doctor` health-check command verifies Bun, agent-browser, Chrome, `.env`, and optionally CDP connectivity.
  - Device provenance recorded in operation log entries.
  - Unit tests for the platform layer (`bun test scripts`).
  - Cross-platform guide (`docs/cross-platform-guide.md`).

- **One-click installation** (PR #3, #4): Bootstrap LocoAgent with a single command.
  - `install.sh` for macOS / Linux / WSL2 (`curl | bash`).
  - `install.ps1` for Windows PowerShell (`irm | iex`).
  - Interactive provider picker (DeepSeek / Anthropic / OpenAI / Custom) with model selection menu.
  - `.env.example` documenting all configuration variables.
  - Idempotent re-run: updates existing checkouts via `git pull --ff-only`, falls back to tarball download if git is absent.
  - `.gitattributes` enforcing LF line endings on shell scripts.

- **Neutral `LLM_*` configuration** (PR #5): Four intuitive env vars (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`) replace the confusing `OPENAI_*` naming for non-Anthropic providers.
  - Backward compatible: legacy `OPENAI_*` / `ANTHROPIC_*` variables still work and take precedence.
  - Translation happens at preload time in `stubs/globals.ts`.

- **TLS proxy support** (PR #5): New `shimFetch.ts` injects CA certificates into provider API calls, fixing `unable to get local issuer certificate` errors behind corporate proxies (FortiGate, Zscaler, etc.).

- **Browser connection contract** (PR #6): System prompt now includes explicit CDP preflight and hard rules forbidding automated social login, preventing account rate-limiting.

- **Bilingual README**: Full Chinese translation (`README.zh-CN.md`) alongside a rewritten English README with architecture diagram, icons, and expanded documentation.

### Changed

- **Chrome profile management** (PR #5): `setup-chrome` no longer kills all Chrome instances or copies the user's real profile. Instead it launches a dedicated, isolated, persistent CDP profile that never touches normal Chrome. The old copy-based approach was broken under Chrome 127+ App-Bound Encryption. Use `--reset` for a clean re-login.
- **Shell-out hardening** (PR #2): `execSync` replaced with `execFileSync(process.execPath, ...)` in `prompts.ts`, eliminating shell injection risk and fixing paths-with-spaces on Windows.
- **X.com skill session management** (PR #6): CDP is now the only authorized browser path; `--session-name` / `--headed` fresh sessions are explicitly forbidden. Login-wall handling changed from "dismiss" to "STOP and ask user".
- Installers now write the neutral `LLM_*` variables and clear legacy provider vars on provider switch.

### Removed

- `scripts/setup-chrome.sh` — replaced by `scripts/setup-chrome.ts`.
- `CHROME_SOURCE_PROFILE` config variable — no longer needed with isolated profile approach.

### Fixed

- `persona/` directory now created automatically before writing the operation log, fixing ENOENT on fresh clones.
- Installer target directory changed from hardcoded `~/locoagent` to current working directory with interactive confirmation.

## [1.0.0] - 2026-05-15

Initial release of LocoAgent as an independent project, forked from the Claude Code CLI source tree.

### Added

- **Agentic loop** powered by LLM (Anthropic SDK + OpenAI-compatible shim) with perceive-decide-act cycle over real browser pages.
- **Browser automation** via `agent-browser` + Chrome CDP: navigate, snapshot, click, fill, screenshot.
- **X.com platform skill** (`/x-com`): 37 operations covering browse, engagement, content creation, social graph, profile, navigation, and lists.
- **Workflow engine**: deterministic, LLM-free browser pipelines with daemon mode and scheduling.
  - `hf-daily-papers`: fetch top HuggingFace papers.
  - `hf-papers-to-x`: fetch papers and post to X.com with images.
  - `x-search-reply`: search X.com and generate AI replies.
  - `linkedin-search-reply`: search LinkedIn and generate AI comments.
- **Operation log** (`persona/operation-log.json`): persistent cross-session deduplication preventing repeated likes, follows, and replies. 30-day summary injected into system prompt.
- **Task scheduling** (`persona/tasks.md`): structured daily/weekly task execution with per-session action limits.
- **Trajectory monitor** (`bun run tail`): live execution status viewer for headless sessions.
- **Digital persona system** (`persona/`): identity, tone, and task context injected into every session.
- **Multi-provider LLM support**: Anthropic (native), OpenAI, DeepSeek (with thinking mode), OpenRouter, Ollama, LM Studio, Bedrock, Vertex AI.
- **Project-root skills directory**: auto-discovered platform playbooks via `skills/<platform>/SKILL.md`.
- **LocoAgent branding**: banner, terminal title, system prompt prefixes, CONTRIBUTING.md, and LICENSE updated from upstream Claude Code references.

[1.1.0]: https://github.com/LocoreMind/locoagent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/LocoreMind/locoagent/releases/tag/v1.0.0
