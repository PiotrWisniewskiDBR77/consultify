#!/usr/bin/env bash
# Stanowisko dowodowe paczki D3 („jedna baza pokazowa po angielsku").
# Baza: WŁASNA kopia consultify_kopia_d3 na PG18 (:54418). Porty 4179/3199 —
# celowo poza pulą innych agentów (4100/3090/4164/3184/4170-4178/3190-3198).
# NIE dotyka stagingu, demo ani produkcji.
set -euo pipefail
REPO="${REPO:-/private/tmp/wt-d3}"
DIR="${DIR:-/private/tmp/dane-pokazowe-en-d3}"
API_PORT=4179
WEB_PORT=3199
DB_URL="postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d3"

mkdir -p "$DIR"
[ -f "$DIR/server.env" ] || { echo "BRAK $DIR/server.env (skopiuj z /private/tmp/stanowisko-noc/server.env)" >&2; exit 1; }

if ! curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
  cd "$REPO/server"
  nohup env \
    DOTENV_IGNORE_LOCAL=1 \
    ENV_FILE="$DIR/server.env" \
    NODE_ENV=development \
    CI=true \
    PORT="$API_PORT" \
    DB_TYPE=postgres \
    DB_MANAGED_SCHEMA=off \
    MOCK_DB=false \
    DATABASE_URL="$DB_URL" \
    FRONTEND_URL="http://localhost:$WEB_PORT" \
    ENABLE_V8_GLOBAL=true \
    DISABLE_SCHEDULER=true \
    DISABLE_AI_PROVIDER_SENTINEL=true \
    LOG_LEVEL=info \
    npx tsx src/index.ts > "$DIR/server.log" 2>&1 &
  echo $! > "$DIR/server.pid"
  cd "$REPO"
  for _ in $(seq 1 90); do curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break; sleep 2; done
fi
curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null && echo "[d3] API OK (:$API_PORT, PID $(cat "$DIR/server.pid" 2>/dev/null))"

if ! curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null 2>&1; then
  cd "$REPO"
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^VITE_' "$DIR/server.env" || true)
  set +a
  nohup env \
    VITE_DOTENV_DISABLED=1 \
    VITE_API_TARGET="http://127.0.0.1:$API_PORT" \
    VITE_API_URL= \
    npx vite --port "$WEB_PORT" --strictPort --host 127.0.0.1 \
    > "$DIR/vite.log" 2>&1 &
  echo $! > "$DIR/vite.pid"
  for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null 2>&1 && break; sleep 1; done
fi
curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null && echo "[d3] frontend OK (:$WEB_PORT, PID $(cat "$DIR/vite.pid" 2>/dev/null))"
