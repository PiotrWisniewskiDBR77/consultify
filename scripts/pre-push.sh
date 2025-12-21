#!/bin/bash
set -e

echo "🔒 Pre-Push Quality Gate"

echo "1. Linting..."
npm run lint

echo "2. Type Checking..."
npx tsc --noEmit

echo "3. Unit Tests..."
npm run test:unit

echo "4. Integration Sanitization (Critical Path)..."
# Run only critical integration path to ensure core mechanics work
# This prevents pushing obviously broken code without waiting for full suite
npx vitest run tests/integration/actionExecution.test.js --run

echo "✅ Ready to Push!"
