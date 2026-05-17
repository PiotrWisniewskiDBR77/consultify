#!/usr/bin/env bash
#
# Smoke check: SuperAdmin Audit endpoints contract on a deployed environment.
#
# Usage:
#   BASE=https://demo.consultify.ai TOKEN=eyJ... \
#     bash server/scripts/smoke-superadmin-audit.sh
#
# Verifies:
#   - /api/superadmin/admin/audit-logs returns 200 with { logs, pagination, integrity } shape
#   - /api/superadmin/admin/audit-logs/stats returns 200 with numeric defaults
#   - /api/superadmin/admin/audit-logs/export?format=csv returns CSV (or 200 JSON)
#   - Garbage params are clamped (no 5xx)
#   - Without token, all endpoints return 401 (auth gate intact)
#
# Exit code 0 if all assertions pass.

set -u
BASE="${BASE:-https://demo.consultify.ai}"
TOKEN="${TOKEN:-}"
TMP="${TMPDIR:-/tmp}/smoke-sa-audit"
mkdir -p "$TMP"

ok=0
fail=0
note() { echo "[smoke] $*"; }
pass() { ok=$((ok+1)); echo "  PASS: $*"; }
miss() { fail=$((fail+1)); echo "  FAIL: $*"; }

note "Target: $BASE"
note "Token : $( [ -n "$TOKEN" ] && echo present || echo absent )"

curl_code() {
  local url="$1"; local out="$2"; shift 2
  curl -sS -o "$out" -w "%{http_code}" --max-time 20 \
    -H 'Accept: application/json' \
    "$@" "$url"
}

assert_unauth() {
  local path="$1"
  local out="$TMP/unauth.json"
  local code
  code=$(curl_code "$BASE$path" "$out") || code=000
  if [ "$code" = "401" ]; then
    pass "unauth $path -> 401"
  else
    miss "unauth $path -> $code (expected 401, body: $(head -c 200 "$out"))"
  fi
}

assert_unauth /api/superadmin/admin/audit-logs
sleep 1
assert_unauth /api/superadmin/admin/audit-logs/stats
sleep 1
assert_unauth "/api/superadmin/admin/audit-logs/export?format=csv"

if [ -z "$TOKEN" ]; then
  note "TOKEN not provided - skipping authenticated assertions."
  echo "RESULT: ok=$ok fail=$fail (auth checks skipped)"
  [ "$fail" -eq 0 ]
  exit $?
fi

assert_logs() {
  local out="$TMP/logs.json"
  local code
  code=$(curl_code "$BASE/api/superadmin/admin/audit-logs?limit=10" "$out" \
    -H "Authorization: Bearer $TOKEN")
  if [ "$code" != "200" ]; then
    miss "auth /audit-logs -> $code (body: $(head -c 200 "$out"))"
    return
  fi
  local has_logs has_pagination has_integrity
  has_logs=$(grep -c '"logs"' "$out" || true)
  has_pagination=$(grep -c '"pagination"' "$out" || true)
  has_integrity=$(grep -c '"integrity"' "$out" || true)
  if [ "$has_logs" -ge 1 ] && [ "$has_pagination" -ge 1 ] && [ "$has_integrity" -ge 1 ]; then
    pass "auth /audit-logs -> 200, contract { logs, pagination, integrity }"
  else
    miss "auth /audit-logs -> 200 but missing keys (logs=$has_logs, pagination=$has_pagination, integrity=$has_integrity)"
  fi
}

assert_stats() {
  local out="$TMP/stats.json"
  local code
  code=$(curl_code "$BASE/api/superadmin/admin/audit-logs/stats" "$out" \
    -H "Authorization: Bearer $TOKEN")
  if [ "$code" != "200" ]; then
    miss "auth /audit-logs/stats -> $code (body: $(head -c 200 "$out"))"
    return
  fi
  if grep -q '"total_logs"' "$out"; then
    pass "auth /audit-logs/stats -> 200 with total_logs"
  else
    miss "auth /audit-logs/stats -> 200 but body missing total_logs"
  fi
}

assert_export() {
  local out="$TMP/export.bin"
  local raw code ct
  raw=$(curl -sS -o "$out" -w "%{http_code}|%{content_type}" --max-time 30 \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE/api/superadmin/admin/audit-logs/export?format=csv")
  code=$(printf '%s' "$raw" | awk -F'|' '{print $1}')
  ct=$(printf '%s' "$raw" | awk -F'|' '{print $2}')
  if [ "$code" != "200" ]; then
    miss "auth /audit-logs/export -> $code (body: $(head -c 200 "$out"))"
    return
  fi
  if echo "$ct" | grep -qiE "csv|octet-stream"; then
    pass "auth /audit-logs/export -> 200 ($ct)"
  else
    note "  /audit-logs/export -> 200 with content-type $ct (JSON fallback acceptable)"
    pass "auth /audit-logs/export -> 200"
  fi
}

assert_clamp() {
  local out="$TMP/garbage.json"
  local code
  code=$(curl_code "$BASE/api/superadmin/admin/audit-logs?limit=NaN&offset=-50&status=pwned" "$out" \
    -H "Authorization: Bearer $TOKEN")
  if [ "$code" = "200" ]; then
    pass "auth /audit-logs?garbage -> 200 (params clamped, no 5xx)"
  else
    miss "auth /audit-logs?garbage -> $code (expected 200, body: $(head -c 200 "$out"))"
  fi
}

assert_logs
sleep 1
assert_stats
sleep 1
assert_export
sleep 1
assert_clamp

echo "RESULT: ok=$ok fail=$fail"
[ "$fail" -eq 0 ]
