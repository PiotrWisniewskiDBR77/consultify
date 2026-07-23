#!/usr/bin/env bash
# Odświeżenie huba odbioru: świeże demo + gałęzie obszarów → regeneracja strony → smoke.
#
# Użycie (z worktree .worktrees/odbior-hub):
#   ./scripts/odbior-hub-odswiez.sh galaz-1 [galaz-2 ...]
#
# Bez argumentów bierze gałęzie z listy DOMYSLNE poniżej.
# Konflikt = przerwanie z nazwą pliku; merge NIE jest zostawiany w połowie.
set -uo pipefail

DOMYSLNE=(fix/prv-mywork-preview integ-idee9-fala6)
GALEZIE=("${@:-}")
[ -z "${GALEZIE[0]:-}" ] && GALEZIE=("${DOMYSLNE[@]}")

echo "→ fetch origin/demo"
git fetch origin demo -q || { echo "BŁĄD: fetch nieudany"; exit 1; }

echo "→ merge origin/demo"
if ! git merge --no-edit origin/demo -q; then
  echo "KONFLIKT z origin/demo:"; git diff --name-only --diff-filter=U
  echo "Rozwiąż ręcznie, potem uruchom ponownie."; exit 1
fi

for g in "${GALEZIE[@]}"; do
  ile=$(git rev-list --count HEAD.."$g" 2>/dev/null || echo "?")
  if [ "$ile" = "0" ]; then echo "→ $g: nic nowego"; continue; fi
  echo "→ merge $g ($ile commitów)"
  if ! git merge --no-edit "$g" -q; then
    echo "KONFLIKT przy $g:"; git diff --name-only --diff-filter=U
    echo "Uwaga: dev-render/main.tsx = rejestr ekranów, rozwiązanie to zwykle OBA wpisy"
    echo "(import screena VLT-003 musi zostać OSTATNI — patrz komentarz w pliku)."
    exit 1
  fi
done

echo "→ regeneracja strony odbioru"
node scripts/odbior-hub.mjs || exit 1

if ! git diff --quiet dev-render/odbior.html; then
  git add dev-render/odbior.html && git commit -q -m "chore(odbior): regeneracja huba po dołączeniu prac" \
    && echo "→ zacommitowano nową wersję strony"
fi

echo "→ smoke (serwer musi już działać na 3000)"
for u in "odbior.html" "?screen=karta-decision" "?screen=idea-table-tool-grouping"; do
  kod=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/$u" || echo "---")
  printf "   %-38s %s\n" "$u" "$kod"
done

echo
echo "GOTOWE. Strona: http://localhost:3000/odbior.html"
echo "Pamiętaj: HTTP 200 to nie dowód renderu — przeklikaj po jednym ekranie z każdego obszaru,"
echo "zanim pokażesz właścicielowi (reguła: właściciel nigdy nie jest pierwszym testerem)."
