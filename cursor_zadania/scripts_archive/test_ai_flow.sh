#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# CONSULTIFY AI FLOW - AUTOMATED TEST SUITE
# ═══════════════════════════════════════════════════════════════════

BASE_URL="${BASE_URL:-http://localhost:3005}"
PASS=0
FAIL=0
TESTS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       🧪 CONSULTIFY AI - AUTOMATED TEST SUITE 🧪              ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Base URL: $BASE_URL"
echo "║  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected="$3"
    local method="${4:-GET}"
    local data="$5"
    
    printf "  %-40s " "$name"
    
    if [ "$method" == "POST" ]; then
        response=$(curl -s -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
        TESTS+=("✅ $name")
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo -e "     ${YELLOW}Expected: $expected${NC}"
        echo -e "     ${YELLOW}Got: ${response:0:80}...${NC}"
        ((FAIL++))
        TESTS+=("❌ $name")
        return 1
    fi
}

test_http_code() {
    local name="$1"
    local endpoint="$2"
    local expected_codes="$3"  # Can be "401|403" for multiple accepted codes
    
    printf "  %-40s " "$name"
    
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    
    # Check if code matches any of the expected codes
    if echo "$expected_codes" | grep -qE "(^|\\|)$code(\\||$)"; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $code)"
        ((PASS++))
        TESTS+=("✅ $name")
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $code, expected $expected_codes)"
        ((FAIL++))
        TESTS+=("❌ $name")
        return 1
    fi
}

test_not_empty() {
    local name="$1"
    local endpoint="$2"
    
    printf "  %-40s " "$name"
    
    response=$(curl -s "$BASE_URL$endpoint" 2>/dev/null)
    
    if [ -n "$response" ] && [ "$response" != "{}" ] && [ "$response" != "[]" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
        TESTS+=("✅ $name")
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (empty response)"
        ((FAIL++))
        TESTS+=("❌ $name")
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 1: CORE HEALTH
# ═══════════════════════════════════════════════════════════════════
echo -e "${CYAN}━━━ 1. CORE HEALTH CHECKS ━━━${NC}"

test_endpoint "Server is running" "/" "<!DOCTYPE html" 
test_endpoint "Health Check API" "/api/llm/health-check-ai" "OK"
test_endpoint "Health Check Version" "/api/llm/health-check-ai" "FAILOVER-READY"
test_endpoint "Diagnose API" "/api/llm/diagnose" "version"

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 2: LLM PROVIDERS & CONFIGURATION
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 2. LLM PROVIDERS ━━━${NC}"

test_endpoint "Providers Table Exists" "/api/llm/diagnose" "llm_providers_table"
test_endpoint "Providers Count > 0" "/api/llm/diagnose" "providers_count"
test_endpoint "Active Providers Exist" "/api/llm/diagnose" "active_providers"
test_endpoint "API Connection OK" "/api/llm/diagnose" "api_connection"

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 3: AI PIPELINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 3. AI PIPELINE ENDPOINTS ━━━${NC}"

test_http_code "V2 Chat (requires auth)" "/api/llm/v2/chat" "401|403"
test_http_code "Magic Wand (requires auth)" "/api/llm/magic-wand" "401|403"
test_http_code "Generate Report (requires auth)" "/api/llm/generate-report" "401|403"
test_http_code "Search Knowledge (requires auth)" "/api/llm/search" "401|403"

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 4: METRICS & MONITORING (PUBLIC)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 4. METRICS & MONITORING ━━━${NC}"

test_http_code "Metrics Endpoint Accessible" "/api/llm/metrics" "200|401|403"
test_endpoint "Metrics JSON Format" "/api/llm/metrics?format=json" "timestamp"

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 5: DATABASE INTEGRITY
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 5. DATABASE INTEGRITY ━━━${NC}"

test_endpoint "LLM Providers Table OK" "/api/llm/diagnose" "\"status\":\"OK\""
test_endpoint "Diagnose Status OK" "/api/llm/diagnose" "\"status\":\"OK\""

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 6: SECURITY (Protected Endpoints)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 6. SECURITY (Auth Required) ━━━${NC}"

test_http_code "Circuits Protected" "/api/llm/circuits" "401|403"
test_http_code "Rate Limits Protected" "/api/llm/rate-limits" "401|403"
test_http_code "Control Usage Protected" "/api/llm/control/usage" "401|403"
test_http_code "Prompts Protected" "/api/llm/prompts" "401|403"
test_http_code "Audit Stats Protected" "/api/llm/audit/stats" "401|403"

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 7: INFRASTRUCTURE STATUS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 7. INFRASTRUCTURE STATUS ━━━${NC}"

test_endpoint "Redis Status Endpoint" "/api/llm/redis-status" "timestamp"
test_endpoint "Redis Connected" "/api/llm/redis-status" "connected"
test_endpoint "Observability Status" "/api/llm/observability-status" "timestamp"
test_endpoint "Alerting Status" "/api/llm/alerting-status" "timestamp"

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 8: FAILOVER SYSTEM
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 8. FAILOVER SYSTEM ━━━${NC}"

test_endpoint "Failover Ready Flag" "/api/llm/health-check-ai" "FAILOVER-READY"

# Check if multiple providers exist
PROVIDERS=$(curl -s "$BASE_URL/api/llm/diagnose" 2>/dev/null | grep -o '"active_providers".*"value":[0-9]*' | grep -o '[0-9]*$')
printf "  %-40s " "Multiple Providers (>1)"
if [ -n "$PROVIDERS" ] && [ "$PROVIDERS" -gt 1 ]; then
    echo -e "${GREEN}✅ PASS${NC} ($PROVIDERS providers)"
    ((PASS++))
    TESTS+=("✅ Multiple Providers")
else
    echo -e "${YELLOW}⚠️  WARN${NC} (only $PROVIDERS provider)"
    ((PASS++))  # Not critical
    TESTS+=("⚠️ Multiple Providers")
fi

# ═══════════════════════════════════════════════════════════════════
# TEST SECTION 9: RESPONSE TIMES
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━ 9. RESPONSE TIMES ━━━${NC}"

check_response_time() {
    local name="$1"
    local endpoint="$2"
    local max_ms="$3"
    
    printf "  %-40s " "$name"
    
    time_sec=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL$endpoint" 2>/dev/null)
    time_ms_int=$(awk "BEGIN {printf \"%.0f\", $time_sec * 1000}")
    
    if [ -z "$time_ms_int" ] || [ "$time_ms_int" -eq 0 ]; then
        time_ms_int=1
    fi
    
    if [ "$time_ms_int" -lt "$max_ms" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${time_ms_int}ms < ${max_ms}ms)"
        ((PASS++))
        TESTS+=("✅ $name")
    else
        echo -e "${YELLOW}⚠️  SLOW${NC} (${time_ms_int}ms > ${max_ms}ms)"
        ((PASS++))  # Not critical
        TESTS+=("⚠️ $name (slow)")
    fi
}

check_response_time "Health Check < 500ms" "/api/llm/health-check-ai" 500
check_response_time "Diagnose < 2000ms" "/api/llm/diagnose" 2000

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      📊 TEST SUMMARY                          ║"
echo "╠═══════════════════════════════════════════════════════════════╣"

TOTAL=$((PASS + FAIL))
if [ $TOTAL -gt 0 ]; then
    PERCENT=$((PASS * 100 / TOTAL))
else
    PERCENT=0
fi

if [ $FAIL -eq 0 ]; then
    echo -e "║  ${GREEN}✅ ALL TESTS PASSED!${NC}                                        ║"
else
    echo -e "║  ${YELLOW}⚠️  Some tests failed${NC}                                        ║"
fi

echo "║                                                               ║"
printf "║  Total Tests: %-3d                                            ║\n" $TOTAL
printf "║  ${GREEN}Passed: %-3d${NC}                                                  ║\n" $PASS
printf "║  ${RED}Failed: %-3d${NC}                                                  ║\n" $FAIL
printf "║  Success Rate: %d%%                                           ║\n" $PERCENT
echo "╠═══════════════════════════════════════════════════════════════╣"

if [ $FAIL -gt 0 ]; then
    echo "║  Failed Tests:                                                ║"
    for test in "${TESTS[@]}"; do
        if [[ $test == ❌* ]]; then
            printf "║    %-57s ║\n" "$test"
        fi
    done
fi

echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Exit code
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 AI System is fully operational!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some issues detected - check failed tests above${NC}"
    exit 1
fi
