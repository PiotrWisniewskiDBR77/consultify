#!/usr/bin/env bash
# check-actions.sh — strażnik REJESTRU AKCJI Idea Workspace (Z3: zero martwych kliknięć).
#
# SSOT reguł: docs/standards/idea-workspace/02_REJESTR_AKCJI.md, sekcja
# „Z3 — zero placeholderów". Styl i sposób raportowania: jak scripts/check-triada.sh
# i scripts/check-artefakt.sh (✓/✗, powód po polsku, exit != 0 przy naruszeniu).
#
# POWÓD ISTNIENIA: commit f5d0271992 naprawił ~40 martwych kliknięć PUNKTOWO.
# Bez tego skryptu następna akcja `mm_*` dopisana do wspólnej powierzchni znowu
# będzie klikiem w próżnię. Skrypt zamienia „naprawione raz" w „niemożliwe".
#
# SPRAWDZA (każdy błąd mówi KTÓRA akcja i CO jest nie tak):
#   R1  każdy ActionDef ma `handler`
#   R2  każdy ActionDef ma przynajmniej jedną powierzchnię (`surfaces: [...]`)
#   R3  akcja pokazywana jako wyłączona (`showsDisabled: true`) ma `disabledReason`
#   R4  akcja `mutates: true` ma `undo`
#   R5  żaden identyfikator akcji się nie duplikuje
#   R6  każdy string runtime (mm_*/wb_*/pf_*/tbl_*) ma odbiornik w hooku swojej
#       reprezentacji — to jest DOKŁADNIE ta klasa błędu, która dała ~40 martwych
#       pozycji (akcja Mapy myśli wystawiana w Tablicy/Przepływie/Tabeli)
#   R7  każdy `CustomEvent` nadawany z rejestru ma w kodzie `addEventListener`
#   R8  każdy endpoint wołany z rejestru (przez `Api.*`) istnieje w routerze serwera
#   R9  generator manifestu Teresy nadal produkuje kształt `ToolDefinition`
#       (name/description/parameters) — inaczej Z4 przestaje się spinać z serwerem
#   R10 (E02 DoD "machine check detects unregistered commands", 2026-08-10)
#       companion scripts/check-action-coverage.sh — R1-R9 powyżej widzą TYLKO
#       akcje JUŻ zadeklarowane w rejestrze; R10 skanuje src/components/MyWork/
#       pod kątem onClick/onSelect z czasownikiem-komendą (create/delete/save/
#       apply/...), Api.* albo CustomEvent, które NIE są traceable do rejestru
#       (runIdeaAction/runAction) — dokładnie ten drift, którego R1-R9 nie widzą.
#       Ratchet/baseline (jak check-list-canon.sh) w
#       scripts/check-action-coverage.baseline.txt — SSOT heurystyki i jej
#       false-positive story: scripts/check-action-coverage.awk (nagłówek).
#   R11 (QG-01, 2026-08-10) tablica `ORIGINAL_ORDER` w ideaActionRegistry.ts jest
#       permutacją zbioru akcji — po podziale rejestru na pięć plików to ONA, a
#       nie kolejność zapisu w źródle, ustala kolejność pozycji w Menu 3 i menu
#       kontekstowym. Brak wpisu = akcja cicho spada na koniec listy.
#
# ★ REJESTR WIELOPLIKOWY (QG-01, 2026-08-10) ★ — `ideaActionRegistry.ts`
# przekroczył 9000 linii/231 akcji i został rozbity per narzędzie w
# `src/actions/registry/`. Publiczne API (import path) się NIE zmieniło —
# `ideaActionRegistry.ts` jest teraz barrel + `RUNTIME_*`/`run*Callback` żyją
# w `registry/runtimeHelpers.ts` + same definicje akcji żyją w pięciu plikach
# `registry/{mindmap,whiteboard,processFlow,table,shared}Actions.ts`. Ten
# skrypt skanuje WSZYSTKIE te pliki (nie tylko `ideaActionRegistry.ts`) — patrz
# `ACTION_FILES`/`RUNTIME_FILE`/`ALL_REGISTRY_FILES` niżej. R1-R5 parsują
# konkatenację `ACTION_FILES` (każdy ma dokładnie jedną tablicę
# `export const XXX_ACTIONS: ActionDef[] = [ … ];`, ten sam kontrakt wcięć co
# dawne `IDEA_ACTIONS`). R6 parsuje `RUNTIME_FILE` (tam dziś mieszkają mapy
# `RUNTIME_*`). R7/R8 skanują `ALL_REGISTRY_FILES`, bo `CustomEvent`/`Api.*`
# występują ZARÓWNO w `runtimeHelpers.ts`, JAK I bezpośrednio w treści
# niektórych akcji (zweryfikowane przy podziale — nie jest to tylko silnik).
#
# UWAGA — parsowanie: skrypt czyta rejestr awk-em wg KONTRAKTU FORMATU opisanego
# w nagłówku `src/actions/ideaActionRegistry.ts`. Jeśli nie znajdzie ANI JEDNEJ
# akcji, przerywa błędem (cichy „0 akcji, wszystko OK" byłby najgorszym wynikiem).
#
# Użycie: scripts/check-actions.sh [--verbose] [--full]
#   (domyślnie, tryb pre-commit) — R1-R9/R11 audytują rejestr (stały, mały
#     zestaw plików — koszt nie rośnie z rozmiarem MyWork). R10 sprawdza
#     TYLKO staged pliki src/components/MyWork/**/*.tsx (przekazane jawnie
#     do check-action-coverage.sh; jeśli żaden nie jest w stage'u, R10 jest
#     pomijane — brak nowego driftu, nic do zweryfikowania).
#   --full — R10 robi pełny skan zakresu MyWork (jak dawny domyślny tryb) —
#     do CI/ręcznych audytów, gdy chcesz zobaczyć CAŁY zastany dług, nie
#     tylko to, co dotyka bieżący commit.
#
# BUGFIX 2026-08-25 (TRI-OBS-17): przed tą zmianą R10 wołał
# check-action-coverage.sh BEZ ARGUMENTÓW. Ten skrypt sam odtwarza staged
# diff i FILTRUJE __tests__ — więc commit dotykający WYŁĄCZNIE pliku w
# src/components/MyWork/**/__tests__/*.tsx (np. SlashMenu.blockConfiguration.
# test.tsx) dawał PUSTĄ listę PO filtrze, co uruchamiało wbudowany fallback
# "pusty staging → pełny skan repo" w check-action-coverage.sh — i blokowało
# commit na 5 plikach ZASTAŁEGO długu (ClosureDecisionQueue,
# EffectivenessClosureQueue, NotebookExportMenu, NotebookHamburgerMenu,
# NotebookInlineAIMenu), których commit w ogóle nie dotykał. Naprawa: ten
# skrypt (check-actions.sh) sam ustala staged pliki MyWork i przekazuje je
# check-action-coverage.sh JAWNIE jako argumenty — tryb "pliki z argumentów"
# w tamtym skrypcie NIE MA fallbacku na pełny skan (pusta lista po filtrze
# __tests__ = "sprawdzono 0 plików", exit 0). Sam check-action-coverage.sh
# (i jego reguły R1-R9/R10 wewnętrzne) NIE ZOSTAŁ osłabiony — `--full` nadal
# widzi cały dług, patrz scripts/check-action-coverage.baseline.txt.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

REGISTRY="src/actions/ideaActionRegistry.ts"
REGISTRY_DIR="src/actions/registry"
RUNTIME_FILE="$REGISTRY_DIR/runtimeHelpers.ts"
ACTION_FILES="$REGISTRY_DIR/mindmapActions.ts $REGISTRY_DIR/whiteboardActions.ts $REGISTRY_DIR/processFlowActions.ts $REGISTRY_DIR/tableActions.ts $REGISTRY_DIR/sharedActions.ts"
ALL_REGISTRY_FILES="$REGISTRY $RUNTIME_FILE $ACTION_FILES"
MANIFEST="src/actions/teresaActionManifest.ts"
API_CLIENT="src/services/api.ts"
ROUTES_DIR="server/src/routes"

VERBOSE=0
FULL=0
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=1 ;;
    --full) FULL=1 ;;
    *) echo "check-actions: nieznany argument '$arg' (dozwolone: --verbose, --full)" >&2; exit 2 ;;
  esac
done

fail=0
err() { echo "✗ check-actions: $*" >&2; fail=1; }
note() { [ "$VERBOSE" = "1" ] && echo "    $*"; return 0; }

if [ ! -f "$REGISTRY" ]; then
  err "brak rejestru $REGISTRY — bez niego nic nie pilnuje martwych kliknięć."
  exit 1
fi
for f in $ACTION_FILES $RUNTIME_FILE; do
  if [ ! -f "$f" ]; then
    err "brak modułu rejestru $f (QG-01 split) — bez niego nic nie pilnuje martwych kliknięć."
    exit 1
  fi
done

# ── Rozbicie rejestru na akcje ──────────────────────────────────────────────
# Blok akcji = literał obiektu wcięty o 2 spacje wewnątrz jednej z pięciu
# tablic `export const XXX_ACTIONS: ActionDef[] = [ … ];` w $ACTION_FILES
# (QG-01, 2026-08-10 — dawniej JEDNA tablica `const IDEA_ACTIONS` w
# $REGISTRY; kontrakt wcięć identyczny, zmienił się tylko wzorzec
# wejścia/wyjścia i liczba plików źródłowych). Dla każdej akcji zbieramy
# jedną linię: id|handler|surfaces|showsDisabled|disabledReason|mutates|undo|teresa_desc
ACTIONS=$(awk '
  /^export const [A-Z_]+_ACTIONS: ActionDef\[\] = \[$/ { inreg = 1; next }
  inreg && /^\];/ { inreg = 0 }
  !inreg { next }
  /^  \{/ {
    id=""; handler=0; surfaces=""; showsdis=0; reason=0; mutates=""; undo=0; teresa=0;
    inact=1; next
  }
  inact && /^  \},?$/ {
    printf "%s|%d|%s|%d|%d|%s|%d|%d\n", (id==""?"<BEZ-ID>":id), handler, (surfaces==""?"<BRAK>":surfaces), showsdis, reason, (mutates==""?"<BRAK>":mutates), undo, teresa;
    inact=0; next
  }
  inact {
    if ($0 ~ /^    id: /)              { line=$0; sub(/^    id: ./, "", line); sub(/.,?$/, "", line); id=line }
    if ($0 ~ /^    handler: /)         { handler=1 }
    if ($0 ~ /^    surfaces: \[/)      { line=$0; sub(/^    surfaces: \[/, "", line); sub(/\].*$/, "", line); gsub(/[ '\''"]/, "", line); surfaces=line }
    if ($0 ~ /^    showsDisabled: true/) { showsdis=1 }
    if ($0 ~ /^    disabledReason: /)  { reason=1 }
    if ($0 ~ /^    mutates: /)         { line=$0; sub(/^    mutates: /, "", line); sub(/,$/, "", line); mutates=line }
    if ($0 ~ /^    undo: /)            { undo=1 }
    if ($0 ~ /^    teresa: /)          { teresa=1 }
  }
' $ACTION_FILES)

ACTION_COUNT=$(printf '%s\n' "$ACTIONS" | grep -c . || true)
if [ "${ACTION_COUNT:-0}" -eq 0 ]; then
  err "nie sparsowałem ŻADNEJ akcji z $ACTION_FILES — format plików rozjechał się z kontraktem opisanym w nagłówku $REGISTRY."
  exit 1
fi

# ── R1-R5: reguły per akcja ─────────────────────────────────────────────────
while IFS='|' read -r id handler surfaces showsdis reason mutates undo teresa; do
  [ -n "$id" ] || continue
  [ "$id" = "<BEZ-ID>" ] && err "akcja bez pola 'id' (blok w $REGISTRY)."
  [ "$handler" = "1" ] || err "akcja '$id' NIE MA pola 'handler' — to jest definicja martwego kliknięcia (R1)."
  if [ "$surfaces" = "<BRAK>" ] || [ -z "$surfaces" ]; then
    err "akcja '$id' nie ma ani jednej powierzchni ('surfaces') — nikt jej nie pokaże (R2)."
  fi
  if [ "$showsdis" = "1" ] && [ "$reason" != "1" ]; then
    err "akcja '$id' jest pokazywana jako wyłączona, ale nie podaje 'disabledReason' — użytkownik zobaczy szarą pozycję bez powodu (R3)."
  fi
  if [ "$mutates" = "true" ] && [ "$undo" != "1" ]; then
    err "akcja '$id' zmienia dane ('mutates: true') i NIE MA opisu cofnięcia ('undo') (R4)."
  fi
  if [ "$mutates" = "<BRAK>" ]; then
    err "akcja '$id' nie deklaruje 'mutates' — nie wiadomo, czy wymaga cofania (R4)."
  fi
  [ "$teresa" = "1" ] || err "akcja '$id' nie ma sekcji 'teresa' — Teresa nie będzie umiała jej wywołać (Z4)."
done <<EOF
$ACTIONS
EOF

# R5 — duplikaty id
DUPS=$(printf '%s\n' "$ACTIONS" | cut -d'|' -f1 | sort | uniq -d)
if [ -n "$DUPS" ]; then
  printf '%s\n' "$DUPS" | while IFS= read -r d; do
    [ -n "$d" ] && echo "✗ check-actions: identyfikator akcji '$d' występuje więcej niż raz (R5)." >&2
  done
  fail=1
fi

# ── R6: każdy string runtime ma odbiornik w hooku swojej reprezentacji ──────
hook_for_tool() {
  case "$1" in
    mindmap)      echo "src/components/MyWork/mindmap/useMindMapQuickActions.ts" ;;
    whiteboard)   echo "src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts" ;;
    process_flow) echo "src/components/MyWork/processflow/useProcessFlowQuickActions.ts" ;;
    table)        echo "src/components/MyWork/table/useTableQuickActions.ts" ;;
    *)            echo "" ;;
  esac
}

# Wyciagamy KAZDY string w pozycji runtime (dowolna tresc miedzy apostrofami),
# a nie tylko poprawnie wygladajacy. Poprzednio wzorzec dopuszczal wylacznie
# [a-z0-9_], wiec identyfikator z wielka litera czy myslnikiem NIE PASOWAL i po
# cichu wypadal z kontroli — straznik meldowal OK na zepsutym rejestrze.
# Zle zbudowany identyfikator ma byc ODRZUCONY, nie POMINIETY.
# QG-01 (2026-08-10): mapy RUNTIME_* mieszkają dziś w $RUNTIME_FILE (dawniej
# w $REGISTRY, zanim rejestr rozbito per narzędzie).
RUNTIME_LINES=$(grep -nE "^  (mindmap|whiteboard|process_flow|table): '[^']*'," "$RUNTIME_FILE" || true)
RUNTIME_PAIRS=$(printf '%s\n' "$RUNTIME_LINES" \
  | sed -E "s/^([0-9]+): +([a-z_]+): '([^']*)',.*$/\1 \2 \3/")

RUNTIME_COUNT=$(printf '%s\n' "$RUNTIME_PAIRS" | grep -c . || true)
RUNTIME_RAW=$(printf '%s\n' "$RUNTIME_LINES" | grep -c . || true)
if [ "${RUNTIME_COUNT:-0}" -eq 0 ]; then
  err "nie znalazłem żadnej mapy runtime ('const RUNTIME_*: ToolActionMap') — reguła R6 nie ma czego pilnować."
fi
# Straznik nie ma prawa cicho zgubic linii: ile znalazl, tyle musi sparsowac.
if [ "${RUNTIME_COUNT:-0}" -ne "${RUNTIME_RAW:-0}" ]; then
  err "R6: znalazłem $RUNTIME_RAW linii runtime, a sparsowałem $RUNTIME_COUNT — reszta wypadłaby z kontroli. Popraw format rejestru albo wzorzec w tym skrypcie."
fi

while read -r lineno tool action; do
  [ -n "${action:-}" ] || continue
  hook=$(hook_for_tool "$tool")
  if [ -z "$hook" ] || [ ! -f "$hook" ]; then
    err "$RUNTIME_FILE:$lineno — nieznana reprezentacja '$tool' (R6)."
    continue
  fi
  case "$action" in
    [a-z0-9_]*) : ;;
    *) err "$RUNTIME_FILE:$lineno — identyfikator runtime '$action' łamie konwencję (dozwolone: małe litery, cyfry, podkreślenie) (R6)."; continue ;;
  esac
  if printf '%s' "$action" | grep -qE '[^a-z0-9_]'; then
    err "$RUNTIME_FILE:$lineno — identyfikator runtime '$action' łamie konwencję (dozwolone: małe litery, cyfry, podkreślenie) (R6)."
    continue
  fi
  if ! grep -qE "(=== *'$action'|^ *$action:|'$action' *:|\"$action\")" "$hook"; then
    err "$RUNTIME_FILE:$lineno — akcja '$action' ($tool) NIE MA odbiornika w $(basename "$hook") → klik w próżnię (R6)."
  else
    note "✓ $tool/$action → $(basename "$hook")"
  fi
done <<EOF
$RUNTIME_PAIRS
EOF

# ── R7: każdy CustomEvent nadawany z rejestru ma listenera ──────────────────
# QG-01: skanujemy WSZYSTKIE pliki rejestru — `new CustomEvent(` występuje i w
# $RUNTIME_FILE (silnik), i bezpośrednio w treści niektórych akcji w
# $ACTION_FILES (zweryfikowane przy podziale, nie tylko teoretycznie).
EVENTS=$(grep -ohE "new CustomEvent\('[^']+'" $ALL_REGISTRY_FILES | sed -E "s/.*'([^']+)'.*/\1/" | sort -u)
if [ -z "$EVENTS" ]; then
  note "rejestr nie nadaje żadnego CustomEvent (R7 bez zastosowania)"
fi
while IFS= read -r ev; do
  [ -n "$ev" ] || continue
  if ! grep -rqE "addEventListener\(['\"]$ev['\"]" src/; then
    err "zdarzenie '$ev' jest nadawane z rejestru, ale NIKT go nie nasłuchuje w src/ → martwy event (R7)."
  else
    note "✓ event $ev ma listenera"
  fi
done <<EOF
$EVENTS
EOF

# ── R8: każdy endpoint wołany z rejestru istnieje w routerze serwera ────────
# Api.<metoda> → ścieżka z src/services/api.ts → dopasowanie w server/src/routes.
# QG-01: skanujemy WSZYSTKIE pliki rejestru (silnik + pięć plików akcji), z
# tego samego powodu co R7 wyżej.
API_METHODS=$(grep -ohE "Api\.[A-Za-z0-9_]+\(" $ALL_REGISTRY_FILES | sed -E 's/^Api\.([A-Za-z0-9_]+)\(/\1/' | sort -u)
while IFS= read -r m; do
  [ -n "$m" ] || continue
  DEF_LINE=$(grep -nE "^  $m: (async )?\(" "$API_CLIENT" | head -1 | cut -d: -f1)
  if [ -z "$DEF_LINE" ]; then
    err "metoda 'Api.$m' wołana z rejestru nie istnieje w $API_CLIENT (R8)."
    continue
  fi
  RAW=$(sed -n "${DEF_LINE},$((DEF_LINE + 40))p" "$API_CLIENT" \
    | grep -oE '\$\{API_URL\}[^`]*' | head -1)
  if [ -z "$RAW" ]; then
    err "nie umiem odczytać ścieżki endpointu dla 'Api.$m' ($API_CLIENT:$DEF_LINE) — sprawdź ręcznie (R8)."
    continue
  fi
  # `${API_URL}/my-work/my-ideas/${id}/duplicate${qs...}` → /my-ideas/[^']*/duplicate
  PATH_RAW=${RAW#\$\{API_URL\}}
  PATH_RAW=$(printf '%s' "$PATH_RAW" | sed -E 's/\$\{[^{}]*\}/:P/g; s/\?.*$//')
  # Obetnij ogon po pierwszym znaku spoza ścieżki (np. reszta zagnieżdżonego
  # `${qs ? ... }` w duplicateMyIdea) — inaczej porównujemy śmieć z routerem.
  PATH_RAW=$(printf '%s' "$PATH_RAW" | sed -E 's![^A-Za-z0-9_:/.-].*$!!')
  # zdejmij prefiks modułu (montowany w Gateway: app.use('/api/my-work', ...))
  MODULE=$(printf '%s' "$PATH_RAW" | cut -d/ -f2)
  SUBPATH=/$(printf '%s' "$PATH_RAW" | cut -d/ -f3-)
  SUBPATH=${SUBPATH%%:P}
  PATTERN=$(printf '%s' "$SUBPATH" | sed -E 's/:P/[^\x27]+/g')
  if grep -rqE "['\"]$PATTERN['\"]" "$ROUTES_DIR"; then
    note "✓ Api.$m → $SUBPATH (moduł /$MODULE) istnieje w routerze"
  else
    err "endpoint '$SUBPATH' (Api.$m, moduł /$MODULE) NIE ISTNIEJE w $ROUTES_DIR → wołanie w próżnię (R8)."
  fi
done <<EOF
$API_METHODS
EOF

# ── R9: manifest Teresy nadal generuje kształt ToolDefinition ───────────────
if [ ! -f "$MANIFEST" ]; then
  err "brak $MANIFEST — rejestr istnieje, ale Teresa nie dostaje z niego narzędzi (Z4, R9)."
else
  for field in "name:" "description:" "parameters:"; do
    grep -q "$field" "$MANIFEST" || err "$MANIFEST nie ustawia pola '$field' — rozjazd z kształtem ToolDefinition z server/src/services/ai/toolDefinitions.ts (R9)."
  done
  grep -q "IDEA_ACTION_REGISTRY" "$MANIFEST" \
    || err "$MANIFEST nie czyta z IDEA_ACTION_REGISTRY — manifest musi być GENEROWANY z rejestru, nie pisany ręcznie (R9)."
fi

# ── R11: ORIGINAL_ORDER == permutacja zbioru akcji (QG-01, 2026-08-10) ──────
# Po podziale rejestru na pięć plików kolejność pozycji w Menu 3 i w menu
# kontekstowym NIE wynika już z kolejności zapisu w źródle — odtwarza ją
# tablica `ORIGINAL_ORDER` w $REGISTRY. Akcja dopisana do `registry/*Actions.ts`
# bez wpisu w `ORIGINAL_ORDER` skompiluje się, zadziała i przejdzie R1-R10 —
# po prostu wyląduje na końcu listy zamiast tam, gdzie autor ją widział. To
# dokładnie ten rodzaj cichego rozjazdu, który ten strażnik ma czynić
# NIEMOŻLIWYM: zbiór id-ków w `ORIGINAL_ORDER` musi być permutacją zbioru
# id-ków sparsowanych z $ACTION_FILES — ani jednego brakującego, ani jednego
# osieroconego (id usunięte z rejestru, ale zostawione w kolejności).
ORDER_IDS=$(awk "
  /^const ORIGINAL_ORDER/ { ino = 1; next }
  ino && /^\]\)/          { ino = 0 }
  !ino                    { next }
  /^  '/                  { gsub(/^  '|',\$/, \"\"); print }
" "$REGISTRY")
ORDER_COUNT=$(printf '%s\n' "$ORDER_IDS" | grep -c . || true)
if [ "${ORDER_COUNT:-0}" -eq 0 ]; then
  err "nie sparsowałem ŻADNEJ pozycji z ORIGINAL_ORDER w $REGISTRY — kolejność menu przestała być pilnowana (R11)."
else
  ACTION_IDS_ONLY=$(printf '%s\n' "$ACTIONS" | cut -d'|' -f1 | grep -c . >/dev/null; printf '%s\n' "$ACTIONS" | cut -d'|' -f1)
  MISSING_IN_ORDER=$(comm -23 <(printf '%s\n' "$ACTION_IDS_ONLY" | sort -u) <(printf '%s\n' "$ORDER_IDS" | sort -u))
  ORPHAN_IN_ORDER=$(comm -13 <(printf '%s\n' "$ACTION_IDS_ONLY" | sort -u) <(printf '%s\n' "$ORDER_IDS" | sort -u))
  DUP_IN_ORDER=$(printf '%s\n' "$ORDER_IDS" | sort | uniq -d)
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    err "akcja '$id' NIE MA wpisu w ORIGINAL_ORDER ($REGISTRY) → cicho spadnie na koniec Menu 3 / menu kontekstowego (R11)."
  done <<EOF
$MISSING_IN_ORDER
EOF
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    err "ORIGINAL_ORDER ($REGISTRY) wymienia '$id', którego nie ma w żadnym z $ACTION_FILES → osierocony wpis kolejności (R11)."
  done <<EOF
$ORPHAN_IN_ORDER
EOF
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    err "ORIGINAL_ORDER ($REGISTRY) wymienia '$id' więcej niż raz — kolejność niejednoznaczna (R11)."
  done <<EOF
$DUP_IN_ORDER
EOF
  [ -n "$MISSING_IN_ORDER$ORPHAN_IN_ORDER$DUP_IN_ORDER" ] \
    || note "✓ ORIGINAL_ORDER = permutacja $ORDER_COUNT akcji (R11)"
fi

# ── R10: drift POZA rejestrem (companion, E02 DoD) ──────────────────────────
# Domyślnie (tryb pre-commit) sprawdza WYŁĄCZNIE staged pliki
# src/components/MyWork/**/*.tsx — przekazane JAWNIE jako argumenty do
# check-action-coverage.sh, żeby nie trafić w jego wbudowany fallback
# "pusty staging → pełny skan repo" (patrz BUGFIX 2026-08-25 w nagłówku
# tego pliku — commit dotykający tylko pliku w __tests__/ dawał pustą listę
# PO filtrze __tests__ w tamtym skrypcie i uruchamiał ten fallback, blokując
# commity na zastałym długu spoza zakresu commita). `--full` (nie
# `--verbose` — te dwie flagi są teraz rozdzielone) robi pełny skan zakresu
# MyWork przez `--all --report`, tak jak dawny domyślny tryb — do CI/ręcznych
# audytów. `--verbose` samo w sobie tylko odkrywa szczegóły (note()) i NIE
# zmienia zakresu skanu.
COVERAGE_SCRIPT="scripts/check-action-coverage.sh"
if [ -f "$COVERAGE_SCRIPT" ]; then
  if [ "$FULL" = "1" ]; then
    COVERAGE_OUT=$(bash "$COVERAGE_SCRIPT" --all --report 2>&1)
    COVERAGE_RC=$?
  else
    STAGED_MYWORK_TSX=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
      | grep -E '^src/components/MyWork/.*\.tsx$' || true)
    if [ -n "$STAGED_MYWORK_TSX" ]; then
      COVERAGE_OUT=$(bash "$COVERAGE_SCRIPT" $STAGED_MYWORK_TSX 2>&1)
      COVERAGE_RC=$?
    else
      COVERAGE_OUT="✓ check-action-coverage: brak plików src/components/MyWork/**/*.tsx w stage'u — R10 pominięte (tryb staged-only; użyj --full dla pełnego skanu zakresu)."
      COVERAGE_RC=0
    fi
  fi
  if [ "$COVERAGE_RC" -ne 0 ]; then
    printf '%s\n' "$COVERAGE_OUT" >&2
    err "R10: check-action-coverage.sh znalazł NOWĄ akcjopodobną konstrukcję spoza rejestru (patrz wyżej)."
  else
    note "$COVERAGE_OUT"
  fi
else
  err "brak $COVERAGE_SCRIPT — R10 (E02 DoD, machine check detects unregistered commands) nie ma czego uruchomić."
fi

# ── Podsumowanie ────────────────────────────────────────────────────────────
if [ "$fail" -eq 1 ]; then
  echo "" >&2
  echo "  REJESTR AKCJI (docs/standards/idea-workspace/02_REJESTR_AKCJI.md, Z3):" >&2
  echo "  akcja bez handlera/powierzchni, martwy event, endpoint bez routera, string" >&2
  echo "  akcji bez odbiornika w hooku, albo (R10) onClick/onSelect z czasownikiem-" >&2
  echo "  komendą bez traceability do rejestru = MARTWE/NIEZAREJESTROWANE KLIKNIĘCIE." >&2
  echo "  Napraw deklarację w $REGISTRY albo dorób odbiornik po stronie narzędzia." >&2
  exit 1
fi

echo "✓ check-actions: rejestr OK — akcji: $ACTION_COUNT · stringów runtime: $RUNTIME_COUNT · zdarzeń: $(printf '%s\n' "$EVENTS" | grep -c . || true) · metod API: $(printf '%s\n' "$API_METHODS" | grep -c . || true)"
exit 0
