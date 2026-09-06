#!/usr/bin/env bash
# =============================================================================
# scripts/demo/przywroc-baze.sh — przywrócenie bazy z manifestu kopii.
#
# UŻYCIE
#   DATABASE_URL="postgresql://..." bash scripts/demo/przywroc-baze.sh \
#     --manifest /private/tmp/dumps/demo-...manifest.json \
#     --oczekiwany-host trolley \
#     [--sprawdz-tylko] [--tak-nadpisz]
#
# TRZY BRAMKI, KTÓRE MUSZĄ PRZEJŚĆ RAZEM
#   1. cel ≠ produkcja (centerbeam),
#   2. host celu zawiera --oczekiwany-host,
#   3. sha256 pliku zgadza się z manifestem — kopia, której nie da się
#      zweryfikować, NIE jest kopią (pamięć nadzorcy: „dowód poza repo wyparowuje").
#
#   Dodatkowo zapis wymaga jawnego --tak-nadpisz. Bez niego skrypt kończy
#   po weryfikacji (tryb --sprawdz-tylko jest domyślny).
#
# CO ROBI PRZY --tak-nadpisz
#   pg_restore --clean --if-exists --no-owner --no-privileges do WSKAZANEJ bazy.
#   `--clean` kasuje obiekty o tych samych nazwach — dlatego bramka hosta jest
#   obowiązkowa i dlatego domyślny tryb NIC nie pisze.
# =============================================================================

set -euo pipefail
TU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/demo/_wspolne.sh
source "$TU/_wspolne.sh"

MANIFEST=""
ODCISK=""
NADPISZ=0

while [ $# -gt 0 ]; do
  case "$1" in
    --manifest) MANIFEST="$2"; shift 2 ;;
    --oczekiwany-host) ODCISK="$2"; shift 2 ;;
    --tak-nadpisz) NADPISZ=1; shift ;;
    --sprawdz-tylko) NADPISZ=0; shift ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) blad "nieznany argument: $1" ;;
  esac
done

[ -n "${DATABASE_URL:-}" ] || blad "brak DATABASE_URL."
[ -n "$MANIFEST" ] || blad "brak --manifest."
[ -f "$MANIFEST" ] || blad "manifest nie istnieje: $MANIFEST"

PLIK="$(node -e 'console.log(require(process.argv[1]).plik)' "$MANIFEST")"
SHA_OCZ="$(node -e 'console.log(require(process.argv[1]).sha256)' "$MANIFEST")"
ROZ_OCZ="$(node -e 'console.log(require(process.argv[1]).rozmiar_bajty)' "$MANIFEST")"
ZRODLO="$(node -e 'console.log(require(process.argv[1]).zrodlo)' "$MANIFEST")"

[ -f "$PLIK" ] || blad "plik kopii z manifestu NIE ISTNIEJE: $PLIK (manifest bez pliku nie jest dowodem)."

SHA_JEST="$(sha256_pliku "$PLIK")"
ROZ_JEST="$(rozmiar_pliku "$PLIK")"
[ "$SHA_JEST" = "$SHA_OCZ" ] || blad "sha256 pliku NIE ZGADZA SIĘ z manifestem (jest $SHA_JEST, ma być $SHA_OCZ). STOP."
[ "$ROZ_JEST" = "$ROZ_OCZ" ] || blad "rozmiar pliku nie zgadza się z manifestem ($ROZ_JEST vs $ROZ_OCZ). STOP."

TOZ="$(tozsamosc_url "$DATABASE_URL")"
bramka_produkcji "$TOZ"
bramka_celu "$TOZ" "$ODCISK"

komunikat "manifest OK: $PLIK ($ROZ_JEST B, sha256 $SHA_JEST)"
komunikat "zrzut pochodzi z: $ZRODLO"
komunikat "cel przywrócenia:  $TOZ"

if [ "$NADPISZ" -ne 1 ]; then
  komunikat "TRYB SPRAWDZENIA — nic nie zapisano. Aby przywrócić, powtórz z --tak-nadpisz."
  exit 0
fi

komunikat "PRZYWRACAM (pg_restore --clean --if-exists) — to NADPISUJE obiekty w celu."
# --exit-on-error celowo NIE jest ustawione: pg_restore zgłasza „already exists"
# i braki uprawnień na rozszerzeniach jako błędy nieblokujące. Liczbę błędów
# raportujemy niżej, żeby nie udawać, że ich nie było.
set +e
pg_restore_arch "$DATABASE_URL" "$PLIK" \
  --clean --if-exists --no-owner --no-privileges 2> "${PLIK}.restore.log"
KOD=$?
set -e
BLEDY="$(grep -c '^pg_restore: error' "${PLIK}.restore.log" || true)"
komunikat "pg_restore zakończony kodem $KOD, linii błędów: ${BLEDY:-0} (log: ${PLIK}.restore.log)"
komunikat "SPRAWDŹ TERAZ: bash scripts/demo/sprawdz-demo.sh --tylko-baza"
