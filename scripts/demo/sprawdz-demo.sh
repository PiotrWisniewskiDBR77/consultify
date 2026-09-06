#!/usr/bin/env bash
# =============================================================================
# scripts/demo/sprawdz-demo.sh — jeden pomiar stanu demo po rozdziale bazy.
#
# TRZY NIEZALEŻNE POMIARY, KAŻDY MOŻE ISTNIEĆ SAM
#   --tylko-zdrowie   /api/health → gitSha porównany z --oczekiwany-sha
#   --tylko-baza      liczba tabel · liczba organizacji · komplet kont pilotażu
#   --tylko-flagi     zmienne demo porównane ze zmiennymi stagingu (dwa pliki JSON
#                     z `railway variables --json`, wykonane przez nadzorcę)
#   bez flagi         wszystkie trzy
#
# UŻYCIE
#   DATABASE_URL=… bash scripts/demo/sprawdz-demo.sh \
#     --oczekiwany-host trolley \
#     --oczekiwany-sha  f3237e94230481d2bf4ad0a9c0dc10b1391191c9 \
#     --url-zdrowia     https://demo.consultify.ai/api/health \
#     --flagi-demo /private/tmp/demo-vars.json --flagi-staging /private/tmp/staging-vars.json
#
# WYNIK: linie „OK …" / „ŹLE …" i kod wyjścia 1, jeśli którykolwiek pomiar
# wypadł źle. Brak pomiaru NIE jest wynikiem — pominięty blok jest oznaczony
# jawnie jako POMINIĘTE i liczy się jako niesprawdzony, nie jako zaliczony.
# =============================================================================

set -uo pipefail
TU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/demo/_wspolne.sh
source "$TU/_wspolne.sh"

ODCISK=""; OCZ_SHA=""; URL_ZDROWIA="https://demo.consultify.ai/api/health"
FLAGI_DEMO=""; FLAGI_STAGING=""
ROB_ZDROWIE=1; ROB_BAZE=1; ROB_FLAGI=1
WYBRANO=0

while [ $# -gt 0 ]; do
  case "$1" in
    --oczekiwany-host) ODCISK="$2"; shift 2 ;;
    --oczekiwany-sha) OCZ_SHA="$2"; shift 2 ;;
    --url-zdrowia) URL_ZDROWIA="$2"; shift 2 ;;
    --flagi-demo) FLAGI_DEMO="$2"; shift 2 ;;
    --flagi-staging) FLAGI_STAGING="$2"; shift 2 ;;
    --tylko-zdrowie) ROB_ZDROWIE=1; ROB_BAZE=0; ROB_FLAGI=0; WYBRANO=1; shift ;;
    --tylko-baza) ROB_ZDROWIE=0; ROB_BAZE=1; ROB_FLAGI=0; WYBRANO=1; shift ;;
    --tylko-flagi) ROB_ZDROWIE=0; ROB_BAZE=0; ROB_FLAGI=1; WYBRANO=1; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) blad "nieznany argument: $1" ;;
  esac
done
[ "$WYBRANO" -eq 0 ] || true

ZLE=0
ok()   { printf 'OK        %s\n' "$*"; }
zle()  { printf 'ŹLE       %s\n' "$*"; ZLE=1; }
pomin(){ printf 'POMINIĘTE %s\n' "$*"; }

# --- 1. ZDROWIE --------------------------------------------------------------
if [ "$ROB_ZDROWIE" -eq 1 ]; then
  ODP="$(curl -s -m 25 -A 'Mozilla/5.0' "$URL_ZDROWIA" || true)"
  if [ -z "$ODP" ]; then
    zle "zdrowie: brak odpowiedzi z $URL_ZDROWIA"
  else
    ST="$(printf '%s' "$ODP"  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).status||"")}catch{console.log("")}})')"
    DB="$(printf '%s' "$ODP"  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).database||"")}catch{console.log("")}})')"
    SHA="$(printf '%s' "$ODP" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).gitSha||"")}catch{console.log("")}})')"
    [ "$ST" = "ok" ] && ok "zdrowie: status=ok" || zle "zdrowie: status=$ST"
    [ "$DB" = "connected" ] && ok "zdrowie: database=connected" || zle "zdrowie: database=$DB"
    if [ -z "$OCZ_SHA" ]; then
      pomin "zdrowie: gitSha=$SHA (nie podano --oczekiwany-sha, więc NIC to nie dowodzi)"
      ZLE=1
    elif [ "$SHA" = "$OCZ_SHA" ]; then
      ok "zdrowie: gitSha = wdrożony commit ($SHA)"
    else
      zle "zdrowie: gitSha=$SHA ≠ oczekiwany $OCZ_SHA"
    fi
  fi
else pomin "zdrowie"; fi

# --- 2. BAZA -----------------------------------------------------------------
if [ "$ROB_BAZE" -eq 1 ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    zle "baza: brak DATABASE_URL — pomiaru NIE było"
  else
    TOZ="$(tozsamosc_url "$DATABASE_URL")"
    bramka_produkcji "$TOZ"
    bramka_celu "$TOZ" "$ODCISK"
    ok "baza: cel $TOZ"

    ZAP="select
      (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tabele,
      (select count(*) from organizations) as organizacje,
      (select count(*) from organizations where name='DBR77 Pilotaż') as org_pilotaz,
      (select count(*) from organization_members m join organizations o on o.id=m.organization_id
        where o.name='DBR77 Pilotaż' and m.status='ACTIVE') as czlonkowie_pilotazu,
      (select count(*) from users u join organizations o on o.id=u.organization_id
        where o.name='DBR77 Pilotaż' and u.status='active') as konta_pilotazu,
      (select count(*) from users where role='SUPERADMIN') as superadmini,
      (select count(*) from pg_constraint where contype='f') as klucze_obce;"

    WIERSZ="$(pg_client psql "$DATABASE_URL" -At -F '|' -c "$ZAP" 2>/dev/null | tail -1)"
    if [ -z "$WIERSZ" ]; then
      zle "baza: zapytanie nie zwróciło wiersza (brak połączenia albo brak tabel)"
    else
      IFS='|' read -r T O OP CP KP SA KO <<<"$WIERSZ"
      ok "baza: tabel=$T organizacji=$O"
      [ "${T:-0}" -gt 500 ] && ok "baza: schemat załadowany ($T tabel > 500)" || zle "baza: tylko $T tabel — schemat NIE jest kompletny"
      [ "${OP:-0}" -eq 1 ] && ok "baza: organizacja DBR77 Pilotaz istnieje" || zle "baza: organizacji DBR77 Pilotaz jest $OP (ma byc 1)"
      [ "${KP:-0}" -ge 5 ] && ok "baza: kont pilotażu aktywnych = $KP (≥5)" || zle "baza: kont pilotażu = $KP (ma być ≥5: 4 osoby + administrator)"
      [ "${CP:-0}" -ge 5 ] && ok "baza: członkostw ACTIVE = $CP (≥5)" || zle "baza: członkostw ACTIVE = $CP (ma być ≥5)"
      printf 'INFO      baza: kont z rolą SUPERADMIN w całej bazie = %s (seed pilotażu żadnego nie nadaje)\n' "${SA:-?}"
      # ★ Klucze obce liczymy, bo pg_restore MILCZĄCO ich nie zakłada, gdy dane
      # źródłowe je łamią. Zmierzone 06.09 na próbie: 1681 w źródle -> 1670 po
      # przywróceniu, przy KOMPLETNYCH danych. Sam „licznik tabel się zgadza"
      # nie jest więc dowodem na wierną kopię.
      if [ -n "${OCZ_KLUCZE:-}" ]; then
        [ "${KO:-0}" -eq "$OCZ_KLUCZE" ] && ok "baza: kluczy obcych = $KO (zgodne z OCZ_KLUCZE)" \
          || zle "baza: kluczy obcych = $KO, oczekiwano $OCZ_KLUCZE — przywrócenie zgubiło więzy"
      else
        printf 'INFO      baza: kluczy obcych = %s (ustaw OCZ_KLUCZE=<liczba ze źródła>, żeby to porównać)\n' "${KO:-?}"
      fi
    fi
  fi
else pomin "baza"; fi

# --- 3. FLAGI ----------------------------------------------------------------
if [ "$ROB_FLAGI" -eq 1 ]; then
  if [ -z "$FLAGI_DEMO" ] || [ -z "$FLAGI_STAGING" ]; then
    zle "flagi: brak --flagi-demo / --flagi-staging — porównania NIE było"
  elif [ ! -f "$FLAGI_DEMO" ] || [ ! -f "$FLAGI_STAGING" ]; then
    zle "flagi: wskazany plik nie istnieje (demo: $FLAGI_DEMO, staging: $FLAGI_STAGING)"
  else
    WYNIK="$(node "$TU/porownaj-flagi.mjs" "$FLAGI_STAGING" "$FLAGI_DEMO")"
    printf '%s\n' "$WYNIK"
    printf '%s' "$WYNIK" | grep -q '^ŹLE' && ZLE=1
  fi
else pomin "flagi"; fi

echo "-----"
if [ "$ZLE" -eq 0 ]; then echo "WERDYKT: zgodność"; exit 0; else echo "WERDYKT: NIEZGODNOŚĆ (patrz linie ŹLE / POMINIĘTE)"; exit 1; fi
