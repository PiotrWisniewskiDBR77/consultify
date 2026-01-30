/**
 * Professional Integration Test Patterns
 *
 * Enterprise-grade patterns for API and database integration testing
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface IntegrationTestContext {
    baseUrl: string;
    authToken?: string;
    cleanup: (() => Promise<void>)[];
}

export interface ApiTestOptions {
    baseUrl: string;
    auth?: { email: string; password: string } | { token: string };
    timeout?: number;
}

// ============================================================================
// Integration Test Helpers
// ============================================================================

/**
 * Create integration test context
 */
export function createIntegrationContext(options: ApiTestOptions): IntegrationTestContext {
    return {
        baseUrl: options.baseUrl,
        authToken: 'token' in (options.auth || {}) ? (options.auth as { token: string }).token : undefined,
        cleanup: [],
    };
}

/**
 * API Request helper
 */
export async function apiRequest(
    ctx: IntegrationTestContext,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: {
        body?: unknown;
        query?: Record<string, string>;
        headers?: Record<string, string>;
    } = {}
): Promise<{ status: number; data: unknown; headers: Headers }> {
    const url = new URL(path, ctx.baseUrl);

    if (options.query) {
        for (const [key, value] of Object.entries(options.query)) {
            url.searchParams.set(key, value);
        }
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (ctx.authToken) {
        headers['Authorization'] = `Bearer ${ctx.authToken}`;
    }

    const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => null);

    return {
        status: response.status,
        data,
        headers: response.headers,
    };
}

/**
 * Register cleanup action
 */
export function registerCleanup(
    ctx: IntegrationTestContext,
    cleanup: () => Promise<void>
): void {
    ctx.cleanup.push(cleanup);
}

/**
 * Run all cleanup actions
 */
export async function runCleanup(ctx: IntegrationTestContext): Promise<void> {
    for (const cleanup of ctx.cleanup.reverse()) {
        try {
            await cleanup();
        } catch (error) {
            console.warn('Cleanup failed:', error);
        }
    }
    ctx.cleanup.length = 0;
}

// ============================================================================
// API Integration Test Pattern
// ============================================================================

export interface CrudEndpointConfig {
    basePath: string;
    createPayload: () => Record<string, unknown>;
    updatePayload: () => Record<string, unknown>;
    idField?: string;
}

export function describeApiCrud(
    name: string,
    ctx: IntegrationTestContext,
    config: CrudEndpointConfig
): void {
    describe(`${name} API CRUD`, () => {
        let createdId: string;
        const { basePath, createPayload, updatePayload, idField = 'id' } = config;

        afterEach(async () => {
            if (createdId) {
                try {
                    await apiRequest(ctx, 'DELETE', `${basePath}/${createdId}`);
                } catch {
                    // Ignore cleanup errors
                }
                createdId = '';
            }
        });

        it('should create resource', async () => {
            const payload = createPayload();
            const res = await apiRequest(ctx, 'POST', basePath, { body: payload });

            expect(res.status).toBe(201);
            expect(res.data).toHaveProperty(idField);
            createdId = (res.data as Record<string, string>)[idField];
        });

        it('should list resources', async () => {
            const res = await apiRequest(ctx, 'GET', basePath);

            expect(res.status).toBe(200);
            expect(Array.isArray((res.data as { items?: unknown[] }).items || res.data)).toBe(true);
        });

        it('should get resource by id', async () => {
            // First create
            const createRes = await apiRequest(ctx, 'POST', basePath, { body: createPayload() });
            createdId = (createRes.data as Record<string, string>)[idField];

            // Then get
            const res = await apiRequest(ctx, 'GET', `${basePath}/${createdId}`);

            expect(res.status).toBe(200);
            expect((res.data as Record<string, string>)[idField]).toBe(createdId);
        });

        it('should return 404 for non-existent resource', async () => {
            const res = await apiRequest(ctx, 'GET', `${basePath}/non-existent-id`);
            expect(res.status).toBe(404);
        });

        it('should update resource', async () => {
            // First create
            const createRes = await apiRequest(ctx, 'POST', basePath, { body: createPayload() });
            createdId = (createRes.data as Record<string, string>)[idField];

            // Then update
            const res = await apiRequest(ctx, 'PUT', `${basePath}/${createdId}`, {
                body: updatePayload(),
            });

            expect(res.status).toBe(200);
        });

        it('should delete resource', async () => {
            // First create
            const createRes = await apiRequest(ctx, 'POST', basePath, { body: createPayload() });
            createdId = (createRes.data as Record<string, string>)[idField];

            // Then delete
            const res = await apiRequest(ctx, 'DELETE', `${basePath}/${createdId}`);

            expect([200, 204]).toContain(res.status);

            // Verify deleted
            const getRes = await apiRequest(ctx, 'GET', `${basePath}/${createdId}`);
            expect(getRes.status).toBe(404);

            createdId = ''; // Already deleted
        });
    });
}

// ============================================================================
// Database Integration Test Pattern
// ============================================================================

export interface DbIntegrationConfig {
    setup: () => Promise<void>;
    teardown: () => Promise<void>;
    seed?: () => Promise<void>;
}

export function describeDbIntegration(
    name: string,
    config: DbIntegrationConfig,
    tests: () => void
): void {
    describe(`${name} (Database Integration)`, () => {
        beforeAll(async () => {
            await config.setup();
            if (config.seed) {
                await config.seed();
            }
        });

        afterAll(async () => {
            await config.teardown();
        });

        tests();
    });
}

// ============================================================================
// Transaction Test Pattern
// ============================================================================

export interface TransactionTestConfig<T> {
    beginTransaction: () => Promise<T>;
    commitTransaction: (tx: T) => Promise<void>;
    rollbackTransaction: (tx: T) => Promise<void>;
}

export function withTransaction<T>(
    config: TransactionTestConfig<T>,
    test: (tx: T) => Promise<void>
): () => Promise<void> {
    return async () => {
        const tx = await config.beginTransaction();
        try {
            await test(tx);
        } finally {
            await config.rollbackTransaction(tx);
        }
    };
}

// ============================================================================
// Retry Pattern for Flaky Tests
// ============================================================================

export function withRetry(
    test: () => Promise<void>,
    options: { maxAttempts?: number; delay?: number } = {}
): () => Promise<void> {
    const { maxAttempts = 3, delay = 100 } = options;

    return async () => {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await test();
                return;
            } catch (error) {
                lastError = error as Error;
                if (attempt < maxAttempts) {
                    await new Promise((r) => setTimeout(r, delay * attempt));
                }
            }
        }

        throw lastError;
    };
}

// ============================================================================
// Parallel Test Execution
// ============================================================================

export async function runInParallel(
    tests: (() => Promise<void>)[],
    options: { concurrency?: number } = {}
): Promise<{ passed: number; failed: number; errors: Error[] }> {
    const { concurrency = 5 } = options;
    const results = { passed: 0, failed: 0, errors: [] as Error[] };

    const queue = [...tests];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
        while (running.length < concurrency && queue.length > 0) {
            const test = queue.shift()!;
            const promise = test()
                .then(() => {
                    results.passed++;
                })
                .catch((error) => {
                    results.failed++;
                    results.errors.push(error);
                })
                .finally(() => {
                    const index = running.indexOf(promise);
                    if (index >= 0) running.splice(index, 1);
                });
            running.push(promise);
        }

        if (running.length > 0) {
            await Promise.race(running);
        }
    }

    return results;
}

// ============================================================================
// Health Check Pattern
// ============================================================================

export async function waitForService(
    url: string,
    options: { timeout?: number; interval?: number } = {}
): Promise<void> {
    const { timeout = 30000, interval = 1000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // Service not ready yet
        }
        await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Service at ${url} not ready after ${timeout}ms`);
}
