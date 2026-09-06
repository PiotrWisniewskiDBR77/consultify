#!/usr/bin/env bash
# =============================================================================
# scripts/demo/_wspolne.sh — wspólna warstwa dla skryptów kopii/przywracania.
#
# CZEMU ISTNIEJE. Na maszynie nadzorcy (macOS) NIE MA `pg_dump` w PATH —
# zmierzone 2026-09-06: `which pg_dump` → brak; jest wyłącznie w kontenerze
# `consultify-noc-pg` (pg_dump 16.15). Skrypty muszą więc umieć wykonać
# pg_dump/pg_restore/psql przez Dockera, i to bez cichego wyboru złej wersji.
#
# CZEGO NIE ROBI. Nie zna hasła do żadnej bazy — connection string podaje
# wołający w zmiennej środowiskowej. Nie drukuje connection stringa nigdzie:
# do logu i do manifestu idzie WYŁĄCZNIE „host:port/baza" (bez użytkownika
# i hasła), tak samo jak w scripts/validate-deploy-target.sh.
# =============================================================================

set -euo pipefail

# Obraz Postgresa używany, gdy na hoście nie ma klienta. pgvector/pgvector:pg16
# to ten sam obraz, na którym stoi stanowisko lokalne (scripts/dev/stanowisko-lokalne/start.sh).
PG_OBRAZ="${PG_OBRAZ:-pgvector/pgvector:pg16}"

komunikat() { printf '[demo] %s\n' "$*" >&2; }
blad() { printf '[demo] BŁĄD: %s\n' "$*" >&2; exit 1; }

# --- tożsamość bazy: host:port/nazwa, BEZ danych logowania --------------------
tozsamosc_url() {
  node -e '
    try {
      const u = new URL(process.argv[1]);
      const host = u.hostname.toLowerCase();
      const port = u.port || "5432";
      const db = decodeURIComponent(u.pathname.replace(/^\//, "")).toLowerCase();
      if (!host || !db) process.exit(1);
      process.stdout.write(`${host}:${port}/${db}`);
    } catch (e) { process.exit(1); }
  ' "$1" 2>/dev/null || blad "nie umiem sparsowac connection stringa (wartosc NIE jest pokazywana). Haslo z surowym ukosnikiem trzeba zapisac jako %2F."
}

# --- BRAMKA PRODUKCJI ---------------------------------------------------------
# `centerbeam` = produkcja consultify.ai (docs/program/grafika/ANALIZA_STAGING_DEMO.md).
# Żaden skrypt z tego katalogu nie ma prawa jej dotknąć — ani do odczytu.
bramka_produkcji() {
  local toz="$1"
  case "$toz" in
    *centerbeam*) blad "cel wskazuje PRODUKCJĘ (centerbeam). Ten skrypt nigdy nie dotyka produkcji. STOP." ;;
  esac
}

# --- BRAMKA ZGODNOŚCI CELU ----------------------------------------------------
# Wołający MUSI podać, w co celuje (--oczekiwany-host trolley / thomas / 127.0.0.1).
# To ten sam wzorzec, co DEMO_DB_HOST_FINGERPRINT w scripts/validate-deploy-target.sh:
# odczytany host porównany z ZADEKLAROWANYM odciskiem. Bez deklaracji — STOP,
# żeby „nie ten host" nigdy nie był domyślną ścieżką.
bramka_celu() {
  local toz="$1" odcisk="$2"
  [ -n "$odcisk" ] || blad "brak --oczekiwany-host. Podaj fragment hosta (np. trolley, thomas, 127.0.0.1). Bez tego skrypt nie wie, czy trafia tam, gdzie chcesz."
  case "${toz%%/*}" in
    *"$odcisk"*) : ;;
    *) blad "cel NIE pasuje do deklaracji: host nie zawiera fragmentu [$odcisk] (host nie jest pokazywany). STOP." ;;
  esac
}

# --- uruchamianie klienta Postgresa ------------------------------------------
# Zwraca „host" jeśli klient jest na maszynie, „docker" jeśli trzeba kontenera.
tryb_klienta() {
  if command -v pg_dump >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1 \
     && command -v psql >/dev/null 2>&1; then
    printf 'host'
  else
    printf 'docker'
  fi
}

# Docker na macOS nie widzi 127.0.0.1 hosta — trzeba host.docker.internal.
url_dla_dockera() {
  printf '%s' "$1" | sed -e 's#@127\.0\.0\.1:#@host.docker.internal:#' -e 's#@localhost:#@host.docker.internal:#'
}

# pg_client <narzędzie> <url> [argumenty...] — stdout narzędzia idzie na stdout.
pg_client() {
  local narzedzie="$1" url="$2"; shift 2
  if [ "$(tryb_klienta)" = "host" ]; then
    PGCONNECT_TIMEOUT=30 "$narzedzie" "$@" "$url"
  else
    docker run --rm -i \
      -e PGCONNECT_TIMEOUT=30 \
      "$PG_OBRAZ" "$narzedzie" "$@" "$(url_dla_dockera "$url")"
  fi
}

# ★ DLACZEGO STRUMIEŃ, A NIE `-v` (zmierzone 06.09 na maszynie nadzorcy):
# Docker Desktop na tym Macu NIE udostępnia `/private/tmp` ani `/tmp` —
#   docker run --rm -v /private/tmp/dumps-proba:/praca alpine ls /praca  ->  katalog PUSTY
#   docker run --rm -v /Users/<user>/x:/praca         alpine ls /praca  ->  pliki widoczne
# Montowanie katalogu z kopią dawało więc „No such file or directory" na pliku,
# który istnieje. Archiwum jedzie przez stdin — działa niezależnie od tego,
# które ścieżki są współdzielone, i nie wymaga od nadzorcy zmiany ustawień Dockera.

# pg_restore_arch <url> <archiwum-na-hoście> [argumenty...] — przywrócenie do bazy.
# Archiwum idzie na stdin. ★ UWAGA, KTÓRA KOSZTOWAŁA JEDEN NIEUDANY PRZEBIEG:
# w `pg_restore` przełącznik `-f` to PLIK WYJŚCIOWY, nie archiwum wejściowe —
# pierwsza wersja tej funkcji kazała pg_restore NADPISAĆ własną kopię zapasową.
pg_restore_arch() {
  local url="$1" archiwum="$2"; shift 2
  if [ "$(tryb_klienta)" = "host" ]; then
    PGCONNECT_TIMEOUT=30 pg_restore "$@" -d "$url" < "$archiwum"
  else
    docker run --rm -i -e PGCONNECT_TIMEOUT=30 \
      "$PG_OBRAZ" pg_restore "$@" -d "$(url_dla_dockera "$url")" < "$archiwum"
  fi
}

# pg_restore_lista <archiwum-na-hoście> — spis zawartości archiwum, BEZ bazy.
pg_restore_lista() {
  local archiwum="$1"
  if [ "$(tryb_klienta)" = "host" ]; then
    pg_restore --list < "$archiwum"
  else
    docker run --rm -i "$PG_OBRAZ" pg_restore --list < "$archiwum"
  fi
}

# pg_sql_plik <url> <plik.sql> — wykonanie pliku SQL (psql). Też przez stdin.
pg_sql_plik() {
  local url="$1" plik="$2"; shift 2
  if [ "$(tryb_klienta)" = "host" ]; then
    PGCONNECT_TIMEOUT=30 psql "$@" "$url" < "$plik"
  else
    docker run --rm -i -e PGCONNECT_TIMEOUT=30 \
      "$PG_OBRAZ" psql "$@" "$(url_dla_dockera "$url")" < "$plik"
  fi
}

sha256_pliku() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else sha256sum "$1" | awk '{print $1}'; fi
}

rozmiar_pliku() {
  # -f%z na BSD/macOS, -c%s na GNU.
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1"
}
