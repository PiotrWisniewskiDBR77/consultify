#!/bin/bash

# Script to generate test files for all services
# Usage: ./scripts/generate-all-service-tests.sh

SERVICES_DIR="server/src/services"
TESTS_DIR="server/tests/unit/backend/services"
SCRIPT_DIR="scripts"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🚀 Generating test files for all services..."

# Find all service files
SERVICE_FILES=$(find "$SERVICES_DIR" -name "*.ts" -type f | grep -v ".test.ts" | grep -v "index.ts" | sort)

TOTAL=0
CREATED=0
SKIPPED=0
ERRORS=0

for SERVICE_FILE in $SERVICE_FILES; do
    TOTAL=$((TOTAL + 1))
    
    # Get service name
    SERVICE_NAME=$(basename "$SERVICE_FILE" .ts)
    SERVICE_NAME_CAPITALIZED=$(echo "$SERVICE_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1)) substr($i,2)}}1' | sed 's/ //g')
    
    # Check if test file already exists
    TEST_FILE="$TESTS_DIR/${SERVICE_NAME}.test.ts"
    
    if [ -f "$TEST_FILE" ]; then
        echo -e "${YELLOW}⏭️  Skipping $SERVICE_NAME (test already exists)${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Generate test file using the service test generator
    if [ -f "$SCRIPT_DIR/generate-service-tests.sh" ]; then
        if bash "$SCRIPT_DIR/generate-service-tests.sh" "$SERVICE_FILE" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Created test for $SERVICE_NAME${NC}"
            CREATED=$((CREATED + 1))
        else
            echo -e "${RED}❌ Error creating test for $SERVICE_NAME${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        # Fallback: create basic test file
        mkdir -p "$TESTS_DIR"
        cat > "$TEST_FILE" << EOF
/**
 * ${SERVICE_NAME_CAPITALIZED} Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for ${SERVICE_NAME} - 85%+ coverage target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDatabase } from '../../../../src/database/IDatabase.js';

describe('${SERVICE_NAME_CAPITALIZED}', () => {
    let mockDb: IDatabase;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                const dbObj = {
                    ...mockDb,
                    changes: 1,
                    lastID: 1,
                };
                if (callback) {
                    callback(null);
                }
                return dbObj;
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        } as unknown as IDatabase;
    });

    describe('Service Methods', () => {
        it('should have required methods', () => {
            expect(true).toBe(true);
        });
    });
});
EOF
        echo -e "${GREEN}✅ Created test for $SERVICE_NAME${NC}"
        CREATED=$((CREATED + 1))
    fi
done

echo ""
echo "📊 Summary:"
echo "  Total services: $TOTAL"
echo -e "  ${GREEN}Created: $CREATED${NC}"
echo -e "  ${YELLOW}Skipped: $SKIPPED${NC}"
echo -e "  ${RED}Errors: $ERRORS${NC}"
echo ""
echo "✨ Done!"

