#!/usr/bin/env bash
# E2b — pomiar bramek edycji INICJATYW. Uzycie: e2b-pomiar.sh <port> <etykieta>
set -uo pipefail
PORT="${1:-4224}"
ETYKIETA="${2:-pomiar}"
BASE="http://127.0.0.1:${PORT}/api"
HASLO='E2bTest!2026'
DB=consultify_kopia_e2b

zaloguj() {
  curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$HASLO\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.token||j.accessToken||(j.data&&(j.data.token||j.data.accessToken))||'')}catch(e){console.log('')}})"
}

proba() { # <token> <metoda> <sciezka> <body|-> <opis>
  local kod
  if [ "$4" = "-" ]; then
    kod=$(curl -s -o /tmp/e2b-odp.json -w '%{http_code}' -X "$2" "$BASE$3" -H "Authorization: Bearer $1")
  else
    kod=$(curl -s -o /tmp/e2b-odp.json -w '%{http_code}' -X "$2" "$BASE$3" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4")
  fi
  printf '  %-58s HTTP %s  %s\n' "$5" "$kod" "$(head -c 200 /tmp/e2b-odp.json | tr -d '\n')"
}

echo "===== $ETYKIETA (port $PORT) ====="
A=$(zaloguj 'e2b.member.a@dbr77.local')
O=$(zaloguj 'e2b.iniowner@dbr77.local')
ADM=$(zaloguj 'e2b.admin@dbr77.local')
echo "tokeny: A=${A:0:10}.. OWNER=${O:0:10}.. ADMIN=${ADM:0:10}.."

echo "-- initiatives.routes: initiative.update (7 bramek) --"
proba "$A"   PUT   "/initiatives/e2b-ini-own-a"   '{"title":"A WLASNA '"$ETYKIETA"'"}'  "1 PUT /:id            MEMBER A -> WLASNA"
proba "$A"   PUT   "/initiatives/e2b-ini-other-b" '{"title":"WLAM PUT '"$ETYKIETA"'"}'  "2 PUT /:id            MEMBER A -> CUDZA (B)"
proba "$O"   PUT   "/initiatives/e2b-ini-owned-c" '{"title":"OWNER PUT '"$ETYKIETA"'"}' "3 PUT /:id            WLASCICIEL (nie tworca)"
proba "$ADM" PUT   "/initiatives/e2b-ini-other-b" '{"title":"ADMIN PUT '"$ETYKIETA"'"}' "4 PUT /:id            ADMIN -> CUDZA"
proba "$A"   PATCH "/initiatives/e2b-ini-other-b" '{"title":"WLAM PATCH '"$ETYKIETA"'"}' "5 PATCH /:id          MEMBER A -> CUDZA"
proba "$A"   PATCH "/initiatives/e2b-ini-other-b/quick-update" '{"priority":"HIGH"}'   "6 PATCH quick-update  MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/move" '{"targetProjectId":"e2b-project"}'   "7 POST /:id/move      MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/bulk-assign" '{"initiativeIds":["e2b-ini-other-b"],"targetProjectId":"e2b-project"}' "8 POST bulk-assign    MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/merge-from-insight" '{"summary":"wlam e2b","insightId":"brak"}' "9 POST merge-insight  MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/extend-from-insight" '{"summary":"wlam e2b","insightId":"brak"}' "10 POST extend-insight MEMBER A -> CUDZA"

echo "-- status / delete --"
proba "$A"   PATCH "/initiatives/e2b-ini-other-b/status" '{"status":"PENDING_APPROVAL"}'   "11 PATCH /:id/status  MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/archive" '{}'                          "12 POST /:id/archive  MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/lifecycle-flag" '{"flag":"HOLD"}'      "13 POST lifecycle-flag MEMBER A -> CUDZA"
proba "$A"   DELETE "/initiatives/e2b-ini-other-b" -                                    "14 DELETE /:id        MEMBER A -> CUDZA"

echo "-- inicjatywa BEZ projektu (kontrola kontekstu) --"
proba "$A"   PUT   "/initiatives/e2b-ini-noproject-b" '{"title":"WLAM NOPROJ '"$ETYKIETA"'"}' "15 PUT /:id           MEMBER A -> CUDZA bez projektu"
proba "$ADM" PUT   "/initiatives/e2b-ini-noproject-b" '{"title":"ADMIN NOPROJ '"$ETYKIETA"'"}' "16 PUT /:id           ADMIN -> bez projektu"

echo "-- runtime-v1 (initiativesExecutionRuntime) --"
proba "$A"   PATCH "/initiatives/runtime-v1/initiatives/e2b-rt-other-b/metadata" '{"expectedVersion":1,"clientRequestId":"e2b-wlam-meta","title":"WLAM META '"$ETYKIETA"'"}' "17 PATCH runtime meta  MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/runtime-v1/initiatives/e2b-rt-other-b/cancel" '{"expectedVersion":1,"clientRequestId":"e2b-wlam-cancel","reason":"wlam e2b"}' "18 POST runtime cancel MEMBER A -> CUDZA"

proba "$O"   PATCH "/initiatives/runtime-v1/initiatives/e2b-rt-other-b/metadata" '{"expectedVersion":1,"clientRequestId":"e2b-wlam-meta-o","title":"WLAM META OWNER '"$ETYKIETA"'"}' "19 PATCH runtime meta  WLASCICIEL INI -> CUDZA"
proba "$O"   PATCH "/initiatives/runtime-v1/initiatives/e2b-rt-own-owner/metadata" '{"expectedVersion":1,"clientRequestId":"e2b-meta-own","title":"OWNER META WLASNA '"$ETYKIETA"'"}' "20 PATCH runtime meta  WLASCICIEL INI -> WLASNA"
proba "$ADM" PATCH "/initiatives/runtime-v1/initiatives/e2b-rt-other-b/metadata" '{"expectedVersion":1,"clientRequestId":"e2b-meta-adm","title":"ADMIN META '"$ETYKIETA"'"}' "21 PATCH runtime meta  ADMIN -> CUDZA"

echo "-- REGRESJA: bramki NIE objete zmiana --"
proba "$A"   POST  "/initiatives/wizard/sessions" '{"projectId":"e2b-project"}'          "R1 POST wizard/sessions   MEMBER A"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/submit-review" '{}'                     "R2 POST submit-review     MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/approve" '{}'                           "R3 POST approve           MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/start-execution" '{}'                   "R4 POST start-execution   MEMBER A -> CUDZA"
proba "$A"   POST  "/initiatives/e2b-ini-other-b/complete" '{}'                          "R5 POST complete          MEMBER A -> CUDZA"
proba "$A"   PUT   "/initiatives/e2b-ini-other-b/profile" '{"summary":"x","expectedVersion":1}' "R6 PUT /:id/profile       MEMBER A -> CUDZA"

echo "--- stan bazy po probach:"
docker exec -e PGPASSWORD=postgres consultify-pg18 psql -U postgres -d $DB -tAc \
 "SELECT id||' | title='||coalesce(title,'-')||' | name='||coalesce(name,'-')||' | status='||coalesce(status,'-')||' | prio='||coalesce(priority,'-')||' | proj='||coalesce(project_id,'NULL') FROM initiatives WHERE id LIKE 'e2b-ini-%' ORDER BY id"
docker exec -e PGPASSWORD=postgres consultify-pg18 psql -U postgres -d $DB -tAc \
 "SELECT aggregate_id||' | v'||version||' | title='||(payload_json->>'title')||' | owner='||coalesce(payload_json->>'initiativeOwnerId','-')||' | state='||coalesce(payload_json->>'lifecycleState','-') FROM ie_aggregate_state WHERE aggregate_id LIKE 'e2b-rt-%' ORDER BY aggregate_id"
