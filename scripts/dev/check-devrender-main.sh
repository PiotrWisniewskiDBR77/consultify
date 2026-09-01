#!/usr/bin/env bash
# Bezpiecznik pliku ekranow dowodowych (dev-render/main.tsx).
#
# POWOD (2026-09-01): dwa tory dopisuja do tego pliku rownolegle. Scalenie metoda
# "zachowaj obie strony" jest tam POPRAWNE (wpisy sa rozlaczne), ale potrafi
# zgubic klamre zamykajaca albo zdublowac klucz — i wtedy CALY harness nie wstaje
# na czystym pobraniu, choc u autora dziala. Zdarzylo sie to realnie.
#
# Sprawdza trzy rzeczy:
#   1. plik sie parsuje,
#   2. kazdy lazy-import wskazuje na ISTNIEJACY plik,
#   3. zaden klucz ekranu nie jest zdublowany (cichy duplikat nadpisuje pierwszy).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2
F=dev-render/main.tsx
[ -f "$F" ] || { echo "BRAK $F"; exit 2; }
RC=0

ESB=node_modules/.bin/esbuild
if [ -x "$ESB" ]; then
  if ! "$ESB" "$F" --format=esm --outfile=/dev/null >/dev/null 2>/tmp/devrender-parse.err; then
    echo "✘ $F NIE PARSUJE SIE:"; head -5 /tmp/devrender-parse.err; RC=1
  else
    echo "✓ parsuje sie"
  fi
else
  echo "• esbuild niedostepny — pominieto sprawdzenie skladni"
fi

MISS=0
while read -r p; do
  [ -z "$p" ] && continue
  B="dev-render/${p#./}"
  if [ -e "$B.tsx" ] || [ -e "$B.ts" ] || [ -e "$B/index.tsx" ] || [ -e "$B" ]; then :; else
    echo "✘ lazy-import wskazuje na nieistniejacy plik: $p"; MISS=1; RC=1
  fi
done < <(grep -oE "import\('\./[^']+'\)" "$F" | sed "s/import('//;s/')//" | sort -u)
[ "$MISS" = 0 ] && echo "✓ wszystkie lazy-importy wskazuja na istniejace pliki"

DUP=$(grep -oE "^  '[a-z0-9-]+': \{" "$F" | sort | uniq -d)
if [ -n "$DUP" ]; then
  echo "✘ zdublowane klucze ekranow (drugi cicho nadpisuje pierwszy):"; echo "$DUP"; RC=1
else
  echo "✓ brak zdublowanych kluczy"
fi

exit $RC
