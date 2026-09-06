#!/usr/bin/env bash
# Stanowisko lokalne NOC — start bazy, serwera i frontendu.
# NIE dotyka stagingu/demo/produkcji. Wszystkie porty własne (54400/4100/3090).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/stanowisko.env"
mkdir -p "$STANOWISKO_DIR"

if [ ! -f "$STANOWISKO_DIR/server.env" ]; then
  echo "BRAK $STANOWISKO_DIR/server.env — patrz README §Flagi (railway variables --environment staging)." >&2
  exit 1
fi

# --- 1. BAZA ---------------------------------------------------------------
if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  if docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    docker start "$PG_CONTAINER" >/dev/null
  else
    docker run -d --name "$PG_CONTAINER" \
      -e POSTGRES_PASSWORD=noc -e POSTGRES_USER=postgres -e POSTGRES_DB="$PG_DB" \
      -p "127.0.0.1:$PG_PORT:5432" pgvector/pgvector:pg16 >/dev/null
    sleep 8
    echo "[stanowisko] nowy kontener — uruchom migracje: bash $HERE/migracje.sh"
  fi
fi
until docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
echo "[stanowisko] baza OK ($PG_CONTAINER :$PG_PORT)"

# --- 2. SERWER (4100) ------------------------------------------------------
if ! curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
  cd "$STANOWISKO_REPO/server"
  # CI=true: JEDYNY sposób, by databaseTargetResolver dopuścił bazę na 127.0.0.1
  #          (allowLocalDatabaseForTests) BEZ przełączania NODE_ENV na test,
  #          które podstawiłoby atrapę bazy. Patrz README §Założenia.
  nohup env \
    DOTENV_IGNORE_LOCAL=1 \
    ENV_FILE="$STANOWISKO_DIR/server.env" \
    NODE_ENV=development \
    CI=true \
    PORT="$API_PORT" \
    DB_TYPE=postgres \
    DB_MANAGED_SCHEMA=off \
    DATABASE_URL="$DATABASE_URL_NOC" \
    FRONTEND_URL="http://localhost:$WEB_PORT" \
    ENABLE_V8_GLOBAL=true \
    DISABLE_SCHEDULER=true \
    DISABLE_AI_PROVIDER_SENTINEL=true \
    LOG_LEVEL=info \
    npx tsx src/index.ts > "$STANOWISKO_DIR/server.log" 2>&1 &
  echo $! > "$STANOWISKO_DIR/server.pid"
  cd "$STANOWISKO_REPO"
  for _ in $(seq 1 90); do
    curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break
    sleep 2
  done
fi
curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null && \
  echo "[stanowisko] serwer OK (:$API_PORT, PID $(cat "$STANOWISKO_DIR/server.pid" 2>/dev/null))"

# --- 3. FRONTEND (3090) ----------------------------------------------------
if ! curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null 2>&1; then
  cd "$STANOWISKO_REPO"
  # VITE_DOTENV_DISABLED=1 — repo .env.local kieruje VITE_API_TARGET na STAGING
  # i wygrywa z process.env (loadEnv w vite.config.ts). Bez tego proxy /api
  # poszłoby na staging zamiast na nasz :4100.
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^VITE_' "$STANOWISKO_DIR/server.env" || true)
  set +a
  nohup env \
    VITE_DOTENV_DISABLED=1 \
    VITE_API_TARGET="http://127.0.0.1:$API_PORT" \
    VITE_API_URL= \
    npx vite --port "$WEB_PORT" --strictPort --host 127.0.0.1 \
    > "$STANOWISKO_DIR/vite.log" 2>&1 &
  echo $! > "$STANOWISKO_DIR/vite.pid"
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null && \
  echo "[stanowisko] frontend OK (:$WEB_PORT, PID $(cat "$STANOWISKO_DIR/vite.pid" 2>/dev/null))"
