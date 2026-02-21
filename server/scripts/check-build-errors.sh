#!/bin/bash
# Script to check for TypeScript build errors that would occur in Docker
# This uses the same command Docker uses: tsc --build tsconfig.build.json

set -e

echo "🔍 Checking TypeScript build errors (Docker-compatible check)..."
echo ""

cd "$(dirname "$0")/.."

# Run the same command Docker uses
./node_modules/.bin/tsc --build tsconfig.build.json --force 2>&1 | tee /tmp/tsc-build-output.txt

# Check for errors
if grep -q "error TS" /tmp/tsc-build-output.txt; then
    echo ""
    echo "❌ TypeScript build errors found:"
    grep "error TS" /tmp/tsc-build-output.txt | head -20
    exit 1
else
    echo ""
    echo "✅ No TypeScript build errors found!"
    exit 0
fi
