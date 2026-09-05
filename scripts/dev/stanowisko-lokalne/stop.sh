#!/usr/bin/env bash
# Zatrzymuje WYŁĄCZNIE własne procesy (PID-y z plików) i własny kontener.
# ZAKAZ pkill / killall — na tej maszynie działają vite innych agentów (3000/3030/3097/3100/3200).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/stanowisko.env"
for nazwa in server vite; do
  plik="$STANOWISKO_DIR/$nazwa.pid"
  [ -f "$plik" ] || continue
  pid="$(cat "$plik")"
  if kill -0 "$pid" 2>/dev/null; then
    # zabijamy grupę procesów startera (tsx/vite odpalają dziecko)
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    echo "[stanowisko] zatrzymano $nazwa (PID $pid)"
  fi
  rm -f "$plik"
done
if [ "${1:-}" = "--baza" ]; then
  docker stop "$PG_CONTAINER" >/dev/null 2>&1 && echo "[stanowisko] kontener $PG_CONTAINER zatrzymany"
fi
