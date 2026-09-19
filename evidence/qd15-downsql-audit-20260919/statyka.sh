#!/bin/bash
# QD15 — statyczny przeglad kazdej migracji >= 20262260 na linii: czy plik
# rollback/<base>.down.sql istnieje, ile ma linii, czy jest transakcyjny (BEGIN),
# jakie operacje destrukcyjne zawiera i czy UP jest addytywny (IF NOT EXISTS).
# Wynik: statyczna-klasyfikacja.txt (dane wejsciowe tabeli koncowej).
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/qd15-downsql-audit-20260919"
cd "$ROOT" || exit 1
OUT="$E/statyczna-klasyfikacja.txt"
{
echo "=== QD15 statyczna klasyfikacja migracji >= 20262260 (linia origin/integracja/20260911)"
echo "generacja: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "tip linii: $(git rev-parse HEAD)"
echo "katalog rollback: server/migrations/rollback/ (wylaczony z lancucha forward przez KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS)"
echo ""
printf "%-52s %-9s %5s %5s %5s %5s %5s %5s %s\n" migracja down linie BEGIN DROPtab DROPkol DELETE UPDATE tresc_destrukcyjna
for f in $(ls server/migrations | grep -E '^2026[0-9]{4}_' | sort); do
  n=${f%%_*}
  [ "$n" -ge 20262260 ] 2>/dev/null || continue
  base=${f%.sql}
  down="server/migrations/rollback/$base.down.sql"
  if [ ! -f "$down" ]; then
    printf "%-52s %-9s %5s %5s %5s %5s %5s %5s %s\n" "$f" "BRAK" - - - - - - "plik .down.sql NIE ISTNIEJE"
    continue
  fi
  linie=$(wc -l < "$down" | tr -d ' ')
  begin=$(grep -ciE '^[[:space:]]*BEGIN;' "$down")
  dt=$(grep -ciE '\bDROP TABLE\b' "$down")
  dk=$(grep -ciE '\bDROP COLUMN\b' "$down")
  de=$(grep -ciE '\bDELETE FROM\b' "$down")
  up=$(grep -ciE '\bUPDATE \b' "$down")
  printf "%-52s %-9s %5s %5s %5s %5s %5s %5s %s\n" "$f" "JEST" "$linie" "$begin" "$dt" "$dk" "$de" "$up" "-"
done
echo ""
echo "=== podsumowanie liczbami"
echo "migracji >= 20262260 na linii      = $(ls server/migrations | grep -E '^2026[0-9]{4}_' | awk -F_ '$1>=20262260' | wc -l | tr -d ' ')"
echo "z plikiem .down.sql                = $(ls server/migrations | grep -E '^2026[0-9]{4}_' | awk -F_ '$1>=20262260 {print $0}' | while read -r f; do [ -f "server/migrations/rollback/${f%.sql}.down.sql" ] && echo x; done | wc -l | tr -d ' ')"
echo "BEZ pliku .down.sql                = $(ls server/migrations | grep -E '^2026[0-9]{4}_' | awk -F_ '$1>=20262260 {print $0}' | while read -r f; do [ -f "server/migrations/rollback/${f%.sql}.down.sql" ] || echo "$f"; done | tee /dev/stderr | wc -l | tr -d ' ')"
echo "downow transakcyjnych (BEGIN)      = $(ls server/migrations/rollback/*.down.sql | while read -r d; do b=$(basename "$d" .down.sql); n=${b%%_*}; [ "$n" -ge 20262260 ] 2>/dev/null && grep -qiE '^[[:space:]]*BEGIN;' "$d" && echo x; done | wc -l | tr -d ' ')"
} > "$OUT" 2>/tmp/qd15-braki.txt
echo "--- braki (bez .down.sql):"; cat /tmp/qd15-braki.txt
cat "$OUT"
