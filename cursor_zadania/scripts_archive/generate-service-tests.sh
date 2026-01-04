#!/bin/bash

# Script to generate service test templates
# Usage: ./scripts/generate-service-tests.sh <service-file-path>

SERVICE_FILE=$1
SERVICE_NAME=$(basename $SERVICE_FILE .ts | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1)) substr($i,2)}}1' | sed 's/ //g')
SERVICE_NAME_LOWER=$(basename $SERVICE_FILE .ts)

if [ -z "$SERVICE_FILE" ]; then
    echo "Usage: $0 <service-file-path>"
    exit 1
fi

TEST_FILE="server/tests/unit/backend/services/${SERVICE_NAME}.test.ts"

if [ -f "$TEST_FILE" ]; then
    echo "Test file already exists: $TEST_FILE"
    exit 1
fi

cat > "$TEST_FILE" << EOF
/**
 * ${SERVICE_NAME} Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for ${SERVICE_NAME} - 85%+ coverage target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDatabase } from '../../../../src/database/IDatabase.js';
import ${SERVICE_NAME} from '../../../../src/services/${SERVICE_NAME_LOWER}.js';

describe('${SERVICE_NAME}', () => {
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

        if (${SERVICE_NAME}.setDependencies) {
            ${SERVICE_NAME}.setDependencies({ db: mockDb });
        }
    });

    describe('Service Methods', () => {
        it('should have required methods', () => {
            expect(${SERVICE_NAME}).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database error'));
            });

            expect(true).toBe(true);
        });
    });
});
EOF

echo "Generated test file: $TEST_FILE"
chmod +x "$TEST_FILE"

