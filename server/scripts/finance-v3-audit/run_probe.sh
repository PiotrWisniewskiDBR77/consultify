#!/usr/bin/env bash
# Rigorous single-rule probe runner for the J4 mutant negative-control cycle.
# Usage: run_probe.sh <rule> <label>
# Writes /tmp/j4_mutant_<label>.log and /tmp/j4_mutant_<label>.exitcode
# (COMMAND / PID / EXIT_CODE / DURATION_S), never measures exit code via a pipe.
set -u
RULE="$1"
LABEL="$2"
cd "/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline/server"
LOG="/tmp/j4_mutant_${LABEL}.log"
META="/tmp/j4_mutant_${LABEL}.exitcode"
CMD='RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j4_rerun" npx tsx scripts/finance-v3-audit/j4-rbac-probe.ts --rule='"$RULE"
echo "COMMAND: $CMD" > "$META"
START=$(date +%s)
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j4_rerun" npx tsx scripts/finance-v3-audit/j4-rbac-probe.ts --rule="$RULE" > "$LOG" 2>&1 &
BGPID=$!
echo "PID=$BGPID" >> "$META"
wait $BGPID
CODE=$?
END=$(date +%s)
echo "EXIT_CODE=$CODE" >> "$META"
echo "DURATION_S=$((END-START))" >> "$META"
echo "LOG=$LOG" >> "$META"
cat "$META"
echo "--- log tail ---"
grep -E "^\[PASS\]|^\[FAIL\]|checks,|fatal error" "$LOG" || true
