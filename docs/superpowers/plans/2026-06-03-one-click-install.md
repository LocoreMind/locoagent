# LocoAgent One-Click Install — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-command bootstrap installer for LocoAgent on macOS/Linux/WSL2 (`install.sh`) and Windows (`install.ps1`), served from GitHub raw URLs, that installs Bun + agent-browser, clones the repo, scaffolds/configures `.env`, and runs `doctor` — so a user goes from nothing to a ready environment with one pasted command.

**Architecture:** Two standalone scripts at repo root, fetched via `raw.githubusercontent.com` *before* the repo exists, so each is fully self-contained and does its own cloning. A committed `.env.example` is the config template; the installers copy it to `.env` and (when a real terminal is attached) interactively fill in provider/API-key. README gets a "⚡ One-click install" subsection in both EN and zh-CN.

**Tech Stack:** Bash (POSIX-ish), PowerShell 5+, Bun, agent-browser, Git (with GitHub tarball/zip fallback).

**Spec:** `docs/superpowers/specs/2026-06-03-one-click-install-design.md`

**No automated test suite exists** (per CLAUDE.md). Verification = `bash -n` syntax check, PowerShell `[ScriptBlock]::Create` parse check, `bun run typecheck` delta (must not increase the ~5199 baseline), and a manual dry read. Full E2E on real Win/macOS is the user's acceptance.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `.env.example` | Documented config template; source for scaffolded `.env`. New file. |
| `install.sh` | macOS/Linux/WSL2 bootstrap. New file, repo root. |
| `install.ps1` | Windows PowerShell bootstrap. New file, repo root. |
| `README.md` | Add "⚡ One-click install" block above `### 📥 Setup` (line ~16 of install section). |
| `README.zh-CN.md` | Same block, translated, above `### 📥 安装步骤` (line 106). |

Confirmed facts driving content:
- Env contract (from `scripts/lib/config.ts`, `host.ts`, `device.ts`, `stubs/globals.ts`): `CLAUDE_CODE_USE_OPENAI`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_GIT_BASH_PATH`, `NODE_EXTRA_CA_CERTS`, `DEVICE_PROFILE` (desktop/ios/android), `CHROME_DEBUG_PORT` (9222), `CHROME_BIN`, `CHROME_SOURCE_PROFILE`, `CHROME_WORK_PROFILE`, `SKIP_PERMISSIONS`.
- `.gitignore` ignores exact `.env` (line 32), NOT `.env.example` — so the example commits with no negation needed.
- Repo: `https://github.com/LocoreMind/locoagent.git`, default branch `main`.
- Bun global add command is `bun add -g <pkg>`.

---

## Task 1: Add `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write the file**

```dotenv
# LocoAgent configuration — copy to .env (the installer does this for you).
# Only the API key is strictly required; everything else has working defaults.

# ── LLM provider ────────────────────────────────────────────────────────────
# Use an OpenAI-compatible endpoint (DeepSeek, etc.) through the built-in shim.
# Set to 1 for OpenAI-compatible; leave empty to use the native Anthropic SDK.
CLAUDE_CODE_USE_OPENAI=1
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# Native Anthropic path (used when CLAUDE_CODE_USE_OPENAI is empty):
ANTHROPIC_API_KEY=

# ── Windows runtime ─────────────────────────────────────────────────────────
# Absolute path to git-bash (bash.exe). install.ps1 auto-detects this when it can.
CLAUDE_CODE_GIT_BASH_PATH=

# ── TLS / proxy (optional) ──────────────────────────────────────────────────
# Extra CA bundle, e.g. behind a corporate proxy that re-signs TLS.
NODE_EXTRA_CA_CERTS=

# ── Chrome / CDP ────────────────────────────────────────────────────────────
# All optional — scripts/lib/host.ts auto-detects sane per-OS defaults.
# DEVICE_PROFILE: desktop | ios | android   (browser emulation target)
DEVICE_PROFILE=desktop
# CDP remote-debugging port used by setup-chrome + agent-browser.
CHROME_DEBUG_PORT=9222
# Override Chrome binary path only if auto-detection fails.
CHROME_BIN=
# Your real Chrome profile dir (source) and the isolated work copy.
CHROME_SOURCE_PROFILE=
CHROME_WORK_PROFILE=

# ── Permissions ─────────────────────────────────────────────────────────────
# Set to 1 to auto-pass --dangerously-skip-permissions (see stubs/globals.ts).
SKIP_PERMISSIONS=
```

- [ ] **Step 2: Verify it is not gitignored**

Run: `git check-ignore .env.example; echo "exit=$?"`
Expected: `exit=1` (NOT ignored).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "feat: add documented .env.example config template"
```

---

## Task 2: Add `install.sh` (macOS / Linux / WSL2)

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Write the script**

Full content (see the canonical copy below in this plan; it is reproduced verbatim into the file). Key behaviors: `set -u`; reads `/dev/tty` for prompts so `curl | bash` stays interactive; `set_env` does in-place key replacement; tarball fallback when git is absent; idempotent re-run via `git pull`.

```bash
#!/usr/bin/env bash
# LocoAgent one-click installer — macOS / Linux / WSL2
#   curl -fsSL https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- /custom/dir
# Env overrides: LOCO_DIR (target dir), LOCO_BRANCH (default main).
set -u

REPO_SLUG="LocoreMind/locoagent"
BRANCH="${LOCO_BRANCH:-main}"
INSTALL_DIR="${1:-${LOCO_DIR:-$HOME/locoagent}}"

if [ -t 2 ]; then
  C_B=$'\033[1m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_0=$'\033[0m'
else C_B=''; C_G=''; C_Y=''; C_R=''; C_0=''; fi
info() { printf '%s\n' "${C_B}==>${C_0} $*" >&2; }
ok()   { printf '%s\n' "${C_G}OK ${C_0} $*" >&2; }
warn() { printf '%s\n' "${C_Y}!! ${C_0} $*" >&2; }
err()  { printf '%s\n' "${C_R}XX ${C_0} $*" >&2; }
die()  { err "$*"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

TTY=""
[ -r /dev/tty ] && TTY=/dev/tty
ask() { # ask <prompt> <default>
  local prompt="$1" def="$2" ans=""
  if [ -n "$TTY" ]; then
    if [ -n "$def" ]; then printf '%s [%s]: ' "$prompt" "$def" >&2
    else printf '%s: ' "$prompt" >&2; fi
    IFS= read -r ans < "$TTY" || ans=""
  fi
  [ -z "$ans" ] && ans="$def"
  printf '%s' "$ans"
}
ask_secret() { # ask_secret <prompt>  (hidden input)
  local prompt="$1" ans=""
  if [ -n "$TTY" ]; then
    printf '%s: ' "$prompt" >&2
    stty -echo < "$TTY" 2>/dev/null
    IFS= read -r ans < "$TTY" || ans=""
    stty echo < "$TTY" 2>/dev/null
    printf '\n' >&2
  fi
  printf '%s' "$ans"
}

# 1. Detect OS
OS="$(uname -s 2>/dev/null || echo unknown)"
case "$OS" in
  Darwin) HOST=macos ;;
  Linux)  HOST=linux ;;
  *)      HOST=linux ;;
esac
WSL_NOTE=""
if [ "$HOST" = linux ] && grep -qi microsoft /proc/version 2>/dev/null; then WSL_NOTE=" (WSL)"; fi
info "LocoAgent installer — host=$HOST$WSL_NOTE  ->  $INSTALL_DIR"

# 2. Bun
bun_path() { export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"; export PATH="$BUN_INSTALL/bin:$PATH"; }
if have bun; then ok "Bun present ($(bun --version))"
else
  info "Installing Bun..."
  if have curl; then curl -fsSL https://bun.sh/install | bash
  elif have wget; then wget -qO- https://bun.sh/install | bash
  else die "Need curl or wget to install Bun."; fi
  bun_path
  have bun || die "Bun installed but not on PATH; open a new shell and re-run."
  ok "Bun installed ($(bun --version))"
fi
bun_path

# 3. agent-browser
if have agent-browser; then ok "agent-browser present"
else
  info "Installing agent-browser..."
  if have npm; then npm install -g agent-browser >/dev/null 2>&1 || warn "npm global install failed"
  else bun add -g agent-browser >/dev/null 2>&1 || warn "bun global install failed"; fi
  bun_path
  if have agent-browser; then ok "agent-browser installed"
  else warn "agent-browser not on PATH — install manually later: npm i -g agent-browser"; fi
fi

# 4. Detect Chrome & Git (detect-only)
chrome_found=0
if [ "$HOST" = macos ] && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then chrome_found=1; fi
for c in google-chrome google-chrome-stable chromium chromium-browser; do have "$c" && chrome_found=1; done
if [ "$chrome_found" = 1 ]; then ok "Chrome detected"
else
  warn "Google Chrome not detected."
  if [ "$HOST" = macos ]; then warn "  Install: brew install --cask google-chrome  (or https://www.google.com/chrome/)"
  else warn "  Install Chrome/Chromium via your package manager or https://www.google.com/chrome/"; fi
fi
GIT_OK=0; have git && GIT_OK=1
[ "$GIT_OK" = 1 ] && ok "Git present" || warn "Git not found — will fetch a source tarball (no auto-updates)."

# 5. Clone / update
fetch_tarball() {
  info "Downloading source tarball..."
  local url="https://codeload.github.com/$REPO_SLUG/tar.gz/refs/heads/$BRANCH" tmp
  tmp="$(mktemp -d)"
  if have curl; then curl -fsSL "$url" -o "$tmp/loco.tgz" || die "tarball download failed"
  else wget -qO "$tmp/loco.tgz" "$url" || die "tarball download failed"; fi
  tar -xzf "$tmp/loco.tgz" -C "$tmp" || die "tarball extract failed"
  local top; top="$(find "$tmp" -maxdepth 1 -type d -name 'locoagent-*' | head -n1)"
  [ -n "$top" ] || die "unexpected tarball layout"
  mkdir -p "$INSTALL_DIR"
  cp -R "$top/." "$INSTALL_DIR/"
  rm -rf "$tmp"
}
if [ -d "$INSTALL_DIR/.git" ] && [ "$GIT_OK" = 1 ]; then
  info "Updating existing checkout..."
  git -C "$INSTALL_DIR" pull --ff-only || warn "git pull failed; continuing with existing files"
elif [ -e "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
  warn "$INSTALL_DIR exists and is not a git checkout — using as-is."
elif [ "$GIT_OK" = 1 ]; then
  info "Cloning $REPO_SLUG ..."
  git clone --branch "$BRANCH" --depth 1 "https://github.com/$REPO_SLUG.git" "$INSTALL_DIR" || die "git clone failed"
else
  fetch_tarball
fi
ok "Source ready at $INSTALL_DIR"

# 6. Dependencies
info "Installing dependencies (bun install)..."
( cd "$INSTALL_DIR" && bun install ) || die "bun install failed"
ok "Dependencies installed"

# 7. .env scaffold + configure
ENV_FILE="$INSTALL_DIR/.env"; EXAMPLE="$INSTALL_DIR/.env.example"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then cp "$EXAMPLE" "$ENV_FILE"; ok "Created .env from .env.example"
  else warn ".env.example missing; creating empty .env"; : > "$ENV_FILE"; fi
fi
get_env() { grep "^$1=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2-; }
set_env() { # set_env KEY VALUE — pure-bash line rewrite (no sed escaping pitfalls)
  local key="$1" val="$2" line out="" found=0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "${key}="*) out="${out}${key}=${val}"$'\n'; found=1 ;;
      *)          out="${out}${line}"$'\n' ;;
    esac
  done < "$ENV_FILE"
  [ "$found" = 0 ] && out="${out}${key}=${val}"$'\n'
  printf '%s' "$out" > "$ENV_FILE"
}
if [ -n "$TTY" ]; then
  info "Configure your LLM provider (press Enter to accept defaults)."
  prov="$(ask 'Provider — 1) OpenAI-compatible (DeepSeek etc.)  2) Anthropic' '1')"
  if [ "$prov" = "2" ]; then
    set_env CLAUDE_CODE_USE_OPENAI ""
    key="$(ask_secret 'ANTHROPIC_API_KEY (blank to keep/skip)')"
    [ -n "$key" ] && set_env ANTHROPIC_API_KEY "$key"
  else
    set_env CLAUDE_CODE_USE_OPENAI "1"
    base_def="$(get_env OPENAI_BASE_URL)"; [ -z "$base_def" ] && base_def="https://api.deepseek.com"
    model_def="$(get_env OPENAI_MODEL)"; [ -z "$model_def" ] && model_def="deepseek-chat"
    set_env OPENAI_BASE_URL "$(ask 'OPENAI_BASE_URL' "$base_def")"
    set_env OPENAI_MODEL "$(ask 'OPENAI_MODEL' "$model_def")"
    key="$(ask_secret 'OPENAI_API_KEY (blank to keep/skip)')"
    [ -n "$key" ] && set_env OPENAI_API_KEY "$key"
  fi
  ok ".env configured"
else
  warn "Non-interactive install — edit $ENV_FILE and set your API key before running."
fi

# 8. Health check
info "Running health check (bun run doctor)..."
( cd "$INSTALL_DIR" && bun run doctor ) || warn "doctor reported issues — usually just a missing API key or Chrome."

# 9. Next steps
printf '\n' >&2
ok "LocoAgent installed at $INSTALL_DIR"
{
  printf '\nNext steps:\n'
  printf '  cd "%s"\n' "$INSTALL_DIR"
  if [ -z "$(get_env OPENAI_API_KEY)" ] && [ -z "$(get_env ANTHROPIC_API_KEY)" ]; then
    printf '  # add your API key to .env first\n'
  fi
  printf '  bun run setup-chrome     # copy Chrome profile + launch Chrome with CDP on :9222\n'
  printf '  bun start                # interactive REPL\n'
} >&2
```

- [ ] **Step 2: Syntax check**

Run: `bash -n install.sh && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: add install.sh one-click bootstrap (macOS/Linux/WSL2)"
```

---

## Task 3: Add `install.ps1` (Windows)

**Files:**
- Create: `install.ps1`

- [ ] **Step 1: Write the script**

```powershell
#Requires -Version 5
# LocoAgent one-click installer — Windows (PowerShell)
#   irm https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.ps1 | iex
# Env overrides: $env:LOCO_DIR (target dir), $env:LOCO_BRANCH (default main).
$ErrorActionPreference = 'Stop'

$RepoSlug   = 'LocoreMind/locoagent'
$Branch     = if ($env:LOCO_BRANCH) { $env:LOCO_BRANCH } else { 'main' }
$InstallDir = if ($env:LOCO_DIR) { $env:LOCO_DIR } else { Join-Path $HOME 'locoagent' }

function Info($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "OK  $m" -ForegroundColor Green }
function Warn($m){ Write-Host "!!  $m" -ForegroundColor Yellow }
function Die($m){  Write-Host "XX  $m" -ForegroundColor Red; exit 1 }
function Have($c){ [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-BunPath { $b = Join-Path $HOME '.bun\bin'; if (Test-Path $b) { $env:PATH = "$b;$env:PATH" } }

$Interactive = -not [Console]::IsInputRedirected
Info "LocoAgent installer  ->  $InstallDir (branch $Branch)"

# 1. Bun
if (Have bun) { Ok "Bun present ($(bun --version))" }
else {
  Info "Installing Bun..."
  try { Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression } catch { Die "Bun install failed: $_" }
  Refresh-BunPath
  if (-not (Have bun)) { Die "Bun installed but not on PATH; open a new terminal and re-run." }
  Ok "Bun installed ($(bun --version))"
}
Refresh-BunPath

# 2. agent-browser
if (Have agent-browser) { Ok "agent-browser present" }
else {
  Info "Installing agent-browser..."
  if (Have npm) { try { npm install -g agent-browser 2>$null } catch {} }
  else { try { bun add -g agent-browser 2>$null } catch {} }
  Refresh-BunPath
  if (Have agent-browser) { Ok "agent-browser installed" }
  else { Warn "agent-browser not on PATH - install manually later: npm i -g agent-browser" }
}

# 3. Detect Chrome & Git (detect-only)
$chromePaths = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$chromeFound = $false
foreach ($p in $chromePaths) { if ($p -and (Test-Path $p)) { $chromeFound = $true; break } }
if ($chromeFound) { Ok "Chrome detected" }
else { Warn "Google Chrome not detected. Install: winget install Google.Chrome  (or https://www.google.com/chrome/)" }
$GitOk = Have git
if ($GitOk) { Ok "Git present" } else { Warn "Git not found - will download a source zip (no auto-updates)." }

# 4. Clone / update
function Fetch-Zip {
  Info "Downloading source zip..."
  $url = "https://codeload.github.com/$RepoSlug/zip/refs/heads/$Branch"
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("loco-" + [System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'loco.zip'
  try { Invoke-RestMethod $url -OutFile $zip } catch { Die "zip download failed: $_" }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $top = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like 'locoagent-*' } | Select-Object -First 1
  if (-not $top) { Die "unexpected zip layout" }
  if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir | Out-Null }
  Copy-Item -Path (Join-Path $top.FullName '*') -Destination $InstallDir -Recurse -Force
  Remove-Item -Recurse -Force $tmp
}
if ((Test-Path (Join-Path $InstallDir '.git')) -and $GitOk) {
  Info "Updating existing checkout..."
  try { git -C $InstallDir pull --ff-only } catch { Warn "git pull failed; continuing" }
}
elseif ((Test-Path $InstallDir) -and (Get-ChildItem $InstallDir -Force -ErrorAction SilentlyContinue)) {
  Warn "$InstallDir exists and is not a git checkout - using as-is."
}
elseif ($GitOk) {
  Info "Cloning $RepoSlug ..."
  try { git clone --branch $Branch --depth 1 "https://github.com/$RepoSlug.git" $InstallDir } catch { Die "git clone failed: $_" }
}
else { Fetch-Zip }
Ok "Source ready at $InstallDir"

# 5. Dependencies
Info "Installing dependencies (bun install)..."
Push-Location $InstallDir
try { bun install } catch { Pop-Location; Die "bun install failed: $_" }
Pop-Location
Ok "Dependencies installed"

# 6. .env scaffold + configure
$EnvFile = Join-Path $InstallDir '.env'
$Example = Join-Path $InstallDir '.env.example'
if (-not (Test-Path $EnvFile)) {
  if (Test-Path $Example) { Copy-Item $Example $EnvFile; Ok "Created .env from .env.example" }
  else { Warn ".env.example missing; creating empty .env"; New-Item -ItemType File -Path $EnvFile | Out-Null }
}
function Get-EnvVal($key){
  $rx = "^$([regex]::Escape($key))="
  $line = Select-String -Path $EnvFile -Pattern $rx -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($line) { return ($line.Line -replace $rx, '') } else { return '' }
}
function Set-EnvVal($key,$val){
  $rx = "^$([regex]::Escape($key))="
  $content = @(Get-Content $EnvFile -ErrorAction SilentlyContinue)
  if ($content -match $rx) { $new = $content | ForEach-Object { if ($_ -match $rx) { "$key=$val" } else { $_ } } }
  else { $new = $content + "$key=$val" }
  Set-Content -Path $EnvFile -Value $new -Encoding UTF8
}
function Read-Default($prompt,$def){
  $label = if ($def) { "$prompt [$def]" } else { $prompt }
  try { $a = Read-Host $label } catch { $a = '' }
  if ([string]::IsNullOrWhiteSpace($a)) { return $def } else { return $a }
}
function Read-Secret($prompt){
  try {
    $s = Read-Host $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    $p = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)
    return $p
  } catch { return '' }
}
if ($Interactive) {
  Info "Configure your LLM provider (press Enter to accept defaults)."
  $prov = Read-Default 'Provider - 1) OpenAI-compatible (DeepSeek etc.)  2) Anthropic' '1'
  if ($prov -eq '2') {
    Set-EnvVal 'CLAUDE_CODE_USE_OPENAI' ''
    $k = Read-Secret 'ANTHROPIC_API_KEY (blank to keep/skip)'
    if ($k) { Set-EnvVal 'ANTHROPIC_API_KEY' $k }
  } else {
    Set-EnvVal 'CLAUDE_CODE_USE_OPENAI' '1'
    $baseDef = Get-EnvVal 'OPENAI_BASE_URL'; if (-not $baseDef) { $baseDef = 'https://api.deepseek.com' }
    $modelDef = Get-EnvVal 'OPENAI_MODEL'; if (-not $modelDef) { $modelDef = 'deepseek-chat' }
    Set-EnvVal 'OPENAI_BASE_URL' (Read-Default 'OPENAI_BASE_URL' $baseDef)
    Set-EnvVal 'OPENAI_MODEL'    (Read-Default 'OPENAI_MODEL' $modelDef)
    $k = Read-Secret 'OPENAI_API_KEY (blank to keep/skip)'
    if ($k) { Set-EnvVal 'OPENAI_API_KEY' $k }
  }
  Ok ".env configured"
} else {
  Warn "Non-interactive install - edit $EnvFile and set your API key before running."
}

# 6b. git-bash auto-detect (Windows runtime needs CLAUDE_CODE_GIT_BASH_PATH)
if (-not (Get-EnvVal 'CLAUDE_CODE_GIT_BASH_PATH')) {
  $cand = @()
  $g = Get-Command git -ErrorAction SilentlyContinue
  if ($g) { $root = Split-Path (Split-Path $g.Source -Parent) -Parent; $cand += (Join-Path $root 'bin\bash.exe') }
  $cand += @(
    (Join-Path $env:ProgramFiles 'Git\bin\bash.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe')
  )
  foreach ($b in $cand) { if ($b -and (Test-Path $b)) { Set-EnvVal 'CLAUDE_CODE_GIT_BASH_PATH' $b; Ok "git-bash: $b"; break } }
}

# 7. Health check
Info "Running health check (bun run doctor)..."
Push-Location $InstallDir
try { bun run doctor } catch { Warn "doctor reported issues - usually just a missing API key or Chrome." }
Pop-Location

# 8. Next steps
Write-Host ""
Ok "LocoAgent installed at $InstallDir"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  cd `"$InstallDir`""
if (-not (Get-EnvVal 'OPENAI_API_KEY') -and -not (Get-EnvVal 'ANTHROPIC_API_KEY')) {
  Write-Host "  # add your API key to .env first"
}
Write-Host "  bun run setup-chrome     # copy Chrome profile + launch Chrome with CDP on :9222"
Write-Host "  bun start                # interactive REPL"
```

- [ ] **Step 2: Parse check**

Run (pwsh): `[ScriptBlock]::Create((Get-Content -Raw install.ps1)) | Out-Null; 'OK'`
Expected: `OK` (no parse exception).

- [ ] **Step 3: Commit**

```bash
git add install.ps1
git commit -m "feat: add install.ps1 one-click bootstrap (Windows)"
```

---

## Task 4: README — EN one-click block

**Files:**
- Modify: `README.md` (insert directly under `### 📥 Setup`, before the existing ` ```bash git clone... ` block)

- [ ] **Step 1: Insert the block**

Find:
```
### 📥 Setup

```bash
git clone https://github.com/LocoreMind/locoagent.git
```
Replace the `### 📥 Setup` line and the line under it so the new content sits first:

```markdown
### ⚡ One-click install (recommended)

One command installs Bun + agent-browser, clones the repo, scaffolds `.env`, and runs the health check. It prompts for your API key when run in a terminal.

**macOS / Linux / WSL2**
```bash
curl -fsSL https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.ps1 | iex
```

Installs to `~/locoagent` (override with `LOCO_DIR`). Re-running updates an existing checkout. Afterwards: `cd locoagent && bun run setup-chrome && bun start`. Chrome and Git are detected (not auto-installed) — install them if the script warns.

### 📥 Manual setup
```

- [ ] **Step 2: Verify the git-clone block still follows** (manual read — the existing ```bash git clone…``` block must remain immediately after the new `### 📥 Manual setup` heading).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add one-click install section (EN)"
```

---

## Task 5: README — zh-CN one-click block

**Files:**
- Modify: `README.zh-CN.md:106` (`### 📥 安装步骤`)

- [ ] **Step 1: Insert the block**

Replace the `### 📥 安装步骤` heading (line 106) with:

```markdown
### ⚡ 一键安装（推荐）

一条命令即可安装 Bun + agent-browser、克隆仓库、生成 `.env` 并运行健康检查。在终端中运行时会提示你输入 API Key。

**macOS / Linux / WSL2**
```bash
curl -fsSL https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.sh | bash
```

**Windows（PowerShell）**
```powershell
irm https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.ps1 | iex
```

默认安装到 `~/locoagent`（可用 `LOCO_DIR` 覆盖）。重复运行会更新已有的检出。完成后：`cd locoagent && bun run setup-chrome && bun start`。Chrome 与 Git 仅检测、不自动安装——若脚本提示缺失，请自行安装。

### 📥 手动安装步骤
```

- [ ] **Step 2: Commit**

```bash
git add README.zh-CN.md
git commit -m "docs: add one-click install section (zh-CN)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Typecheck delta** — `bun run typecheck 2>&1 | grep -c "error TS"` does not exceed the ~5199 baseline (shell/doc changes shouldn't touch it).
- [ ] **Step 2: Re-confirm script syntax** — `bash -n install.sh && echo SH_OK`; PowerShell parse check from Task 3 Step 2.
- [ ] **Step 3: Confirm `.env.example` committed and `.env` still ignored** — `git check-ignore .env .env.example` prints only `.env`.
- [ ] **Step 4:** Report results to the user; full E2E on real Windows + macOS is their acceptance step.

---

## Self-Review

- **Spec coverage:** raw-URL hosting (Tasks 4/5 commands), bootstrap self-contained (Tasks 2/3), Bun+agent-browser auto-install (steps 2-3 each), detect Chrome/Git + tarball fallback (step 4-5 each), clone-or-update idempotency (step 5), `.env` scaffold + interactive/non-interactive split + non-clobber via defaults (step 7), git-bash autodetect Windows (Task 3 step 6b), doctor (step 8), next steps no auto-launch (step 9), `.env.example` (Task 1), README EN+zh (Tasks 4/5). All spec sections mapped.
- **Placeholder scan:** none — every file body is complete and verbatim.
- **Type/name consistency:** `set_env`/`get_env` (bash) and `Set-EnvVal`/`Get-EnvVal` (ps1) used consistently; `REPO_SLUG`/`$RepoSlug`, `BRANCH`/`$Branch`, `INSTALL_DIR`/`$InstallDir` consistent within each script.
