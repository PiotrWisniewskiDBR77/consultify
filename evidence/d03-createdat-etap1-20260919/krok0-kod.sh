#!/usr/bin/env bash
# D-03 / QD16 etap 1 — KROK 0, code side: which candidate tables does the product
# touch, and does any of that code treat created_at as a string (after the cast
# node-pg returns a Date, not a string, so string handling is the real risk).
# REGUŁA 10: no password here; PGPASSWORD comes from the environment.
set -u
cd "$(dirname "$0")/../.." || exit 1
: "${PGPASSWORD:?ustaw PGPASSWORD w środowisku (hasło jednorazowego kontenera)}"
CONTAINER="${CONTAINER:-qoder-d-pg-7}"
DB="${DB:-consultify_qd16}"
PSQL="docker exec -e PGPASSWORD $CONTAINER psql -U postgres -d $DB -At"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

RISKY_RE="(substr|substring|length|trim|upper|lower|replace|strftime|date|datetime)\([[:space:]]*created_at|created_at[[:space:]]*\|\||created_at[[:space:]]*(LIKE|like)[[:space:]]|created_at[[:space:]]*::text"

echo "=== J. tekstowe operacje SQL na created_at w kodzie serwera ==="
grep -rnoE "$RISKY_RE" server/src --include='*.ts' > "$TMP/ryzykowne-linie.txt"
echo "trafień (linie): $(wc -l < "$TMP/ryzykowne-linie.txt" | tr -d ' ')"
grep -rlE "$RISKY_RE" server/src --include='*.ts' | sort > "$TMP/pliki-ryzykowne.txt"
echo "plików z takim wzorcem: $(wc -l < "$TMP/pliki-ryzykowne.txt" | tr -d ' ')"
echo '--- 10 przykładów plik:linia ---'
head -10 "$TMP/ryzykowne-linie.txt"

echo
echo "=== K. operacje łańcuchowe JS na created_at (server i front) ==="
echo "server/src: $(grep -rnoE 'created_at\.(slice|substring|split|startsWith|endsWith|replace|trim|padStart|toLocale[A-Za-z]*)\(' server/src --include='*.ts' | wc -l | tr -d ' ')"
echo "src (front): $(grep -rnoE 'created_at\.(slice|substring|split|startsWith|endsWith|replace|trim|padStart|toLocale[A-Za-z]*)\(' src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ')"
echo '--- jedyny taki przypadek w serwerze (kontekst) ---'
grep -rnoE "created_at\?\.(slice|substring|split)\([0-9]+[, 0-9]*\)" server/src --include='*.ts'

echo
echo "=== L. SQLite nie czyta tej migracji (ścieżka Table Platform bierze tylko 7*.sql) ==="
sed -n '3179,3200p' server/src/database/DatabaseInitializer.ts

echo
echo "=== M. które tabele z puli 152 pojawiają się w kodzie i w plikach ryzykownych ==="
$PSQL -c "SELECT tabela FROM qd16_probe.wyniki ORDER BY tabela" > "$TMP/pula.txt"
grep -rhoE '[a-z][a-z0-9_]{3,}' server/src --include='*.ts' | sort -u > "$TMP/tok-server.txt"
grep -rhoE '[a-z][a-z0-9_]{3,}' src --include='*.ts' --include='*.tsx' | sort -u > "$TMP/tok-front.txt"
: > "$TMP/klasyfikacja.txt"
while read -r t; do
  s=0; f=0; r=0
  grep -qx "$t" "$TMP/tok-server.txt" && s=1
  grep -qx "$t" "$TMP/tok-front.txt" && f=1
  while read -r p; do grep -qE "\b$t\b" "$p" && { r=1; break; }; done < "$TMP/pliki-ryzykowne.txt"
  echo "$t|$s|$f|$r" >> "$TMP/klasyfikacja.txt"
done < "$TMP/pula.txt"
echo "tabel w puli: $(wc -l < "$TMP/klasyfikacja.txt" | tr -d ' ')"
awk -F'|' '{print "kod_serwera="$2" kod_frontu="$3" plik_z_tekstowym_created_at="$4}' "$TMP/klasyfikacja.txt" | sort | uniq -c
echo '--- tabele odrzucone, bo występują w pliku z tekstowym created_at (pierwsze 40) ---'
awk -F'|' '$4==1{print $1}' "$TMP/klasyfikacja.txt" | head -40

echo
echo "=== N. pula bezpieczna (kod bez tekstowego created_at) — rozmiar ==="
awk -F'|' '$4==0{print $1}' "$TMP/klasyfikacja.txt" > "$TMP/pula-bezpieczna.txt"
wc -l < "$TMP/pula-bezpieczna.txt"
