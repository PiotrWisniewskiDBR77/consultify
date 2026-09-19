#!/bin/bash
# QD15 — mutacja M3b: RZECZYWISCIE pusty rollback.
# Pierwsza proba (M3 w mutacje.sh) zakomentowala TYLKO `DROP TABLE`, a down
# 20262303 ma jeszcze trzy `DROP INDEX` — wiec DOWN realnie zmienil schemat
# (DOWNeff=TAK) i mutacja nie testowala tego, co miala testowac. M3b zastepuje
# CALA tresc operacji downa no-opem (BEGIN/COMMIT zostaja), czyli modeluje
# "plik .down.sql istnieje, ale nic nie cofa".
#
# Oczekiwane: SEM=TAK, POS=TAK, DUMP=TAK (stan koncowy UP->DOWN->UP wroci do
# baseline, bo UP ma CREATE TABLE IF NOT EXISTS i sam odbuduje obiekty), przy
# DOWN_zmienil_schemat=NIE. To jest dokladnie slepa plamka starej miary: bez
# kolumny DOWNeff przyrzad zameldowalby PASS dla rollbacku, ktory nic nie robi.
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/qd15-downsql-audit-20260919"
DOWN="$ROOT/server/migrations/rollback/20262303_meeting_protocols.down.sql"
M=20262303_meeting_protocols.sql
ORIG_SHA=029d09974e4720cfcd2a19d8e5c907036fde14e88caba688eed25411990a488c
cd "$ROOT" || exit 1
sha() { shasum -a 256 "$DOWN" | cut -d' ' -f1; }

echo "oryginal_sha256=$(sha) zgodny=$([ "$(sha)" = "$ORIG_SHA" ] && echo TAK || echo NIE)"

printf '%s\n' \
  "-- QD15 M3b: mutacja przyrzadu — down jako no-op (nic nie cofa)." \
  "BEGIN;" \
  "COMMIT;" > "$DOWN"
echo "po_mutacji_sha256=$(sha)"
echo "tresc po mutacji:"; cat "$DOWN"

bash "$E/izolacja.sh" "$M" > "$E/mutacje/M3b-przebieg.log" 2>&1
mv "$E/izolacja-$M.txt" "$E/mutacje/M3b-wynik.txt"
cp "$E/cykle/20262303_meeting_protocols.log" "$E/mutacje/M3b-cykl.log"
echo "--- M3b wynik:"
grep -E "^$M\|" "$E/mutacje/M3b-wynik.txt"

cp "$E/mutacje/oryginal-20262303.down.sql" "$DOWN"
echo "po_revert_sha256=$(sha) zgodny=$([ "$(sha)" = "$ORIG_SHA" ] && echo TAK || echo NIE)"
