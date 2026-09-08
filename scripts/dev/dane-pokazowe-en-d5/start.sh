#!/usr/bin/env bash
# Stanowisko dowodowe paczki D5 („jedna baza pokazowa po angielsku" — Wyniki + Finanse).
# Baza: WŁASNA kopia consultify_kopia_d5 na PG18 (:54418). Porty 4185/3205 —
# celowo poza pulą innych agentów (4100/3090/4164/3184/4170-4184/3190-3204).
# NIE dotyka stagingu, demo ani produkcji.
#
# NODE_ENV=development + CI=true (a NIE NODE_ENV=test) — CELOWO:
# `resultsInternalBetaVisibility.middleware.ts:26-32` PRZEPUSZCZA każdego, gdy
# NODE_ENV=test i brak RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce.
# Na NODE_ENV=test harness pokazałby listę KPI komuś, komu produkcja jej nie da.
set -euo pipefail
REPO="${REPO:-/private/tmp/wt-d5}"
DIR="${DIR:-/private/tmp/dane-pokazowe-en-d5}"
API_PORT=4185
WEB_PORT=3205
DB_URL="postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d5"

mkdir -p "$DIR"
[ -f "$DIR/server.env" ] || cp /private/tmp/stanowisko-noc/server.env "$DIR/server.env"

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
curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null && echo "[d5] API OK (:$API_PORT, PID $(cat "$DIR/server.pid" 2>/dev/null))"

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
curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null && echo "[d5] frontend OK (:$WEB_PORT, PID $(cat "$DIR/vite.pid" 2>/dev/null))"
