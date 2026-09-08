#!/usr/bin/env bash
# Liczba zapytan SQL na zadanie — mierzona LOGIEM POSTGRESA, nie licznikiem
# aplikacji. [ODMROZENIE 06_EXECUTION DEC-453]
#
# Po co osobny przyrzad: licznik `dbQueryCount` w performanceMetrics.middleware.ts
# loguje sie dopiero powyzej 10 zapytan, wiec po naprawie "brak wpisu w logu"
# nie odroznia "jest 8 zapytan" od "metryka przestala dzialac". Log Postgresa
# liczy niezaleznie od aplikacji.
#
# UWAGA: log zapisuje `parse`, `bind` i `execute` osobno dla tego samego
# zapytania — liczymy TYLKO `execute`, inaczej wynik jest zawyzony ~3x.
#
# Uzycie: scripts/dev/perf-zapytania-pg.sh <plik-wyjsciowy.txt>

set -u
WYNIK="${1:-/dev/stdout}"
API="http://127.0.0.1:4174"
KONTENER="consultify-pg18"
BAZA="consultify_kopia_perf"

TOK=$(curl -s --max-time 30 -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"audyt@dbr77.local","password":"AudytDBR77!2026"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

if [ -z "$TOK" ]; then echo "BLAD: brak tokenu" >&2; exit 1; fi

# WAZNE: `ALTER DATABASE ... SET` dziala dopiero na NOWE polaczenia. Pula
# serwera API jest juz otwarta, wiec bez restartu API jego zapytania NIE trafiaja
# do logu i skrypt pokazuje spokojne zera zamiast prawdy. Dlatego ustawienie
# wlaczamy TU, a wywolujacy MUSI zrestartowac API zanim zacznie mierzyc —
# pilnuje tego bezpiecznik na koncu pliku.
docker exec "$KONTENER" psql -U postgres -c \
  "ALTER DATABASE $BAZA SET log_min_duration_statement=0;" >/dev/null 2>&1

# ROZGRZEWKA — bez niej pomiar klamie. Pierwsze zadanie po restarcie API placi
# za koszty jednorazowe: DDL `ensureProjectRoleTemplateSchema`, odczyt
# `information_schema` w `getUserSessionCompatibility`, seed szablonow rol.
# Zmierzone: ten sam endpoint pokazywal 15 zapytan jako pierwszy po restarcie
# i 5 jako kolejny — czyli „poprawa" albo „regresja" byla wylacznie kolejnoscia
# w kolejce pomiaru. Rozgrzewamy KAZDA sciezke, potem mierzymy.
SCIEZKI=(
  "/api/initiatives/runtime-v1/execution-cases"
  "/api/initiatives/runtime-v1/management-signals"
  "/api/initiatives/runtime-v1/interventions"
  "/api/initiatives/runtime-v1/capacity-options"
  "/api/initiatives/runtime-v1/report-definitions"
  "/api/initiatives/runtime-v1/execution-cases/demo-story-20260826-execution-oee/work"
  "/api/initiatives/runtime-v1/execution-cases/demo-story-20260826-execution-oee/allocations"
  "/api/v8/execution-control/manager/lanes/action-queue/problems"
  "/api/v8/execution-control/budget/overspend-signals"
  "/api/v8/execution-control/capacity/timeline"
  "/api/execution-control/capacity/resource-plan"
  "/api/tasks"
  "/api/raid"
)

# rozgrzewka: kazda sciezka po dwa razy, wyniki wyrzucamy
for SCIEZKA in "${SCIEZKI[@]}"; do
  curl -s --max-time 60 -o /dev/null -H "Authorization: Bearer $TOK" "$API$SCIEZKA"
  curl -s --max-time 60 -o /dev/null -H "Authorization: Bearer $TOK" "$API$SCIEZKA"
done
sleep 2

: > "$WYNIK"
for SCIEZKA in "${SCIEZKI[@]}"; do
  MARK="M$(date -u +%s%N)"
  docker exec "$KONTENER" psql -U postgres -d "$BAZA" -c "SELECT '${MARK}A';" >/dev/null 2>&1
  curl -s --max-time 60 -o /dev/null -H "Authorization: Bearer $TOK" "$API$SCIEZKA"
  sleep 2
  docker exec "$KONTENER" psql -U postgres -d "$BAZA" -c "SELECT '${MARK}B';" >/dev/null 2>&1
  N=$(docker logs --since 40s "$KONTENER" 2>&1 \
      | sed -n "/${MARK}A/,/${MARK}B/p" \
      | grep -cE 'execute [^:]*:')
  # dwa markery same sa zapytaniami — odejmujemy je
  N=$((N > 2 ? N - 2 : 0))
  printf '%4d  %s\n' "$N" "$SCIEZKA" | tee -a "$WYNIK"
done

docker exec "$KONTENER" psql -U postgres -c \
  "ALTER DATABASE $BAZA RESET log_min_duration_statement;" >/dev/null 2>&1

# BEZPIECZNIK: same zera nie znacza "zero zapytan" — znacza, ze API nie zostalo
# zrestartowane po wlaczeniu logu i jego polaczenia loga nie pisza. Taki wynik
# musi byc bledem, a nie cichym sukcesem.
SUMA=$(awk '{s+=$1} END{print s+0}' "$WYNIK")
if [ "$SUMA" -eq 0 ]; then
  echo "POMIAR NIEWAZNY: same zera — zrestartuj API po wlaczeniu log_min_duration_statement" >&2
  exit 2
fi
echo "Zapisano: $WYNIK"
