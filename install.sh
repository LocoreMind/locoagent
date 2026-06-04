#!/usr/bin/env bash
# LocoAgent one-click installer — macOS / Linux / WSL2
#   curl -fsSL https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- /custom/dir
# Env overrides: LOCO_DIR (target dir), LOCO_BRANCH (default main).
set -u

REPO_SLUG="LocoreMind/locoagent"
BRANCH="${LOCO_BRANCH:-main}"

is_loco_repo() { [ -f "$1/install.sh" ] && [ -d "$1/src" ]; }

# Install target: honor the positional arg or $LOCO_DIR; otherwise install into
# the *current directory* (where the user ran the command). An empty dir is used
# directly; a dir that already holds the LocoAgent checkout updates in place;
# any other non-empty dir gets a ./locoagent subfolder so we never clobber files.
AUTO_DIR=0
if [ "${1:-}" ]; then
  INSTALL_DIR="$1"
elif [ "${LOCO_DIR:-}" ]; then
  INSTALL_DIR="$LOCO_DIR"
else
  AUTO_DIR=1
  cwd="$(pwd)"
  if is_loco_repo "$cwd"; then INSTALL_DIR="$cwd"
  elif [ -z "$(ls -A "$cwd" 2>/dev/null)" ]; then INSTALL_DIR="$cwd"
  else INSTALL_DIR="$cwd/locoagent"; fi
fi

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
if (exec < /dev/tty) 2>/dev/null; then TTY=/dev/tty; fi
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
# choose_model DESC  VAL1 LABEL1  VAL2 LABEL2 ...   (VAL1 is the default)
# Prints the numbered menu to stderr and reads a choice from the terminal; the
# chosen model id is the only thing written to stdout (so it is capturable).
# Enter keeps the default; 'c' types a custom name; a number picks; any other
# free-form input is taken literally as a model id.
choose_model() {
  local desc="$1"; shift
  local def="$1" n=1 ans=""
  local vals=()
  {
    printf 'Select %s model (Enter = default):\n' "$desc"
    while [ "$#" -ge 2 ]; do
      vals+=("$1")
      if [ "$n" = 1 ]; then printf '  %d) %-28s %s  [default]\n' "$n" "$1" "$2"
      else printf '  %d) %-28s %s\n' "$n" "$1" "$2"; fi
      n=$((n + 1)); shift 2
    done
    printf '  c) custom - type any model name\n'
  } >&2
  local total=$((n - 1))
  if [ -n "$TTY" ]; then
    printf 'Choice [1]: ' >&2
    IFS= read -r ans < "$TTY" || ans=""
  fi
  case "$ans" in
    "")          printf '%s' "$def" ;;
    c|C|custom)
      printf 'Custom model name: ' >&2
      IFS= read -r ans < "$TTY" || ans=""
      [ -z "$ans" ] && ans="$def"
      printf '%s' "$ans" ;;
    *[!0-9]*)    printf '%s' "$ans" ;;   # free-form input → literal model id
    *)
      if [ "$ans" -ge 1 ] && [ "$ans" -le "$total" ]; then printf '%s' "${vals[$((ans - 1))]}"
      else printf '%s' "$def"; fi ;;
  esac
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

# Let the user confirm/redirect where files land (the #1 "where did my install
# go?" confusion). Enter accepts the shown default. Skip when the path was given
# explicitly or when updating an in-place checkout.
if [ -n "$TTY" ] && [ "$AUTO_DIR" = 1 ] && ! is_loco_repo "$INSTALL_DIR"; then
  INSTALL_DIR="$(ask 'Install location' "$INSTALL_DIR")"
fi
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
clear_env() { # clear_env KEY — blank a var only if it already exists (never append)
  local key="$1" line out="" found=0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "${key}="*) out="${out}${key}="$'\n'; found=1 ;;
      *)          out="${out}${line}"$'\n' ;;
    esac
  done < "$ENV_FILE"
  [ "$found" = 1 ] && printf '%s' "$out" > "$ENV_FILE"
}
clear_legacy_provider_vars() {
  clear_env CLAUDE_CODE_USE_OPENAI; clear_env OPENAI_API_KEY; clear_env OPENAI_BASE_URL
  clear_env OPENAI_MODEL; clear_env ANTHROPIC_API_KEY; clear_env ANTHROPIC_MODEL
}
ask_llm_key() { # ask_llm_key LABEL — prompt for the provider key → neutral LLM_API_KEY
  local label="$1" v
  v="$(ask_secret "$label (Enter to keep existing)")"
  if [ -n "$v" ]; then set_env LLM_API_KEY "$v"
  elif [ -z "$(get_env LLM_API_KEY)" ]; then warn "No API key entered — add LLM_API_KEY to .env before running."; fi
}
if [ -n "$TTY" ]; then
  info "Configure your LLM provider."
  # One neutral front door: pick provider -> enter that provider's key -> pick model.
  # We write LLM_PROVIDER/LLM_API_KEY/LLM_MODEL (+LLM_BASE_URL for custom) and clear
  # any legacy OPENAI_*/ANTHROPIC_* so the .env has a single, unambiguous source.
  prov="$(ask 'Provider — 1) DeepSeek  2) Anthropic  3) OpenAI  4) Custom (OpenAI-compatible)' '1')"
  clear_legacy_provider_vars
  set_env LLM_BASE_URL ""
  case "$prov" in
    2)
      set_env LLM_PROVIDER "anthropic"
      ask_llm_key 'Anthropic API key'
      set_env LLM_MODEL "$(choose_model 'Anthropic' \
        claude-sonnet-4-6 'balanced (recommended)' \
        claude-opus-4-8 'most capable' \
        claude-haiku-4-5-20251001 'fast')"
      ;;
    3)
      set_env LLM_PROVIDER "openai"
      ask_llm_key 'OpenAI API key'
      set_env LLM_MODEL "$(choose_model 'OpenAI' \
        gpt-5.5 'latest' \
        gpt-4o 'multimodal' \
        gpt-4.1 'general')"
      ;;
    4)
      set_env LLM_PROVIDER "custom"
      set_env LLM_BASE_URL "$(ask 'Base URL (OpenAI-compatible endpoint)' 'http://localhost:1234/v1')"
      ask_llm_key 'API key (Enter if your endpoint needs none)'
      set_env LLM_MODEL "$(ask 'Model id' '')"
      ;;
    *)
      set_env LLM_PROVIDER "deepseek"
      ask_llm_key 'DeepSeek API key'
      set_env LLM_MODEL "$(choose_model 'DeepSeek' \
        deepseek-chat 'V3 general' \
        deepseek-reasoner 'R1 reasoning')"
      ;;
  esac
  ok ".env configured"
else
  warn "Non-interactive install — edit $ENV_FILE and set LLM_PROVIDER + LLM_API_KEY before running."
fi

# 8. Health check
info "Running health check (bun run doctor)..."
( cd "$INSTALL_DIR" && bun run doctor ) || warn "doctor reported issues — usually just a missing API key or Chrome."

# 8b. Offer to launch the isolated CDP Chrome now, so the user can log into their
# accounts once before starting. This is the step that creates the persistent,
# isolated profile; skipping it is why automation can fall back to a throwaway
# browser. Interactive only.
if [ -n "$TTY" ]; then
  ans="$(ask 'Launch the isolated CDP Chrome now to log into your accounts? (Y/n)' 'Y')"
  case "$ans" in
    [Nn]*) : ;;
    *) ( cd "$INSTALL_DIR" && bun run setup-chrome ) || warn "setup-chrome reported issues; run it later with: bun run setup-chrome" ;;
  esac
fi

# 9. Next steps
printf '\n' >&2
ok "LocoAgent installed at $INSTALL_DIR"
{
  printf '\nNext steps:\n'
  printf '  cd "%s"\n' "$INSTALL_DIR"
  if [ -z "$(get_env LLM_API_KEY)" ] && [ -z "$(get_env OPENAI_API_KEY)" ] && [ -z "$(get_env ANTHROPIC_API_KEY)" ]; then
    printf '  # add LLM_API_KEY to .env first\n'
  fi
  printf '  bun run setup-chrome     # launch an isolated Chrome with CDP on :9222 (does not touch your normal Chrome)\n'
  printf '  bun start                # interactive REPL\n'
} >&2
