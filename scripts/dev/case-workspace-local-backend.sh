#!/usr/bin/env bash
# =============================================================================
# Case Workspace — REALNY backend na 127.0.0.1:3001 przeciw JEDNORAZOWEJ,
# LOKALNEJ bazie Postgres (kontener case-workspace-test-pg, port 55432).
# =============================================================================
#
# PO CO: produkcyjne UI /zlecenia nigdy nie rozmawiało z żywym backendem —
# jedyny dotychczasowy harness podmieniał window.fetch atrapami. Ten skrypt
# stawia PRAWDZIWY serwer Express: prawdziwy routing, prawdziwy łańcuch
# autoryzacji, prawdziwy Postgres.
#
# DLACZEGO TO NIE JEST OBEJŚCIE ZABEZPIECZENIA:
# `npm run dev:localdb` / `dev:pg` są wyłączone (scripts/dev/reject-local-db.mjs),
# bo codzienny development ma celować w bazę zewnętrzną. Tu jest odwrotnie:
# JAWNY ZAKAZ właściciela dotyczy pisania danych testowych do bazy demo/staging.
# Weryfikacja E2E musi więc iść do bazy jednorazowej — i o to chodzi poniżej.
# Skrypt NIE modyfikuje reject-local-db.mjs i NIE podszywa się pod dev:*.
#
# --- ŚWIADOME DECYZJE ŚRODOWISKOWE (każda ma powód) --------------------------
#
# NODE_ENV=development, a NIE test — CELOWO. `NODE_ENV=test` otwiera w tym
#   repo trzy furtki, których dowód NIE MOŻE dotykać:
#     · server/src/index.ts:1157 — podmienia realny Gateway na stub,
#     · auth.middleware.ts:1136  — ENABLE_TEST_AUTH_BYPASS wpuszcza BEZ tokenu,
#     · auth.middleware.ts:1191  — E2E_MODE przyjmuje token BEZ weryfikacji
#                                  podpisu (wystarczy claim `e2e: true`).
#   Dlatego E2E_MODE i ENABLE_TEST_AUTH_BYPASS NIE są tu ustawiane w ogóle.
#   Sesja powstaje przez REALNY POST /api/auth/login i REALNY podpis JWT.
#
# CI=true — jedyny powód: databaseTargetResolver.ts:27 dopuszcza host lokalny
#   tylko przy NODE_ENV=test | CI=true | VITEST. Wybieramy CI, bo to JEDYNE
#   miejsce w całym server/src, które w ogóle czyta process.env.CI
#   (zweryfikowane grepem) — więc nie włącza żadnego innego zachowania,
#   w przeciwieństwie do NODE_ENV=test.
#
# ENABLE_V8_GLOBAL=true — v8FeatureGate.middleware.ts:15 / featureFlagService
#   isV8Enabled(): bez tego KAŻDY /api/v8/* zwraca 404 „V8 not enabled”
#   (uwaga: 404, nie 403 — łatwo pomylić z brakującą trasą).
#
# MOCK_DB=false — bez tego istnieje ryzyko cichej atrapy bazy: zielony wynik
#   na nieistniejących danych. Wymuszamy realny Postgres.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT/server"

# --- Baza: WYŁĄCZNIE lokalny kontener jednorazowy ---------------------------
export DATABASE_URL="${CW_DATABASE_URL:-postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test}"

# Twarda bariera: gdyby ktoś podstawił CW_DATABASE_URL wskazujący na zewnątrz,
# przerywamy, zamiast pisać do żywej bazy demo/staging.
node -e '
  const url = new URL(process.env.DATABASE_URL);
  const local = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1"]);
  if (!local.has(url.hostname)) {
    console.error(`[cw-backend] BLOCKED: DATABASE_URL wskazuje host ${url.hostname}, a nie lokalny kontener.`);
    console.error("[cw-backend] Ten skrypt nie startuje przeciw bazie demo/staging.");
    process.exit(1);
  }
'

export PORT=3001
export HOST=127.0.0.1
export NODE_ENV=development
export CI=true
export DB_TYPE=postgres
export MOCK_DB=false
export ENABLE_V8_GLOBAL=true

# JWT_SECRET: envValidator wymaga >= 32 znaków. Wartość lokalna, jednorazowa,
# NIE jest sekretem produkcyjnym. Ten sam sekret podpisuje i weryfikuje token.
export JWT_SECRET="${JWT_SECRET:-case-workspace-local-dev-secret-min-32-chars-0123456789}"

# Hałas startowy poza zakresem dowodu (scheduler, sentinel AI, health monitory).
# Analogicznie do npm run dev:backend:railway — nie dotyka auth ani routingu.
export DISABLE_SCHEDULER=true
export DISABLE_AI_PROVIDER_SENTINEL=true
export DISABLE_AI_HEALTH_MONITOR=true
export DISABLE_STARTUP_HEALTH_MONITOR=true
export SKIP_STARTUP_VALIDATOR=true
export DEFER_LLM_CONFIG_INIT_MS=3000
export DISABLE_RATE_LIMIT=true
export LOG_LEVEL=info

echo "[cw-backend] DATABASE_URL = ${DATABASE_URL}"
echo "[cw-backend] NODE_ENV=${NODE_ENV} (NIE test — realny Gateway, realna autoryzacja)"
echo "[cw-backend] E2E_MODE / ENABLE_TEST_AUTH_BYPASS: NIEUSTAWIONE (świadomie)"
echo "[cw-backend] Nasłuch: http://127.0.0.1:${PORT}"

exec npx tsx src/index.ts
