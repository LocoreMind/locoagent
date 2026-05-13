#!/usr/bin/env bash
# setup-chrome.sh
# Pre-launch Chrome with CDP remote debugging, copying the real Chrome profile
# so agent-browser can operate social accounts with existing login sessions.
#
# Usage:
#   ./scripts/setup-chrome.sh              # uses defaults from .env
#   CHROME_SOURCE_PROFILE=... ./scripts/setup-chrome.sh
#
# Required env vars (set in .env or shell):
#   CHROME_SOURCE_PROFILE  - path to your real Chrome profile dir (default: ~/Library/Application Support/Google/Chrome/Default)
#   CHROME_WORK_PROFILE    - temp dir to copy profile into           (default: /tmp/locoagent-chrome-profile)
#   CHROME_DEBUG_PORT      - CDP remote debugging port               (default: 9222)
#   CHROME_BIN             - path to Chrome binary                   (default: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome)

set -euo pipefail

# ── Load .env if present ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

# ── Defaults ──────────────────────────────────────────────────────────────────
CHROME_SOURCE_PROFILE="${CHROME_SOURCE_PROFILE:-$HOME/Library/Application Support/Google/Chrome/Default}"
CHROME_WORK_PROFILE="${CHROME_WORK_PROFILE:-/tmp/locoagent-chrome-profile}"
CHROME_DEBUG_PORT="${CHROME_DEBUG_PORT:-9222}"
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
CHROME_LOCAL_STATE_SRC="$(dirname "$CHROME_SOURCE_PROFILE")/Local State"

# ── Step 1: Kill existing Chrome ─────────────────────────────────────────────
echo "→ Killing any existing Google Chrome processes..."
killall "Google Chrome" 2>/dev/null || true
sleep 1

# ── Step 2: Copy Chrome profile ──────────────────────────────────────────────
if [[ ! -d "$CHROME_SOURCE_PROFILE" ]]; then
  echo "✗ Chrome source profile not found: $CHROME_SOURCE_PROFILE"
  echo "  Set CHROME_SOURCE_PROFILE in .env to the correct path."
  exit 1
fi

echo "→ Copying Chrome profile to $CHROME_WORK_PROFILE ..."
echo "  (source: $CHROME_SOURCE_PROFILE)"
rm -rf "$CHROME_WORK_PROFILE"
mkdir -p "$CHROME_WORK_PROFILE"
cp -r "$CHROME_SOURCE_PROFILE" "$CHROME_WORK_PROFILE/Default"

# Copy Local State (required for Chrome to read the profile correctly)
if [[ -f "$CHROME_LOCAL_STATE_SRC" ]]; then
  cp "$CHROME_LOCAL_STATE_SRC" "$CHROME_WORK_PROFILE/Local State"
  echo "  ✓ Local State copied"
else
  echo "  ⚠ Local State not found at: $CHROME_LOCAL_STATE_SRC (may cause profile read errors)"
fi

# ── Step 3: Launch Chrome with CDP ───────────────────────────────────────────
echo "→ Launching Chrome on port $CHROME_DEBUG_PORT ..."
"$CHROME_BIN" \
  --remote-debugging-port="$CHROME_DEBUG_PORT" \
  --user-data-dir="$CHROME_WORK_PROFILE" \
  --no-first-run \
  --disable-default-apps \
  2>/dev/null &

CHROME_PID=$!
echo "  Chrome PID: $CHROME_PID"

# ── Step 4: Wait for CDP port to be ready ────────────────────────────────────
echo "→ Waiting for CDP port $CHROME_DEBUG_PORT to be ready..."
MAX_WAIT=15
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "http://127.0.0.1:$CHROME_DEBUG_PORT/json/version" >/dev/null 2>&1; then
    echo "  ✓ Chrome CDP ready (${i}s)"
    break
  fi
  if [[ $i -eq $MAX_WAIT ]]; then
    echo "✗ Chrome CDP port $CHROME_DEBUG_PORT did not become ready after ${MAX_WAIT}s"
    exit 1
  fi
  sleep 1
done

# ── Step 5: Connect agent-browser ────────────────────────────────────────────
echo "→ Connecting agent-browser to CDP port $CHROME_DEBUG_PORT ..."
agent-browser connect "$CHROME_DEBUG_PORT"

echo ""
echo "✓ Chrome setup complete. agent-browser is ready."
echo "  Profile: $CHROME_WORK_PROFILE"
echo "  CDP:     http://127.0.0.1:$CHROME_DEBUG_PORT"
echo ""
echo "  Run: bun run start"
