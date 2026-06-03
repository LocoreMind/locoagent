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
if [ -n "$TTY" ]; then
  info "Configure your LLM provider."
  prov="$(ask 'Provider — 1) DeepSeek (OpenAI-compatible)  2) Anthropic' '1')"
  if [ "$prov" = "2" ]; then
    # base URL + model are fixed for the native Anthropic path; only the key is asked.
    set_env CLAUDE_CODE_USE_OPENAI ""
    key="$(ask_secret 'ANTHROPIC_API_KEY (Enter to keep existing)')"
    if [ -n "$key" ]; then set_env ANTHROPIC_API_KEY "$key"
    elif [ -z "$(get_env ANTHROPIC_API_KEY)" ]; then warn 'No API key entered — add ANTHROPIC_API_KEY to .env before running.'; fi
  else
    # base URL + model are fixed DeepSeek defaults; the user only types the key.
    set_env CLAUDE_CODE_USE_OPENAI "1"
    [ -z "$(get_env OPENAI_BASE_URL)" ] && set_env OPENAI_BASE_URL "https://api.deepseek.com"
    [ -z "$(get_env OPENAI_MODEL)" ] && set_env OPENAI_MODEL "deepseek-chat"
    key="$(ask_secret 'OPENAI_API_KEY (Enter to keep existing)')"
    if [ -n "$key" ]; then set_env OPENAI_API_KEY "$key"
    elif [ -z "$(get_env OPENAI_API_KEY)" ]; then warn 'No API key entered — add OPENAI_API_KEY to .env before running.'; fi
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
