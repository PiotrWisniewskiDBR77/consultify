#!/usr/bin/env bash
# Dowod po operacji sprzatania (Zadanie 2d, w1a-sprzatanie-20260910): przepływ
# zapisu na koncie Northwind przez PRAWDZIWE API stagingu — nie licznik wierszy,
# tylko realny POST/DELETE przez HTTP.
#
# NIE URUCHOMIONO PRZEZ ROBOTNIKA — logowanie haslem to akcja, ktorej robotnik
# (agent Claude) ma zakaz wykonywac sam (zasada bezpieczenstwa: nigdy nie
# wprowadzaj hasla do pola/uwierzytelnienia, nawet za zgoda). Uruchom to Ty,
# recznie, jednym poleceniem — haslo czytane jest z lokalnego pliku, nigdy nie
# pojawia sie w tym skrypcie ani w jego wyjsciu.
#
# Uzycie:
#   bash scripts/dane/dowod-zapisu-northwind.sh
#
# Wymaga: ~/Developer/consultify-secrets/northwind-konta-STAGING.txt z liniami
# "james.whitfield@northwind.example" (e-mail) i "Wspolne haslo: ..." (NIE
# linii "Rotacja ...").

set -euo pipefail

SECRETS_FILE="$HOME/Developer/consultify-secrets/northwind-konta-STAGING.txt"
BASE_URL="https://staging.consultify.ai"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
EMAIL="james.whitfield@northwind.example"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "BRAK pliku sekretow: $SECRETS_FILE" >&2
  exit 1
fi

# Bierze WYLACZNIE linie "Wspolne haslo" (nie "Rotacja") — bez wypisywania jej
# tresci na ekran.
PASSWORD=$(grep -i "wsp[oó]lne has" "$SECRETS_FILE" | head -1 | sed -E 's/^[^:]*:\s*//')
if [ -z "$PASSWORD" ]; then
  echo "Nie znaleziono linii 'Wspolne haslo' w $SECRETS_FILE" >&2
  exit 1
fi

COOKIEJAR=$(mktemp)
trap 'rm -f "$COOKIEJAR"' EXIT

echo "1) GET /api/csrf-token"
CSRF_RESP=$(curl -s -c "$COOKIEJAR" -A "$UA" "$BASE_URL/api/csrf-token")
CSRF_TOKEN=$(echo "$CSRF_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null || true)
if [ -z "$CSRF_TOKEN" ]; then
  echo "Nie udalo sie odczytac csrfToken z odpowiedzi: $CSRF_RESP" >&2
  exit 1
fi
echo "   csrf-token: OK (dlugosc ${#CSRF_TOKEN})"

echo "2) POST /api/auth/login (Northwind, $EMAIL)"
LOGIN_HTTP=$(curl -s -o /tmp/w1a-login-resp.json -w "%{http_code}" \
  -A "$UA" -b "$COOKIEJAR" -c "$COOKIEJAR" \
  -H "Content-Type: application/json" -H "x-csrf-token: $CSRF_TOKEN" \
  -X POST "$BASE_URL/api/auth/login" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "   HTTP: $LOGIN_HTTP"
if [ "$LOGIN_HTTP" != "200" ]; then
  echo "Logowanie nie powiodlo sie (HTTP $LOGIN_HTTP) — patrz /tmp/w1a-login-resp.json" >&2
  exit 1
fi
# server/src/routes/auth.routes.ts: pole w JSON to "token" (= result.accessToken),
# ALE setAuthCookies() ustawia tez httpOnly cookie w tej samej odpowiedzi — dla
# tras SPA (server/src/routes/pmo/tasks.routes.ts, requireAudit) wystarczy cookie
# jar (-b/-c) z poprzednich krokow; token trzymamy tylko jako dodatkowy dowod.
ACCESS_TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/w1a-login-resp.json')).get('token',''))" 2>/dev/null || true)
rm -f /tmp/w1a-login-resp.json
if [ -z "$ACCESS_TOKEN" ]; then
  echo "UWAGA: brak pola 'token' w odpowiedzi logowania (moze auth dziala WYLACZNIE cookie'ami) — kontynuuje na samych cookies." >&2
fi

echo "3) POST /api/tasks (utworz jedno zadanie testowe)"
# CreateTaskSchema (server/src/validators/task.validators.ts): status jest
# lowercase enumem z domyslka 'todo' — jedyne wymagane pole to 'title'.
CREATE_HTTP=$(curl -s -o /tmp/w1a-create-resp.json -w "%{http_code}" \
  -A "$UA" -b "$COOKIEJAR" \
  -H "Content-Type: application/json" -H "x-csrf-token: $CSRF_TOKEN" \
  ${ACCESS_TOKEN:+-H "Authorization: Bearer $ACCESS_TOKEN"} \
  -X POST "$BASE_URL/api/tasks" \
  -d '{"title":"w1a-dowod-zapisu (usun mnie)","status":"todo"}')
echo "   HTTP: $CREATE_HTTP"
TASK_ID=$(python3 -c "import json; d=json.load(open('/tmp/w1a-create-resp.json')); print(d.get('id') or d.get('task',{}).get('id',''))" 2>/dev/null || true)
rm -f /tmp/w1a-create-resp.json
if [ -z "$TASK_ID" ]; then
  echo "Nie udalo sie odczytac id nowego zadania — sprawdz reczne ksztalt odpowiedzi /api/tasks." >&2
  exit 1
fi
echo "   nowe zadanie: $TASK_ID"

echo "4) DELETE /api/tasks/$TASK_ID (posprzataj po sobie)"
DELETE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -A "$UA" -b "$COOKIEJAR" \
  -H "x-csrf-token: $CSRF_TOKEN" ${ACCESS_TOKEN:+-H "Authorization: Bearer $ACCESS_TOKEN"} \
  -X DELETE "$BASE_URL/api/tasks/$TASK_ID")
echo "   HTTP: $DELETE_HTTP"

echo
echo "PODSUMOWANIE KODOW: csrf=200 login=$LOGIN_HTTP create=$CREATE_HTTP delete=$DELETE_HTTP"
echo "Oczekiwane: login=200, create=200/201, delete=200/204. Jesli tak — przeplyw zapisu po sprzataniu jest sprawny."
