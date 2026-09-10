#!/usr/bin/env bash
# retag-zamrozenia-20260910.sh — RE-TAG ZAMROŻENIA MVP (S1.11), partia 10.09.2026.
#
# PO CO: tagi `mvp-final-<MODUL>-20260905` opisują kod sprzed 1764–1844 commitów, a moduły
# 09_RESULTS i 10_FINANCE mają tylko tagi z 02.09 (3312–3322 commitów wstecz). „Zamrożenie",
# które wskazuje stan sprzed tygodnia, jest formalnością, nie bezpiecznikiem. Ten skrypt
# zakłada NOWĄ, LOKALNĄ partię tagów `mvp-final-<MODUL>-<DATA>` na wskazanym SHA i dopisuje
# do rejestru `docs/program/MVP_FINAL_ZAMROZONE.json` adnotację `retag` — ADDYTYWNIE, bez
# kasowania oryginalnego wpisu z odbioru właściciela (jego słowa z 05.09 zostają nietknięte).
#
# CZEGO TEN SKRYPT NIE ROBI (świadomie):
#   * NIE pushuje niczego (`git push --tags` robi wyłącznie nadzorca sesji głównej);
#   * NIE przelicza list plików per moduł — to robi `zamroz.mjs --nadpisz`, które wymaga
#     świeżych zrzutów-wzorców i nadpisuje słowa właściciela. Skutek: pliki dodane po 05.09
#     NIE są objęte bezpiecznikiem `check-freeze.sh`. To znany dług — patrz „STOP" na końcu wydruku;
#   * NIE zakłada tagów dla modułów, których NIE MA w rejestrze (09_RESULTS, 10_FINANCE) —
#     tag bez wpisu w rejestrze niczego nie chroni i dawałby fałszywe zielone światło.
#
# DEC-466 (właściciel 10.09 21:55 i 22:35): Inicjatywy i Realizacja przepuszczone WARUNKOWO
# („narzędzia są, ale nie są jeszcze dobre, poprawimy je w fali 2"). Dlatego 05_INITIATIVES
# i 06_EXECUTION dostają w rejestrze `retag.warunkowe = true` z cytatem i odsyłaczem do
# programów fali 2: 3.19 i 3.20.
#
# UŻYCIE:
#   scripts/dev/retag-zamrozenia-20260910.sh                        # DRY-RUN (domyślnie)
#   scripts/dev/retag-zamrozenia-20260910.sh --sha=ff3ae0dbde       # dry-run na konkretnym SHA
#   scripts/dev/retag-zamrozenia-20260910.sh --apply                # zakłada LOKALNE tagi + rejestr
#   scripts/dev/retag-zamrozenia-20260910.sh --apply --sha=<sha> --data=20260911
#
# FLAGI:
#   --sha=<ref>    commit/tag/gałąź, na którym stają tagi (domyślnie `staging-deployed`)
#   --data=YYYYMMDD  data w nazwie tagu (domyślnie 20260910)
#   --apply        wykonaj (bez tego: tylko pokaż, co by się stało)
#   --bez-rejestru nie ruszaj JSON-a (same tagi)
#   --nadpisz      pozwól nadpisać istniejący tag tej samej nazwy (`git tag -f`)
#
# IDEMPOTENCJA: drugi przebieg z `--apply` nie zmienia nic — istniejące tagi na tym samym
# SHA są pomijane, a wpisy `retag` w rejestrze nadpisywane tą samą treścią (plik bajt w bajt).
#
# Zgodne z bash 3.2 (macOS): bez mapfile, bez tablic asocjacyjnych.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

REJESTR="docs/program/MVP_FINAL_ZAMROZONE.json"
SHA_REF="staging-deployed"
DATA="20260910"
APPLY=0
BEZ_REJESTRU=0
NADPISZ=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --sha=*)        SHA_REF="${1#--sha=}" ;;
    --data=*)       DATA="${1#--data=}" ;;
    --apply)        APPLY=1 ;;
    --bez-rejestru) BEZ_REJESTRU=1 ;;
    --nadpisz)      NADPISZ=1 ;;
    -h|--help)      sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "⛔ Nieznany argument: $1 (użyj --help)" >&2; exit 2 ;;
  esac
  shift
done

case "$DATA" in
  [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "⛔ --data musi mieć postać YYYYMMDD (dostałem: $DATA)" >&2; exit 2 ;;
esac

command -v node >/dev/null 2>&1 || { echo "⛔ brak node — nie odczytam rejestru. Przerywam." >&2; exit 1; }
[ -f "$REJESTR" ] || { echo "⛔ brak $REJESTR — nie ma czego re-tagować. Przerywam." >&2; exit 1; }

# --- rozwiązanie SHA ---------------------------------------------------------
if ! CEL_SHA="$(git rev-parse --verify --quiet "${SHA_REF}^{commit}")"; then
  echo "⛔ Nie umiem rozwiązać --sha=$SHA_REF na commit." >&2
  echo "   Jeśli to tag zdalny: git fetch --tags --force origin" >&2
  exit 1
fi
CEL_KROTKI="$(git rev-parse --short=10 "$CEL_SHA")"
CEL_OPIS="$(git log -1 --format='%s' "$CEL_SHA" | cut -c1-90)"

echo "═══════════════════════════════════════════════════════════════════════════"
echo " RE-TAG ZAMROŻENIA MVP — S1.11"
[ "$APPLY" -eq 1 ] && echo " TRYB: APPLY (zakładam tagi LOKALNE, bez push)" || echo " TRYB: DRY-RUN (nic nie zapisuję)"
echo " Wskazany ref : $SHA_REF"
echo " Rozwiązany   : $CEL_KROTKI  — $CEL_OPIS"
echo " Data w tagu  : $DATA"
echo " Rejestr      : $REJESTR"
echo "═══════════════════════════════════════════════════════════════════════════"

# Ostrzeżenie o nieświeżym tagu lokalnym: `staging-deployed` przesuwa workflow na GitHubie,
# lokalna kopia bywa o partię do tyłu. Bezpiecznik, który nie może zmierzyć, ma mówić głośno.
if [ "$SHA_REF" = "staging-deployed" ]; then
  echo ""
  echo '⚠ UWAGA: staging-deployed to tag przesuwany przez workflow na GitHubie.'
  echo "  Lokalna kopia bywa nieaktualna (10.09 wskazywała b85398b174, gdy staging miał ff3ae0dbde)."
  echo "  Zanim uruchomisz --apply:  git fetch --tags --force origin"
  echo "  i porównaj z odczytem:     curl -s https://staging.consultify.ai/api/health"
fi

# Czy cel jest przodkiem HEAD — jeśli nie, tagujemy coś spoza tej linii pracy.
if ! git merge-base --is-ancestor "$CEL_SHA" HEAD 2>/dev/null; then
  echo ""
  echo "⚠ $CEL_KROTKI NIE jest przodkiem HEAD ($(git rev-parse --short=10 HEAD))."
  echo "  Tagujesz stan spoza bieżącej linii integracyjnej — upewnij się, że tak chcesz."
fi

# --- moduły z rejestru -------------------------------------------------------
MODULY_W_REJESTRZE="$(node -e '
const rej = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const k of Object.keys(rej.moduly || {})) console.log(k);
' "$REJESTR" | sort)"

WSZYSTKIE_MODULY="$(node -e '
import("./scripts/mvp-final/moduly.mjs").then((m) => {
  for (const k of Object.keys(m.MODULY)) console.log(k);
});
' 2>/dev/null | sort)"

echo ""
echo "── Moduły ────────────────────────────────────────────────────────────────"
LICZ_NOWE=0; LICZ_ISTNIEJE=0; LICZ_KOLIZJA=0
DO_ZALOZENIA=""

for M in $MODULY_W_REJESTRZE; do
  TAG="mvp-final-${M}-${DATA}"
  WARUNEK=""
  case "$M" in
    05_INITIATIVES|06_EXECUTION) WARUNEK="  [WARUNKOWE — DEC-466]" ;;
  esac

  STARY_TAG="$(node -e '
    const rej = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String((rej.moduly[process.argv[2]] || {}).tag || "—"));
  ' "$REJESTR" "$M")"
  STARY_SHA="$(node -e '
    const rej = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String((rej.moduly[process.argv[2]] || {}).commit || "").slice(0, 10) || "—");
  ' "$REJESTR" "$M")"
  ZALEGLOSC="—"
  if [ -n "$STARY_SHA" ] && [ "$STARY_SHA" != "—" ]; then
    ZALEGLOSC="$(git rev-list --count "${STARY_SHA}..${CEL_SHA}" 2>/dev/null || echo '?')"
  fi

  if ISTN="$(git rev-parse --verify --quiet "refs/tags/${TAG}^{commit}")"; then
    if [ "$ISTN" = "$CEL_SHA" ]; then
      printf "  = %-22s %s → %s  (tag już jest na tym SHA — pomijam)%s\n" "$M" "$STARY_SHA" "$CEL_KROTKI" "$WARUNEK"
      LICZ_ISTNIEJE=$((LICZ_ISTNIEJE + 1))
      continue
    fi
    printf "  ! %-22s tag %s istnieje na INNYM SHA (%s)%s\n" "$M" "$TAG" "$(git rev-parse --short=10 "$ISTN")" "$WARUNEK"
    if [ "$NADPISZ" -eq 1 ]; then
      echo "      → --nadpisz: przestawię na $CEL_KROTKI"
      DO_ZALOZENIA="$DO_ZALOZENIA $M"
      LICZ_NOWE=$((LICZ_NOWE + 1))
    else
      echo "      → POMIJAM (dodaj --nadpisz, jeśli świadomie przestawiasz)"
      LICZ_KOLIZJA=$((LICZ_KOLIZJA + 1))
    fi
    continue
  fi

  printf "  + %-22s %s → %s  (nadrabia %s commitów; stary tag: %s)%s\n" \
    "$M" "$STARY_SHA" "$CEL_KROTKI" "$ZALEGLOSC" "$STARY_TAG" "$WARUNEK"
  DO_ZALOZENIA="$DO_ZALOZENIA $M"
  LICZ_NOWE=$((LICZ_NOWE + 1))
done

# --- moduły spoza rejestru ---------------------------------------------------
BRAKUJACE=""
for M in $WSZYSTKIE_MODULY; do
  echo "$MODULY_W_REJESTRZE" | grep -qx "$M" || BRAKUJACE="$BRAKUJACE $M"
done

if [ -n "$(printf '%s' "$BRAKUJACE" | tr -d '[:space:]')" ]; then
  echo ""
  echo "── Moduły BEZ wpisu w rejestrze (NIE tagowane) ───────────────────────────"
  for M in $BRAKUJACE; do
    printf "  ⛔ %-22s brak w %s — bezpiecznik check-freeze NIE chroni tego modułu\n" "$M" "$REJESTR"
  done
  echo ""
  echo "  Te moduły nigdy nie przeszły przez zamroz.mjs. Istnieją dla nich tylko starsze tagi"
  echo "  z 02.09 (modul-09-wyniki-final-20260902 / modul-10-finanse-final-20260902), które NIE"
  echo "  mają listy plików, więc niczego nie blokują. Sam tag tego nie naprawi."
  echo "  Domknięcie S1.11 wymaga dla każdego z nich (po „tak\" właściciela):"
  for M in $BRAKUJACE; do
    echo "      node scripts/mvp-final/zamroz.mjs --modul=$M --decyzja=\"<słowa właściciela>\" --data=$DATA"
  done
fi

# --- WSPOLNE -----------------------------------------------------------------
WSPOLNE_STAN="$(node -e '
const rej = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
process.stdout.write(rej.wspolne ? "jest" : "brak");
' "$REJESTR")"
if [ "$WSPOLNE_STAN" = "brak" ]; then
  echo ""
  echo "── Kanon i komponenty wspólne ────────────────────────────────────────────"
  echo "  ⛔ wpis \"wspolne\" w rejestrze = null. Pliki z src/components/standard/, shared/, ui/,"
  echo "     store/, services/api, i18n NIE są objęte żadnym zamrożeniem — a to one łamią kanon"
  echo "     najczęściej (krach 07-12). Do rozstrzygnięcia z właścicielem:"
  echo "      node scripts/mvp-final/zamroz.mjs --modul=WSPOLNE --decyzja=\"<słowa właściciela>\" --data=$DATA"
fi

echo ""
echo "── Podsumowanie ──────────────────────────────────────────────────────────"
echo "  do założenia : $LICZ_NOWE"
echo "  już na celu  : $LICZ_ISTNIEJE"
echo "  kolizje      : $LICZ_KOLIZJA"
echo "  bez rejestru : $(printf '%s' "$BRAKUJACE" | wc -w | tr -d ' ')"

if [ "$APPLY" -eq 0 ]; then
  echo ""
  echo "DRY-RUN — nic nie zapisano. Aby wykonać:"
  echo "  $0 --apply --sha=$SHA_REF --data=$DATA"
  exit 0
fi

# =============================== APPLY =======================================
echo ""
echo "── APPLY ─────────────────────────────────────────────────────────────────"

CYTAT_DEC466='DEC-466 (10.09.2026, 21:55 i 22:35): "przepuszczamy warunkowo inicjatywy i execution" oraz "narzedzia sa, ale nie sa jeszcze dobre, poprawimy je w fali 2". Warunek: konto wlasciciela zasiane we wszystkich modulach (S-1). Fala 2: 3.19 dopracowanie Inicjatyw/Realizacji, 3.20 proces zatwierdzania inicjatyw (DEC-465).'
POWOD_RETAG="Re-tag partii 10.09.2026 (S1.11): tagi z 20260905 wskazywaly kod sprzed ~1765 commitow. Nowy punkt = ${CEL_KROTKI} (staging po partii 3). Zamrozenie odswiezone po odbiorze wlasciciela DEC-452/DEC-466; listy plikow NIE byly przeliczane (patrz naglowek scripts/dev/retag-zamrozenia-20260910.sh)."

ZALOZONE=0
for M in $DO_ZALOZENIA; do
  TAG="mvp-final-${M}-${DATA}"
  MSG="MVP final re-tag ${M} — ${DATA} — ${CEL_KROTKI}"
  case "$M" in
    05_INITIATIVES|06_EXECUTION) MSG="$MSG — WARUNKOWE (DEC-466)" ;;
  esac
  if [ "$NADPISZ" -eq 1 ]; then
    git tag -f -a "$TAG" "$CEL_SHA" -m "$MSG" >/dev/null 2>&1 && { echo "  ✅ $TAG → $CEL_KROTKI"; ZALOZONE=$((ZALOZONE + 1)); } \
      || echo "  ⚠ nie udało się założyć $TAG"
  else
    git tag -a "$TAG" "$CEL_SHA" -m "$MSG" >/dev/null 2>&1 && { echo "  ✅ $TAG → $CEL_KROTKI"; ZALOZONE=$((ZALOZONE + 1)); } \
      || echo "  ⚠ nie udało się założyć $TAG"
  fi
done
echo "  tagów założonych: $ZALOZONE (LOKALNIE — bez push)"

if [ "$BEZ_REJESTRU" -eq 1 ]; then
  echo "  ℹ rejestr nietknięty (--bez-rejestru)"
else
  node - "$REJESTR" "$DATA" "$CEL_SHA" "$CEL_KROTKI" "$POWOD_RETAG" "$CYTAT_DEC466" <<'NODE'
const fs = require('fs');
const [plik, data, sha, shaKrotki, powod, cytat] = process.argv.slice(2);
const rej = JSON.parse(fs.readFileSync(plik, 'utf8'));
const warunkowe = new Set(['05_INITIATIVES', '06_EXECUTION']);
let n = 0;
for (const [klucz, wpis] of Object.entries(rej.moduly || {})) {
  wpis.retag = {
    data,
    tag: `mvp-final-${klucz}-${data}`,
    commit: sha,
    commit_krotki: shaKrotki,
    powod,
    warunkowe: warunkowe.has(klucz),
    ...(warunkowe.has(klucz) ? { warunek: cytat } : {}),
    pliki_przeliczone: false,
  };
  n += 1;
}
rej._zaktualizowano = `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}`;
fs.writeFileSync(plik, JSON.stringify(rej, null, 1) + '\n');
console.log(`  ✅ rejestr: dopisana adnotacja "retag" do ${n} modułów (wpisy z 05.09 nietknięte)`);
NODE
fi

echo ""
echo "── STOP-y do rozliczenia przez CTO ───────────────────────────────────────"
echo "  1. Listy plików per moduł pochodzą z 05.09 — pliki dodane później NIE są chronione"
echo "     przez check-freeze.sh. Przeliczenie = zamroz.mjs --nadpisz (nadpisuje słowa właściciela)."
echo "  2. 09_RESULTS i 10_FINANCE nie mają wpisu w rejestrze — S1.11 nie jest domknięte bez nich."
echo "  3. \"wspolne\" = null — kanon i komponenty wspólne bez zamrożenia."
echo "  4. Tagi są LOKALNE. Push wyłącznie decyzją nadzorcy sesji głównej:"
echo "       git push origin \$(git tag -l 'mvp-final-*-$DATA' | tr '\\n' ' ')"
echo "  5. Zacommituj rejestr (bezpiecznik pilnuje src/, nie docs/):"
echo "       git add $REJESTR && git commit -m \"zamrozenie(retag $DATA): 14 modulow na $CEL_KROTKI\""
