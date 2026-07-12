#!/usr/bin/env bash
# check-list-canon.sh — TWARDY bezpiecznik zamrożonego standardu tabel (TRIADA).
#
# Powód (2026-07-12): lekkie powłoki (InitiativesLightShell/InterviewLightShell)
# zrobiły WŁASNĄ tabelę zamiast <StandardTable>, degradując zatwierdzony, mrożony
# od pół roku kanon do "tabelek jak dla trzylatka". Poszło hurtem na żywo.
# Ten skrypt blokuje commit, gdzie ekran (poza src/components/standard/) renderuje
# własną listę-tabelę zamiast korzystać ze StandardTable/StandardModuleBar (reguła #1).
#
# Użycie: check-list-canon.sh [pliki...]   (bez argumentów: sprawdza staged *.tsx)
set -uo pipefail
files="$*"
if [ -z "$files" ]; then
  files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
    | grep -E '^src/components/.*\.tsx$' | grep -v '^src/components/standard/' || true)
fi
fail=0
for f in $files; do
  [ -f "$f" ] || continue
  case "$f" in src/components/standard/*) continue;; esac
  # 1) surowe prymitywy tabeli w komponencie = zakaz (mają być w StandardTable)
  if grep -Eq '<table[ >/]|<thead[ >]|<tbody[ >]|role="table"|role="grid"|role="columnheader"' "$f"; then
    echo "✗ list-canon: $f — surowa tabela (<table>/<thead>/role=table). Użyj <StandardTable> (kanon TRIADA, reguła #1)." >&2
    fail=1
  fi
  # 2) *LightShell / *Hub renderujący listę (grid+kolumny) BEZ importu ze standard/
  base=$(basename "$f")
  case "$base" in
    *LightShell.tsx|*Hub.tsx)
      if grep -Eq '\.map\(' "$f" && grep -Eq 'grid-template-columns|gridTemplateColumns|COLUMNS|columns=|columnDefs' "$f"; then
        if ! grep -Eq "from ['\"][^'\"]*standard['\"/]" "$f"; then
          echo "✗ list-canon: $base — renderuje listę kolumnową, ale NIE importuje StandardTable." >&2
          echo "    Osadź <StandardTable>/<StandardModuleBar> zamiast własnej tabeli (reguła #1)." >&2
          echo "    To dokładnie regresja z 2026-07-12 ('tabelki jak dla trzylatka')." >&2
          fail=1
        fi
      fi
      ;;
  esac
done
if [ $fail -eq 0 ]; then echo "✓ list-canon: brak własnych tabel poza StandardTable"; fi
exit $fail
