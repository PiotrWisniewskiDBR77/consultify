#!/bin/bash
# Strażnik DOKTRYNY GĘSTOŚCI (docs/ui-standards/DOKTRYNA_GESTOSCI.md §7/§8).
#
# Przeniesiony z .claude/hooks/check-gestosc.sh (2026-07-19) — .claude/ jest
# gitignored, więc hook żył WYŁĄCZNIE lokalnie per-sesja i nie działał w CI
# ani dla innego developera/agenta. Ta kopia jest wersjonowana w repo.
#
# Osąd przestrzeni (pustka, hero, governance) NIE jest tu łapany — patrz
# skill consultify-gestosc. Uzupełnia check-triada.sh/check-artefakt.sh (ten
# sam mechanizm), NIE zastępuje ich.
#
# BLOK (§8 doktryny — regresje mechaniczne, BLOKUJĄ):
#   1. plik-duplikat "* 2.tsx"/"* 2.ts" (§3 — anty-wzór: 195× w audycie 07-11)
#   2. nowy komponent (plik nieśledzony w git) z 0 importerów w src/ (§3)
#   3. ta sama akcja (id) na pasku (toolbar) ORAZ w kebabie (§1 — JEDNA AKCJA=JEDEN DOM)
# OSTRZEŻENIE (nie blokuje, tylko komunikat — §8):
#   4. toolbar > 5 widocznych akcji (limit ≤5, §1)
#   5. hub > 6 zakładek (limit ≤6, §4)
#
# DWA TRYBY (logika detekcji NIEZMIENIONA względem oryginału):
#   1) HOOK MODE — Claude Code PostToolUse na Edit|Write, JSON na stdin.
#   2) SCAN MODE — standalone/CI/pre-commit, bez JSON-a na stdin. Skanuje
#      zmienione pliki (argumenty pozycyjne > staged git diff > unstaged git
#      diff); BLOK 1/2 działają na plikach jak w hooku (nazwa/git-status),
#      BLOK 3/4/5 na treści pliku (najbliższy odpowiednik "nowej treści" w
#      trybie skanowania — patrz uzasadnienie przy funkcji get_payload).
#      Użycie: check-gestosc.sh [pliki...]
set -u

# ---------- BLOK 1: plik-duplikat "* 2.tsx/ts" ----------
check_block1_dup_filename() {
  local file="$1" basename_f
  basename_f=$(basename -- "$file")
  case "$basename_f" in
    *" 2.tsx"|*" 2.ts") return 1 ;;
  esac
  return 0
}

# ---------- BLOK 2: nowy komponent z 0 importerów ----------
check_block2_orphan_component() {
  local file="$1" project_dir="$2" comp hits status
  case "$file" in
    */src/components/*|src/components/*) : ;;
    *) return 0 ;;
  esac
  # Testy (__tests__/*.test.tsx, *.spec.tsx) NIE są komponentami UI — są
  # punktem wejścia dla test runnera, nie mają i nie mogą mieć "importera"
  # w src/. Bez tego wyjątku KAŻDY nowy plik testowy w src/components/**
  # fałszywie łapał się jako "sierota" (§3 dotyczy orphan UI components,
  # nie pokrycia testami — P-01, 2026-07-28).
  case "$file" in
    */__tests__/*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) return 0 ;;
  esac
  status=$(cd "$project_dir" 2>/dev/null && git status --porcelain -- "$file" 2>/dev/null | head -1)
  case "$status" in
    "??"*|"A "*|"AM"*) : ;;
    *) return 0 ;;
  esac
  comp="${file##*/}"
  comp="${comp%.*}"
  hits=$(grep -rlE "['\"](\\.\\.?/)[^'\"]*${comp}['\"]|${comp}['\"]" \
          --include='*.ts' --include='*.tsx' "$project_dir/src" 2>/dev/null \
          | grep -v -F "$file" | head -3)
  if [ -z "$hits" ]; then
    return 1
  fi
  return 0
}

# ---------- BLOK 3/4/5: na treści (payload) ----------
# Zwraca: "DUP:<id>" jeśli zdublowana akcja pasek+kebab, oraz opcjonalnie
# ostrzeżenia na kolejnych liniach "WARN:...". Identyczna logika awk co oryginał.
analyze_payload() {
  local payload="$1"
  printf '%s' "$payload" | awk '
    function lower(s) { return tolower(s) }
    BEGIN { zone = ""; tzone = ""; tabzone = ""; tn = 0; tabn = 0 }
    {
      line = lower($0)
      if (line ~ /toolbaraction|primaryaction|modulebaraction|baraction|toolbaritem/) { zone = "toolbar"; tzone = "toolbar" }
      else if (line ~ /kebabaction|kebabitem|overflowaction|secondaryaction|dropdownaction|kebabmenu|rowaction/) { zone = "kebab"; tzone = "" }
      # `\s` is a GNU-awk extension. On macOS this runs under BSD awk, where
      # `\s` matches a literal `s`, so these zone-closing rules never fired:
      # the toolbar and tabs zones stayed open to end-of-file and swept up every
      # later `id:` in the module. That is how ResultsRoiHub and ResultsOkrHub
      # were both reported as "7/8 tabs" while really declaring 2 Menu-2 pills
      # and 5 Menu-3 chips. Use the same POSIX class line 85 already uses.
      else if (tzone == "toolbar" && line ~ /^[ \t]*\]/) { tzone = "" }

      if (line ~ /[ \t.]tabs[ \t]*[:=]|hubtabs|moduletabs|tabdefinitions|tabconfig/) { tabzone = "tabs" }
      else if (tabzone == "tabs" && line ~ /^[ \t]*\]/) { tabzone = "" }

      s = $0
      while (match(s, /id:[ \t]*["'"'"'][a-zA-Z0-9_-]+["'"'"']/)) {
        tok = substr(s, RSTART, RLENGTH)
        q1 = index(tok, "\"")
        if (q1 == 0) q1 = index(tok, "\x27")
        rest = substr(tok, q1 + 1)
        q2 = index(rest, "\"")
        if (q2 == 0) q2 = index(rest, "\x27")
        id = substr(rest, 1, q2 - 1)
        if (zone == "toolbar") { toolbar[id] = 1 }
        else if (zone == "kebab") { kebab[id] = 1 }
        if (tzone == "toolbar") { tn++ }
        if (tabzone == "tabs") { tabn++ }
        s = substr(s, RSTART + RLENGTH)
      }
    }
    END {
      for (id in toolbar) { if (id in kebab) { print "DUP:" id } }
      print "TOOLBAR_COUNT:" tn
      print "TAB_COUNT:" tabn
    }
  '
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# ============================= TRYB WEJŚCIA =================================
MODE=""
SCAN_ARGS_NL=""
if [ "$#" -gt 0 ]; then
  MODE="scan"
  # newline-joined (nie $*/spacje) — nazwy plików ze spacją (np. "* 2.tsx",
  # dokładnie wzorzec z BLOK 1 niżej) NIE mogą się rozjechać na dwa "słowa"
  # przy późniejszym słowo-dzieleniu.
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
  case "$FILE" in
    *.tsx|*.ts) : ;;
    *) exit 0 ;;
  esac

  if ! check_block1_dup_filename "$FILE"; then
    jq -n --arg f "$FILE" '{
      decision: "block",
      reason: ("⛔ GĘSTOŚĆ: plik-duplikat \"" + $f + "\" (wzorzec „* 2.tsx/ts” — 195 takich w audycie 07-11). Zakaz drugiej kopii pliku. Usuń plik albo scal z oryginałem. SSOT: docs/ui-standards/DOKTRYNA_GESTOSCI.md §3."),
      systemMessage: "Gęstość: zablokowano plik-duplikat „* 2”"
    }'
    exit 0
  fi

  PAYLOAD=$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null)
  [ -z "$PAYLOAD" ] && exit 0

  if ! check_block2_orphan_component "$FILE" "$PROJECT_DIR"; then
    comp="${FILE##*/}"; comp="${comp%.*}"
    jq -n --arg f "$FILE" --arg c "$comp" '{
      decision: "block",
      reason: ("⛔ GĘSTOŚĆ: nowy komponent \"" + $c + "\" (" + $f + ") ma 0 importerów w src/. Nowy komponent MUSI mieć callera w tym samym kroku/PR — bez callera nie wchodzi. Dodaj miejsce użycia albo nie twórz pliku. SSOT: docs/ui-standards/DOKTRYNA_GESTOSCI.md §3."),
      systemMessage: ("Gęstość: zablokowano komponent bez callera — " + $c)
    }'
    exit 0
  fi

  ANALYSIS=$(analyze_payload "$PAYLOAD")
  DUP=$(printf '%s\n' "$ANALYSIS" | grep '^DUP:' | head -1 | sed 's/^DUP://')
  TOOLBAR_COUNT=$(printf '%s\n' "$ANALYSIS" | grep '^TOOLBAR_COUNT:' | sed 's/^TOOLBAR_COUNT://')
  TAB_COUNT=$(printf '%s\n' "$ANALYSIS" | grep '^TAB_COUNT:' | sed 's/^TAB_COUNT://')

  if [ -n "$DUP" ]; then
    jq -n --arg d "$DUP" --arg f "$FILE" '{
      decision: "block",
      reason: ("⛔ GĘSTOŚĆ: akcja \"" + $d + "\" w " + $f + " zdublowana — występuje ORAZ na pasku (toolbar), ORAZ w kebabie. JEDNA AKCJA = JEDEN DOM (§1). Usuń z jednej z powierzchni. SSOT: docs/ui-standards/DOKTRYNA_GESTOSCI.md §1."),
      systemMessage: ("Gęstość: zablokowano zdublowaną akcję \"" + $d + "\" (pasek+kebab)")
    }'
    exit 0
  fi

  WARN=""
  if [ -n "$TOOLBAR_COUNT" ] && [ "$TOOLBAR_COUNT" -gt 5 ] 2>/dev/null; then
    WARN="⚠️ GĘSTOŚĆ: toolbar w ${FILE} ma ${TOOLBAR_COUNT} widocznych akcji (limit ≤5 wg §1 doktryny). 6+ → obowiązkowy overflow „…”. Sprawdź osądem czy potrzebny overflow (docs/ui-standards/DOKTRYNA_GESTOSCI.md §1)."
  fi
  if [ -n "$TAB_COUNT" ] && [ "$TAB_COUNT" -gt 6 ] 2>/dev/null; then
    if [ -n "$WARN" ]; then
      WARN="${WARN} | ⚠️ Hub w ${FILE} ma ${TAB_COUNT} zakładek (limit ≤6 wg §4 doktryny). 7+ → scal lub zamień na sub-tryby."
    else
      WARN="⚠️ GĘSTOŚĆ: hub w ${FILE} ma ${TAB_COUNT} zakładek (limit ≤6 wg §4 doktryny). 7+ → scal lub zamień na sub-tryby (docs/ui-standards/DOKTRYNA_GESTOSCI.md §4)."
    fi
  fi
  if [ -n "$WARN" ]; then
    jq -n --arg w "$WARN" '{ systemMessage: $w }'
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
warnings=""
# Iteracja linia-po-linii (nie słowo-dzielenie po $FILES) — nazwy plików ze
# spacją muszą przejść przez pipeline bez rozjechania na dwa tokeny.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue
  case "$f" in *.tsx|*.ts) : ;; *) continue ;; esac
  checked=$((checked + 1))

  if ! check_block1_dup_filename "$f"; then
    echo "✗ check-gestosc: $f — plik-duplikat \"* 2.tsx/ts\" (§3 doktryny gęstości)." >&2
    fail=1
  fi

  if ! check_block2_orphan_component "$f" "$PROJECT_DIR"; then
    comp="${f##*/}"; comp="${comp%.*}"
    echo "✗ check-gestosc: $f — nowy komponent \"$comp\" ma 0 importerów w src/ (§3 doktryny gęstości)." >&2
    fail=1
  fi

  # Treść do analizy BLOK 3/4/5: cały plik jeśli nieśledzony, inaczej pełna
  # bieżąca treść pliku (BLOK 3 dubel pasek+kebab i limity §1/§4 dotyczą
  # STANU KOŃCOWEGO pliku, nie tylko dodanych linii — w przeciwieństwie do
  # crimson-leak w check-triada.sh, gdzie liczy się tylko nowo wpisywana treść).
  PAYLOAD=$(cat "$f" 2>/dev/null)
  [ -z "$PAYLOAD" ] && continue

  ANALYSIS=$(analyze_payload "$PAYLOAD")
  DUP=$(printf '%s\n' "$ANALYSIS" | grep '^DUP:' | head -1 | sed 's/^DUP://')
  TOOLBAR_COUNT=$(printf '%s\n' "$ANALYSIS" | grep '^TOOLBAR_COUNT:' | sed 's/^TOOLBAR_COUNT://')
  TAB_COUNT=$(printf '%s\n' "$ANALYSIS" | grep '^TAB_COUNT:' | sed 's/^TAB_COUNT://')

  if [ -n "$DUP" ]; then
    echo "✗ check-gestosc: $f — akcja \"$DUP\" zdublowana (toolbar+kebab, §1 doktryny gęstości)." >&2
    fail=1
  fi
  if [ -n "$TOOLBAR_COUNT" ] && [ "$TOOLBAR_COUNT" -gt 5 ] 2>/dev/null; then
    warnings="${warnings}⚠️  $f — toolbar ma $TOOLBAR_COUNT akcji (limit ≤5, §1)\n"
  fi
  if [ -n "$TAB_COUNT" ] && [ "$TAB_COUNT" -gt 6 ] 2>/dev/null; then
    warnings="${warnings}⚠️  $f — hub ma $TAB_COUNT zakładek (limit ≤6, §4)\n"
  fi
done <<EOF
$FILES
EOF

if [ -n "$warnings" ]; then
  printf "%b" "$warnings"
fi

if [ "$fail" -eq 1 ]; then
  echo "" >&2
  echo "  DOKTRYNA GĘSTOŚCI: docs/ui-standards/DOKTRYNA_GESTOSCI.md §3/§1." >&2
  exit 1
fi
if [ "$checked" -eq 0 ]; then
  # ★ Zero sprawdzonych plików ≠ "czysto" (ta sama choroba co w check-triada.sh,
  # §8 audytu 2026-07-24). Na czystym drzewie diff jest pusty i bramka nie widzi
  # NICZEGO — samo "✓ sprawdzono 0" czytało się jako zielone światło.
  echo "⚠ check-gestosc: sprawdzono 0 plików — NIC nie zweryfikowano (nie mylić z 'czysto')." >&2
  echo "  Uruchom z treścią w stagingu lub podaj pliki jawnie: check-gestosc.sh <plik...>." >&2
  exit 0
fi
echo "✓ check-gestosc: brak regresji mechanicznych (sprawdzono plików: $checked)"
exit 0
