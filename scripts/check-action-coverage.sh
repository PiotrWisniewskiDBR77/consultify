#!/usr/bin/env bash
# check-action-coverage.sh — MACHINE CHECK dla E02 DoD: "detects unregistered
# commands" (docs/qa/ideas-manual-audit-2026-08-09/11_IDEAS_EPICS_DOD_AND_
# FINAL_ACCEPTANCE_PROTOCOL.md, epic E02 DoD; doc 09 §4.2: "Automated checks
# fail when a visible command lacks a registry entry or live handler").
#
# scripts/check-actions.sh (R1-R9) audytuje TYLKO wewnetrzna spojnosc akcji
# JUZ zadeklarowanych w IDEA_ACTION_REGISTRY. Nie widzi driftu POZA rejestrem
# — komponentu, ktory renderuje klikalna akcje z zaszytym on-clickiem i ZERO
# wpisu w rejestrze. To jest dokladnie luka, ktora ten skrypt zamyka (E02-GAP-01
# w docs/qa/ideas-complete-transformation-2026-08-09/02_EXECUTION_LEDGER.csv:
# "check-actions.sh only audits the 16 already-registered actions, cannot
# detect drift outside the registry").
#
# CO SPRAWDZA: kazdy onClick={...}/onSelect={...} w src/components/MyWork/
# (SSOT heurystyki: scripts/check-action-coverage.awk, przeczytaj naglowek
# tamtego pliku — czasownik-komenda po zdjeciu prefiksu handle/on, Api.*,
# dispatchEvent(new CustomEvent(...)), z wyjatkiem juz traceable do rejestru
# (runIdeaAction(...) albo lokalny wrapper runAction(id, run)) i strukturalnym
# wyjatkiem dla Tiptap editor.chain()...run() (formatowanie tekstu Notebooka,
# nie komenda Idei).
#
# RATCHET / BASELINE (jak scripts/check-list-canon.sh i check-artefakt.sh —
# ta sama konwencja w repo): dzisiejszy dlug (288 akcjopodobnych konstrukcji w
# 134 plikach na 446 zeskanowanych, patrz --update i baseline) PRZECHODZI.
# Bramka FAILuje TYLKO gdy liczba w danym pliku ROSNIE ponad baseline, albo
# plik spoza baseline (baseline=0) ma >0 trafien. Zero-tolerance od pierwszego
# dnia zablokowalby caly istniejacy backlog (dokladnie ten sam blad co
# check-list-canon.sh przed 2026-07-24 — bramka swiecila na czerwono zawsze i
# przestala cokolwiek znaczyc).
#
# Uzycie:
#   check-action-coverage.sh [pliki...]   # sprawdz podane pliki (tryb hooka)
#   check-action-coverage.sh              # staged *.tsx w zakresie; brak staged → pelny skan
#   check-action-coverage.sh --all        # wymus pelny skan zakresu
#   check-action-coverage.sh --report     # jak wyzej + wypisz KAZDE naruszenie z linia+fragmentem
#   check-action-coverage.sh --update     # regeneruj baseline z aktualnego stanu
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

BASELINE="scripts/check-action-coverage.baseline.txt"
AWK_PROG="scripts/check-action-coverage.awk"

MODE=""
VERBOSE=0
ARG_FILES_NL=""
for arg in "$@"; do
  case "$arg" in
    --update) MODE="update" ;;
    --all)    MODE="all" ;;
    --report) VERBOSE=1 ;;
    --*) echo "check-action-coverage: nieznany argument '$arg' (dozwolone: --all, --update, --report)" >&2; exit 2 ;;
    *) ARG_FILES_NL="${ARG_FILES_NL}${arg}
" ;;
  esac
done

if [ ! -f "$AWK_PROG" ]; then
  echo "✗ check-action-coverage: brak $AWK_PROG — bez niego heurystyka nie istnieje." >&2
  exit 1
fi

# ── Zakres ────────────────────────────────────────────────────────────────
# src/components/MyWork/ (powierzchnie UI Idei — mindmap/whiteboard/
# processflow/table + sekcje dzielone szeroko, zgodnie z zadaniem E02),
# WYLACZAJAC __tests__ (to nie sa powierzchnie klienta).
list_scope_files() {
  git ls-files src/components/MyWork 2>/dev/null \
    | grep -E '\.tsx$' \
    | grep -v '/__tests__/'
}

count_violations() {
  awk -f "$AWK_PROG" -- "$1" 2>/dev/null | grep -c . || true
}

report_violations() {
  awk -f "$AWK_PROG" -- "$1" 2>/dev/null
}

baseline_for() {
  local rel="$1"
  [ -f "$BASELINE" ] || { echo 0; return; }
  awk -F'\t' -v p="$rel" '$2==p{print $1; found=1} END{if(!found) print 0}' "$BASELINE"
}

# ── Wybor plikow ─────────────────────────────────────────────────────────
SOURCE=""
if [ "$MODE" = "update" ] || [ "$MODE" = "all" ]; then
  FILES=$(list_scope_files)
  SOURCE="pełny skan repo"
elif [ -n "$ARG_FILES_NL" ]; then
  FILES=$(printf '%s' "$ARG_FILES_NL" | grep -E '^src/components/MyWork/.*\.tsx$' | grep -v '/__tests__/' || true)
  SOURCE="pliki z argumentów"
else
  FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
    | grep -E '^src/components/MyWork/.*\.tsx$' | grep -v '/__tests__/' || true)
  if [ -n "$FILES" ]; then
    SOURCE="staged"
  else
    FILES=$(list_scope_files)
    SOURCE="pełny skan repo (fallback z pustego stagingu)"
  fi
fi

# ── --update ─────────────────────────────────────────────────────────────
if [ "$MODE" = "update" ]; then
  tmp=$(mktemp)
  body=$(mktemp)
  total=0
  nfiles=0
  scanned=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -f "$f" ] || continue
    scanned=$((scanned + 1))
    n=$(count_violations "$f")
    if [ "$n" -gt 0 ]; then
      printf '%s\t%s\n' "$n" "$f" >> "$body"
      total=$((total + n))
      nfiles=$((nfiles + 1))
    fi
  done < <(printf '%s\n' "$FILES" | sort -u)
  {
    echo "# check-action-coverage.sh — BASELINE długu zastanego (ratchet, E02 DoD)."
    echo "# Format: <liczba>\t<ścieżka>. Liczba = ile onClick/onSelect w pliku są"
    echo "# akcjopodobne (heurystyka: scripts/check-action-coverage.awk) i NIE są"
    echo "# traceable do IDEA_ACTION_REGISTRY (runIdeaAction/runAction)."
    echo "#"
    echo "# Bramka przepuszcza plik dopóki liczba NIE ROŚNIE. Nowe naruszenie (nowy"
    echo "# plik w zakresie, albo wzrost liczby) = commit zablokowany. Regeneruj"
    echo "# (--update) TYLKO gdy dług ŚWIADOMIE SPADŁ (akcja przeniesiona do rejestru),"
    echo "# nigdy żeby uciszyć nową regresję."
    echo "#"
    echo "# WYGENEROWANO: $(date +%Y-%m-%d) (scripts/check-action-coverage.sh --update)"
    echo "# RAZEM: $total naruszeń w $nfiles plikach (zeskanowano $scanned plików w zakresie)"
    echo "#"
    echo "# Posortowane po ścieżce (stabilny diff)."
    sort -k2,2 "$body" 2>/dev/null || true
  } > "$tmp"
  mv "$tmp" "$BASELINE"
  rm -f "$body"
  echo "✓ check-action-coverage: baseline zaktualizowany → $BASELINE ($total naruszeń w $nfiles plikach, $scanned plików w zakresie)"
  exit 0
fi

# ── Tryb sprawdzania ─────────────────────────────────────────────────────
fail=0
checked=0
total_current=0
total_baseline=0
new_files=0
grown_files=0
debt_report=""

while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue
  checked=$((checked + 1))

  cur=$(count_violations "$f")
  base=$(baseline_for "$f")
  total_current=$((total_current + cur))
  total_baseline=$((total_baseline + base))

  if [ "$cur" -gt "$base" ]; then
    if [ "$base" -eq 0 ]; then
      new_files=$((new_files + 1))
      echo "✗ action-coverage: $f — NOWA akcjopodobna konstrukcja bez rejestru ($cur, baseline 0)." >&2
    else
      grown_files=$((grown_files + 1))
      echo "✗ action-coverage: $f — dług URÓSŁ: $cur, baseline $base (+$((cur - base)))." >&2
    fi
    report_violations "$f" | while IFS='|' read -r ln snippet; do
      echo "      L$ln  $snippet" >&2
    done
    fail=1
  elif [ "$VERBOSE" = "1" ] && [ "$cur" -gt 0 ]; then
    debt_report="${debt_report}  • $f — $cur (baseline $base)
"
  fi
done < <(printf '%s\n' "$FILES")

if [ "$VERBOSE" = "1" ] && [ -n "$debt_report" ]; then
  echo ""
  echo "── Dług zastany (w baseline, NIE blokuje) ──"
  printf '%s' "$debt_report"
fi

if [ "$checked" -eq 0 ]; then
  echo "⚠ check-action-coverage: sprawdzono 0 plików — NIC nie zweryfikowano." >&2
  echo "  Podaj pliki jawnie albo uruchom pełny skan: scripts/check-action-coverage.sh --all" >&2
  exit 0
fi

if [ "$fail" -eq 0 ]; then
  echo "✓ check-action-coverage: brak NOWYCH akcjopodobnych konstrukcji spoza rejestru (${SOURCE}: $checked plików; naruszeń $total_current, baseline $total_baseline — dług nie rośnie)"
  if [ "$total_current" -lt "$total_baseline" ]; then
    echo "  ↓ Dług SPADŁ o $((total_baseline - total_current)). Zatwierdź spadek: scripts/check-action-coverage.sh --update"
  fi
else
  echo "" >&2
  echo "  ⛔ E02 DoD (machine check detects unregistered commands): onClick/onSelect z" >&2
  echo "     czasownikiem-komendą (create/delete/save/apply/convert/...), Api.* albo" >&2
  echo "     CustomEvent, ale BEZ traceability do IDEA_ACTION_REGISTRY (runIdeaAction/" >&2
  echo "     runAction). Nowych plików: $new_files · plików z urosłym długiem: $grown_files." >&2
  echo "" >&2
  echo "     Wyjścia: (a) dodaj wpis do src/actions/ideaActionRegistry.ts i przepnij" >&2
  echo "     handler przez runIdeaAction; (b) jeśli to naprawdę czysty UI-toggle (nie" >&2
  echo "     komenda) — heurystyka się myli, popraw ją w check-action-coverage.awk," >&2
  echo "     nie omijaj bramki; (c) jeśli dług ŚWIADOMIE posprzątany — --update." >&2
fi

exit $fail
