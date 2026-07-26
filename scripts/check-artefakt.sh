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
# ── CZĘŚĆ 2 (2026-07-21, fala F4a): reguły SPEC-N §5.2/§5B dla 7 KART N ──
# Poza bezpiecznikiem crimson skrypt sprawdza trzy reguły powłoki kart N
# (SPEC-N §2.3, §2.4, §2.1). Zakres: WYŁĄCZNIE 7 plików pełnych kart
# (lista w karty_n_files) — nie panele boczne list, nie Tool Document.
#
# ── RATCHET PART 2 (2026-07-26) ───────────────────────────────────────────────
# Do 2026-07-26 R2/R3 (reguły BLOKUJĄCE: createPortal / id zarezerwowane w lewej
# nawigacji) były TYLKO raportem — kod wyjścia zmieniał wyłącznie `--strict` /
# `KARTY_N_STRICT=1`, których nikt nie ustawia w CI/pre-commit ⇒ bezpiecznik
# był realnie martwy (audyt gotowości 2026-07-24). Naprawa: RATCHET identyczny
# jak PART 1 (crimson) i check-list-canon.sh — baseline PER PLIK w
# scripts/check-artefakt-n.baseline.txt (format `<liczba>\t<ścieżka>`, liczy
# WYŁĄCZNIE R2+R3, nigdy R1 — patrz niżej). Bramka FAILuje DOMYŚLNIE (bez
# żadnej flagi) gdy suma R2+R3 w danym pliku ROŚNIE ponad baseline, albo plik
# spoza baseline (baseline = 0) ma >0 naruszeń. Dług zastany (dziś: 0 wszędzie)
# przechodzi z ostrzeżeniem, suma długu jest zawsze wypisana.
#
# R1 (solid/filled CTA — OSTRZEŻENIE) NIE wchodzi do baseline/ratchetu: to
# heurystyka niedokładna z natury (patrz uzasadnienie przy kn_solid_hits),
# świadomie ma zostać oceną okiem, nie bramką — pozostaje raportem zawsze.
#
# `--strict`/`KARTY_N_STRICT=1` NIE zmienia się: dodatkowo, ponad ratchet,
# blokuje na CAŁYM istniejącym R2+R3 (zero-tolerance), niezależnie od baseline —
# przygotowanie pod falę Z, która wyłączy strict na stałe (plan §4 pkt 1).
#
# Regeneracja baseline po świadomym sprzątnięciu długu: --update
# (regeneruj TYLKO gdy liczba SPADŁA — nigdy żeby ukryć nową regresję).
#
# Wyjątek per linia: komentarz `karty-n-ok` (analogicznie do `crimson-ok`).
#
# Użycie: check-artefakt.sh [--update] [--strict] [--report]
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

BASELINE="scripts/check-artefakt.baseline.txt"
BASELINE_KN="scripts/check-artefakt-n.baseline.txt"
MODE=""
STRICT="${KARTY_N_STRICT:-0}"
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --update) MODE="--update" ;;
    --strict) STRICT=1 ;;
    --report) VERBOSE=1 ;;
    *) echo "check-artefakt: nieznany argument '$arg' (dozwolone: --update, --strict, --report)" >&2; exit 2 ;;
  esac
done
# Pełna lista plik:linia tylko na żądanie (--report) albo gdy blokujemy (--strict).
# Domyślnie jedna linia podsumowania — hook pre-commit biegnie przy KAŻDYM commicie
# i nie ma zasypywać terminala listą znanego długu przedmigracyjnego.
[ "$STRICT" = "1" ] && VERBOSE=1

# --- Zakres: pliki powłoki artefaktów (SPEC-A), NIE centrum per-archetyp. ---
# Ustalone 1:1 z rzeczywistością repo (2026-07-18):
#   - ArtifactRightPanel.tsx      — prawy panel accordion, wspólny dla A-E
#   - NModeLayout/*                — powłoka archetypu A Canvas ("N Mode")
#   - ExecutiveModuleShell/*       — powłoka archetypów B/D/E (Wordy/Tabele/Prezentacje)
#   - IdeaMapWorkspace.tsx         — powłoka Idea Map (Canvas, MyWork)
#
# Rozszerzenie (Fala 2 Z11, 2026-07-22) — 4 narzędzia IDEE (MyWork):
#   - IdeaRecommendationMap.tsx + mindmap/*      — Mind Map
#   - IdeaWhiteboardTool.tsx + whiteboard/*      — Whiteboard
#   - IdeaProcessFlowTool.tsx + processflow/*    — Process Flow
#   - IdeaTableTool.tsx + table/** (rekursywnie, ma podkatalogi np. table/offline/) — Idea Table
# IDEE tools (Fala 2 Z11, 2026-07-22): dług zamrożony baseline'em, sweep w toku — po scaleniu sweepów baseline → 0
list_scope_files() {
  {
    echo "src/components/standard/ArtifactRightPanel.tsx"
    echo "src/components/MyWork/IdeaMapWorkspace.tsx"
    find src/components/shared/NModeLayout -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
    find src/components/shared/ExecutiveModuleShell -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
    echo "src/components/MyWork/IdeaRecommendationMap.tsx"
    find src/components/MyWork/mindmap -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
    echo "src/components/MyWork/IdeaWhiteboardTool.tsx"
    find src/components/MyWork/whiteboard -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
    echo "src/components/MyWork/IdeaProcessFlowTool.tsx"
    find src/components/MyWork/processflow -maxdepth 1 \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
    echo "src/components/MyWork/IdeaTableTool.tsx"
    find src/components/MyWork/table \( -iname '*.ts' -o -iname '*.tsx' \) ! -iname '*.test.*' 2>/dev/null
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

# Baseline PART 2 (karty N, R2+R3 blokujące — NIE R1). Format identyczny jak
# powyżej: <liczba>\t<ścieżka>, jeden plik osobny baseline (zakres inny niż
# PART 1: 7 kart N, nie powłoka wspólna).
baseline_for_kn() {
  local rel="$1"
  [ -f "$BASELINE_KN" ] || { echo 0; return; }
  awk -F'\t' -v p="$rel" '$2==p{print $1; found=1} END{if(!found) print 0}' "$BASELINE_KN"
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
  echo "✓ check-artefakt: baseline (PART 1, crimson) zaktualizowany → $BASELINE"
  # Nie exit tutaj — --update musi też zregenerować baseline PART 2 (karty N),
  # ale jego funkcje detekcji (kn_portal_hits/kn_reserved_hits) są zdefiniowane
  # niżej w pliku. Blok --update dla PART 2 (z właściwym exit 0) jest zaraz po
  # nich. Normalna pętla-detekcji PART 1 poniżej jest więc pomijana w --update
  # (bo baseline właśnie stał się aktualnym stanem — sprawdzanie byłoby pustym
  # potwierdzeniem samego siebie).
fi

fail=0
total_current=0
total_baseline=0
if [ "$MODE" != "--update" ]; then
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
fi

# =====================================================================
# CZĘŚĆ 2 — REGUŁY KART N (SPEC-N §5.2 / §5B). Raport domyślnie, blok z --strict.
# =====================================================================

# 7 pełnych kart objętych SPEC-N (plan wdrożenia §2 "FALA F", tabela §3 M1-M7).
# NIE panele boczne list, NIE Tool Document (ten jest WYNIKIEM, nie kartą — SPEC-N §0A).
karty_n_files() {
  cat <<'EOF'
src/components/DiscoveryTools/KnownToolDetailView.tsx
src/components/Initiatives/InitiativeDocumentView.tsx
src/components/Interview/InsightViewer.tsx
src/components/Interview/InterviewWorkspace.tsx
src/components/MyWork/DecisionDetailView.tsx
src/components/MyWork/NotificationDetailView.tsx
src/components/MyWork/TaskDetailView.tsx
EOF
}

# Klasy pełnego tła Tailwind, które czytają się jako solid/filled CTA.
# `primary-*` celowo POMINIĘTE — łapie je już bezpiecznik crimson wyżej.
SOLID_BG='bg-(teal|blue|indigo|emerald|green|purple|violet|amber|orange|cyan|sky|rose|navy)-(500|600|700|900)'

kn_report=0        # liczba naruszeń reguł BLOKUJĄCYCH (2 i 3), suma AKTUALNA
kn_warn=0          # liczba naruszeń reguły OSTRZEGAWCZEJ (1) — nigdy w baseline
kn_fail=0          # 1 = ratchet PART 2 wykrył wzrost R2+R3 w którymś pliku
kn_total_baseline=0  # suma baseline R2+R3 (do komunikatu "dług nie rośnie")

# --- Reguła 1 (OSTRZEŻENIE) — drugi solid/filled CTA poza slotem primary. ---
# SPEC-N §2.3: „Poza tym jednym slotem żaden element nie może być stylowany jako
# solid/filled CTA". Realny przypadek: Insight ma solid-teal „AI Consultant"
# w toolbarze, konkurujący wizualnie z primary w nagłówku.
#
# Dlaczego OSTRZEŻENIE, a nie blokada — dwa powody, oba realne:
#  (a) grep po klasach NIE odróżnia jedynego DOZWOLONEGO primary od drugiego
#      solid-CTA; widzi tylko „tu jest solid przycisk". Rozstrzygnięcie, który
#      jest tym sankcjonowanym, wymaga typu (`primaryAction`, F1), nie regexpa.
#  (b) heurystyka kształtu (padding+zaokrąglenie) odsiewa awatary i mapy badge'ów,
#      ale nie gwarantuje tego na kodzie, którego jeszcze nie widziałem.
# Dlatego ta reguła NIE blokuje nawet w --strict; jest listą do obejrzenia okiem.
kn_solid_hits() {
  local f="$1"
  {
    # (a) nazwane komponenty solid z powłoki (np. ToolbarAISolidButton) — sygnał pewny
    grep -nE '<[A-Z][A-Za-z0-9]*Solid[A-Za-z0-9]*' "$f" 2>/dev/null
    # (b) inline: pełne tło + biały tekst + kształt przycisku (padding poziomy + zaokrąglenie)
    grep -nE "$SOLID_BG" "$f" 2>/dev/null \
      | grep 'text-white' | grep 'className' | grep -E '\bpx-' | grep -E 'rounded'
  } | grep -v 'karty-n-ok' | sort -t: -k1,1n
}

# --- Reguła 2 (BLOKADA) — createPortal wynoszący chrome poza powłokę. ---
# SPEC-N §2.4: powłoka nie ma pozwalać na wyjście toolbara na zewnątrz.
# Realny przypadek (poza tą siódemką): ToolDocumentView portalował CAŁY toolbar
# poza NModeShell, stylując go jak kebab wiersza listy. W 7 kartach: zakaz.
kn_portal_hits() {
  grep -nE '\bcreatePortal\b' "$1" 2>/dev/null | grep -v 'karty-n-ok'
}

# --- Reguła 3 (BLOKADA) — zarezerwowane id sekcji w LEWEJ nawigacji. ---
# SPEC-N §2.1: `comments` · `history` · `activity-log` NIE MOGĄ być sekcją lewej
# kolumny — należą wyłącznie do prawego panelu. Realny przypadek: Decision
# renderuje komentarze w lewej nawigacji I w panelu jednocześnie; Task,
# Notification, Initiative, Insight tak samo.
#
# KLUCZOWE rozróżnienie: te same id w PRAWYM panelu są WYMAGANE (§2.2 — rekord
# o stałych kluczach actions/properties/relations/comments/history). Ślepy grep
# po `id: 'comments'` zgłaszałby jako błąd dokładnie to, czego standard wymaga.
# Dyskryminator ustalony na realnym kodzie: wpisy prawego panelu
# (ArtifactRightPanel) mają `defaultOpen` i `children`; wpisy lewej nawigacji
# nigdy ich nie mają (mają `cSpan`/`component`).
#
# Okno oglądania = od linii `id:` maksymalnie 8 linii w dół, ale URWANE na
# NASTĘPNYM `id:`. Bez tego urwania wpis jednoliniowy (np. lewa nawigacja
# Insight :762) „widziałby" `defaultOpen` z kolejnego, sąsiedniego wpisu
# prawego panelu i zostałby błędnie uznany za zgodny — czyli cichy fałszywy
# negatyw, gate przepuszczałby realne naruszenie.
kn_reserved_hits() {
  local f="$1" ln shape
  while IFS=: read -r ln _; do
    [ -n "$ln" ] || continue
    # (1) sama linia `id:` — wpis jednoliniowy może mieć `defaultOpen` tuż obok,
    # (2) linie poniżej, urwane na następnym `id:` — wpis wieloliniowy.
    shape=$(( $(sed -n "${ln}p" "$f" | grep -cE '(defaultOpen|children)[[:space:]]*[:=]') \
            + $(sed -n "$((ln + 1)),$((ln + 8))p" "$f" \
                  | awk '/(id|key|sectionId)[[:space:]]*:/{exit} {print}' \
                  | grep -cE '(defaultOpen|children)[[:space:]]*[:=]') ))
    # ma defaultOpen/children ⇒ to prawy panel ⇒ zgodne ze standardem, pomijamy
    [ "$shape" -gt 0 ] && continue
    printf '%s:%s\n' "$ln" "$(sed -n "${ln}p" "$f" | sed 's/^[[:space:]]*//')"
  done < <(grep -nE "(id|key|sectionId)[[:space:]]*:[[:space:]]*'(comments|history|activity-log)'" "$f" 2>/dev/null \
             | grep -v 'karty-n-ok')
}

# --update PART 2 (karty N): regeneruje scripts/check-artefakt-n.baseline.txt
# z sumy R2 (createPortal) + R3 (id zarezerwowane) per plik. R1 (solid CTA,
# ostrzeżenie) celowo NIE wchodzi do baseline — patrz nagłówek pliku.
if [ "$MODE" = "--update" ]; then
  tmp_kn=$(mktemp)
  echo "# check-artefakt-n.baseline.txt — regenerowany --update. Format: <liczba>\\t<ścieżka>." > "$tmp_kn"
  echo "# Liczy WYŁĄCZNIE reguły BLOKUJĄCE PART 2: R2 (createPortal, SPEC-N §2.4) + R3" >> "$tmp_kn"
  echo "# (id zarezerwowane w lewej nawigacji, SPEC-N §2.1). R1 (solid CTA, ostrzeżenie," >> "$tmp_kn"
  echo "# §2.3) NIE wchodzi tu nigdy — pozostaje raportem zawsze (heurystyka niedokładna" >> "$tmp_kn"
  echo "# z natury, patrz komentarz przy kn_solid_hits w check-artefakt.sh)." >> "$tmp_kn"
  echo "# Regeneruj TYLKO po świadomym sprzątnięciu długu, nigdy żeby ukryć nową regresję." >> "$tmp_kn"
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    n=$(( $(kn_portal_hits "$f" | grep -c . || true) + $(kn_reserved_hits "$f" | grep -c . || true) ))
    [ "$n" -gt 0 ] && printf '%s\t%s\n' "$n" "$f" >> "$tmp_kn"
  done < <(karty_n_files)
  mv "$tmp_kn" "$BASELINE_KN"
  echo "✓ check-artefakt: baseline (PART 2, karty N) zaktualizowany → $BASELINE_KN"
  exit 0
fi

if [ "$VERBOSE" = "1" ]; then
  echo ""
  if [ "$STRICT" = "1" ]; then
    echo "── Karty N (SPEC-N §5B) — tryb STRICT: naruszenia R2 i R3 BLOKUJĄ ──"
  else
    echo "── Karty N (SPEC-N §5B) — tryb RAPORTU: wypisuję, nie blokuję ──"
  fi
fi

while IFS= read -r f; do
  [ -f "$f" ] || { echo "  ? karty N: $f — pliku nie ma na tej gałęzi (sprawdź listę zakresu)" >&2; continue; }

  n_solid=$(kn_solid_hits "$f" | grep -c . || true)
  n_portal=$(kn_portal_hits "$f" | grep -c . || true)
  n_reserved=$(kn_reserved_hits "$f" | grep -c . || true)
  kn_warn=$((kn_warn + n_solid))
  kn_report=$((kn_report + n_portal + n_reserved))

  # Ratchet PART 2 (domyślny, bez --strict): FAIL gdy R2+R3 w TYM pliku rośnie
  # ponad baseline. Drukuje się zawsze (niezależnie od --report), bo to jest
  # sygnał blokujący, nie tylko informacyjny — analogicznie do PART 1 wyżej.
  cur_kn=$((n_portal + n_reserved))
  base_kn=$(baseline_for_kn "$f")
  kn_total_baseline=$((kn_total_baseline + base_kn))
  if [ "$cur_kn" -gt "$base_kn" ]; then
    echo "✗ check-artefakt (karty N): $f — $cur_kn naruszeń R2+R3 (baseline $base_kn). Nowa regresja createPortal (§2.4) / id zarezerwowane w lewej nawigacji (§2.1)." >&2
    kn_fail=1
  fi

  [ "$VERBOSE" = "1" ] || continue
  [ "$n_solid" -eq 0 ] && [ "$n_portal" -eq 0 ] && [ "$n_reserved" -eq 0 ] && continue
  echo "  $f"

  if [ "$n_solid" -gt 0 ]; then
    echo "    ⚠ R1 solid/filled CTA poza slotem primary — $n_solid (SPEC-N §2.3; OSTRZEŻENIE, do oceny okiem)"
    kn_solid_hits "$f" | while IFS= read -r h; do echo "        L${h%%:*}"; done
  fi
  if [ "$n_portal" -gt 0 ]; then
    echo "    ✗ R2 createPortal w powłoce karty — $n_portal (SPEC-N §2.4)"
    kn_portal_hits "$f" | while IFS= read -r h; do echo "        L${h%%:*}"; done
  fi
  if [ "$n_reserved" -gt 0 ]; then
    echo "    ✗ R3 zarezerwowane id sekcji w lewej nawigacji — $n_reserved (SPEC-N §2.1)"
    kn_reserved_hits "$f" | while IFS= read -r h; do echo "        L$h"; done
  fi
done < <(karty_n_files)

if [ "$kn_fail" -eq 1 ]; then
  echo "" >&2
  echo "  ✗ check-artefakt (karty N, ratchet PART 2): R2+R3 rośnie w co najmniej jednym pliku — patrz ✗ wyżej." >&2
  echo "  Napraw: createPortal → sloty NModeShell (§2.4); comments/history/activity-log → prawy panel (§2.1)." >&2
  echo "  Jeśli to świadome sprzątnięcie długu W INNYM pliku (suma spadła), zaktualizuj: scripts/check-artefakt.sh --update" >&2
elif [ "$kn_report" -eq 0 ] && [ "$kn_warn" -eq 0 ]; then
  echo "✓ karty N (SPEC-N §5B): brak naruszeń reguł R1-R3"
elif [ "$VERBOSE" = "1" ]; then
  echo "  Razem: R1 (ostrzeżeń) $kn_warn · R2+R3 aktualnie $kn_report / baseline $kn_total_baseline (blokujące, ratchet — dług nie rośnie)"
else
  echo "• karty N (SPEC-N §5B): R1 ostrzeżeń $kn_warn · R2+R3 aktualnie $kn_report / baseline $kn_total_baseline (dług istniejący, ratchet nie rośnie — nie blokuje; szczegóły: --report)"
fi

if [ "$kn_fail" -eq 1 ]; then
  fail=1
fi

if [ "$STRICT" = "1" ] && [ "$kn_report" -gt 0 ]; then
  echo "" >&2
  echo "  ✗ check-artefakt --strict: $kn_report naruszeń reguł blokujących kart N (zero-tolerance, niezależnie od baseline)." >&2
  echo "  Napraw: createPortal → sloty NModeShell (§2.4); comments/history/activity-log → prawy panel (§2.1)." >&2
  fail=1
fi

exit $fail
