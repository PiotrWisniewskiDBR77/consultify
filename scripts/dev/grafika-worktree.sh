#!/usr/bin/env bash
# Katalog roboczy dla robotnika toru grafiki — WĄSKI WYCINEK.
#
# Po co: pełne drzewo robocze m03 waży 2,8 GB (1,3 GB to zrzuty w evidence/,
# 463 MB dokumentacja). Przy 13 GB wolnego dysku cztery pełne katalogi
# robocze wypełniłyby dysk. Sparse-checkout bierze tylko to, co robotnik
# realnie edytuje: kod, tłumaczenia, harness, skrypty i dokumenty grafiki.
#
# Użycie: grafika-worktree.sh <nazwa> <galaz>
set -euo pipefail
NAZWA="$1"; GALAZ="$2"
KAT="/private/tmp/g-$NAZWA"
BAZA="/private/tmp/m03"
[ -e "$KAT" ] && { echo "ISTNIEJE: $KAT"; exit 1; }
git -C "$BAZA" worktree add --no-checkout -b "$GALAZ" "$KAT" codex/m03-admin-20260824
git -C "$KAT" sparse-checkout init --cone
# .claude/ MUSI być w wycinku: bez niego robotnik nie widzi skilli projektu
# (kanon triady/podglądu/artefaktów). 02.09 robotnik naprawiał podgląd Idei według
# NIEAKTUALNEJ wersji skilla, bo w jego katalogu nie było .claude/, a wersja
# ładowana przez sesję pochodzi z katalogu głównego repo — z innej gałęzi, gdzie
# poprawka kanonu z 01.09 nigdy nie dojechała.
git -C "$KAT" sparse-checkout set src public dev-render scripts docs/program/grafika docs/ui-standards tests .claude
git -C "$KAT" checkout
ln -s "$(readlink "$BAZA/node_modules")" "$KAT/node_modules"
for f in package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js; do
  [ -e "$BAZA/$f" ] && git -C "$KAT" checkout HEAD -- "$f" 2>/dev/null || true
done
echo "GOTOWE: $KAT (gałąź $GALAZ)"
du -sh "$KAT" 2>/dev/null | tail -1
