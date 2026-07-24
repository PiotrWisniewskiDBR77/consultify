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
VIOL_RE='bg-primary-[4567]00|focus:(ring|border)-primary|bg-crimson-[0-9]|primary-(100|200|300)([^0-9]|$)'

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

find_violations() {
  # $1 = payload (treść do sprawdzenia)
  local payload="$1" viol accent_tokens accent_viol all
  viol=$(printf '%s' "$payload" | grep -nE "$VIOL_RE" | head -6)
  accent_tokens=$(printf '%s' "$payload" | grep -oE '(--)?c-accent(-[a-zA-Z0-9]+)?' 2>/dev/null || true)
  accent_viol=""
  if [ -n "$accent_tokens" ]; then
    accent_viol=$(printf '%s\n' "$accent_tokens" | grep -xE '(--)?c-accent' | sort -u | head -6)
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
      reason: ("⛔ KANON TRIADY: nowa treść w " + $f + " zawiera zakazane wzorce:\n" + $v + "\nprimary = crimson #85182F (KAŻDY numer, w tym 100/200/300); c-accent/var(--c-accent) = ten sam crimson pod inną nazwą. CTA/stany aktywne = NEUTRALNE (bg-navy-900 / dark:bg-[#F4F7FB]); fokus = niebieski c-focus. SSOT: docs/ui-standards/TRIADA_KANON.md (część C). Popraw wpisywany kod, albo — jeśli to świadomy wyjątek brand/logo — dopisz ścieżkę do scripts/triada-allowlist.txt."),
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
  echo "  KANON TRIADY: primary-* (KAŻDY numer, w tym 100/200/300) i c-accent/var(--c-accent)" >&2
  echo "  to crimson #85182F. CTA/stany aktywne = NEUTRALNE, fokus = c-focus." >&2
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
