#!/usr/bin/env bash
# check-artefakt.sh — TWARDY bezpiecznik crimson w powłoce artefaktów (SPEC-A).
#
# Powód: CLAUDE.md §UI pkt 6 — powłoka wspólna artefaktów (Menu 1 + prawy panel
# accordion `ArtifactRightPanel` + kebab + stany, patrz
# Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2) ma być
# CRIMSON-NEUTRALNA: `primary-*` (KAŻDY numer, patrz tailwind.config.js —
# cała rodzina `primary` = Harvard Crimson #85182F) i token `c-accent`
# (bg-c-accent/text-c-accent/border-c-accent) są zakazane w plikach powłoki.
# Crimson = TYLKO semantyka krytyczna (danger/destructive), nigdy CTA/stan
# domyślny w powłoce współdzielonej przez 5 archetypów (A-E).
#
# Wyjątek: linia z jawnym komentarzem `crimson-ok` (np. `/* crimson-ok */`)
# jest świadomym, zaakceptowanym użyciem i nie liczy się do naruszeń.
#
# RATCHET (nie "zero naruszeń od razu"): dziś w powłoce już są historyczne
# użycia `primary-*` (NModeLayout — sprzed tego hooka). Zamiast blokować
# wszystko od razu, hook porównuje aktualną liczbę naruszeń PER PLIK z
# baseline w scripts/check-artefakt.baseline.txt i FAILuje tylko gdy liczba
# w danym pliku ROŚNIE (albo nowy plik w zakresie ma >0 naruszeń, gdy nie ma
# wpisu w baseline = baseline 0). Dzięki temu hook jest włączalny NATYCHMIAST,
# bez czyszczenia świata, a mimo to łapie KAŻDĄ nową regresję.
#
# Regeneracja baseline po świadomym sprzątaniu długu: --update
#
# Użycie: check-artefakt.sh [--update]
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

BASELINE="scripts/check-artefakt.baseline.txt"
MODE="${1:-}"

# --- Zakres: pliki powłoki artefaktów (SPEC-A), NIE centrum per-archetyp. ---
# Ustalone 1:1 z rzeczywistością repo (2026-07-18):
#   - ArtifactRightPanel.tsx      — prawy panel accordion, wspólny dla A-E
#   - NModeLayout/*                — powłoka archetypu A Canvas ("N Mode")
#   - ExecutiveModuleShell/*       — powłoka archetypów B/D/E (Wordy/Tabele/Prezentacje)
#   - IdeaMapWorkspace.tsx         — powłoka Idea Map (Canvas, MyWork)
list_scope_files() {
  {
    echo "src/components/standard/ArtifactRightPanel.tsx"
    echo "src/components/MyWork/IdeaMapWorkspace.tsx"
    find src/components/shared/NModeLayout -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
    find src/components/shared/ExecutiveModuleShell -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
  } | sort
}

# Liczba naruszeń w pojedynczym pliku (primary-* KAŻDY numer, lub c-accent token).
count_violations() {
  local f="$1"
  grep -nE 'primary-|bg-c-accent|text-c-accent|border-c-accent' "$f" 2>/dev/null \
    | grep -v 'crimson-ok' | grep -c . || true
}

baseline_for() {
  local rel="$1"
  [ -f "$BASELINE" ] || { echo 0; return; }
  awk -F'\t' -v p="$rel" '$2==p{print $1; found=1} END{if(!found) print 0}' "$BASELINE"
}

if [ "$MODE" = "--update" ]; then
  tmp=$(mktemp)
  echo "# check-artefakt.sh baseline — regenerowany --update. Format: <liczba>\\t<ścieżka>." > "$tmp"
  echo "# Regeneruj TYLKO po świadomym sprzątnięciu długu crimson w powłoce, nie żeby ukryć nową regresję." >> "$tmp"
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    n=$(count_violations "$f")
    [ "$n" -gt 0 ] && printf '%s\t%s\n' "$n" "$f" >> "$tmp"
  done < <(list_scope_files)
  mv "$tmp" "$BASELINE"
  echo "✓ check-artefakt: baseline zaktualizowany → $BASELINE"
  exit 0
fi

fail=0
total_current=0
total_baseline=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  cur=$(count_violations "$f")
  base=$(baseline_for "$f")
  total_current=$((total_current + cur))
  total_baseline=$((total_baseline + base))
  if [ "$cur" -gt "$base" ]; then
    echo "✗ check-artefakt: $f — $cur naruszeń crimson w powłoce (baseline $base). Nowa regresja primary-*/c-accent w SPEC-A powłoce (CLAUDE.md UI pkt 6)." >&2
    fail=1
  fi
done < <(list_scope_files)

if [ $fail -eq 0 ]; then
  echo "✓ check-artefakt: brak nowych naruszeń crimson w powłoce artefaktów (aktualnie $total_current, baseline $total_baseline — dług nie rośnie)"
else
  echo "" >&2
  echo "  Napraw: zamień primary-*/c-accent na tokeny neutralne (c-focus dla fokusu, c-* semantyczne)." >&2
  echo "  Jeśli to świadome sprzątnięcie długu (liczba SPADŁA), zaktualizuj baseline: scripts/check-artefakt.sh --update" >&2
fi
exit $fail
