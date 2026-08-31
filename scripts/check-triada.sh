#!/bin/bash
# Strażnik kanonu triady (docs/ui-standards/TRIADA_KANON.md).
#
# Przeniesiony z .claude/hooks/check-triada.sh (2026-07-19) — .claude/ jest
# gitignored, więc hook żył WYŁĄCZNIE lokalnie per-sesja i nie działał w CI
# ani dla innego developera/agenta. Ta kopia jest wersjonowana w repo.
#
# DWA TRYBY (logika detekcji NIEZMIENIONA względem oryginału):
#   1) HOOK MODE — jak dawniej: Claude Code PostToolUse na Edit|Write, JSON
#      na stdin (.tool_input.file_path/.new_string). Używane gdy
#      .claude/settings.json (lokalny, poza gitem) wskaże na ten plik.
#   2) SCAN MODE — nowe: standalone/CI/pre-commit. Bez JSON-a na stdin —
#      skanuje zmienione pliki (argumenty pozycyjne > staged git diff >
#      unstaged git diff) i sprawdza TYLKO nowo dodane linie (git diff),
#      całą treść dla plików nieśledzonych — ten sam zakres "nowa treść"
#      co hook, inny transport wejścia. Użycie: check-triada.sh [pliki...]
#
# VF0-2 (2026-07-19): rozszerzono o crimson-leak `c-accent` / `var(--c-accent)`
# oraz `primary-(100|200|300)` (poprzednio hook łapał tylko bg-primary-[4567]00
# i focus:ring/border-primary — numery 100/200/300 i sam token c-accent
# przechodziły). Dodano allowlist ścieżkowy (scripts/triada-allowlist.txt)
# dla świadomych wyjątków brand/logo.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ALLOWLIST="$SCRIPT_DIR/triada-allowlist.txt"

# Zakazane wzorce kanonu (primary = crimson #85182F) — IDENTYCZNE jak w
# oryginalnym hooku, patrz komentarz historyczny wyżej.
# VF3 (2026-07-26, audyt strażników): regex nadal przepuszczał primary-50/800/900
# i KAŻDY numer primary-* poza prefiksem bg- (np. text-primary-700,
# dark:border-primary-800) — realny przypadek: NotificationSettings.tsx:239
# 'bg-primary-50 dark:bg-primary-900/20 ... border-primary-200 dark:border-primary-800/30'
# — tylko border-primary-200 był łapany (via 100/200/300), reszta przechodziła.
# Kanon TRIADA_KANON.md czesc C: primary = crimson #85182F, KAZDY numer w
# KAZDYM kontekscie (bg-/text-/border-/ring-/from-/to-/via-/divide-/outline-),
# nie tylko bg-[4567]00. Rozszerzono na pelna enumeracje odcieni 50-900,
# niezaleznie od prefiksu klasy (grep dopasowuje substring, wiec prefiks nie
# musi byc w regexie - "primary-500" lapie i "bg-primary-500" i
# "dark:text-primary-500" i "hover:border-primary-500"). Legalny wyjatek
# pozostaje WYLACZNIE sciezkowy (scripts/triada-allowlist.txt, brand/logo) -
# skrypt nie przewiduje wyjatku regexowego dla semantyki danger/critical
# (canon: primary nigdy nie jest legalny nawet dla stanow krytycznych - do
# tego sluza tokeny c-danger/c-critical, patrz TRIADA_KANON.md czesc C).
#
# VF5 (2026-08-31, zgloszenie przy rejestracji modulu Ustawien): crimson
# #85182F jest w repo dostepny pod WIELOMA nazwami poza `primary-*` —
# `tailwind.config.js` definiuje DWIE inne skale o IDENTYCZNYCH wartosciach
# hex (`crimson-*` linie 171-184 i `brand-*` linie 288-303, legacy alias),
# a `src/index.css` eksponuje ten sam kolor jako `--c-accent`/`c-accent`
# (juz lapane od VF0-2) ORAZ jako `--c-accent-soft`/`c-accent-soft` (ten sam
# crimson, tylko z wbudowana alfa 0.08/0.14 — NIE lapane: filtr accent_viol
# dopasowywal WYLACZNIE dokladny token `c-accent`/`--c-accent`, wiec
# `bg-c-accent-soft` przechodzil bez zadnego ostrzezenia). Zmierzone na
# `src/**` (2026-08-31): `crimson-*` — 151 linii w scope, tylko 31 lapanych
# starym `bg-crimson-[0-9]` (120 przechodzilo, np. text-crimson-600,
# border-crimson-500, group-hover/btn:to-crimson-700); `brand-*` — 133 linie,
# `brand` NIE BYL W REGEXIE WCALE (0 lapanych, przypadkowe 2 to inny wzorzec
# na tej samej linii); `c-accent-soft` — 483 wystapien tokenu w ~195 plikach,
# z czego ~66 plikow w samym `src/components/settings/` (moment zgloszenia:
# modul Ustawien uzywa `--c-accent-soft` dekoracyjnie — hover/selected/badge
# tła — prawie wylacznie, patrz probka w raporcie audytu, nie w tym pliku).
# Rozszerzenie NIZEJ dopisuje `crimson-(50..900)` (ten sam trik substring co
# primary — lapie kazdy prefiks/warianty bez enumeracji), `brand-(50..900)`
# analogicznie, plus jawna enumeracje prefiksow dla BEZ-numerowej (DEFAULT)
# formy `brand` (bg-/text-/border-/ring-/from-/shadow-), bo bare "-brand" bez
# ograniczenia do konkretnych prefiksow lapalby falszywie prozaiczne "on-brand"
# / "off-brand" / "tenant-branding" w komentarzach i identyfikatorach (realnie
# wystepujace w repo). Filtr `c-accent-soft` jest osobno w find_violations/
# count_violations_full (accent_viol), patrz nizej.
VIOL_RE='primary-(50|100|200|300|400|500|600|700|800|900)([^0-9]|$)|focus:(ring|border)-primary([^0-9]|$)|crimson-(50|100|200|300|400|500|600|700|800|900)([^0-9]|$)|brand-(50|100|200|300|400|500|600|700|800|900)([^0-9]|$)|(bg|text|border|ring|from|shadow)-brand([^0-9a-zA-Z-]|$)'

is_scope_file() {
  # Tylko frontend TS/TSX w src/components lub src/views (jak oryginał).
  case "$1" in
    */src/components/*|*/src/views/*|src/components/*|src/views/*) : ;;
    *) return 1 ;;
  esac
  case "$1" in
    *.tsx|*.ts) return 0 ;;
    *) return 1 ;;
  esac
}

is_allowlisted() {
  local file="$1"
  [ -f "$ALLOWLIST" ] || return 1
  while IFS= read -r pattern; do
    case "$pattern" in ''|'#'*) continue ;; esac
    case "$file" in $pattern) return 0 ;; esac
  done < "$ALLOWLIST"
  return 1
}

# ===================== TRYB --all / --update (ratchet pełnego repo) =========
# VF4 (2026-07-26, audyt strażników): do tej pory check-triada.sh widział
# WYŁĄCZNIE diff (nowo dodane linie) — na czystym drzewie nie sprawdza
# NICZEGO, więc dług zastany (primary-* wpisany przed hookiem) nigdy nie był
# policzony ani widoczny. Dodano tryb pełnego skanu repo z ratchetem,
# wzorowany 1:1 na mechanizmie scripts/check-list-canon.sh (i
# scripts/check-artefakt.sh): baseline PER PLIK w
# scripts/check-triada.baseline.txt (`<liczba>\t<ścieżka>`), bramka FAILuje
# TYLKO gdy liczba naruszeń w pliku ROŚNIE (albo nowy plik ma >0 przy
# baseline 0). Dług zastany przechodzi, każda NOWA regresja blokuje.
# Liczenie w tym trybie NIE używa find_violations() (ta obcina wynik do 6 —
# słusznie dla czytelnego promptu hooka, błędnie dla ratchetu: zaniżyłoby
# liczbę w mocno naruszonych plikach i psuło porównanie z baseline).
BASELINE="$SCRIPT_DIR/check-triada.baseline.txt"

list_scope_files_all() {
  # Ten sam zakres co is_scope_file(): src/components/**/*.{ts,tsx} i
  # src/views/**/*.{ts,tsx} — pełna lista z indeksu git (śledzone pliki).
  git ls-files 'src/components/*.ts' 'src/components/*.tsx' \
               'src/views/*.ts' 'src/views/*.tsx' 2>/dev/null | sort -u
}

count_violations_full() {
  # Dokładna (nieobcięta) liczba naruszeń w CAŁEJ treści pliku — dla ratchetu.
  local f="$1" viol_lines accent_tokens accent_exact
  viol_lines=$(grep -cE "$VIOL_RE" "$f" 2>/dev/null || true)
  accent_tokens=$(grep -oE '(--)?c-accent(-[a-zA-Z0-9]+)?' "$f" 2>/dev/null || true)
  accent_exact=0
  if [ -n "$accent_tokens" ]; then
    # VF5: `(-soft)?` dopisany obok bare c-accent — `--c-accent-soft`/`c-accent-soft`
    # to TEN SAM crimson #85182F (tylko z wbudowana alfa), patrz komentarz przy VIOL_RE.
    accent_exact=$(printf '%s\n' "$accent_tokens" | grep -xE '(--)?c-accent(-soft)?' | sort -u | grep -c . || true)
  fi
  echo $((viol_lines + accent_exact))
}

baseline_for_triada() {
  local rel="$1"
  [ -f "$BASELINE" ] || { echo 0; return; }
  awk -F'\t' -v p="$rel" '$2==p{print $1; found=1} END{if(!found) print 0}' "$BASELINE"
}

if [ "${1:-}" = "--all" ] || [ "${1:-}" = "--update" ]; then
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  cd "$ROOT" || exit 1
  ALL_MODE="$1"
  VERBOSE=0
  [ "${2:-}" = "--report" ] && VERBOSE=1

  if [ "$ALL_MODE" = "--update" ]; then
    tmp=$(mktemp); body=$(mktemp); total=0; nfiles=0
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ -f "$f" ] || continue
      is_allowlisted "$f" && continue
      n=$(count_violations_full "$f")
      if [ "$n" -gt 0 ]; then
        printf '%s\t%s\n' "$n" "$f" >> "$body"
        total=$((total + n)); nfiles=$((nfiles + 1))
      fi
    done < <(list_scope_files_all)
    {
      echo "# check-triada.sh — BASELINE długu zastanego (ratchet pełnego repo). Format: <liczba>\\t<ścieżka>."
      echo "# Liczba = ile linii w CAŁYM pliku łamie VIOL_RE (primary-*, KAŻDY odcień 50-900,"
      echo "# focus:ring/border-primary, bg-crimson-N) albo używa bare c-accent/--c-accent."
      echo "#"
      echo "# Bramka (--all) przepuszcza plik dopóki liczba NIE ROŚNIE. Nowe naruszenie (nowy"
      echo "# plik albo wzrost w istniejącym) = FAIL. Regeneruj (--update) TYLKO gdy dług"
      echo "# ŚWIADOMIE SPADŁ — nigdy żeby uciszyć nową regresję."
      echo "#"
      echo "# WYGENEROWANO: $(date +%Y-%m-%d) (scripts/check-triada.sh --update)"
      echo "# RAZEM: $total naruszeń w $nfiles plikach"
      echo "#"
      echo "# Posortowane po ścieżce (stabilny diff). Dług maleje = wiersze znikają / liczby spadają."
      sort -k2,2 "$body" 2>/dev/null || true
    } > "$tmp"
    mv "$tmp" "$BASELINE"
    rm -f "$body"
    echo "✓ check-triada --update: baseline zaktualizowany → $BASELINE ($total naruszeń w $nfiles plikach)"
    exit 0
  fi

  # ALL_MODE = --all: sprawdzanie względem baseline.
  fail=0; checked=0; total_current=0; total_baseline=0; new_files=0; grown_files=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -f "$f" ] || continue
    is_allowlisted "$f" && continue
    checked=$((checked + 1))
    cur=$(count_violations_full "$f")
    base=$(baseline_for_triada "$f")
    total_current=$((total_current + cur))
    total_baseline=$((total_baseline + base))
    if [ "$cur" -gt "$base" ]; then
      if [ "$base" -eq 0 ]; then
        new_files=$((new_files + 1))
        echo "✗ check-triada --all: $f — NOWE naruszenie crimson ($cur, baseline 0)." >&2
      else
        grown_files=$((grown_files + 1))
        echo "✗ check-triada --all: $f — dług URÓSŁ: $cur naruszeń, baseline $base (+$((cur - base)))." >&2
      fi
      grep -nE "$VIOL_RE" "$f" 2>/dev/null | head -6 | sed 's/^/      /' >&2
      fail=1
    elif [ "$VERBOSE" = "1" ] && [ "$cur" -gt 0 ]; then
      echo "  • $f — $cur (baseline $base)"
    fi
  done < <(list_scope_files_all)

  if [ "$fail" -eq 0 ]; then
    echo "✓ check-triada --all: brak NOWYCH naruszeń crimson (sprawdzono plików: $checked; naruszeń $total_current, baseline $total_baseline — dług nie rośnie)"
    if [ "$total_current" -lt "$total_baseline" ]; then
      echo "  ↓ Dług SPADŁ o $((total_baseline - total_current)). Zatwierdź spadek: scripts/check-triada.sh --update"
    fi
  else
    echo "" >&2
    echo "  KANON TRIADY: primary-*/crimson-*/brand-* (KAŻDY numer) i c-accent/c-accent-soft/var(--c-accent...) = crimson #85182F." >&2
    echo "  Nowych plików z naruszeniem: $new_files · plików z urosłym długiem: $grown_files." >&2
    echo "  SSOT: docs/ui-standards/TRIADA_KANON.md (część C)." >&2
  fi
  exit $fail
fi

find_violations() {
  # $1 = payload (treść do sprawdzenia)
  local payload="$1" viol accent_tokens accent_viol all
  viol=$(printf '%s' "$payload" | grep -nE "$VIOL_RE" | head -6)
  accent_tokens=$(printf '%s' "$payload" | grep -oE '(--)?c-accent(-[a-zA-Z0-9]+)?' 2>/dev/null || true)
  accent_viol=""
  if [ -n "$accent_tokens" ]; then
    # VF5: patrz komentarz przy VIOL_RE — `-soft` to ten sam crimson z wbudowaną alfą.
    accent_viol=$(printf '%s\n' "$accent_tokens" | grep -xE '(--)?c-accent(-soft)?' | sort -u | head -6)
  fi
  all=$(printf '%s\n%s\n' "$viol" "$accent_viol" | grep -v '^$' || true)
  printf '%s' "$all"
}

# ============================= TRYB WEJŚCIA =================================
# Argumenty pozycyjne obecne → SCAN MODE, zero dotyku stdin (bezpieczne w
# pre-commit/CI, gdzie stdin bywa dziwnym fd — patrz check-list-canon.sh/
# check-artefakt.sh, ten sam wzorzec).
MODE=""
SCAN_ARGS_NL=""
if [ "$#" -gt 0 ]; then
  MODE="scan"
  # newline-joined (nie $*/spacje) — nazwy plików ze spacją (np. "* 2.tsx",
  # dokładnie wzorzec z DOKTRYNA_GESTOSCI.md §3) NIE mogą się rozjechać na
  # dwa "słowa" przy późniejszym słowo-dzieleniu.
  SCAN_ARGS_NL=$(printf '%s\n' "$@")
else
  INPUT=""
  if [ ! -t 0 ]; then
    INPUT=$(cat 2>/dev/null || true)
  fi
  HOOK_FILE=""
  if [ -n "$INPUT" ]; then
    HOOK_FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null || true)
  fi
  if [ -n "$HOOK_FILE" ]; then
    MODE="hook"
  else
    MODE="scan"
  fi
fi

# ============================= HOOK MODE (niezmieniona logika) ==============
if [ "$MODE" = "hook" ]; then
  FILE="$HOOK_FILE"
  if ! is_scope_file "$FILE"; then exit 0; fi
  if is_allowlisted "$FILE"; then exit 0; fi

  PAYLOAD=$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null)
  [ -z "$PAYLOAD" ] && exit 0

  ALL_VIOL=$(find_violations "$PAYLOAD")
  if [ -n "$ALL_VIOL" ]; then
    jq -n --arg v "$ALL_VIOL" --arg f "$FILE" '{
      decision: "block",
      reason: ("⛔ KANON TRIADY: nowa treść w " + $f + " zawiera zakazane wzorce:\n" + $v + "\nprimary/crimson/brand = crimson #85182F (KAŻDY numer, w tym 100/200/300); c-accent/c-accent-soft/var(--c-accent...) = ten sam crimson pod inną nazwą (aliasy). CTA/stany aktywne = NEUTRALNE (bg-navy-900 / dark:bg-[#F4F7FB]); fokus = niebieski c-focus. SSOT: docs/ui-standards/TRIADA_KANON.md (część C). Popraw wpisywany kod, albo — jeśli to świadomy wyjątek brand/logo — dopisz ścieżkę do scripts/triada-allowlist.txt."),
      systemMessage: ("Kanon triady: zablokowano crimson (primary-*/c-accent) w " + $f)
    }'
    exit 0
  fi
  exit 0
fi

# ============================= SCAN MODE (nowe: CLI/CI/pre-commit) ==========
FILES=""
if [ -n "$SCAN_ARGS_NL" ]; then
  FILES="$SCAN_ARGS_NL"
else
  FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)
  if [ -z "$FILES" ]; then
    FILES=$(git diff --name-only HEAD 2>/dev/null)
  fi
fi

fail=0
checked=0
# Iteracja linia-po-linii (nie słowo-dzielenie po $FILES) — nazwy plików ze
# spacją muszą przejść przez pipeline bez rozjechania na dwa tokeny.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue
  is_scope_file "$f" || continue
  is_allowlisted "$f" && continue
  checked=$((checked + 1))

  # Nowa treść: cały plik jeśli nieśledzony (??), inaczej tylko dodane linie
  # z git diff (parytet z semantyką hooka "tylko nowo wpisywana treść").
  STATUS=$(git status --porcelain -- "$f" 2>/dev/null | head -1)
  case "$STATUS" in
    "??"*)
      PAYLOAD=$(cat "$f")
      ;;
    *)
      PAYLOAD=$(git diff --cached -U0 -- "$f" 2>/dev/null | grep -E '^\+' | grep -Ev '^\+\+\+' | sed 's/^\+//')
      if [ -z "$PAYLOAD" ]; then
        PAYLOAD=$(git diff -U0 -- "$f" 2>/dev/null | grep -E '^\+' | grep -Ev '^\+\+\+' | sed 's/^\+//')
      fi
      ;;
  esac
  [ -z "$PAYLOAD" ] && continue

  ALL_VIOL=$(find_violations "$PAYLOAD")
  if [ -n "$ALL_VIOL" ]; then
    echo "✗ check-triada: $f — zakazane wzorce (primary=crimson #85182F / c-accent):" >&2
    printf '%s\n' "$ALL_VIOL" | sed 's/^/    /' >&2
    fail=1
  fi
done <<EOF
$FILES
EOF

if [ "$fail" -eq 1 ]; then
  echo "" >&2
  echo "  KANON TRIADY: primary-*/crimson-*/brand-* (KAŻDY numer, w tym 100/200/300) i" >&2
  echo "  c-accent/c-accent-soft/var(--c-accent...) to crimson #85182F. CTA/stany aktywne = NEUTRALNE, fokus = c-focus." >&2
  echo "  SSOT: docs/ui-standards/TRIADA_KANON.md (część C). Świadomy wyjątek brand/logo →" >&2
  echo "  dopisz ścieżkę do scripts/triada-allowlist.txt." >&2
  exit 1
fi
if [ "$checked" -eq 0 ]; then
  # ★ Zero sprawdzonych plików ≠ "czysto". Na czystym drzewie (po commicie) diff jest
  # pusty i bramka nie widzi NICZEGO — to nie jest zielone światło. Uruchamiaj z treścią
  # w stagingu (jak hook pre-commit) albo podaj pliki jawnie: check-triada.sh <plik...>.
  echo "⚠ check-triada: sprawdzono 0 plików — NIC nie zweryfikowano (nie mylić z 'czysto')." >&2
  echo "  Uruchom z treścią w stagingu lub podaj pliki jawnie. Patrz §8 audytu 2026-07-24." >&2
  exit 0
fi
echo "✓ check-triada: brak nowych naruszeń crimson (sprawdzono plików: $checked)"
exit 0
