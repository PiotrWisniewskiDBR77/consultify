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

# 4+5. Import bez wpisu i wpis bez importu (propozycja toru grafiki, 2026-09-01).
#      POWOD: ekran ma leniwy import, ale nie ma go w spisie -> harness pokazuje liste
#      awaryjna, co wyglada IDENTYCZNIE jak "ekran sie nie renderuje". Odwrotnie: wpis
#      bez importu wywala harness przy wejsciu na ten ekran.
#
#      DWA FALSZYWE ALARMY, ktore ta kontrola miala w pierwszej wersji (2026-09-01) —
#      obie wykryte natychmiast, obie wpisane tu, zeby nikt ich nie wprowadzil ponownie:
#        (a) NIE pomijala linii zakomentowanych: para import+wpis skomentowana razem
#            jest POPRAWNA, a byla meldowana jako defekt (3 falszywe alarmy);
#        (b) dopasowywala tylko `<Nazwa />` BEZ atrybutow, wiec ekran uzywany
#            jako `<Nazwa tryb="artefakt" />` wygladal na nieuzywany (3 falszywe alarmy);
#        (c) lapala nazwe wystepujaca WEWNATRZ napisu opisowego (etykieta ekranu
#            zawierajaca `<NazwaScreen>` w tekscie) i brala ja za wywolanie (1 falszywy
#            alarm). Dlatego dopasowanie jest zawezone do `=> <Nazwa`, czyli realnego
#            wywolania w polu `render`.
#      To jest ta sama wada, ktora tego samego dnia naprawiono w detektorze przepelnienia
#      slajdu: 100 procent falszywych alarmow czyni kontrole bezuzyteczna, bo czlowiek
#      uczy sie ja ignorowac.
BEZKOM=$(mktemp)
sed -E 's://.*::' "$F" > "$BEZKOM"

IMPORTY=$(grep -oE "^const ([A-Za-z0-9_]+) = React\.lazy" "$BEZKOM" | sed -E 's/^const ([A-Za-z0-9_]+) .*/\1/' | sort -u)
UZYTE=$(grep -oE "=> *<[A-Za-z0-9_]+Screen[ />]" "$BEZKOM" | sed -E 's/.*<([A-Za-z0-9_]+).*/\1/' | sort -u)
rm -f "$BEZKOM"

SIEROTY=$(comm -23 <(echo "$IMPORTY") <(echo "$UZYTE"))
if [ -n "$SIEROTY" ]; then
  echo "✘ leniwy import BEZ wpisu w spisie (ekran niewidoczny mimo obecnosci w kodzie):"
  echo "$SIEROTY" | sed 's/^/    /'
  RC=1
else
  echo "✓ kazdy leniwy import ma wpis w spisie"
fi

WIDMA=$(comm -13 <(echo "$IMPORTY") <(echo "$UZYTE"))
if [ -n "$WIDMA" ]; then
  echo "✘ wpis w spisie BEZ leniwego importu (harness padnie przy wejsciu na ten ekran):"
  echo "$WIDMA" | sed 's/^/    /'
  RC=1
else
  echo "✓ kazdy wpis w spisie ma leniwy import"
fi

exit $RC
