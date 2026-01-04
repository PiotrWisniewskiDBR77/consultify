#!/bin/bash
# Test Sharding Script
# Splits tests into shards for parallel execution

set -e

SHARD_INDEX=${1:-0}
SHARD_TOTAL=${2:-1}

if [ -z "$SHARD_INDEX" ] || [ -z "$SHARD_TOTAL" ]; then
    echo "Usage: $0 <shard_index> <shard_total>"
    echo "Example: $0 0 4  # Run shard 0 of 4"
    exit 1
fi

echo "Running test shard $SHARD_INDEX of $SHARD_TOTAL"

# Get all test files
TEST_FILES=$(find tests/unit tests/components tests/integration -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | sort)

# Calculate shard size
TOTAL_TESTS=$(echo "$TEST_FILES" | wc -l | tr -d ' ')
SHARD_SIZE=$((TOTAL_TESTS / SHARD_TOTAL))
REMAINDER=$((TOTAL_TESTS % SHARD_TOTAL))

# Calculate start and end indices
START_INDEX=$((SHARD_INDEX * SHARD_SIZE))
if [ $SHARD_INDEX -lt $REMAINDER ]; then
    START_INDEX=$((START_INDEX + SHARD_INDEX))
    END_INDEX=$((START_INDEX + SHARD_SIZE + 1))
else
    START_INDEX=$((START_INDEX + REMAINDER))
    END_INDEX=$((START_INDEX + SHARD_SIZE))
fi

# Extract shard files
SHARD_FILES=$(echo "$TEST_FILES" | sed -n "${START_INDEX},${END_INDEX}p")

if [ -z "$SHARD_FILES" ]; then
    echo "No test files in shard $SHARD_INDEX"
    exit 0
fi

echo "Shard $SHARD_INDEX contains $(echo "$SHARD_FILES" | wc -l | tr -d ' ') test files"

# Run tests in this shard
echo "$SHARD_FILES" | xargs npm run test:unit -- --run

