#!/bin/sh
# KONTROLA 09.09 — API 4213 przeciw kopii `consultify_kontrola`.
# PUŁAPKI: server.env niesie DB_* wskazujące staging → getDatabaseType robi
# process.exit(1) po cichu; DISABLE_RATE_LIMIT=true zabija start;
# NODE_ENV=development skaża pomiar flag; linia 32 pliku psuje `source`.
cd /Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/server || exit 1
set -a
. /Users/piotrwisniewski/Developer/consultify-secrets/server.env
set +a
unset DB_HOST DB_NAME DB_USER DB_PASSWORD DB_PORT DB_SSL DB_SSLMODE DISABLE_RATE_LIMIT NODE_ENV
NODE_ENV=test ENABLE_V8_GLOBAL=true RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DB_MANAGED_SCHEMA=off PORT=4213 FRONTEND_URL=http://127.0.0.1:3231 \
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54418/consultify_kontrola \
nohup ../node_modules/.bin/tsx src/index.ts > .api.log 2>&1 &
echo $! > .api.pid
echo "API PID $(cat .api.pid)"
