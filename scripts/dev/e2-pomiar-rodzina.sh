#!/usr/bin/env bash
# E2 K1 — pomiar rodziny: czy MEMBER moze zmieniac CUDZE obiekty (zadanie/decyzja/inicjatywa)
set -uo pipefail
PORT="${1:-4222}"; ETYKIETA="${2:-rodzina}"
BASE="http://127.0.0.1:${PORT}/api"; HASLO='E2Test!2026'
zaloguj() { curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$HASLO\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.token||j.accessToken||(j.data&&(j.data.token||j.data.accessToken))||'')}catch(e){console.log('')}})"; }
proba() { local kod; if [ "$4" = "-" ]; then kod=$(curl -s -o /tmp/e2r.json -w '%{http_code}' -X "$2" "$BASE$3" -H "Authorization: Bearer $1"); else kod=$(curl -s -o /tmp/e2r.json -w '%{http_code}' -X "$2" "$BASE$3" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4"); fi; echo "  $5 -> HTTP $kod  $(head -c 200 /tmp/e2r.json)"; }
echo "===== $ETYKIETA (port $PORT) ====="
T=$(zaloguj 'e2.member.a@dbr77.local')
DEC='ec425792-3ee8-48e8-98dc-41076a730d0b'; INI='da588307-778c-4089-b86a-38b3a45793d7'
echo "[TASK]  PUT /tasks/e2-task-other-b (cudze)";      proba "$T" PUT "/tasks/e2-task-other-b" '{"title":"E2 rodzina TASK"}' "task.update"
echo "[DEC]   PUT /decisions/$DEC (cudza)";              proba "$T" PUT "/decisions/$DEC" '{"title":"E2 rodzina DEC"}' "decision.update"
echo "[DEC]   DELETE /decisions/$DEC (cudza)";           proba "$T" DELETE "/decisions/$DEC" '{"reason":"e2"}' "decision.delete"
echo "[INI]   PUT /initiatives/$INI (cudza)";            proba "$T" PUT "/initiatives/$INI" '{"title":"E2 rodzina INI"}' "initiative.update"
echo "[INI]   PATCH /initiatives/$INI (cudza)";          proba "$T" PATCH "/initiatives/$INI" '{"title":"E2 rodzina INI patch"}' "initiative.update(patch)"
echo "--- stan bazy:"
docker exec consultify-pg18 psql -U postgres -d consultify_kopia_e2 -tAc "SELECT 'task   '||title FROM tasks WHERE id='e2-task-other-b'; SELECT 'dec    '||title||' status='||coalesce(status,'-') FROM decisions WHERE id='$DEC'; SELECT 'init   '||title FROM initiatives WHERE id='$INI';"
