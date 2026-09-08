#!/usr/bin/env bash
# Liczba zapytan SQL na zadanie — pomiar KONTROLOWANY. [ODMROZENIE 06_EXECUTION DEC-453]
#
# Trzy przyrzady odrzucone po drodze i dlaczego (zeby nikt nie probowal ich znowu):
#  1. `dbQueryCount` z performanceMetrics.middleware.ts — loguje sie dopiero
#     powyzej 10 zapytan, wiec po naprawie "brak wpisu" nie odroznia "jest 8"
#     od "metryka umarla".
#  2. `pg_stat_database.xact_commit` — rozrzut pojedynczych prob ([17,2,14,2,20])
#     okazal sie WIEKSZY niz mierzona roznica; nie wykrywa efektu.
#  3. Szeroka lista endpointow czytana z `docker logs` — przy wiekszym ruchu log
#     gubil wiersze i oddawal ciche zera dla zadan, ktore odpowiadaly 200.
#
# Dlatego: MALO endpointow, ROZGRZEWKA (pierwsze zadanie po restarcie placi za
# DDL, `information_schema` i seed szablonow rol), POWTORZENIA i mediana.
# Liczymy tylko `execute` — log zapisuje `parse`/`bind`/`execute` osobno.
#
# WYMAGANIE: API musi byc zrestartowane PO wlaczeniu log_min_duration_statement,
# inaczej jego pula polaczen nie pisze do logu. Bezpiecznik ponizej to lapie.
#
# Uzycie: scripts/dev/perf-zapytania-jeden.sh <plik-wyjsciowy.txt> [powtorzen]

set -u
WYNIK="${1:-/dev/stdout}"
POWTORZ="${2:-3}"
API="http://127.0.0.1:4174"
KONTENER="consultify-pg18"
BAZA="consultify_kopia_perf"

TOK=$(curl -s --max-time 30 -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"audyt@dbr77.local","password":"AudytDBR77!2026"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
[ -z "$TOK" ] && { echo "BLAD: brak tokenu" >&2; exit 1; }

SCIEZKI=(
  "/api/initiatives/runtime-v1/execution-cases/demo-story-20260826-execution-oee/allocations"
  "/api/initiatives/runtime-v1/execution-cases/demo-story-20260826-execution-oee/work"
  "/api/initiatives/runtime-v1/report-definitions"
)

# rozgrzewka — 3x kazda sciezka, wyniki wyrzucamy
for S in "${SCIEZKI[@]}"; do
  for _ in 1 2 3; do
    curl -s --max-time 60 -o /dev/null -H "Authorization: Bearer $TOK" "$API$S"
  done
done
sleep 2

: > "$WYNIK"
SUMA_ALL=0
for S in "${SCIEZKI[@]}"; do
  PROBY=""
  for _ in $(seq 1 "$POWTORZ"); do
    MARK="M$(date -u +%s%N)"
    docker exec "$KONTENER" psql -U postgres -d "$BAZA" -c "SELECT '${MARK}A';" >/dev/null 2>&1
    curl -s --max-time 60 -o /dev/null -H "Authorization: Bearer $TOK" "$API$S"
    sleep 1
    docker exec "$KONTENER" psql -U postgres -d "$BAZA" -c "SELECT '${MARK}B';" >/dev/null 2>&1
    N=$(docker logs --since 60s "$KONTENER" 2>&1 \
        | sed -n "/${MARK}A/,/${MARK}B/p" \
        | grep -cE 'execute [^:]*:')
    N=$((N > 2 ? N - 2 : 0))   # oba markery to tez zapytania
    PROBY="$PROBY $N"
    SUMA_ALL=$((SUMA_ALL + N))
    sleep 1
  done
  MEDIANA=$(echo $PROBY | tr ' ' '\n' | grep -v '^$' | sort -n | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}')
  printf '%4s  [%s ]  %s\n' "$MEDIANA" "$PROBY" "$S" | tee -a "$WYNIK"
done

if [ "$SUMA_ALL" -eq 0 ]; then
  echo "POMIAR NIEWAZNY: same zera — API nie zrestartowane po wlaczeniu logu?" >&2
  exit 2
fi
echo "Zapisano: $WYNIK"
