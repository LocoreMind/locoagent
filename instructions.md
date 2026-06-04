# LocoAgent — Install, Configure, Use

A concise quickstart. For full docs see `README.md` / `README.zh-CN.md`.

---

## 1. Install (one-click)

**macOS / Linux / WSL2**
```bash
curl -fsSL https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.ps1 | iex
```

The installer: installs **Bun** if missing, ensures **agent-browser**, detects Chrome & Git (does *not* auto-install them — install if it warns), clones the repo, and scaffolds `.env` from `.env.example`.

- Installs into the **current directory** if empty, otherwise into `./locoagent`. Override with `LOCO_DIR`. Re-running from inside a checkout updates it in place.
- Requires **Bun** (not Node). The repo runs from source: `git clone` → `bun install` → `bun start`.

---

## 2. Configure (`.env`)

Edit `.env` in the install directory. **Only the LLM key is required**; everything else has working defaults.

```bash
LLM_PROVIDER=deepseek          # deepseek | openai | anthropic | custom
LLM_API_KEY=sk-...             # ← the one value you must set
LLM_MODEL=deepseek-chat        # blank = provider default
LLM_BASE_URL=                  # only for custom / self-hosted OpenAI-compatible
```

Other blocks (all optional):
- **Windows:** `CLAUDE_CODE_GIT_BASH_PATH=` — absolute path to `bash.exe` (installer auto-detects when it can).
- **Corporate VPN / campus TLS** ("unable to get local issuer certificate"): export the gateway root CA to a `.pem` and set `NODE_EXTRA_CA_CERTS=` to its absolute path.
- **Chrome / CDP:** `DEVICE_PROFILE` (desktop|ios|android), `CHROME_BIN` (only if auto-detect fails). Per-platform ports/profiles live in `config/browser-targets.json`, not `.env`.

Verify your setup at any time:
```bash
bun run doctor                 # checks Bun, Chrome, agent-browser, .env, …
bun run doctor --check-cdp     # also probes every platform's CDP port
```

---

## 3. Browser setup (log in once)

LocoAgent drives a **fresh, isolated, persistent Chrome profile** with CDP — never your everyday Chrome.

```bash
bun run setup-chrome           # launch the default (X) target on :9222
```
A Chrome window opens. **Log into your social account(s) once** — the session persists across restarts. `bun run setup-chrome --reset` wipes the isolated profile to log in fresh.

**Multiple platforms** (each its own port + isolated profile → cookie isolation):
```bash
bun run setup-chrome --all              # launch every target (x:9222, linkedin:9223, reddit:9224)
bun run setup-chrome --target linkedin  # launch just one; log into it once
```
Targets are defined in `config/browser-targets.json` (the single source of truth).

> Never let the agent automate the login itself — it can rate-limit the account. Always log in by hand in the Chrome window.

---

## 4. Use

**Interactive (REPL)**
```bash
bun start
```

**Headless / single task (`-p`)**
```bash
bun start -p "open X.com and like the first post about AI agents"
bun start -p "/x-com like 5 posts about 'large language models', then follow the authors"
bun start --model anthropic/claude-sonnet-4.5     # override the model per run
```
Platform playbooks load on demand as slash commands, e.g. `/x-com`. The agent records every like/follow/reply in a dedup log, so re-running won't repeat actions.

**Workflows** (scripted, LLM-free pipelines)
```bash
bun run workflow list                       # status of all workflows
bun run workflow run --id x-search-reply    # run one synchronously
bun run workflow start --id x-search-reply  # run once in the background
bun run workflow daemon --id x-search-reply --interval 60   # repeat every 60 min
bun run workflow stop --id x-search-reply   # stop a background/daemon run
```

**Run several platforms together** — same platform serial, different platforms in parallel:
```bash
bun run workflow orchestrate --ids x-search-reply,linkedin-search-reply
```

**Watch the agent live** (in a second terminal): `bun run tail`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Timeout connecting to CDP at 127.0.0.1:9222` | Chrome isn't up — run `bun run setup-chrome` (or `--target <platform>` / `--all`). |
| `unable to get local issuer certificate` / untrusted root | Behind a TLS-inspecting proxy — set `NODE_EXTRA_CA_CERTS` (see §2). |
| Anything off | `bun run doctor --check-cdp` — it names the failing check and the fix. |
| agent-browser opens the wrong Chrome | Re-run `bun run setup-chrome`; it pins agent-browser to the isolated CDP profile. |
