#!/usr/bin/env bash
# Londyn stable dev launcher (Consultify)
# - Ensures we run the Londyn branch
# - Prevents multiple "other versions" from staying up (kills previous dev servers from this repo)
# - Starts backend+frontend with the seeded SQLite DB used in screenshots

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

kill_if_ours() {
  local pid="$1"
  local cmd=""
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ -n "$cmd" && "$cmd" == *"$ROOT_DIR"* ]]; then
    kill "$pid" 2>/dev/null || true
  fi
}

kill_port_if_ours() {
  local port="$1"
  local pids=""
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      kill_if_ours "$pid"
    done <<< "$pids"
  fi
}

echo "== Londyn launcher =="
cd "$ROOT_DIR"

echo "Stopping previous dev servers (this repo only)..."
kill_port_if_ours 3000
kill_port_if_ours 3001

# Also kill common dev commands (only if command line contains repo path)
for pid in $(pgrep -f "tsx watch src/index.ts" 2>/dev/null || true); do kill_if_ours "$pid"; done
for pid in $(pgrep -f "node .*vite --port 3000" 2>/dev/null || true); do kill_if_ours "$pid"; done
for pid in $(pgrep -f "concurrently .*dev:backend.*dev:frontend" 2>/dev/null || true); do kill_if_ours "$pid"; done

if [[ "${1:-}" == "--stop" || "${1:-}" == "--stop-only" ]]; then
  echo "Stopped Londyn dev servers (this repo only)."
  exit 0
fi

LIVE_MODE=false
if [[ "${1:-}" == "--live" ]]; then
  LIVE_MODE=true
  echo "Mode: LIVE (backend auto-restart on file changes, HMR enabled)"
fi

echo "Ensuring git is on branch 'Londyn'..."
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ "$current_branch" != "Londyn" ]]; then
  # Switch without forcing. If it can't switch safely, we stop with a clear message.
  if ! git switch Londyn >/dev/null 2>&1; then
    echo "ERROR: Can't switch to 'Londyn' safely (you have local changes)."
    echo "Save your work (commit or stash), then run this again."
    exit 1
  fi
fi

DB_PATH="$ROOT_DIR/data/dev/consultinity.db"
if [[ ! -f "$DB_PATH" ]]; then
  echo "WARNING: SQLite DB not found at: $DB_PATH"
  echo "Creating empty database directory..."
  mkdir -p "$ROOT_DIR/data/dev"
  echo "The database will be initialized on first run."
fi

echo "Starting Londyn (frontend:3000, backend:3001) ..."
echo "Login: piotr.wisniewski@dbr77.com / 123456"
if [[ "$LIVE_MODE" == "true" ]]; then
  echo "Tip: Changes in frontend/backend will auto-reload (no manual restart needed)"
fi

# IMPORTANT:
# - dotenv in backend loads .env, but does NOT override existing env vars
# - so we force DB_TYPE/SQLITE_PATH here to always use the seeded DB
# - Use ABSOLUTE path to avoid issues with server running from different CWD
# - --live: uses dev:watch so backend restarts on file changes; HMR stays on (no VITE_STABLE_DEV)
if [[ "$LIVE_MODE" == "true" ]]; then
  DB_TYPE=sqlite \
  SQLITE_PATH="$DB_PATH" \
  PORT=3001 \
  VITE_API_URL="http://localhost:3001" \
  npm run dev:watch
else
  DB_TYPE=sqlite \
  SQLITE_PATH="$DB_PATH" \
  PORT=3001 \
  VITE_API_URL="http://localhost:3001" \
  npm run dev
fi

