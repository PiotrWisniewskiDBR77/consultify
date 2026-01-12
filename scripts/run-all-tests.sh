#!/bin/bash
set -e

echo "========================================================"
echo "🧪 RUNNING COMPREHENSIVE TEST SUITE"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run tests and track results
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 Running: $suite_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $suite_name: PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $suite_name: FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Level 1: Unit Tests
run_test_suite "Unit Tests (Backend)" "npm run test:backend"
run_test_suite "Unit Tests (Frontend)" "npm run test:unit -- tests/unit --exclude tests/unit/backend"

# Level 2: Component Tests
run_test_suite "Component Tests" "npm run test:component"

# Level 3: Integration Tests
run_test_suite "Integration Tests" "npm run test:integration"

# Level 4: Error Handling Tests
run_test_suite "Error Handling Tests" "npm run test:integration -- tests/integration/errorHandling.test.js tests/integration/apiResilience.test.js tests/integration/criticalEndpoints.test.js"

# Level 5: Backend Error Recovery Tests
run_test_suite "Backend Error Recovery Tests" "npm run test:unit -- tests/unit/backend/errorRecovery.test.js"

# Summary
echo ""
echo "========================================================"
echo "📊 TEST SUMMARY"
echo "========================================================"
echo -e "Total Test Suites: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
    exit 1
fi

