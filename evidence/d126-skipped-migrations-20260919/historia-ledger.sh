#!/usr/bin/env bash
# D-126 — uzgodnienie tresci HISTORYCZNEJ (tej, ktora staging zapisal jako 'skipped')
# z trescia OBECNA w server/migrations/never-ran/.
#
# DLUG-PO-MVP.md:155 mowi "obiekty tych 7 migracji (z tresci w historii git) vs zywy staging".
# Ledger przechowuje 'skipped:<sha256 zawartosci utf-8>' (migrate.postgres.ts:146-149, :431),
# wiec wersje historyczna znajduje sie przez dopasowanie sha256 bloba z historii git —
# bez zgadywania dat ani commitow.
#
# Uzycie (z korzenia repo):
#   bash evidence/d126-skipped-migrations-20260919/historia-ledger.sh
# Wymaga wcześniejszego przebiegu audyt-d126.mjs (czyta checksum-ledger.tsv).
# Zero zapisow do bazy, zero sekretow.

set -uo pipefail
cd /Users/piotrwisniewski/Developer/qoder-wt/consultify-d

E=evidence/d126-skipped-migrations-20260919
mkdir -p "$E/historia"
SUM="$E/historia/podsumowanie.txt"
: > "$SUM"

echo "# D-126 historia vs obecnie — $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$SUM"

while IFS='|' read -r plik status applied ledger obecna werdykt; do
  [ "$plik" = "plik" ] && continue
  sha="${ledger#ledger=}"
  sha="${sha#skipped:}"
  znaleziony_commit=""
  znaleziona_sciezka=""
  for sciezka in "server/migrations/$plik" "server/migrations/never-ran/$plik" "server/migrations-archive/$plik"; do
    for c in $(git log --format=%H --all -- "$sciezka" 2>/dev/null); do
      blob=$(git rev-parse -q --verify "$c:$sciezka" 2>/dev/null) || continue
      [ -z "$blob" ] && continue
      s=$(git cat-file blob "$blob" | shasum -a 256 | cut -d' ' -f1)
      if [ "$s" = "$sha" ]; then
        znaleziony_commit="$c"; znaleziona_sciezka="$sciezka"
        git cat-file blob "$blob" > "$E/historia/$plik.ledger.sql"
        break 2
      fi
    done
  done

  if [ -z "$znaleziony_commit" ]; then
    echo "$plik|LEDGER_SHA_NIEZNALEZIONY_W_HISTORII|$sha" >> "$SUM"
    continue
  fi

  diff -u "$E/historia/$plik.ledger.sql" "server/migrations/never-ran/$plik" > "$E/historia/$plik.diff"
  dodane=$(grep -c '^+[^+]' "$E/historia/$plik.diff" || true)
  usuniete=$(grep -c '^-[^-]' "$E/historia/$plik.diff" || true)
  # DDL dodane/usuniete (liniowe przyblizenie; dokladny parser to audyt-d126.mjs)
  ddl_dodane=$(grep '^+[^+]' "$E/historia/$plik.diff" | grep -ci 'CREATE TABLE\|CREATE .*INDEX\|ADD COLUMN' || true)
  ddl_usuniete=$(grep '^-[^-]' "$E/historia/$plik.diff" | grep -ci 'CREATE TABLE\|CREATE .*INDEX\|ADD COLUMN' || true)
  echo "$plik|commit=$(git log -1 --format='%h %ad' --date=short "$znaleziony_commit")|sciezka_wtedy=$znaleziona_sciezka|linie_dodane=$dodane|linie_usuniete=$usuniete|ddl_dodane=$ddl_dodane|ddl_usuniete=$ddl_usuniete|sha_ledger=$sha" >> "$SUM"
done < "$E/checksum-ledger.tsv"

cat "$SUM"
