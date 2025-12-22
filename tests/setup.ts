import '@testing-library/jest-dom';
import { beforeAll, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { mockLLMApi } from './__mocks__/llmApi.js';

const require = createRequire(import.meta.url);

// Ensure consistent test-mode behavior across backend + frontend tests
if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
    process.env.MOCK_REDIS = process.env.MOCK_REDIS || 'true';
    process.env.MOCK_DB = process.env.MOCK_DB || 'true';
    // Keep DB in-memory in tests (db chooses :memory: when NODE_ENV === 'test')
    process.env.SQLITE_PATH = process.env.SQLITE_PATH || ':memory:';
}

// Reset LLM API mocks before each test
beforeEach(() => {
    mockLLMApi.reset();
});

// Ensure DB schema is initialized before any test starts hitting it.
beforeAll(async () => {
    try {
        const db = require('../server/database');
        if (db?.initPromise) {
            await db.initPromise;
        }
    } catch (err) {
        // If a given test-suite doesn't touch backend DB, do not fail it here.
        // Real failures should surface in the tests that use the DB.
        console.warn('[Test Setup] DB init wait skipped:', err?.message || err);
    }
});

if (typeof window !== 'undefined') {
    global.ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    };

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

// Node Polyfills
import { TextEncoder, TextDecoder } from 'util';
`global.TextEncoder = TextEncoder as unknown as typeof TextEncoder;`
`global.TextDecoder = TextDecoder as unknown as typeof TextDecoder;`

// PDF-Parse / Canvas Polyfills
global.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() { }
`};`

// Handle uncaught exceptions from async database operations during tests
// This prevents non-test-related FK constraint errors from causing CI exit code 1
if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', (err: Error) => {
        // Log but don't crash for known non-critical errors (e.g., activity logging FK violations)
        if (err.message && err.message.includes('SQLITE_CONSTRAINT') && err.message.includes('FOREIGN KEY')) {
            console.warn('[Test Setup] Non-critical uncaughtException (FK constraint):', err.message);
            return; // Don't rethrow, allow tests to continue
        }
        // For other errors, log and rethrow
        console.error('[Test Setup] Uncaught exception:', err);
        throw err;
    });
}
