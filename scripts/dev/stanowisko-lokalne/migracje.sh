#!/usr/bin/env bash
# Pełne migracje od zera na LOKALNEJ bazie (bez --allow-checksum-drift).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/stanowisko.env"
cd "$STANOWISKO_REPO"
DB_TYPE=postgres NODE_ENV=test DATABASE_URL="$DATABASE_URL_NOC" \
  npx tsx server/scripts/migrate.postgres.ts
