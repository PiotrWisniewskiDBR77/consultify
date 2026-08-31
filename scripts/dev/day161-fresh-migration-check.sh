#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER_NAME="${DAY161_CONTAINER_NAME:-cx-day161-pg}"
HOST_PORT="${DAY161_PG_PORT:-6049}"
DATABASE_NAME="${DAY161_DATABASE_NAME:-cx161}"
DATABASE_PASSWORD="${DAY161_DATABASE_PASSWORD:-cx}"
# Katalog artefaktow MUSI byc przenosny.
#
# Bylo tu na sztywno `/private/tmp/...` — sciezka istniejaca wylacznie na macOS.
# Na runnerze Linux `mkdir -p /private/...` konczy sie "Permission denied", wiec
# bramka umierala w pierwszej sekundzie, PRZED podniesieniem bazy. Wygladala na
# czerwona z powodu migracji, a nigdy zadnej migracji nie uruchomila.
ARTIFACT_DIR="${DAY161_ARTIFACT_DIR:-${TMPDIR:-/tmp}/cx-day161-lancuch-migracji-artefakty}"
DATABASE_URL="postgresql://postgres:${DATABASE_PASSWORD}@127.0.0.1:${HOST_PORT}/${DATABASE_NAME}"
RUN_LOG="${ARTIFACT_DIR}/day161-fresh-migration-gate.log"
REPLAY_LOG="${ARTIFACT_DIR}/day161-fresh-migration-gate-replay.log"

cleanup() {
  docker rm -fv "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "${ARTIFACT_DIR}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  echo "Refusing to adopt existing container ${CONTAINER_NAME}." >&2
  exit 1
fi
if lsof -nP -iTCP:"${HOST_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Refusing to use occupied port ${HOST_PORT}." >&2
  exit 1
fi

docker run -d --name "${CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD="${DATABASE_PASSWORD}" \
  -e POSTGRES_DB="${DATABASE_NAME}" \
  -p "127.0.0.1:${HOST_PORT}:5432" \
  pgvector/pgvector:pg16 >/dev/null

until docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

cd "${REPO_ROOT}"
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL="${DATABASE_URL}" \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tee "${RUN_LOG}"
grep -Fq '✅ Postgres migrations complete' "${RUN_LOG}"

docker exec "${CONTAINER_NAME}" psql -U postgres -d "${DATABASE_NAME}" -Atc \
  "SELECT CASE WHEN count(*) > 0 AND bool_and(status = 'success') THEN 'LEDGER_OK' ELSE 'LEDGER_BAD' END FROM schema_migrations;" \
  | grep -Fxq 'LEDGER_OK'

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL="${DATABASE_URL}" \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tee "${REPLAY_LOG}"
grep -Fq 'Applying migrations: 0' "${REPLAY_LOG}"
grep -Fq '✅ Postgres migrations complete' "${REPLAY_LOG}"

echo "DAY161_FRESH_MIGRATION_GATE=PASS"
