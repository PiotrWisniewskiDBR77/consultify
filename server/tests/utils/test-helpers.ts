/**
 * Test Utilities and Helpers
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Shared utilities for backend tests
 */

import { vi } from 'vitest';

import type { IDatabase } from '../../src/database/IDatabase.js';

/**
 * Create a mock database instance
 */
export function createMockDatabase(): IDatabase {
    return {
        get: vi.fn((sql: string, params: unknown[], callback: (err: Error | null, row?: unknown) => void) => {
            callback(null, {});
            return {} as IDatabase;
        }),
        all: vi.fn((sql: string, params: unknown[], callback: (err: Error | null, rows?: unknown[]) => void) => {
            callback(null, []);
            return {} as IDatabase;
        }),
        run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null, changes?: number) => void) => {
            callback(null, 0);
            return {} as IDatabase;
        }),
        exec: vi.fn((sql: string, callback: (err: Error | null) => void) => {
            callback(null);
            return {} as IDatabase;
        }),
        serialize: vi.fn((callback: () => void) => {
            callback();
        }),
        close: vi.fn((callback?: (err: Error | null) => void) => {
            if (callback) callback(null);
        }),
    } as unknown as IDatabase;
}

/**
 * Create a mock Express request
 */
export function createMockRequest() {
    return {
        method: 'GET',
        path: '/api/test',
        originalUrl: '/api/test',
        ip: '127.0.0.1',
        body: {},
        query: {},
        params: {},
        headers: {},
        socket: {
            remoteAddress: '127.0.0.1',
        },
    };
}

/**
 * Create a mock Express response
 */
export function createMockResponse() {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        sendFile: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
    };
    return res;
}

/**
 * Create a mock Express next function
 */
export function createMockNext() {
    return vi.fn();
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a test user object
 */
export function createTestUser(overrides?: Partial<{ id: string; email: string; role: string }>) {
    return {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        ...overrides,
    };
}

/**
 * Create a test organization object
 */
export function createTestOrganization(overrides?: Partial<{ id: string; name: string; status: string }>) {
    return {
        id: 'org-123',
        name: 'Test Organization',
        status: 'active',
        ...overrides,
    };
}

