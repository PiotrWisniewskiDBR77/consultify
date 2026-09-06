#!/usr/bin/env bash
# =============================================================================
# scripts/demo/kopia-bazy.sh — kopia zapasowa bazy (pg_dump -Fc) + sha256 + manifest.
#
# UŻYCIE
#   DATABASE_URL="postgresql://..." bash scripts/demo/kopia-bazy.sh \
#     --oczekiwany-host trolley --etykieta demo-przed-rozdzialem [--katalog /private/tmp/dumps]
#
# CO ROBI (i co z tego wynika w runbooku)
#   1. Sprawdza, że cel NIE jest produkcją (centerbeam) — twarda odmowa.
#   2. Sprawdza, że host zawiera zadeklarowany odcisk (--oczekiwany-host).
#      Bez deklaracji nie ruszy: „kopia nie tej bazy" ma być niemożliwa przez pomyłkę.
#   3. pg_dump -Fc --no-owner --no-privileges → plik .dump
#   4. Liczy sha256 i rozmiar, zapisuje manifest JSON obok pliku.
#
# CZEGO NIE ROBI. Nie zapisuje nigdzie connection stringa ani hasła. Manifest
# zawiera wyłącznie „host:port/baza". Nie kasuje starych kopii.
#
# WYNIK: ścieżka manifestu na stdout (jedna linia) — do podstawienia w przywroc-baze.sh.
# =============================================================================

set -euo pipefail
TU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/demo/_wspolne.sh
source "$TU/_wspolne.sh"

KATALOG="${KATALOG_KOPII:-/private/tmp/dumps}"
ETYKIETA=""
ODCISK=""

while [ $# -gt 0 ]; do
  case "$1" in
    --katalog) KATALOG="$2"; shift 2 ;;
    --etykieta) ETYKIETA="$2"; shift 2 ;;
    --oczekiwany-host) ODCISK="$2"; shift 2 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) blad "nieznany argument: $1" ;;
  esac
done

[ -n "${DATABASE_URL:-}" ] || blad "brak DATABASE_URL (podaj przez zmienną środowiskową, nie przez argument — argumenty widać w ps)."
[ -n "$ETYKIETA" ] || blad "brak --etykieta (np. demo-przed-rozdzialem). Etykieta trafia do nazwy pliku."

TOZ="$(tozsamosc_url "$DATABASE_URL")"
bramka_produkcji "$TOZ"
bramka_celu "$TOZ" "$ODCISK"

mkdir -p "$KATALOG"
STEMPEL="$(date -u +%Y%m%dT%H%M%SZ)"
PLIK="$KATALOG/${ETYKIETA}-${STEMPEL}.dump"
MANIFEST="$KATALOG/${ETYKIETA}-${STEMPEL}.manifest.json"

komunikat "cel: $TOZ"
komunikat "klient Postgresa: $(tryb_klienta) (obraz: $PG_OBRAZ)"
komunikat "zrzut → $PLIK"

# -Fc: format własny, bo pg_restore z niego umie odtworzyć równolegle i selektywnie.
# --no-owner/--no-privileges: kopia ma się dać wgrać do NOWEJ bazy z innym
# właścicielem (dokładnie przypadek „nowa baza demo"), bez ręcznego GRANT-owania.
pg_client pg_dump "$DATABASE_URL" -Fc --no-owner --no-privileges > "$PLIK"

[ -s "$PLIK" ] || blad "zrzut jest PUSTY — nie zapisuję manifestu. Sprawdź dostęp do bazy."

SHA="$(sha256_pliku "$PLIK")"
ROZMIAR="$(rozmiar_pliku "$PLIK")"

# Liczba tabel w zrzucie liczona Z PLIKU (a nie z bazy) — to jest dowód na to,
# co faktycznie leży w kopii, a nie na to, co było w bazie w innej chwili.
# `pg_restore --list` wypisuje i definicje tabel, i wpisy TABLE DATA — liczymy
# wyłącznie definicje, żeby liczba dała się porównać z `information_schema.tables`.
TABLIC="$(pg_restore_lista "$PLIK" 2>/dev/null | awk '/ TABLE / && !/ TABLE DATA /' | wc -l | tr -d ' ')"

node -e '
  const fs = require("fs");
  const [manifest, plik, sha, rozmiar, toz, etykieta, tablic] = process.argv.slice(1);
  fs.writeFileSync(manifest, JSON.stringify({
    wersja: 1,
    etykieta,
    plik,
    sha256: sha,
    rozmiar_bajty: Number(rozmiar),
    zrodlo: toz,
    tabel_w_zrzucie: Number(tablic),
    utworzono_utc: new Date().toISOString(),
    format: "pg_dump -Fc --no-owner --no-privileges",
  }, null, 2) + "\n");
' "$MANIFEST" "$PLIK" "$SHA" "$ROZMIAR" "$TOZ" "$ETYKIETA" "${TABLIC:-0}"

komunikat "gotowe: $ROZMIAR B, sha256 $SHA, tabel w zrzucie: ${TABLIC:-0}"
printf '%s\n' "$MANIFEST"
