#!/usr/bin/env bash
# check-question-canon.sh — TWARDY bezpiecznik standardu SPEC-Q (StandardQuestion).
#
# Powód: pytanie diagnostyczne (Interview/DRD/Assessment/Audit) ma JEDNĄ powłokę —
# <StandardQuestion> (src/components/standard/StandardQuestion.tsx). Historia list
# (check-list-canon.sh) pokazała, że gdy ekran robi WŁASNĄ kartę zamiast kanonu,
# standard degraduje. Ten skrypt blokuje ekran (poza src/components/standard/),
# który renderuje własną kartę pytania (drabinkę dojrzałości / rubrykę) zamiast
# osadzić <StandardQuestion>.
#
# Heurystyka: plik zawiera sygnaturę karty pytania — pole/typ drabinki lub
# rubryki (boundaryVsPrev, QuestionLevel, maturityLevel, QuestionRubricRow, albo
# `rubric` + `.map(`) — ALE nie importuje StandardQuestion → FAIL.
#
# Wyłączenia: sam kanon (src/components/standard/*) jest zawsze przepuszczany.
#
# Użycie: check-question-canon.sh [pliki...]   (bez argumentów: staged *.tsx)
# NIE wpięty do husky (świadomie) — uruchamiany ręcznie / w bloku SPEC-Q.
set -uo pipefail
files="$*"
if [ -z "$files" ]; then
  files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
    | grep -E '^src/components/.*\.tsx$' | grep -v '^src/components/standard/' || true)
fi
fail=0
for f in $files; do
  [ -f "$f" ] || continue
  # Kanon i cała rodzina standard/ są wykluczone (to definicja, nie konsument).
  case "$f" in src/components/standard/*) continue;; esac

  # Sygnatura karty pytania diagnostycznego: drabinka dojrzałości lub rubryka.
  if grep -Eq 'boundaryVsPrev|QuestionLevel|QuestionRubricRow|maturityLevel|maturityLadder' "$f" \
     || { grep -Eq '\brubric\b' "$f" && grep -Eq '\.map\(' "$f"; }; then
    # Ma sygnaturę — musi importować StandardQuestion.
    if ! grep -Eq "StandardQuestion" "$f"; then
      echo "✗ question-canon: $f — renderuje własną kartę pytania (drabinka/rubryka)," >&2
      echo "    ale NIE osadza <StandardQuestion>." >&2
      echo "    Reguła SPEC-Q: osadź <StandardQuestion> zamiast własnej karty pytania" >&2
      echo "    (src/components/standard/StandardQuestion.tsx — 4. format artefaktu)." >&2
      fail=1
    fi
  fi
done
if [ $fail -eq 0 ]; then echo "✓ question-canon: brak własnych kart pytań poza StandardQuestion"; fi
exit $fail
