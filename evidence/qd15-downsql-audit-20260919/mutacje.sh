#!/bin/bash
# QD15 — mutacje przyzadu (dowod, ze miary potrafia zrobic sie CZERWONE).
# Cel mutacji: 20262303_meeting_protocols — jedyna migracja w pelnym audycie,
# ktora jest w calosci zielona (SEM=TAK POS=TAK DUMP=TAK DOWNeff=TAK), wiec kazde
# zepsucie jej downa MUSI zmienic co najmniej jedna kolumne. Zielony baseline bez
# mutacji nie jest dowodem — zielony baseline, ktory po mutacji czerwienieje, jest.
#
# M1 — down zawiera niepoprawny SQL            -> oczekiwane: rc_down <> 0
# M2 — down zostawia obcy obiekt (nie cofa go) -> oczekiwane: SEM=NIE i DUMP=NIE
# M3 — down POMIJA DROP TABLE (rollback pusty) -> oczekiwane: DOWNeff=NIE przy
#      SEM=TAK i DUMP=TAK. To jest dokladnie ta mutacja, ktorej stara miara
#      (rownosc stanu koncowego) NIE widziala — bo UP ma CREATE TABLE IF NOT EXISTS
#      i stan koncowy wraca do baseline. Dowod, ze kolumna DOWN_zmienil_schemat
#      zamyka tamta slepa plamke.
#
# Po kazdej mutacji: przywrocenie oryginału i sprawdzenie sha256 co do bajtu.
# Wszystko na kopii (consultify_qd15_iso), staging/demo nietkniete.
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/qd15-downsql-audit-20260919"
DOWN="$ROOT/server/migrations/rollback/20262303_meeting_protocols.down.sql"
M=20262303_meeting_protocols.sql
ORIG_SHA=029d09974e4720cfcd2a19d8e5c907036fde14e88caba688eed25411990a488c
cd "$ROOT" || exit 1

sha() { shasum -a 256 "$DOWN" | cut -d' ' -f1; }
revert() { cp "$E/mutacje/oryginal-20262303.down.sql" "$DOWN"; }

mkdir -p "$E/mutacje"
cp "$DOWN" "$E/mutacje/oryginal-20262303.down.sql"
echo "oryginal_sha256=$(sha)"
[ "$(sha)" = "$ORIG_SHA" ] || { echo "FATAL: sha oryginalu niezgodny"; exit 1; }

run() { # $1 = etykieta
  bash "$E/izolacja.sh" "$M" > "$E/mutacje/$1-przebieg.log" 2>&1
  mv "$E/izolacja-$M.txt" "$E/mutacje/$1-wynik.txt"
  cp "$E/cykle/20262303_meeting_protocols.log" "$E/mutacje/$1-cykl.log"
  echo "--- $1 wynik:"
  grep -E "^$M\|" "$E/mutacje/$1-wynik.txt"
}

# ===== M1: niepoprawny SQL w downie =====
python3 - "$DOWN" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("DROP TABLE IF EXISTS meeting_protocols;",
            "DROP TABLE IF EXISTS meeting_protocols;\nSELECT * FROM qd15_tabela_ktorej_nie_ma;")
open(p,'w').write(s)
PY
echo ""; echo "===== M1 (niepoprawny SQL) sha=$(sha)"
run M1
revert; echo "po_revert_sha=$(sha) zgodny=$([ "$(sha)" = "$ORIG_SHA" ] && echo TAK || echo NIE)"

# ===== M2: down zostawia obcy obiekt =====
python3 - "$DOWN" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("COMMIT;", "CREATE TABLE IF NOT EXISTS qd15_mutation_probe (id text);\n\nCOMMIT;")
open(p,'w').write(s)
PY
echo ""; echo "===== M2 (obcy obiekt zostaje) sha=$(sha)"
run M2
revert; echo "po_revert_sha=$(sha) zgodny=$([ "$(sha)" = "$ORIG_SHA" ] && echo TAK || echo NIE)"

# ===== M3: down pomija DROP TABLE (rollback pusty) =====
python3 - "$DOWN" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("DROP TABLE IF EXISTS meeting_protocols;",
            "-- QD15 M3: DROP TABLE celowo pominiete (mutacja przyrządu)")
open(p,'w').write(s)
PY
echo ""; echo "===== M3 (pusty rollback) sha=$(sha)"
run M3
revert; echo "po_revert_sha=$(sha) zgodny=$([ "$(sha)" = "$ORIG_SHA" ] && echo TAK || echo NIE)"

echo ""; echo "===== Stan koncowy po wszystkich mutacjach: sha=$(sha) zgodny_z_oryginalem=$([ "$(sha)" = "$ORIG_SHA" ] && echo TAK || echo NIE)"
