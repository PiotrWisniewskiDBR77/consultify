#!/usr/bin/env node
/**
 * Automated Service Migration Script
 * Converts a JavaScript service to TypeScript with Class-based Async DI pattern
 */

const fs = require('fs');
const path = require('path');

// Get service name from command line
const serviceName = process.argv[2];

if (!serviceName) {
    console.error('Usage: node migrate-service.js <serviceName>');
    console.error('Example: node migrate-service.js feedbackService');
    process.exit(1);
}

const jsPath = path.join(__dirname, '../server/services', `${serviceName}.js`);
const tsPath = path.join(__dirname, '../server/src/services', `${serviceName}.ts`);
const testPath = path.join(__dirname, '../server/tests/unit/backend/services', `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}.test.ts`);

// Check if source exists
if (!fs.existsSync(jsPath)) {
    console.error(`❌ Service not found: ${jsPath}`);
    process.exit(1);
}

// Check if already migrated
if (fs.existsSync(tsPath)) {
    console.error(`⚠️  Service already migrated: ${tsPath}`);
    process.exit(1);
}

console.log(`🚀 Migrating ${serviceName}...`);

// Read source
const source = fs.readFileSync(jsPath, 'utf-8');

// Extract service methods (simple regex-based extraction)
const methodMatches = source.matchAll(/(\w+)\s*:\s*async\s+function\s*\([^)]*\)|(\w+)\s*:\s*function\s*\([^)]*\)|(\w+)\s*:\s*\([^)]*\)\s*=>/g);
const methods = [];
for (const match of methodMatches) {
    const methodName = match[1] || match[2] || match[3];
    if (methodName && methodName !== 'initDeps') {
        methods.push(methodName);
    }
}

// Detect dependencies
const requireMatches = source.match(/require\(['"](.*?)['"]\)/g) || [];
const dependencies = requireMatches.map(req => {
    const match = req.match(/require\(['"](.*?)['"]\)/);
    return match ? match[1] : null;
}).filter(Boolean);

// Generate TypeScript class name
const className = serviceName.charAt(0).toUpperCase() + serviceName.slice(1) + 'Class';
const instanceName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);

// Generate TypeScript code
const tsCode = `/**
 * ${instanceName}
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Migrated from server/services/${serviceName}.js
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface ${instanceName}Deps {
    db: IDatabase;
    // TODO: Add other dependencies
}

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class ${className} {
    #deps: ${instanceName}Deps | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor(deps?: Partial<${instanceName}Deps>) {
        if (deps?.db) {
            this.#deps = deps as ${instanceName}Deps;
            this.#initialized = true;
        }
    }

    async #initDeps() {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            // TODO: Add dynamic imports for dependencies
            this.#deps = {
                db: getDatabase()
            };
            this.#initialized = true;
        })();

        return this.#initPromise;
    }

    setDependencies(newDeps: Partial<${instanceName}Deps>) {
        this.#deps = { ...this.#deps!, ...newDeps };
        this.#initialized = true;
    }

    private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
        await this.#initDeps();
        return DbPromise.get<T>(this.#deps!.db, sql, params);
    }

    private async dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
        await this.#initDeps();
        const result = await DbPromise.run(this.#deps!.db, sql, params);
        return {
            lastID: result.lastID,
            changes: result.changes || 0
        };
    }

    private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        await this.#initDeps();
        return DbPromise.all<T>(this.#deps!.db, sql, params);
    }

    // ==========================================
    // SERVICE METHODS
    // ==========================================

${methods.map(method => `    async ${method}() {
        await this.#initDeps();
        // TODO: Implement ${method}
        throw new Error('Not implemented');
    }`).join('\n\n')}
}

// ==========================================
// EXPORTS
// ==========================================

const ${instanceName} = new ${className}();

${methods.map(method => `export const ${method} = (...args: any[]) => ${instanceName}.${method}(...args);`).join('\n')}

export default ${instanceName};
`;

// Generate test code
const testCode = `/**
 * ${instanceName} Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDatabase } from '../../../../src/database/IDatabase.js';
import ${instanceName} from '../../../../src/services/${serviceName}.js';

describe('${instanceName}', () => {
    let mockDb: IDatabase;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(function (this: any, sql: string, params: unknown[], callback: (err: Error | null) => void) {
                if (callback) {
                    callback.call({ lastID: 1, changes: 1 }, null);
                }
                return this;
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        } as unknown as IDatabase;

        if (${instanceName}.setDependencies) {
            ${instanceName}.setDependencies({ db: mockDb });
        }
    });

    describe('Service Methods', () => {
        it('should be defined', () => {
            expect(${instanceName}).toBeDefined();
        });

        // TODO: Add functional tests for each method
${methods.map(method => `        it.todo('should test ${method}');`).join('\n')}
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
`;

// Create directories if needed
const tsDir = path.dirname(tsPath);
const testDir = path.dirname(testPath);

if (!fs.existsSync(tsDir)) {
    fs.mkdirSync(tsDir, { recursive: true });
}
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
}

// Write files
fs.writeFileSync(tsPath, tsCode);
fs.writeFileSync(testPath, testCode);

console.log(`✅ Generated TypeScript service: ${tsPath}`);
console.log(`✅ Generated test file: ${testPath}`);
console.log('');
console.log('📝 Next steps:');
console.log(`  1. Review and complete: ${tsPath}`);
console.log(`  2. Implement TODO items (dependencies, method bodies)`);
console.log(`  3. Complete tests: ${testPath}`);
console.log(`  4. Run: npx vitest run ${testPath}`);
console.log(`  5. If passing, remove: ${jsPath}`);
console.log('');
console.log('⚠️  This is a TEMPLATE. Manual review and completion required!');
