#!/usr/bin/env bash
# E2 — pomiar: kto moze edytowac cudze zadanie. Uzycie: e2-pomiar.sh <port> <etykieta>
set -uo pipefail
PORT="${1:-4222}"
ETYKIETA="${2:-pomiar}"
BASE="http://127.0.0.1:${PORT}/api"
HASLO='E2Test!2026'

zaloguj() {
  curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$HASLO\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.token||j.accessToken||(j.data&&(j.data.token||j.data.accessToken))||'')}catch(e){console.log('')}})"
}

proba() { # <token> <metoda> <sciezka> <body|-> <opis>
  local kod
  if [ "$4" = "-" ]; then
    kod=$(curl -s -o /tmp/e2-odp.json -w '%{http_code}' -X "$2" "$BASE$3" -H "Authorization: Bearer $1")
  else
    kod=$(curl -s -o /tmp/e2-odp.json -w '%{http_code}' -X "$2" "$BASE$3" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4")
  fi
  echo "  $5 -> HTTP $kod  $(head -c 220 /tmp/e2-odp.json)"
}

echo "===== $ETYKIETA (port $PORT) ====="
TOK_A=$(zaloguj 'e2.member.a@dbr77.local')
TOK_ADM=$(zaloguj 'e2.admin@dbr77.local')
echo "token MEMBER A: ${TOK_A:0:12}...  token ADMIN: ${TOK_ADM:0:12}..."

echo "[1] MEMBER A -> PUT wlasne zadanie e2-task-own-a"
proba "$TOK_A" PUT "/tasks/e2-task-own-a" '{"title":"E2 own EDIT '"$ETYKIETA"'"}' "PUT own"
echo "[2] MEMBER A -> PUT CUDZE zadanie e2-task-other-b"
proba "$TOK_A" PUT "/tasks/e2-task-other-b" '{"title":"E2 WLAM '"$ETYKIETA"'"}' "PUT cudze"
echo "[3] ADMIN -> PUT CUDZE zadanie e2-task-other-b"
proba "$TOK_ADM" PUT "/tasks/e2-task-other-b" '{"title":"E2 ADMIN EDIT '"$ETYKIETA"'"}' "PUT cudze (ADMIN)"
echo "[4] MEMBER A -> DELETE CUDZE zadanie 2a4d39f7 (Katarzyna)"
proba "$TOK_A" DELETE "/tasks/2a4d39f7-2faa-41cb-b445-a553876e134f" - "DELETE cudze"

echo "--- stan bazy po probach:"
docker exec consultify-pg18 psql -U postgres -d consultify_kopia_e2 -tAc "SELECT id||' | '||title||' | assignee='||coalesce(assignee_id,'-') FROM tasks WHERE id IN ('e2-task-own-a','e2-task-other-b','2a4d39f7-2faa-41cb-b445-a553876e134f') ORDER BY id"
