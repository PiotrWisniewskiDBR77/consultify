#!/bin/bash
set -e

echo "========================================================"
echo "🚀 STARTING 5-LEVEL SYSTEM TEST PROTOCOL"
echo "========================================================"

# Level 1: Static Analysis & Integrity
echo ""
echo "🔍 [LEVEL 1] Static Analysis & Integrity"
echo "----------------------------------------"
echo "Running ESLint..."
npm run lint
echo "Running TypeScript Check..."
npx tsc --noEmit
echo "✅ Level 1 Check Passed"

# Level 2: Unit Testing
echo ""
echo "🧪 [LEVEL 2] Unit Testing"
echo "----------------------------------------"
echo "Running Backend Unit Tests..."
npm run test:backend
echo "Running Frontend Unit Tests..."
npm run test:unit
echo "✅ Level 2 Check Passed"

# Level 3: Component Testing
echo ""
echo "🧩 [LEVEL 3] Component Testing"
echo "----------------------------------------"
echo "Running Component Tests..."
npm run test:component
echo "✅ Level 3 Check Passed"

# Level 4: Integration & API Testing
echo ""
echo "🔌 [LEVEL 4] Integration & API Testing"
echo "----------------------------------------"
echo "Running Integration Tests..."
npm run test:integration
echo "✅ Level 4 Check Passed"

# Level 5: System & Performance Testing
echo ""
echo "🚀 [LEVEL 5] System & Performance Testing"
echo "----------------------------------------"
echo "Running Load Tests (Simplified)..."
npm run test:load
# Note: Full E2E logic often requires a running server, skipping heavy E2E in this quick script unless requested
echo "✅ Level 5 Check Passed"

echo ""
echo "========================================================"
echo "📊 CHECKING CODE COVERAGE (Goal: 90%)"
echo "========================================================"
npm run test:coverage

echo ""
echo "🎉 ALL SYSTEMS GO! 5-LEVEL TESTING COMPLETE."
echo "========================================================"
