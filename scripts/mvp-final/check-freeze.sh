#!/usr/bin/env bash
# check-freeze.sh — BEZPIECZNIK ZAMROŻENIA MVP FINAL.
#
# PO CO: właściciel odbiera MVP moduł po module (05.09) i po swoim „tak" chce mieć pewność,
# że do tego modułu nikt już nie wraca. Bez mechaniki taka obietnica żyje tylko w czyjejś
# pamięci — a pamięć w tym projekcie przegrała już wiele razy. Ten guard zamienia obietnicę
# w twardą bramkę: commit dotykający pliku zamrożonego modułu jest ODRZUCANY.
#
# ODMROŻENIE (jedyna droga): w komunikacie commita musi być znacznik
#     [ODMROZENIE <MODUL> DEC-<numer>]
# np. `fix(czat): pusty stan listy [ODMROZENIE 13_CHAT DEC-318]`
# Znacznik jest świadomy, zostaje w historii git i wskazuje decyzję — czyli odmrożenie
# jest zawsze policzalne i da się je później rozliczyć.
#
# GDZIE JEST WPIĘTY:
#   .husky/commit-msg  — TU BLOKUJE. Tylko commit-msg dostaje PRAWDZIWY komunikat ($1).
#   .husky/pre-commit  — TU TYLKO OSTRZEGA (patrz niżej).
#
# DLACZEGO NIE BLOKUJE W pre-commit (zmierzone 2026-09-05, nie założone):
#   w pre-commit plik .git/COMMIT_EDITMSG zawiera komunikat POPRZEDNIEGO commita
#   (git zapisuje nowy dopiero po tym hooku). Bramka czytająca go w pre-commit
#   przepuszczałaby zmianę na podstawie starego napisu i blokowała na podstawie
#   cudzego — czyli byłaby teatrem. Dlatego blokada siedzi w commit-msg.
#
# Użycie:
#   scripts/mvp-final/check-freeze.sh --commit-msg=<plik>   # tryb blokujący (commit-msg)
#   scripts/mvp-final/check-freeze.sh --tylko-ostrzez       # tryb informacyjny (pre-commit)
#   scripts/mvp-final/check-freeze.sh --pliki a b c [--komunikat="..."]   # do testów
#
# DEC-398 — WYJĄTEK DLA COMMITU SCALAJĄCEGO STAGINGU:
#   `git merge --no-ff <starsza-gałąź>` wnosi w diffu WSZYSTKIE pliki różniące repo od
#   tej gałęzi — także zamrożone — mimo że treść jest już na `origin/staging` (przyjęta
#   wcześniej, merge nic nowego nie odmraża). Gdy druga strona scalenia (MERGE_HEAD) jest
#   już przodkiem `origin/staging`, znaczniki [ODMROZENIE ...] nie są wymagane. Patrz
#   sekcja niżej oznaczona "DEC-398".
#
# Zgodne z bash 3.2 (macOS): bez mapfile, bez declare -A, bez tablic asocjacyjnych.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

# MVP_FINAL_TEST_REJESTR: furtka WYŁĄCZNIE dla testów (checkFreeze.merge.test.mjs) — pozwala
# podmienić ścieżkę rejestru zamrożeń na atrapę w piaskownicy tmp, bez dotykania repo.
# Domyślnie nieaktywna: bez zmiennej zachowanie identyczne jak przed DEC-398.
REJESTR="${MVP_FINAL_TEST_REJESTR:-docs/program/MVP_FINAL_ZAMROZONE.json}"
TRYB="blokuj"
PLIK_KOMUNIKATU=""
KOMUNIKAT=""
JAWNE_PLIKI=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --commit-msg=*) PLIK_KOMUNIKATU="${1#--commit-msg=}" ;;
    --komunikat=*) KOMUNIKAT="${1#--komunikat=}" ;;
    --tylko-ostrzez) TRYB="ostrzegaj" ;;
    --pliki) shift; while [ "$#" -gt 0 ] && [ "${1#--}" = "$1" ]; do JAWNE_PLIKI="$JAWNE_PLIKI
$1"; shift; done; continue ;;
    *) ;;
  esac
  shift
done

# --- DEC-398: WYJĄTEK COMMITU SCALAJĄCEGO STAGINGU ---------------------------------
# Warunek (oba, inaczej reguła zwykła):
#   1) commit jest scalający: istnieje plik $(git rev-parse --git-path MERGE_HEAD)
#   2) druga strona scalenia (SHA z MERGE_HEAD) jest już PRZODKIEM refs/remotes/origin/staging
#      — czyli treść jest już przyjęta na stagingu, merge nic nowego nie odmraża.
# Gdy ref refs/remotes/origin/staging nie istnieje lokalnie (np. brak fetch z origin) →
# wyjątek NIE działa, obowiązuje zwykła reguła (bezpiecznik, który nie może zmierzyć,
# MUSI blokować, a nie przepuszczać — patrz brak node/brak rejestru wyżej/niżej).
MERGE_HEAD_PLIK="$(git rev-parse --git-path MERGE_HEAD 2>/dev/null || true)"
if [ -n "$MERGE_HEAD_PLIK" ] && [ -f "$MERGE_HEAD_PLIK" ]; then
  MERGE_HEAD_SHA="$(tr -d '[:space:]' < "$MERGE_HEAD_PLIK" 2>/dev/null || true)"
  if [ -n "$MERGE_HEAD_SHA" ] \
     && git rev-parse --verify --quiet refs/remotes/origin/staging >/dev/null 2>&1 \
     && git merge-base --is-ancestor "$MERGE_HEAD_SHA" refs/remotes/origin/staging 2>/dev/null; then
    echo "check-freeze: commit scalający stagingu (MERGE_HEAD $MERGE_HEAD_SHA jest na origin/staging) — markery niewymagane (DEC-398)" >&2
    exit 0
  fi
fi
# --- KONIEC WYJĄTKU DEC-398 ---------------------------------------------------------

# Brak rejestru = nic jeszcze nie zamrożone = przepuszczamy (i mówimy to wprost,
# żeby cisza nigdy nie udawała zieleni — „brak pomiaru nie jest wynikiem").
if [ ! -f "$REJESTR" ]; then
  [ "$TRYB" = "blokuj" ] && echo "ℹ mvp-final: brak $REJESTR — żaden moduł nie jest jeszcze zamrożony."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "  ⛔ mvp-final: brak node — nie umiem odczytać rejestru zamrożeń. Commit wstrzymany." >&2
  echo "     (Bezpiecznik, który nie może zmierzyć, MUSI blokować, a nie przepuszczać.)" >&2
  exit 1
fi

# Komunikat commita: --komunikat= ma pierwszeństwo, potem plik z $1/--commit-msg=.
if [ -z "$KOMUNIKAT" ] && [ -n "$PLIK_KOMUNIKATU" ] && [ -f "$PLIK_KOMUNIKATU" ]; then
  KOMUNIKAT="$(cat "$PLIK_KOMUNIKATU")"
fi

# Lista plików: jawna (testy) albo staged.
if [ -n "$JAWNE_PLIKI" ]; then
  PLIKI="$JAWNE_PLIKI"
else
  PLIKI="$(git diff --cached --name-only --diff-filter=ACMRD 2>/dev/null)"
fi

if [ -z "$(printf '%s' "$PLIKI" | tr -d '[:space:]')" ]; then
  exit 0
fi

# Przecięcie staged × rejestr liczy node (JSON bez jq). Wypisuje wiersze "MODUL<TAB>plik".
TRAFIENIA="$(printf '%s\n' "$PLIKI" | node -e '
const fs = require("fs");
const rej = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const mapa = new Map();
for (const [k, w] of Object.entries(rej.moduly || {})) for (const p of w.pliki || []) if (!mapa.has(p)) mapa.set(p, k);
if (rej.wspolne && Array.isArray(rej.wspolne.pliki)) for (const p of rej.wspolne.pliki) if (!mapa.has(p)) mapa.set(p, "WSPOLNE");
let wej = fs.readFileSync(0, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
for (const p of wej) if (mapa.has(p)) console.log(mapa.get(p) + "\t" + p);
' "$REJESTR" 2>/dev/null)"

if [ -z "$TRAFIENIA" ]; then
  exit 0
fi

# Które moduły zostały dotknięte (unikalnie, bez tablic asocjacyjnych).
MODULY_DOTKNIETE="$(printf '%s\n' "$TRAFIENIA" | cut -f1 | sort -u)"

# Czy dla KAŻDEGO dotkniętego modułu jest znacznik odmrożenia w komunikacie.
BRAK_ZNACZNIKA=""
for M in $MODULY_DOTKNIETE; do
  if ! printf '%s' "$KOMUNIKAT" | grep -Eq "\[ODMROZENIE[[:space:]]+$M[[:space:]]+DEC-[0-9]+\]"; then
    BRAK_ZNACZNIKA="$BRAK_ZNACZNIKA $M"
  fi
done

if [ -z "$(printf '%s' "$BRAK_ZNACZNIKA" | tr -d '[:space:]')" ]; then
  echo "✅ mvp-final: commit dotyka modułów zamrożonych ($(printf '%s' "$MODULY_DOTKNIETE" | tr '\n' ' ')), ale ma świadomy znacznik odmrożenia."
  exit 0
fi

if [ "$TRYB" = "ostrzegaj" ]; then
  echo "" >&2
  echo "  ⚠ mvp-final: ten commit rusza pliki ZAMROŻONE jako MVP final." >&2
  printf '%s\n' "$TRAFIENIA" | head -20 | while IFS="$(printf '\t')" read -r M P; do
    echo "     [$M] $P" >&2
  done
  LICZBA="$(printf '%s\n' "$TRAFIENIA" | wc -l | tr -d ' ')"
  [ "$LICZBA" -gt 20 ] && echo "     ... i $((LICZBA - 20)) więcej" >&2
  echo "     Bez znacznika [ODMROZENIE <MODUL> DEC-<numer>] commit zostanie ODRZUCONY w commit-msg." >&2
  echo "" >&2
  exit 0
fi

echo "" >&2
echo "  ⛔ COMMIT ZABLOKOWANY: ruszasz moduł ZAMROŻONY jako MVP final." >&2
echo "     Właściciel odebrał ten moduł i powiedział: „po zatwierdzeniu nie będziesz go już zmieniał\"." >&2
echo "" >&2
printf '%s\n' "$TRAFIENIA" | head -30 | while IFS="$(printf '\t')" read -r M P; do
  echo "     [$M] $P" >&2
done
LICZBA="$(printf '%s\n' "$TRAFIENIA" | wc -l | tr -d ' ')"
[ "$LICZBA" -gt 30 ] && echo "     ... i $((LICZBA - 30)) więcej plików" >&2
echo "" >&2
echo "     JAK ODMROZIĆ (jedyna droga — świadomie, z decyzją):" >&2
for M in $BRAK_ZNACZNIKA; do
  echo "       git commit -m \"<opis zmiany> [ODMROZENIE $M DEC-<numer decyzji>]\"" >&2
done
echo "" >&2
echo "     Numer DEC- to numer decyzji właściciela (rejestr decyzji programu)." >&2
echo "     Bez decyzji: NIE odmrażaj — zgłoś zmianę jako osobną pozycję po MVP." >&2
echo "     Procedura po polsku: docs/program/MVP_FINAL_PROCEDURA.md" >&2
echo "" >&2
exit 1
