#!/usr/bin/env bash
# check-list-canon.sh — TWARDY bezpiecznik zamrożonego standardu tabel (TRIADA).
#
# Powód (2026-07-12): lekkie powłoki (InitiativesLightShell/InterviewLightShell)
# zrobiły WŁASNĄ tabelę zamiast <StandardTable>, degradując zatwierdzony, mrożony
# od pół roku kanon do "tabelek jak dla trzylatka". Poszło hurtem na żywo.
# Ten skrypt blokuje commit, gdzie ekran (poza src/components/standard/) renderuje
# własną listę-tabelę zamiast korzystać ze StandardTable/StandardModuleBar (reguła #1).
#
# ── RATCHET / BASELINE (2026-07-24) ───────────────────────────────────────────
# Do 2026-07-24 bramka działała w trybie "zero tolerancji" na CAŁYM zakresie.
# Skutek uboczny był gorszy niż brak bramki: repo niesie ~190 naruszeń DŁUGU
# ZASTANEGO (te same pliki na origin/demo dają identyczny zbiór), więc bramka
# świeciła NA CZERWONO ZAWSZE. Nikt nie odróżniał NOWEGO naruszenia od starych,
# więc czerwień przestała cokolwiek znaczyć i była przepuszczana — czyli kanon
# tabel przestał być realnie egzekwowany.
#
# Rozwiązanie identyczne jak w scripts/check-artefakt.sh (spójność z repo):
# baseline PER PLIK w scripts/check-list-canon.baseline.txt (format
# `<liczba>\t<ścieżka>`, czytelny dla człowieka — widać, jak dług maleje).
# Bramka FAILuje TYLKO gdy liczba naruszeń w danym pliku ROŚNIE, albo gdy plik
# spoza baseline (baseline = 0) ma >0 naruszeń. Dług zastany przechodzi,
# KAŻDE nowe naruszenie blokuje.
#
# Regeneracja baseline po świadomym sprzątaniu długu: --update
# (regeneruj TYLKO gdy liczba SPADŁA — nigdy żeby ukryć nową regresję).
#
# ── ZERO PLIKÓW ≠ CZYSTO (2026-07-24) ─────────────────────────────────────────
# Poprzednia wersja bez argumentów czytała staged diff; na czystym drzewie
# (np. po commicie) zbiór był pusty, pętla nie sprawdzała NICZEGO, a skrypt
# i tak drukował "✓ brak własnych tabel". Fałszywa zieleń — dokładnie ta sama
# choroba, którą złapano w check-triada.sh (§8 audytu 2026-07-24).
# Teraz: pusty staging → automatyczny PEŁNY skan repo (z jawnym komunikatem),
# a jeśli i tak sprawdzono 0 plików → OSTRZEŻENIE, nie sukces.
#
# Użycie:
#   check-list-canon.sh [pliki...]   # sprawdź podane pliki (tryb hooka)
#   check-list-canon.sh              # staged *.tsx; brak staged → pełny skan repo
#   check-list-canon.sh --all        # wymuś pełny skan zakresu repo
#   check-list-canon.sh --report     # jak wyżej + wypisz KAŻDE miejsce długu
#   check-list-canon.sh --update     # regeneruj baseline z aktualnego stanu
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

BASELINE="scripts/check-list-canon.baseline.txt"

# Normalize a multiline opening <table ...> tag into one logical line before
# checking the §27 exemption. Without this, an exemption placed on the next
# line is invisible while child <thead>/<tbody> nodes are reported as debt.
# Blank lines preserve approximate source line numbering for later findings.
flatten_table_tags() {
  awk '
  {
    line = $0
    if (in_tag) {
      buf = buf " " line
      consumed++
      if (line ~ />/) {
        for (i = 1; i < consumed; i++) print ""
        print buf
        in_tag = 0
        buf = ""
        consumed = 0
      }
      next
    }
    if (line ~ /<table([ \t>\/]|$)/ && line !~ />/) {
      in_tag = 1
      buf = line
      consumed = 1
      next
    }
    print line
  }
  END {
    if (in_tag) {
      for (i = 1; i < consumed; i++) print ""
      print buf
    }
  }
  ' "$1"
}

MODE=""            # "" (auto) | all | update
VERBOSE=0
ARG_FILES_NL=""    # newline-joined — nazwy plików ze spacją nie mogą się rozjechać
for arg in "$@"; do
  case "$arg" in
    --update) MODE="update" ;;
    --all)    MODE="all" ;;
    --report) VERBOSE=1 ;;
    --*) echo "check-list-canon: nieznany argument '$arg' (dozwolone: --all, --update, --report)" >&2; exit 2 ;;
    *) ARG_FILES_NL="${ARG_FILES_NL}${arg}
" ;;
  esac
done

# ── Zakres pełnego skanu ──────────────────────────────────────────────────────
# Historycznie (pre-commit) bramka dostawała WYŁĄCZNIE `^src/components/.*\.tsx$`
# poza `src/components/standard/` — trzymamy ten sam zakres, żeby baseline mierzył
# to samo, co bramka blokuje. Dodatkowo previewStyles.ts (plik .ts) — reguła 3
# dotyczy jego zawartości, więc musi być w zakresie mimo rozszerzenia.
list_scope_files() {
  {
    git ls-files src/components 2>/dev/null \
      | grep -E '\.tsx$' \
      | grep -v '^src/components/standard/'
    git ls-files src/components 2>/dev/null | grep -E '/previewStyles\.ts$'
  } | sort -u
}

# ── Detekcja naruszeń w jednym pliku ──────────────────────────────────────────
# Wypisuje po jednej linii na naruszenie w formacie: <reguła>|<linia>|<opis>.
# Liczba linii = liczba naruszeń pliku (to jest wielkość porównywana z baseline).
# Logika detekcji NIEZMIENIONA względem wersji sprzed baseline'u.
violations_for() {
  local f="$1" bn flat logical_table_lines table_lines unmarked_table all_table_exempt other_hits
  bn=$(basename -- "$f")
  flat=$(flatten_table_tags "$f")

  # 1) surowe prymitywy tabeli w komponencie = zakaz (mają być w StandardTable).
  # Wyjątek: znacznik §27-exempt na otwierającym <table> (archetyp Excel/Platforma-tabel,
  # patrz docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md) — <thead>/<tbody> dziedziczą
  # wyjątek TYLKO gdy WSZYSTKIE <table> w pliku są oznaczone (brak mieszania archetypów
  # w jednym pliku; jeśli choć jeden <table> jest bez znacznika, plik i tak pada).
  logical_table_lines=$(printf '%s\n' "$flat" | grep -nE '<table([ >/]|$)' || true)
  # Keep the ratchet count stable for pre-existing unmarked multiline tables:
  # their child primitives already count as violations in the baseline. The
  # logical form is used to resolve exemptions, while same-line openings keep
  # the historic standalone R1 count.
  table_lines=$(grep -nE '<table[ >/]' "$f" 2>/dev/null || true)
  unmarked_table=""
  if [ -n "$logical_table_lines" ]; then
    unmarked_table=$(printf '%s\n' "$logical_table_lines" | grep -v '§27-exempt' || true)
  fi
  all_table_exempt=0
  if [ -n "$logical_table_lines" ] && [ -z "$unmarked_table" ]; then
    all_table_exempt=1
  fi
  if [ -n "$table_lines" ]; then
    printf '%s\n' "$table_lines" | grep -v '§27-exempt' | while IFS= read -r h; do
      [ -n "$h" ] || continue
      echo "R1|${h%%:*}|surowa tabela <table> bez §27-exempt — użyj <StandardTable>"
    done
  fi

  other_hits=$(printf '%s\n' "$flat" | grep -nE '<thead[ >]|<tbody[ >]|role="table"|role="grid"|role="columnheader"' \
    | grep -v '§27-exempt' || true)
  if [ -n "$other_hits" ] && [ "$all_table_exempt" != "1" ]; then
    printf '%s\n' "$other_hits" | while IFS= read -r h; do
      [ -n "$h" ] || continue
      echo "R1|${h%%:*}|surowy prymityw tabeli (<thead>/<tbody>/role=table) — użyj <StandardTable>"
    done
  fi

  # 2) *LightShell / *Hub renderujący listę (grid+kolumny) BEZ importu ze standard/
  #
  # R2b (2026-07-26, audyt strażników): dla *Hub.tsx samo R2 ("jakikolwiek
  # import ze standard/") jest za słabe — StandardTable SAM wystarcza, żeby
  # przejść, mimo że Menu 1 huba wciąż renderuje się legacy komponentem
  # (shared/ModuleHub zamiast StandardModuleBar). Reguła #1 CLAUDE.md wymaga
  # WSZYSTKICH trzech (StandardModuleBar · StandardTable · StandardPreview).
  # R2b sprawdza konkretnie import StandardModuleBar (nie "cokolwiek ze
  # standard/") dla hubów, które już renderują listę (ten sam trigger co R2:
  # .map + kolumny) — TYLKO *Hub.tsx, nie *LightShell.tsx (inny archetyp,
  # nie zawsze ma własne Menu 1).
  case "$bn" in
    *LightShell.tsx|*Hub.tsx)
      if grep -Eq '\.map\(' "$f" && grep -Eq 'grid-template-columns|gridTemplateColumns|COLUMNS|columns=|columnDefs' "$f"; then
        if ! grep -Eq "from ['\"][^'\"]*standard['\"/]" "$f"; then
          echo "R2|-|renderuje listę kolumnową, ale NIE importuje StandardTable (regresja 2026-07-12)"
        fi
        case "$bn" in
          *Hub.tsx)
            if ! grep -Eq 'StandardModuleBar' "$f"; then
              echo "R2b|-|hub modułu listowego renderuje listę, ale NIE importuje StandardModuleBar — menu legacy (kanon triady reguła #1)"
            fi
            ;;
        esac
      fi
      ;;
  esac

  # 3) previewStyles.ts — pill regression guard (#36, decyzja Piotra D21 07-12:
  # akcje w preview = pill/rounded-full, NIE rounded-lg; to już raz się cofnęło).
  if [ "$bn" = "previewStyles.ts" ]; then
    if grep -A2 "export const PREVIEW_PILL_BASE" "$f" 2>/dev/null | grep -q 'rounded-lg'; then
      echo "R3|-|PREVIEW_PILL_BASE używa rounded-lg zamiast rounded-full (kanon preview, decyzja D21)"
    fi
  fi
}

count_violations() {
  violations_for "$1" | grep -c . || true
}

# ── Widoczność długu R2b (2026-07-26) ────────────────────────────────────────
# R2b jest ratchetowana jak reszta (dług zastany przechodzi, nowe blokuje) —
# ale ratchet z definicji CHOWA istniejący dług w liczbach ("nie rośnie" ≠
# "zero"). Ta funkcja liczy PRAWDZIWY stan menu w hubach list na CAŁYM zakresie
# repo (niezależnie od tego, co akurat jest w $FILES do commitu), żeby dług
# był widoczny w KAŻDYM uruchomieniu, nie tylko przy --report na trafionych
# plikach. Zwraca "legacy total" (spacją).
legacy_menu_hub_summary() {
  local f bn legacy=0 total=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -f "$f" ] || continue
    bn=$(basename -- "$f")
    case "$bn" in *Hub.tsx) : ;; *) continue ;; esac
    grep -Eq '\.map\(' "$f" || continue
    grep -Eq 'grid-template-columns|gridTemplateColumns|COLUMNS|columns=|columnDefs' "$f" || continue
    total=$((total + 1))
    grep -Eq 'StandardModuleBar' "$f" || legacy=$((legacy + 1))
  done < <(list_scope_files)
  echo "$legacy $total"
}

baseline_for() {
  local rel="$1"
  [ -f "$BASELINE" ] || { echo 0; return; }
  awk -F'\t' -v p="$rel" '$2==p{print $1; found=1} END{if(!found) print 0}' "$BASELINE"
}

# Ścieżki obecne w baseline (do domknięcia zbioru przy pełnym skanie — bez tego
# plik, którego dług SPADŁ do zera, wypadłby z prefiltra i suma "baseline"
# w podsumowaniu byłaby zaniżona, czyli dług wyglądałby na mniejszy niż jest).
baseline_paths() {
  [ -f "$BASELINE" ] || return 0
  awk -F'\t' 'NF==2 && $1 ~ /^[0-9]+$/ {print $2}' "$BASELINE"
}

# ── Prefiltr pełnego skanu ────────────────────────────────────────────────────
# Bez niego pełny skan to 4 grepy × 2500 plików (~28 s). Jedno przejście grep -l
# zawęża do kandydatów; pliki *LightShell/*Hub dokładamy zawsze (reguła 2 nie ma
# stałego wzorca treści, więc prefiltr treściowy by ich nie złapał).
narrow_scope() {
  local all="$1"
  {
    printf '%s\n' "$all" | grep -E '(LightShell|Hub)\.tsx$' || true
    printf '%s\n' "$all" | grep -E '/previewStyles\.ts$' || true
    printf '%s\n' "$all" | tr '\n' '\0' \
      | xargs -0 grep -lE '<table[ >/]|<thead[ >]|<tbody[ >]|role="table"|role="grid"|role="columnheader"' 2>/dev/null || true
    baseline_paths
  } | grep -v '^$' | sort -u
}

# ── Wybór zbioru plików do sprawdzenia ────────────────────────────────────────
SOURCE=""
if [ "$MODE" = "update" ] || [ "$MODE" = "all" ]; then
  FILES=$(narrow_scope "$(list_scope_files)")
  SOURCE="pełny skan repo"
elif [ -n "$ARG_FILES_NL" ]; then
  FILES="$ARG_FILES_NL"
  SOURCE="pliki z argumentów"
else
  FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
    | grep -E '^src/components/.*\.tsx$' | grep -v '^src/components/standard/' || true)
  if [ -n "$FILES" ]; then
    SOURCE="staged"
  else
    # ★ Zero plików ≠ "czysto". Zamiast zameldować fałszywą zieleń — pełny skan.
    echo "⚠ check-list-canon: staging pusty — nie ma czego sprawdzić z diffa." >&2
    echo "  Przechodzę na PEŁNY skan repo (--all), żeby nie zameldować fałszywej zieleni." >&2
    FILES=$(narrow_scope "$(list_scope_files)")
    SOURCE="pełny skan repo (fallback z pustego stagingu)"
  fi
fi

# ── --update: regeneracja baseline ────────────────────────────────────────────
if [ "$MODE" = "update" ]; then
  tmp=$(mktemp)
  body=$(mktemp)
  total=0
  nfiles=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -f "$f" ] || continue
    case "$f" in src/components/standard/*) continue;; esac
    n=$(count_violations "$f")
    if [ "$n" -gt 0 ]; then
      printf '%s\t%s\n' "$n" "$f" >> "$body"
      total=$((total + n))
      nfiles=$((nfiles + 1))
    fi
  done < <(printf '%s\n' "$FILES" | sort -u)
  {
    echo "# check-list-canon.sh — BASELINE długu zastanego (ratchet). Format: <liczba>\\t<ścieżka>."
    echo "# Liczba = ile miejsc w pliku łamie kanon tabel (surowy <table>/<thead>/<tbody>/role=table,"
    echo "# LightShell-Hub bez StandardTable, PREVIEW_PILL_BASE rounded-lg)."
    echo "#"
    echo "# Bramka przepuszcza plik dopóki liczba NIE ROŚNIE. Nowe naruszenie (nowy plik albo"
    echo "# wzrost w istniejącym) = commit zablokowany. Regeneruj (--update) TYLKO gdy dług"
    echo "# ŚWIADOMIE SPADŁ — nigdy żeby uciszyć nową regresję."
    echo "#"
    echo "# WYGENEROWANO: $(date +%Y-%m-%d) (scripts/check-list-canon.sh --update)"
    echo "# RAZEM: $total naruszeń w $nfiles plikach"
    echo "#"
    echo "# Posortowane po ścieżce (stabilny diff). Dług maleje = wiersze znikają / liczby spadają."
    sort -k2,2 "$body" 2>/dev/null || true
  } > "$tmp"
  mv "$tmp" "$BASELINE"
  rm -f "$body"
  echo "✓ check-list-canon: baseline zaktualizowany → $BASELINE ($total naruszeń w $nfiles plikach)"
  read -r lm_legacy lm_total <<< "$(legacy_menu_hub_summary)"
  echo "• Huby list z legacy menu (renderują listę, brak importu StandardModuleBar — R2b): $lm_legacy z $lm_total *Hub.tsx"
  exit 0
fi

# ── Tryb sprawdzania ──────────────────────────────────────────────────────────
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
  case "$f" in src/components/standard/*) continue;; esac
  # Poza zakresem (nie-TS/TSX) NIE liczy się do `checked` — inaczej podanie
  # dowolnego pliku (np. README.md) dawałoby "sprawdzono 1" i zieleń bez treści.
  case "$f" in *.tsx|*.ts) : ;; *) continue ;; esac
  checked=$((checked + 1))

  cur=$(count_violations "$f")
  base=$(baseline_for "$f")
  total_current=$((total_current + cur))
  total_baseline=$((total_baseline + base))

  if [ "$cur" -gt "$base" ]; then
    if [ "$base" -eq 0 ]; then
      new_files=$((new_files + 1))
      echo "✗ list-canon: $f — NOWE naruszenie kanonu tabel ($cur, baseline 0)." >&2
    else
      grown_files=$((grown_files + 1))
      echo "✗ list-canon: $f — dług URÓSŁ: $cur naruszeń, baseline $base (+$((cur - base)))." >&2
    fi
    violations_for "$f" | while IFS='|' read -r rule ln desc; do
      echo "      L$ln  [$rule] $desc" >&2
    done
    fail=1
  elif [ "$VERBOSE" = "1" ] && [ "$cur" -gt 0 ]; then
    debt_report="${debt_report}  • $f — $cur (baseline $base)
"
  fi

  # 4) bespoke inline pill classes on preview action buttons outside previewStyles.ts
  #    (OSTRZEŻENIE — nigdy nie blokowało i nie wchodzi do baseline)
  bn=$(basename -- "$f")
  case "$f" in
    src/components/shared/PreviewPane/*|src/components/shared/artifact-actions/*)
      if [ "$bn" != "previewStyles.ts" ] && grep -Eq 'className="[^"]*rounded-lg[^"]*"[^)]*onClick' "$f"; then
        echo "⚠ list-canon: $f — możliwy bespoke przycisk (rounded-lg) w warstwie preview. Użyj actionPillClass()/PreviewActionBar (kanon §7.3b)."
      fi
      ;;
  esac
done < <(printf '%s\n' "$FILES")

if [ "$VERBOSE" = "1" ] && [ -n "$debt_report" ]; then
  echo ""
  echo "── Dług zastany (w baseline, NIE blokuje) ──"
  printf '%s' "$debt_report"
fi

if [ "$checked" -eq 0 ]; then
  # ★ Zero sprawdzonych plików ≠ "czysto" — patrz nagłówek skryptu.
  echo "⚠ check-list-canon: sprawdzono 0 plików — NIC nie zweryfikowano (nie mylić z 'czysto')." >&2
  echo "  Podaj pliki jawnie albo uruchom pełny skan: scripts/check-list-canon.sh --all" >&2
  exit 0
fi

# ★ Dług R2b WIDOCZNY zawsze (nie tylko na --report) — ratchet chowa "dług nie
# rośnie" za liczbami; ta linia mówi wprost ile hubów list ma dziś legacy menu
# (shared/ModuleHub zamiast StandardModuleBar), niezależnie od wyniku bramki.
read -r lm_legacy lm_total <<< "$(legacy_menu_hub_summary)"
echo "• Huby list z legacy menu (renderują listę, brak importu StandardModuleBar — R2b): $lm_legacy z $lm_total *Hub.tsx"

if [ "$fail" -eq 0 ]; then
  echo "✓ check-list-canon: brak NOWYCH naruszeń kanonu tabel (${SOURCE}: $checked plików; naruszeń $total_current, baseline $total_baseline — dług nie rośnie)"
  if [ "$total_current" -lt "$total_baseline" ]; then
    echo "  ↓ Dług SPADŁ o $((total_baseline - total_current)). Zatwierdź spadek: scripts/check-list-canon.sh --update"
  fi
else
  echo "" >&2
  echo "  ⛔ Kanon tabel (CLAUDE.md UI reguła #1): ekran listowy buduje się WYŁĄCZNIE" >&2
  echo "     komponentami src/components/standard/ (StandardTable/StandardModuleBar)." >&2
  echo "     Nowych plików z naruszeniem: $new_files · plików z urosłym długiem: $grown_files." >&2
  echo "     To ta sama klasa błędu co 2026-07-12 ('tabelki jak dla trzylatka')." >&2
  echo "" >&2
  echo "     Wyjścia: (a) osadź <StandardTable>; (b) jeśli to świadomie archetyp Excel/" >&2
  echo "     Platforma-tabel — oznacz otwierający <table> znacznikiem §27-exempt" >&2
  echo "     (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md); (c) jeśli dług ŚWIADOMIE" >&2
  echo "     posprzątany i liczba SPADŁA — scripts/check-list-canon.sh --update." >&2
fi

exit $fail
