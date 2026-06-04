# Cross-Platform Guide

LocoAgent runs on **Windows** and **macOS** (Linux works but is unverified). The
agent process always runs on a desktop host; **iOS/Android are browser-emulation
targets**, not native runtimes.

## Two axes

- **Host** — where the agent runs (`windows` / `macos` / `linux`). Auto-detected.
  Controls Chrome binary path, profile location, temp dir, process kill.
- **Target device** — what the browser emulates (`desktop` / `ios` / `android`),
  set via `DEVICE_PROFILE` in `.env`. Maps to `agent-browser -p <profile>`.

The platform layer lives in `scripts/lib/` (`host.ts`, `device.ts`, `config.ts`)
and is shared by `setup-chrome.ts` and `doctor.ts`.

## First run (any OS)

```bash
bun install
bun run doctor            # verify bun, agent-browser, Chrome, env
bun run setup-chrome      # launch isolated Chrome with CDP on :9222 (no conflict with your normal Chrome)
bun start                 # interactive REPL
```

`bun run setup-chrome` is the same command on every OS. `setup-chrome:win` is a
retained alias. It launches a **fresh, isolated, persistent** profile (never your
real Chrome) and connects agent-browser; log into your socials once in that
window and the session persists. Re-running just reconnects — it never kills your
everyday Chrome or wipes the session. Use `bun run setup-chrome --reset` to wipe
the isolated profile and log in fresh.

## Configuration (`.env`)

| Var | Default (Windows) | Default (macOS) |
|-----|-------------------|-----------------|
| `CHROME_BIN` | `C:\Program Files\Google\Chrome\Application\chrome.exe` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| `CHROME_WORK_PROFILE` (isolated, persistent) | `%LOCALAPPDATA%\locoagent-chrome-profile` | `~/Library/Application Support/locoagent-chrome-profile` |
| `CHROME_DEBUG_PORT` | `9222` | `9222` |
| `DEVICE_PROFILE` | `desktop` | `desktop` |

Any value left unset falls back to the host-aware default; override only what you need.

## Targeting a mobile device

Set `DEVICE_PROFILE=ios` (or `android`) in `.env`, or pass `-p ios` directly to
agent-browser per command:

```bash
agent-browser -p ios open https://x.com
```

When an action is logged, record the surface with `--device`:

```bash
bun run scripts/log-operation.ts add --platform x --action like \
  --url <url> --status success --device ios
```

`device` is provenance only — dedup remains account-level (a like is a like
regardless of which surface performed it).

## Verifying

```bash
bun run typecheck         # tsc --noEmit (note: the vendored src/ tree has pre-existing errors; check your own files)
bun test scripts          # unit tests for the platform layer
bun run doctor            # host health check
bun run doctor --check-cdp  # also probe the running CDP port
```

`tests/*.sh` are bash-only smoke scripts (macOS/Linux); `doctor` is the portable
equivalent.
