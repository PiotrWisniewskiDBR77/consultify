#!/usr/bin/env bash
# check-focus-canon.sh — REPORTING gate for the focus-color canon (TRIADA_KANON.md:167,
# "--c-focus / --c-focus-solid, niebieski, nigdy crimson"; CLAUDE.md "Pułapka nr 1":
# `primary` in tailwind = crimson #85182F, focus MUST go through `c-focus`).
#
# This script is a DEBT METER, not a UI change. It does not touch src/. It only
# counts and reports — same spirit as `npm run lint:motion`
# (server/scripts/check-motion-compliance.ts): default mode is a report that
# always exits 0; --ci mode compares the current count against a baseline JSON
# and fails ONLY if the count grew (ratchet — debt may shrink, never grow).
#
# Measured deltas: see docs/ui-standards/_DOC_CODE_DELTA_REGISTER.md D-01/D-05.
#
# Violation patterns (crimson used as focus ring/outline):
#   ring-primary-  outline-primary-  focus:ring-primary-  focus-visible:ring-primary-
#   ring-offset-primary-
# ('ring-primary-' as a substring already catches the focus:/focus-visible:
# prefixed variants; kept as one combined regex, see VIOLATION_RE below.)
#
# Correct patterns (progress counter, not gated):
#   ring-c-focus  outline-c-focus  --c-focus
#
# Excluded from counting: node_modules (never in git ls-files scope), test
# files (__tests__/, *.test.tsx, *.test.ts, *.spec.tsx, *.spec.ts), and
# src/index.css (token DEFINITIONS + intentional compatibility rules live
# there, not violations — reported separately as "pominięte").
#
# ── 2026-08-02 — panel adwersaryjny, 4 dziury naprawione (K-23/K-24/K-39/K-40) ──
#
# K-23 (skrypt nie był wpięty nigdzie): dopięty do .husky/pre-commit jako
# bramka 8, WYŁĄCZNIE gdy staged diff dotyka .ts/.tsx w src/. Przed tą datą
# CANON.md §6 nazywał ten skrypt "kod SSOT egzekwujący regułę fokusa", a nic
# go realnie nie odpalało — czysty teatr zgodności.
#
# K-24 (ślepota na pliki NIEśledzone): `git ls-files` z natury pomija pliki
# bez `git add`. Recenzent udowodnił: plik z 5 naruszeniami, bez `git add` →
# `--ci` zwracało exit 0. Naprawa: DODATKOWY skan przez
# `git ls-files --others --exclude-standard` (ta sama filtracja zakresu).
# DECYZJA (uzasadnienie): w --ci naruszenia w plikach NIEśledzonych ZAWSZE
# blokują (fail=1), bez porównania z baseline — bo baseline z definicji nie
# zna tych plików (nie były w `git ls-files` gdy baseline powstawał), więc
# KAŻDE naruszenie w nich jest z definicji NOWE, nigdy dług zastany. To nie
# koliduje z legalnym wzorcem repo "nowe pliki w tests/ wymagają git add -f"
# — jeśli taki świeży plik nie dotyka fokusa, licznik zostaje na zero i nic
# nie blokuje; blokuje wyłącznie realne naruszenie leżące w drzewie roboczym.
# W trybie report (bez --ci) sekcja tylko OSTRZEGA, nie zmienia exit 0 —
# zgodnie z zasadą "report zawsze przechodzi, --ci bramkuje".
#
# K-39 (regex łapie tylko statyczne stringi): trywialny bypass przez
# interpolację (`ring-${x}`), konkatenację (`'ring-prim' + 'ary-500'`) albo
# `.join('-')` przechodził niewykryty. DODANO drugorzędny licznik
# HEURYSTYCZNY (patrz HEURISTIC_RE / scan_heuristic) — to jest OSTRZEŻENIE
# do ręcznego review, NIGDY bramka (będzie dawać fałszywe trafienia z
# natury — nie da się tego złapać regexem ze 100% pewnością). Nie wchodzi
# do baseline, nie wpływa na exit code w żadnym trybie.
#
# K-40 (`--update-baseline` zerowało dług bez tarcia): teraz wypisuje deltę
# (o ile spadł dług, z których plików zniknęły WSZYSTKIE naruszenia — jeśli
# poprzedni baseline miał zapisane dane per-plik) i wymaga jawnego
# potwierdzenia (`--yes` non-interactive, albo pytanie interaktywne). Baseline
# JSON od teraz opcjonalnie niesie też mapę per-plik ("files"), żeby KOLEJNE
# uruchomienie --update-baseline mogło pokazać, co konkretnie zniknęło.
#
# Czego ten skrypt NADAL nie łapie (uczciwie, patrz --help):
#   - dynamicznie budowanych klas, których heurystyka nie rozpozna (np. mapa
#     obiektowa `{focus: 'ring-primary-500'}[state]`, klasy budowane w
#     osobnej funkcji pomocniczej, wartości z CMS/configu);
#   - naruszeń w plikach spoza `src/` (np. server/, dev-render/) — poza
#     zakresem tego kanonu;
#   - REALNEGO wyglądu na ekranie (to miernik długu tekstowego w kodzie, nie
#     dowód zgodności wizualnej — patrz CLAUDE.md UI pkt 4: odbiór = wzrokiem).
#
# Usage:
#   check-focus-canon.sh                      # report, always exit 0
#   check-focus-canon.sh --top 20              # report with a bigger TOP N
#   check-focus-canon.sh --ci                  # ratchet: exit 1 only if debt grew
#                                               #   (tracked ratchet) OR any
#                                               #   untracked-file violation exists
#   check-focus-canon.sh --update-baseline      # regenerate baseline (asks to confirm)
#   check-focus-canon.sh --update-baseline --yes  # same, non-interactive
#   check-focus-canon.sh --help                # this text
#
# npm: lint:focus / lint:focus:ci (package.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

BASELINE="docs/ui-standards/.focus-baseline.json"
REGISTER="docs/ui-standards/_DOC_CODE_DELTA_REGISTER.md"

print_help() {
  cat <<'HELP'
check-focus-canon.sh — miernik długu fokusa crimson (nie dowód zgodności)

ŁAPIE (regex na statycznych stringach w src/*.{ts,tsx,js,jsx}, poza testami
i src/index.css):
  ring-primary-*  outline-primary-*  ring-offset-primary-*
  (w tym warianty focus:/focus-visible: — to podciąg tego samego regexu)

NIE ŁAPIE (uczciwie — patrz komentarz K-39/K-24 w nagłówku pliku):
  - klas budowanych dynamicznie: template literal (`ring-${kolor}`),
    konkatenacja stringów, `.join('-')`, mapy obiektowe, wartości z configu
    — dla tych wzorców jest TYLKO drugorzędne OSTRZEŻENIE (sekcja
    "heurystyka"), nigdy bramka, bo regex nie da tu 100% pewności;
  - plików spoza zakresu src/ (np. server/, dev-render/);
  - realnego wyglądu na ekranie — to licznik tekstu w kodzie, NIE zastępuje
    odbioru wzrokiem (CLAUDE.md UI pkt 4).
  Plik NIEśledzony w gicie (bez `git add`) jest wykrywany OSOBNO (sekcja
  "pliki nieśledzone") i w --ci blokuje zawsze, niezależnie od baseline.

TRYBY:
  (brak)              raport, zawsze exit 0
  --top N              raport z większym TOP N (domyślnie 10)
  --ci                 ratchet: exit 1 gdy tracked-dług wzrósł NAD baseline,
                        LUB gdy jakikolwiek plik nieśledzony ma naruszenie
  --update-baseline     przelicz baseline z aktualnego stanu; wymaga
                        potwierdzenia (--yes albo pytanie interaktywne);
                        pokazuje deltę i (jeśli dostępne) listę plików,
                        z których zniknęły wszystkie naruszenia
  --help                ten tekst

Wpięcie: .husky/pre-commit bramka 8, tylko gdy commit dotyka .ts/.tsx w src/.
HELP
}

MODE="report"
TOP_N=10
CONFIRM=0
for arg in "$@"; do
  case "$arg" in
    -h|--help) print_help; exit 0 ;;
    --ci) MODE="ci" ;;
    --update-baseline) MODE="update" ;;
    --yes) CONFIRM=1 ;;
    --top) : ;; # value consumed below
    --top=*) TOP_N="${arg#--top=}" ;;
    [0-9]*) TOP_N="$arg" ;;
    --*) echo "check-focus-canon: nieznany argument '$arg' (dozwolone: --ci, --update-baseline, --yes, --top N, --help)" >&2; exit 2 ;;
  esac
done

# ── Zakres: src/, bez node_modules (git ls-files już to gwarantuje), bez testów. ──
# BSD grep (macOS) nie ma niezawodnego -r + --include na wszystkich wersjach —
# jak w check-list-canon.sh/check-artefakt.sh, zakres budujemy przez `git ls-files`.
FILTER_SCOPE() {
  grep -E '\.(ts|tsx|js|jsx)$' \
    | grep -v '__tests__/' \
    | grep -v -E '\.(test|spec)\.(ts|tsx|js|jsx)$' \
    | grep -v -E '(^|/)src/index\.css$' \
    | sort -u
}

list_scope_files() {
  git ls-files src 2>/dev/null | FILTER_SCOPE
}

# K-24: pliki w src/ które ISTNIEJĄ na dysku, ale nie są w gicie w ogóle
# (ani śledzone, ani staged) — dokładnie ta klasa, którą `git ls-files`
# (funkcja powyżej) z definicji pomija.
list_untracked_scope_files() {
  git ls-files --others --exclude-standard src 2>/dev/null | FILTER_SCOPE
}

INDEX_CSS="src/index.css"

VIOLATION_RE='ring-primary-|outline-primary-|ring-offset-primary-'
CORRECT_RE='ring-c-focus|outline-c-focus|--c-focus'

# K-39: heurystyka DRUGORZĘDNA (ostrzeżenie, nie bramka) na dynamiczną
# konstrukcję klasy fokusa crimson — patrz uzasadnienie w nagłówku pliku.
#   ring-${...}          → template literal interpolujący do "ring-"
#   ring-primary-${...}  → jw., bardziej specyficzny (redundantny z powyższym,
#                           zostawiony osobno dla czytelności trafień)
#   'ring-prim           → literał zaczynający się od "ring-prim" — typowy
#                           ślad konkatenacji ('ring-prim' + 'ary-500')
HEURISTIC_RE='ring-\$\{|ring-primary-\$\{|'"'"'ring-prim'

# Liczba WIERSZY pasujących do wzorca w pliku (przybliżenie liczby naruszeń —
# w praktyce jedna klasa fokusa na wiersz JSX). Używane tylko dla src/index.css
# (pojedynczy plik, patrz niżej) — dla całego zakresu jest wersja wsadowa.
count_matches() {
  local f="$1" re="$2"
  grep -c -E "$re" -- "$f" 2>/dev/null || true
}

TAB="$(printf '\t')"
NL="
"

# ── Skan WSADOWY zamiast pętli grep-per-plik ────────────────────────────────
# Pierwsza wersja tej sekcji (dodana razem z heurystyką K-39) forkowała 5-6
# procesów `grep`/`sort` NA KAŻDY plik w zakresie (~700 plików w src/) —
# zmierzone: >20s, w praktyce blokujące "zawieszenie" przy trasowaniu.
# `grep` przyjmuje wiele plików jako argumenty i sam raportuje per-plik
# ("path:count" z -c, "path:line:content" z -n) — jedno wywołanie zamiast N.
# Bramka pre-commit ma być "wąska i szybka" (CLAUDE.md), więc to nie jest
# kosmetyka: przy 8 numerowanych bramkach na każdy commit dotykający src/
# jedna wolna bramka psuje cały hook.
batch_counts() {  # batch_counts <regex> <file...> → "path:count" per plik
  local re="$1"; shift
  [ "$#" -gt 0 ] || return 0
  grep -c -H -E "$re" -- "$@" 2>/dev/null || true
}
batch_lines() {  # batch_lines <regex> <file...> → "path:line:content" per trafienie
  local re="$1"; shift
  [ "$#" -gt 0 ] || return 0
  grep -n -H -E "$re" -- "$@" 2>/dev/null || true
}

# bash 3.2 (macOS /bin/bash) pod `set -u` rzuca "unbound variable" na
# `"${arr[@]}"` gdy tablica jest pusta — dlatego zawsze sprawdzamy najpierw
# `${#arr[@]}` i dopiero w gałęzi "niepusta" rozwijamy tablicę.
scope_arr=()
while IFS= read -r line; do
  [ -n "$line" ] && [ -f "$line" ] && scope_arr+=("$line")
done < <(list_scope_files)

untracked_arr=()
while IFS= read -r line; do
  [ -n "$line" ] && [ -f "$line" ] && untracked_arr+=("$line")
done < <(list_untracked_scope_files)

violation_files=0
violation_occurrences=0
compliant_files=0
compliant_occurrences=0
declare_top=""   # newline-joined "<count>\t<path>" for TOP N sort

if [ "${#scope_arr[@]}" -gt 0 ]; then
  violation_raw=$(batch_counts "$VIOLATION_RE" "${scope_arr[@]}")
  if [ -n "$violation_raw" ]; then
    while IFS=: read -r vpath vcount; do
      [ -n "$vpath" ] || continue
      case "$vcount" in ''|*[!0-9]*) vcount=0 ;; esac
      if [ "$vcount" -gt 0 ]; then
        violation_files=$((violation_files + 1))
        violation_occurrences=$((violation_occurrences + vcount))
        declare_top="${declare_top}${vcount}${TAB}${vpath}${NL}"
      fi
    done <<EOF
$violation_raw
EOF
  fi

  correct_raw=$(batch_counts "$CORRECT_RE" "${scope_arr[@]}")
  if [ -n "$correct_raw" ]; then
    while IFS=: read -r cpath ccount; do
      [ -n "$cpath" ] || continue
      case "$ccount" in ''|*[!0-9]*) ccount=0 ;; esac
      if [ "$ccount" -gt 0 ]; then
        compliant_files=$((compliant_files + 1))
        compliant_occurrences=$((compliant_occurrences + ccount))
      fi
    done <<EOF
$correct_raw
EOF
  fi
fi

# ── K-24: skan plików NIEśledzonych (poza zasięgiem baseline z definicji) ────
untracked_violation_files=0
untracked_violation_occurrences=0
declare_untracked=""

if [ "${#untracked_arr[@]}" -gt 0 ]; then
  untracked_violation_raw=$(batch_counts "$VIOLATION_RE" "${untracked_arr[@]}")
  if [ -n "$untracked_violation_raw" ]; then
    while IFS=: read -r upath ucount; do
      [ -n "$upath" ] || continue
      case "$ucount" in ''|*[!0-9]*) ucount=0 ;; esac
      if [ "$ucount" -gt 0 ]; then
        untracked_violation_files=$((untracked_violation_files + 1))
        untracked_violation_occurrences=$((untracked_violation_occurrences + ucount))
        declare_untracked="${declare_untracked}${ucount}${TAB}${upath}${NL}"
      fi
    done <<EOF
$untracked_violation_raw
EOF
  fi
fi

# K-39: heurystyka DRUGORZĘDNA (ostrzeżenie, nie bramka) na dynamiczną
# konstrukcję klasy fokusa crimson — patrz uzasadnienie w nagłówku pliku.
#   ring-${...}          → template literal interpolujący do "ring-"
#   ring-primary-${...}  → jw., bardziej specyficzny (redundantny z powyższym,
#                           zostawiony osobno dla czytelności trafień)
#   'ring-prim           → literał zaczynający się od "ring-prim" — typowy
#                           ślad konkatenacji ('ring-prim' + 'ary-500')
#   .join( + "ring"       → np. ['ring', 'primary', '500'].join('-'); filtr
#                           ':[0-9]+:.*ring' celowo wymaga, żeby "ring"
#                           pojawiło się PO separatorze <linia>: wstawionym
#                           przez grep -n, a nie w samej ŚCIEŻCE pliku (batch
#                           -H dokleja ścieżkę przed numerem linii — bez tego
#                           zawężenia plik typu ".../Scoring/Foo.tsx" fałszywie
#                           łapałby KAŻDY .join() tylko przez nazwę katalogu).
heuristic_files=0
heuristic_occurrences=0
heuristic_report=""  # newline-joined "<path>:<line>:<content>" (+ tag dla plików niesledzonych)

if [ "${#scope_arr[@]}" -gt 0 ]; then
  heur_tracked_raw=$(
    {
      batch_lines "$HEURISTIC_RE" "${scope_arr[@]}"
      batch_lines '\.join\(' "${scope_arr[@]}" | grep -iE ':[0-9]+:.*ring' || true
    } | sort -u
  )
  if [ -n "$heur_tracked_raw" ]; then
    heuristic_occurrences=$((heuristic_occurrences + $(printf '%s\n' "$heur_tracked_raw" | grep -c '')))
    heuristic_files=$((heuristic_files + $(printf '%s\n' "$heur_tracked_raw" | cut -d: -f1 | sort -u | grep -c '')))
    heuristic_report="${heuristic_report}${heur_tracked_raw}${NL}"
  fi
fi

if [ "${#untracked_arr[@]}" -gt 0 ]; then
  heur_untracked_raw=$(
    {
      batch_lines "$HEURISTIC_RE" "${untracked_arr[@]}"
      batch_lines '\.join\(' "${untracked_arr[@]}" | grep -iE ':[0-9]+:.*ring' || true
    } | sort -u
  )
  if [ -n "$heur_untracked_raw" ]; then
    heuristic_occurrences=$((heuristic_occurrences + $(printf '%s\n' "$heur_untracked_raw" | grep -c '')))
    heuristic_files=$((heuristic_files + $(printf '%s\n' "$heur_untracked_raw" | cut -d: -f1 | sort -u | grep -c '')))
    tagged=$(printf '%s\n' "$heur_untracked_raw" | sed 's/^\([^:]*\):/\1 (niesledzony):/')
    heuristic_report="${heuristic_report}${tagged}${NL}"
  fi
fi

# src/index.css — policzone OSOBNO, wypisane jako "pominięte" (definicje +
# reguły kompatybilności, nie naruszenia).
skipped_index_css_violations=0
skipped_index_css_correct=0
if [ -f "$INDEX_CSS" ]; then
  skipped_index_css_violations=$(count_matches "$INDEX_CSS" "$VIOLATION_RE")
  skipped_index_css_correct=$(count_matches "$INDEX_CSS" "$CORRECT_RE")
fi

# Pokrycie liczone na PLIKACH, które w ogóle dotykają fokusa (mają choć jedno
# wystąpienie violation LUB correct) — % plików już zgodnych z kanonem.
denom=$((violation_files + compliant_files))
if [ "$denom" -gt 0 ]; then
  coverage_pct=$(( compliant_files * 100 / denom ))
else
  coverage_pct=100
fi

# ── --update-baseline: pokaż deltę, zażądaj potwierdzenia, zapisz ───────────
if [ "$MODE" = "update" ]; then
  old_files=0
  old_occ=0
  old_files_json="{}"
  if [ -f "$BASELINE" ]; then
    old_files=$(grep -o '"violation_files":[^,}]*' "$BASELINE" | grep -o '[0-9]*' || echo 0)
    old_occ=$(grep -o '"violation_occurrences":[^,}]*' "$BASELINE" | grep -o '[0-9]*' || echo 0)
    old_files=${old_files:-0}
    old_occ=${old_occ:-0}
    if command -v jq >/dev/null 2>&1; then
      old_files_json=$(jq -c '.files // {}' "$BASELINE" 2>/dev/null || echo '{}')
      [ -n "$old_files_json" ] || old_files_json="{}"
    fi
  fi

  delta_files=$((old_files - violation_files))
  delta_occ=$((old_occ - violation_occurrences))

  echo ""
  echo "check-focus-canon --update-baseline: podglad PRZED zapisem"
  echo "  Naruszenia:  $old_files -> $violation_files plikow (delta $delta_files), $old_occ -> $violation_occurrences wystapien (delta $delta_occ)"
  if [ "$delta_files" -lt 0 ] || [ "$delta_occ" -lt 0 ]; then
    echo "  UWAGA: dlug ROSNIE wzgledem obecnego baseline — ratchet ma dzialac tylko w dol." >&2
  fi

  new_files_json="{}"
  if command -v jq >/dev/null 2>&1; then
    if [ -n "$declare_top" ]; then
      new_files_json=$(printf '%s' "$declare_top" | awk -F'\t' 'NF==2{print $2"\t"$1}' | jq -R -s '
        split("\n") | map(select(length>0) | split("\t")) | map({(.[0]): (.[1]|tonumber)}) | add // {}
      ')
    fi
    removed=$(jq -n --argjson old "$old_files_json" --argjson new "$new_files_json" '
      (($old | keys) - ($new | keys)) as $goneKeys
      | ($goneKeys | map({key: ., value: $old[.]}) | from_entries)
    ' 2>/dev/null || echo '{}')
    removed_count=$(printf '%s' "$removed" | jq 'length' 2>/dev/null || echo 0)
    if [ "${removed_count:-0}" -gt 0 ]; then
      echo "  Pliki, z ktorych zniknely WSZYSTKIE naruszenia (bylo w poprzednim baseline, teraz 0):"
      printf '%s' "$removed" | jq -r 'to_entries[] | "    \(.value)\t\(.key)"'
    elif [ "$old_files_json" = "{}" ]; then
      echo "  Brak danych per-plik z poprzedniego baseline (stary format, sam agregat) — od tego zapisu beda zapisywane."
    else
      echo "  Brak plikow z calkowicie wyzerowanymi naruszeniami."
    fi
  else
    echo "  (jq niedostepny w PATH — pomijam liste plikow ze zmiana, zapisuje sam agregat.)"
  fi

  if [ "$CONFIRM" -ne 1 ]; then
    if [ -t 0 ]; then
      printf "  Potwierdz nadpisanie baseline (t/n): " >&2
      read -r ans || ans=""
      case "$ans" in
        t|T|y|Y|tak|TAK|yes|YES) CONFIRM=1 ;;
        *) echo "check-focus-canon: przerwano — baseline NIE zaktualizowany." >&2; exit 1 ;;
      esac
    else
      echo "" >&2
      echo "check-focus-canon --update-baseline: wymagane jawne potwierdzenie (K-40 — zerowanie" >&2
      echo "  dlugu jednym poleceniem bez autoryzacji było dziura). Uruchom z --yes w trybie" >&2
      echo "  nieinteraktywnym, albo bez flagi w terminalu (odpowiesz t/n)." >&2
      exit 2
    fi
  fi

  tmp=$(mktemp)
  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg comment "Baseline dlugu focus-canon (ring-primary-*/outline-primary-* zamiast ring-c-focus). Ratchet: liczby moga tylko malec. Aktualizuj W DOL po kazdej naprawie. NIGDY w gore. 'files' = mapa per-plik (do diffu przy kolejnym --update-baseline). Zob. docs/ui-standards/_DOC_CODE_DELTA_REGISTER.md D-01." \
      --arg date "$(date +%F)" \
      --argjson vf "$violation_files" \
      --argjson vo "$violation_occurrences" \
      --argjson files "$new_files_json" \
      '{_comment: $comment, _generated: $date, violation_files: $vf, violation_occurrences: $vo, files: $files}' > "$tmp"
  else
    cat > "$tmp" <<JSON
{
  "_comment": "Baseline dlugu focus-canon (ring-primary-*/outline-primary-* zamiast ring-c-focus). Ratchet: liczby moga tylko malec. Aktualizuj W DOL po kazdej naprawie. NIGDY w gore. (jq niedostepny przy zapisie — brak mapy per-plik). Zob. docs/ui-standards/_DOC_CODE_DELTA_REGISTER.md D-01.",
  "_generated": "$(date +%F)",
  "violation_files": $violation_files,
  "violation_occurrences": $violation_occurrences
}
JSON
  fi
  mv "$tmp" "$BASELINE"
  echo ""
  echo "check-focus-canon: baseline zaktualizowany -> $BASELINE (violation_files=$violation_files, violation_occurrences=$violation_occurrences)"
  exit 0
fi

# ── Raport (wspólny dla report i ci) ─────────────────────────────────────────
echo "check-focus-canon — dlug fokusa crimson (ring-primary-* zamiast ring-c-focus)"
echo ""
echo "  Naruszenia (crimson jako fokus):  $violation_files plikow, $violation_occurrences wystapien"
echo "  Poprawne (c-focus):               $compliant_files plikow, $compliant_occurrences wystapien"
echo "  Pokrycie (plikow zgodnych):       ${coverage_pct}%"
echo "  Pominiete (src/index.css):        $skipped_index_css_violations naruszen / $skipped_index_css_correct poprawnych (definicje + zgodnosc, nie liczone do bramki)"
echo ""

if [ -n "$declare_top" ]; then
  echo "  TOP $TOP_N plikow wg liczby naruszen (do planowania naprawy modulami):"
  printf '%s' "$declare_top" | sort -t $'\t' -k1,1nr | head -n "$TOP_N" | while IFS=$'\t' read -r n path; do
    [ -n "$path" ] || continue
    printf '    %4s  %s\n' "$n" "$path"
  done
else
  echo "  TOP: brak naruszen."
fi

echo ""
# K-24: pliki nieśledzone — ZAWSZE pokazane, w --ci blokują (patrz niżej).
if [ "$untracked_violation_files" -gt 0 ]; then
  echo "  ⚠️  PLIKI NIEŚLEDZONE z naruszeniami (poza baseline z definicji — git ls-files ich nie widzi):"
  echo "     $untracked_violation_files plikow, $untracked_violation_occurrences wystapien."
  printf '%s' "$declare_untracked" | sort -t $'\t' -k1,1nr | while IFS=$'\t' read -r n path; do
    [ -n "$path" ] || continue
    printf '      %4s  %s\n' "$n" "$path"
  done
  echo "     Napraw albo 'git add' + wejdz do ratchetu (--ci blokuje te pliki BEZ WZGLEDU na baseline)."
else
  echo "  Pliki niesledzone: bez naruszen."
fi

echo ""
# K-39: heurystyka dynamicznej konstrukcji — ZAWSZE ostrzeżenie, nigdy bramka.
if [ "$heuristic_files" -gt 0 ]; then
  echo "  ⚠️  HEURYSTYKA (dynamiczna konstrukcja klasy — do RECZNEGO review, nie bramka, mozliwe falszywe trafienia):"
  echo "     $heuristic_files plikow, $heuristic_occurrences podejrzanych wierszy."
  printf '%s' "$heuristic_report" | head -n 30 | sed 's/^/      /'
  total_heur_lines=$(printf '%s' "$heuristic_report" | grep -c '' || true)
  if [ "${total_heur_lines:-0}" -gt 30 ]; then
    echo "      ... (+$((total_heur_lines - 30)) wiecej, patrz repo)"
  fi
else
  echo "  Heurystyka dynamicznej konstrukcji: brak podejrzanych wzorcow."
fi

echo ""
echo "  Rejestr delt (kontekst dokument<->kod): $REGISTER (D-01, D-05)"

# ── --ci: ratchet, exit 1 tylko gdy dlug WZROSL (tracked) LUB sa naruszenia
#          w plikach nieśledzonych (te sa zawsze "nowe", patrz K-24 wyzej) ──
if [ "$MODE" = "ci" ]; then
  if [ ! -f "$BASELINE" ]; then
    echo "" >&2
    echo "check-focus-canon --ci: brak baseline ($BASELINE) — uruchom --update-baseline najpierw." >&2
    exit 2
  fi
  base_files=$(grep -o '"violation_files":[^,}]*' "$BASELINE" | grep -o '[0-9]*' || echo 0)
  base_occ=$(grep -o '"violation_occurrences":[^,}]*' "$BASELINE" | grep -o '[0-9]*' || echo 0)
  base_files=${base_files:-0}
  base_occ=${base_occ:-0}

  fail=0
  if [ "$violation_files" -gt "$base_files" ]; then
    echo "" >&2
    echo "check-focus-canon --ci: NOWA REGRESJA — violation_files $violation_files > baseline $base_files" >&2
    fail=1
  fi
  if [ "$violation_occurrences" -gt "$base_occ" ]; then
    echo "" >&2
    echo "check-focus-canon --ci: NOWA REGRESJA — violation_occurrences $violation_occurrences > baseline $base_occ" >&2
    fail=1
  fi
  if [ "$untracked_violation_files" -gt 0 ]; then
    echo "" >&2
    echo "check-focus-canon --ci: NOWY DLUG w plikach NIEsledzonych (poza baseline z definicji) — $untracked_violation_files plikow / $untracked_violation_occurrences wystapien." >&2
    echo "  Te pliki nie maja historii w baseline, wiec KAZDE naruszenie w nich liczy sie jako nowe (K-24)." >&2
    echo "  Dodaj plik do gita (git add) i napraw naruszenie, albo usun je przed commitem." >&2
    fail=1
  fi

  if [ "$fail" -eq 1 ]; then
    echo "  Napraw nowe naruszenia (zamien ring-primary-*/outline-primary-* na ring-c-focus/outline-c-focus)." >&2
    echo "  Jesli to swiadome sprzatniecie dlugu (liczby SPADLY), zaktualizuj baseline: bash scripts/check-focus-canon.sh --update-baseline" >&2
    exit 1
  fi

  if [ "$violation_files" -lt "$base_files" ] || [ "$violation_occurrences" -lt "$base_occ" ]; then
    echo ""
    echo "  Dlug SPADL wzgledem baseline ($base_files -> $violation_files plikow, $base_occ -> $violation_occurrences wystapien)."
    echo "  Zaktualizuj baseline w dol: bash scripts/check-focus-canon.sh --update-baseline"
  else
    echo ""
    echo "check-focus-canon --ci: OK (dlug nie rosnie, baseline $base_files plikow / $base_occ wystapien)"
  fi
fi

exit 0
