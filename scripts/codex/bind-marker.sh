#!/usr/bin/env bash
# Bezpieczne wiązanie markera bazowego w instrukcji dyżuru Codexa.
#
# POWÓD ISTNIENIA (incydenty dni 29 i 32): nadzorca wiązał marker globalnym
# `sed s/«MARKER_SHA»/<sha>/g`, co podstawiało SHA także w treści RAMKI
# WYJAŚNIAJĄCEJ wartownika ("jeśli widzisz tu nadal «MARKER_SHA» — STOP").
# Skutek: instrukcja wskazywała prawdziwy marker jako wartownik i Codex
# zatrzymywał dyżur — prawidłowo, ale bez potrzeby. Dwa dyżury stracone.
#
# ZASADA: podstawiamy WYŁĄCZNIE w liniach operacyjnych (komendy, pole markera),
# NIGDY w blokach cytowanych (linie zaczynające się od "> " lub "   > ").
#
# Użycie: scripts/codex/bind-marker.sh <plik-instrukcji.md> <sha>
set -euo pipefail
F="${1:?podaj plik instrukcji}"; SHA="${2:?podaj SHA markera}"
[ -f "$F" ] || { echo "BŁĄD: brak pliku $F"; exit 1; }
[[ "$SHA" =~ ^[0-9a-f]{10,40}$ ]] || { echo "BŁĄD: '$SHA' nie wygląda na SHA"; exit 1; }

PRZED=$(grep -c '«MARKER_SHA»' "$F" || true)
[ "$PRZED" -gt 0 ] || { echo "BŁĄD: brak placeholdera «MARKER_SHA» — czy instrukcja już związana?"; exit 1; }

python3 - "$F" "$SHA" << 'PY'
import sys
plik, sha = sys.argv[1], sys.argv[2]
linie = open(plik).readlines()
podmienione = pominiete = 0
for i, l in enumerate(linie):
    if '«MARKER_SHA»' not in l:
        continue
    low = l.lower()
    # (1) blok cytowany = wyjaśnienie wartownika; (2) linia MÓWIĄCA o wartowniku,
    # nawet poza cytatem (tabela STOP, lista kontrolna) — tam sentinel ma zostać literałem.
    if l.lstrip().startswith('>') or 'wartownik' in low or 'sentinel' in low or 'niezwiązan' in low:
        pominiete += l.count('«MARKER_SHA»')
        continue
    podmienione += l.count('«MARKER_SHA»')
    linie[i] = l.replace('«MARKER_SHA»', sha)
open(plik, 'w').writelines(linie)
print(f"podmienione w liniach operacyjnych: {podmienione}")
print(f"POMINIĘTE w blokach cytowanych (poprawnie): {pominiete}")
PY

echo "--- kontrola po wiązaniu ---"
if grep -n '«MARKER_SHA»' "$F" | grep -qv '^\s*[0-9]*:\s*>'; then
  echo "UWAGA: placeholder został poza blokiem cytowanym — sprawdź ręcznie:"
  grep -n '«MARKER_SHA»' "$F"
fi
echo "wystąpień SHA w pliku: $(grep -c "$SHA" "$F")"
echo "OK. Pamiętaj: commit 'docs(codex): bind dayNN base marker $SHA' + backup push."
