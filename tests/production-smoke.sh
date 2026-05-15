#!/usr/bin/env bash
# Production smoke tests for Consultify chat (Anna + Teresa + V8)
# Run: bash tests/production-smoke.sh [BASE_URL]

set -euo pipefail

BASE="${1:-https://consultify.ai}"
PASS=0
FAIL=0
WARN=0

c_green='\033[0;32m'
c_red='\033[0;31m'
c_yellow='\033[0;33m'
c_reset='\033[0m'

ok()   { ((PASS++)); echo -e "${c_green}✓ PASS${c_reset} $1"; }
fail() { ((FAIL++)); echo -e "${c_red}✗ FAIL${c_reset} $1"; }
warn() { ((WARN++)); echo -e "${c_yellow}⚠ WARN${c_reset} $1"; }

echo "═══════════════════════════════════════════"
echo " Consultify Production Smoke Tests"
echo " Target: $BASE"
echo " Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════"
echo ""

# ──────────────────────────────
# 1. Health check
# ──────────────────────────────
echo "── 1. Health & Connectivity ──"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/ping" 2>/dev/null)
[[ "$HTTP" == "200" ]] && ok "/ping → 200" || fail "/ping → $HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" 2>/dev/null)
[[ "$HTTP" == "200" ]] && ok "/api/health → 200" || warn "/api/health → $HTTP"

echo ""

# ──────────────────────────────
# 2. Public Anna chat
# ──────────────────────────────
echo "── 2. Anna (Public Chat) ──"

ANNA_RESP=$(curl -s -X POST "$BASE/api/public/anna/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Czym jest Consultify?","locale":"pl","siteKey":"consultify"}' \
  2>/dev/null)
ANNA_STATUS=$?

if [[ $ANNA_STATUS -eq 0 ]]; then
  ANNA_MSG=$(echo "$ANNA_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message','')[:80])" 2>/dev/null || echo "")
  ANNA_ERR=$(echo "$ANNA_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")
  ANNA_FALLBACK=$(echo "$ANNA_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('fallbackReason',''))" 2>/dev/null || echo "")

  if [[ -n "$ANNA_MSG" && -z "$ANNA_ERR" && "$ANNA_FALLBACK" != "service_unavailable" ]]; then
    ok "Anna chat → response received (${#ANNA_MSG} chars)"
    echo "    Preview: ${ANNA_MSG:0:100}..."
  elif [[ "$ANNA_FALLBACK" == "service_unavailable" ]]; then
    fail "Anna chat → service_unavailable (LLM provider down?)"
  elif [[ -n "$ANNA_ERR" ]]; then
    fail "Anna chat → error: $ANNA_ERR"
  else
    warn "Anna chat → empty response"
  fi
else
  fail "Anna chat → curl failed ($ANNA_STATUS)"
fi

# Anna voice config
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/public/anna/voice-config?siteKey=consultify" 2>/dev/null)
[[ "$HTTP" == "200" ]] && ok "Anna voice-config → 200" || warn "Anna voice-config → $HTTP"

echo ""

# ──────────────────────────────
# 3. V8 global gate
# ──────────────────────────────
echo "── 3. V8 Feature Gate ──"

V8_RESP=$(curl -s "$BASE/api/public/kb-v8/articles" 2>/dev/null)
V8_ERR=$(echo "$V8_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")

if [[ "$V8_ERR" == *"V8_DISABLED"* ]]; then
  fail "V8 global gate → DISABLED (ENABLE_V8_GLOBAL not set)"
elif [[ "$V8_ERR" == *"V8"* ]]; then
  fail "V8 global gate → blocked: $V8_ERR"
else
  ok "V8 global gate → open (not V8_DISABLED)"
fi

echo ""

# ──────────────────────────────
# 4. KB V8 public endpoints
# ──────────────────────────────
echo "── 4. Knowledge Base (Public V8) ──"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/public/kb-v8/articles" 2>/dev/null)
[[ "$HTTP" == "200" ]] && ok "KB articles → 200" || warn "KB articles → $HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/public/kb-v8/categories" 2>/dev/null)
[[ "$HTTP" == "200" ]] && ok "KB categories → 200" || warn "KB categories → $HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/public/kb-v8/featured" 2>/dev/null)
[[ "$HTTP" == "200" ]] && ok "KB featured → 200" || warn "KB featured → $HTTP"

echo ""

# ──────────────────────────────
# 5. LLM providers health
# ──────────────────────────────
echo "── 5. LLM Providers ──"

LLM_RESP=$(curl -s "$BASE/api/llm/providers/health" 2>/dev/null)
LLM_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/llm/providers/health" 2>/dev/null)

if [[ "$LLM_HTTP" == "200" ]]; then
  ok "LLM providers health → 200"
elif [[ "$LLM_HTTP" == "401" ]]; then
  warn "LLM providers health → 401 (auth required, expected for some setups)"
else
  fail "LLM providers health → $LLM_HTTP"
fi

echo ""

# ──────────────────────────────
# 6. Chat stream (requires auth — just check route exists)
# ──────────────────────────────
echo "── 6. Chat Stream Route ──"

STREAM_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/ai/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' 2>/dev/null)

if [[ "$STREAM_HTTP" == "401" ]]; then
  ok "Chat stream route exists → 401 (auth required, expected)"
elif [[ "$STREAM_HTTP" == "400" ]]; then
  warn "Chat stream → 400 (validation error — check if screenContext fix deployed)"
elif [[ "$STREAM_HTTP" == "404" ]]; then
  fail "Chat stream → 404 (route not mounted)"
else
  warn "Chat stream → $STREAM_HTTP"
fi

echo ""

# ──────────────────────────────
# 7. V8 Teresa (requires auth)
# ──────────────────────────────
echo "── 7. Teresa Route ──"

TERESA_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v8/teresa/proposals" 2>/dev/null)

if [[ "$TERESA_HTTP" == "401" || "$TERESA_HTTP" == "403" ]]; then
  ok "Teresa route exists → $TERESA_HTTP (auth required, expected)"
elif [[ "$TERESA_HTTP" == "404" ]]; then
  TERESA_BODY=$(curl -s "$BASE/api/v8/teresa/proposals" 2>/dev/null)
  TERESA_CODE=$(echo "$TERESA_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('code',''))" 2>/dev/null || echo "")
  if [[ "$TERESA_CODE" == "V8_DISABLED" ]]; then
    fail "Teresa → V8_DISABLED (ENABLE_V8_GLOBAL missing)"
  elif [[ "$TERESA_CODE" == "V8_ORG_DISABLED" ]]; then
    warn "Teresa → V8_ORG_DISABLED (v8_feature_flags empty for org)"
  else
    fail "Teresa → 404 (route not mounted)"
  fi
else
  warn "Teresa → $TERESA_HTTP"
fi

echo ""

# ──────────────────────────────
# 8. Database query test (virtual_worker_profiles)
# ──────────────────────────────
echo "── 8. Virtual Worker (Anna Profile) ──"

VOICE_RESP=$(curl -s "$BASE/api/public/anna/voice-context?locale=pl&siteKey=consultify&sessionId=test-$(date +%s)" 2>/dev/null)
VOICE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/public/anna/voice-context?locale=pl&siteKey=consultify&sessionId=test-$(date +%s)" 2>/dev/null)

if [[ "$VOICE_HTTP" == "200" ]]; then
  VOICE_ERR=$(echo "$VOICE_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")
  if [[ -z "$VOICE_ERR" ]]; then
    ok "Anna voice-context → 200 (worker profile loaded)"
  else
    warn "Anna voice-context → 200 but with error: $VOICE_ERR"
  fi
else
  fail "Anna voice-context → $VOICE_HTTP"
fi

echo ""

# ──────────────────────────────
# 9. Conversations route
# ──────────────────────────────
echo "── 9. Conversations Route ──"

CONV_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/conversations" 2>/dev/null)

if [[ "$CONV_HTTP" == "401" ]]; then
  ok "Conversations route → 401 (auth required, expected)"
elif [[ "$CONV_HTTP" == "404" ]]; then
  fail "Conversations route → 404 (not mounted)"
else
  warn "Conversations → $CONV_HTTP"
fi

echo ""

# ──────────────────────────────
# 10. Frontend serving
# ──────────────────────────────
echo "── 10. Frontend ──"

FE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
[[ "$FE_HTTP" == "200" ]] && ok "Frontend index → 200" || fail "Frontend index → $FE_HTTP"

echo ""

# ──────────────────────────────
# Summary
# ──────────────────────────────
echo "═══════════════════════════════════════════"
echo -e " Results: ${c_green}$PASS passed${c_reset}, ${c_red}$FAIL failed${c_reset}, ${c_yellow}$WARN warnings${c_reset}"
TOTAL=$((PASS + FAIL + WARN))
echo " Total:   $TOTAL tests"
echo "═══════════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
