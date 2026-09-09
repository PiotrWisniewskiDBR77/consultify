#!/bin/sh
# KONTROLA 09.09 — Vite 3231, komplet 34 flag VITE_* ze stagingowego server.env
# + VITE_MODULE_MEETINGS=true (wymóg zlecenia; na stagingu tej zmiennej NIE MA).
cd /Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach || exit 1
set -a
. /Users/piotrwisniewski/Developer/consultify-secrets/server.env
set +a
unset NODE_ENV
VITE_DOTENV_DISABLED=1 VITE_API_URL= VITE_API_TARGET=http://127.0.0.1:4213 \
VITE_MODULE_MEETINGS=true \
nohup node_modules/.bin/vite --mode test --port 3231 --strictPort --host 127.0.0.1 > .vite.log 2>&1 &
echo $! > .vite.pid
echo "VITE PID $(cat .vite.pid)"
