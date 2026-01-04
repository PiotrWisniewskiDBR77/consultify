/**
 * Test Utilities
 * Enterprise SaaS Architecture - TypeScript Backend Tests
 *
 * Common utilities for backend tests: mocks, fixtures, helpers
 */

import type { NextFunction, Request, Response } from 'express';
import { vi } from 'vitest';

import type { IDatabase } from '../../src/database/IDatabase.js';

// ==========================================
// MOCK DATABASE
// ==========================================

/**
 * Create a mock database instance for testing
 */
export function createMockDatabase(): IDatabase {
    const mockDb: IDatabase = {
        get: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null, row: unknown) => void) => {
            if (callback) {
                callback(null, null);
            }
            return mockDb;
        }),
        all: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null, rows: unknown[]) => void) => {
            if (callback) {
                callback(null, []);
            }
            return mockDb;
        }),
        run: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(null);
            }
            return mockDb;
        }),
        exec: vi.fn((sql: string, callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(null);
            }
            return mockDb;
        }),
        serialize: vi.fn((callback: () => void) => {
            callback();
        }),
        close: vi.fn((callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(null);
            }
        }),
        query: vi.fn(),
    };

    return mockDb;
}

// ==========================================
// MOCK EXPRESS REQUEST/RESPONSE
// ==========================================

/**
 * Create a mock Express request
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
        method: 'GET',
        path: '/api/test',
        originalUrl: '/api/test',
        url: '/api/test',
        query: {},
        params: {},
        body: {},
        headers: {},
        ip: '127.0.0.1',
        get: vi.fn((header: string) => undefined),
        ...overrides,
    } as Partial<Request>;
}

/**
 * Create a mock Express response
 */
export function createMockResponse(): Partial<Response> {
    const res = {
        statusCode: 200,
        status: vi.fn((code: number) => {
            res.statusCode = code;
            return res;
        }),
        json: vi.fn((data: unknown) => res),
        send: vi.fn((data: unknown) => res),
        sendFile: vi.fn((path: string) => res),
        set: vi.fn((header: string, value: string) => res),
        on: vi.fn((event: string, callback: () => void) => {
            if (event === 'finish') {
                setTimeout(callback, 0);
            }
            return res;
        }),
    } as Partial<Response>;

    return res;
}

/**
 * Create a mock Express next function
 */
export function createMockNext(): NextFunction {
    return vi.fn() as NextFunction;
}

// ==========================================
// TEST FIXTURES
// ==========================================

/**
 * Common test user fixture
 */
export const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'user',
    organizationId: 'test-org-id',
    name: 'Test User',
};

/**
 * Common test organization fixture
 */
export const testOrganization = {
    id: 'test-org-id',
    name: 'Test Organization',
    tier: 'free',
    createdAt: new Date().toISOString(),
};

/**
 * Common test project fixture
 */
export const testProject = {
    id: 'test-project-id',
    name: 'Test Project',
    organizationId: 'test-org-id',
    status: 'active',
    createdAt: new Date().toISOString(),
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Wait for a promise to resolve (useful for async tests)
 */
export function waitFor(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a test error
 */
export function createTestError(message: string, code?: string): Error & { code?: string } {
    const error = new Error(message) as Error & { code?: string };
    if (code) {
        error.code = code;
    }
    return error;
}

/**
 * Reset all mocks (useful in beforeEach)
 */
export function resetMocks(): void {
    vi.clearAllMocks();
}


