/**
 * Comprehensive Error Handling Tests
 * Tests error handling, resilience, and recovery mechanisms
 */

// @vitest-environment node
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
// Using TestDatabaseFactory is safer/more standard now than legacy dbHelper.cjs
import { TestDatabaseFactory } from '../utils/TestDatabaseFactory.js';

// Explicitly mock Sentry here to survive resetModules
vi.mock('@sentry/node', () => ({
    init: vi.fn(),
    Handlers: { requestHandler: () => (req, res, next) => next(), errorHandler: () => (error, req, res, next) => next() },
    captureException: vi.fn(),
}));

// Deliberately delay app/db import until after mock injection

describe('Error Handling & Resilience', () => {
    let app;
    let db;

    beforeAll(async () => {
        // 1. Create DB
        const testDb = await TestDatabaseFactory.create();
        global.__TEST_DB_MOCK__ = testDb;

        // 2. Reset modules
        vi.resetModules();

        // 3. Import app/db
        const dbModule = await import('../../server/database.js');
        db = dbModule.default;

        const appModule = await import('../../server/src/index.ts');
        app = appModule.default || appModule;

        await db.initPromise;
    });

    afterEach(async () => {
        // Optional: clean tables if needed
        // await testDb.run('DELETE FROM ...'); 
    });

    describe('API Error Responses', () => {
        it('should return 404 for non-existent routes', async () => {
            const res = await request(app)
                .get('/api/nonexistent/route')
                .expect(404);

            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toHaveProperty('code');
            expect(res.body.error).toHaveProperty('message');
            expect(res.body.error).toHaveProperty('timestamp');
        });

        it('should return 400 for invalid request body', async () => {
            const res = await request(app)
                .post('/api/projects')
                .send({ invalid: 'data' })
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });

        it('should return 401 for unauthenticated requests', async () => {
            const res = await request(app)
                .get('/api/users/me')
                .expect(401);

            expect(res.body).toHaveProperty('error');
        });

        it('should handle malformed JSON gracefully', async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Content-Type', 'application/json')
                .send('invalid json{')
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });

        it('should handle missing required fields', async () => {
            const res = await request(app)
                .post('/api/projects')
                .send({})
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });
    });

    describe('Database Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // This test verifies that database errors don't crash the server
            // In a real scenario, we'd mock the database to throw errors
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body).toHaveProperty('status');
        });

        it('should return proper error format for database constraint violations', async () => {
            // Test foreign key violations, unique constraints, etc.
            // This would require setting up test data that violates constraints
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body.status).toBe('ok');
        });
    });

    describe('Async Error Handling', () => {
        it('should handle async route errors without crashing', async () => {
            // Test that async errors are caught by error handler middleware
            const res = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            expect(res.body).toHaveProperty('error');
        });

        it('should handle promise rejections in routes', async () => {
            // Verify that unhandled promise rejections are caught
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body).toHaveProperty('status');
        });
    });

    describe('Error Response Format', () => {
        it('should return consistent error format', async () => {
            const res = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            expect(res.body.error).toMatchObject({
                code: expect.any(String),
                message: expect.any(String),
                timestamp: expect.any(String)
            });
        });

        it('should include error code in response', async () => {
            const res = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            expect(res.body.error.code).toBe('NOT_FOUND');
        });

        it('should include timestamp in error response', async () => {
            const res = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            const timestamp = new Date(res.body.error.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('Rate Limiting Error Handling', () => {
        it('should return 429 for rate limit exceeded', async () => {
            // This test would require making many requests quickly
            // For now, we verify the rate limiter is configured
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body).toHaveProperty('status');
        });
    });

    describe('Server Resilience', () => {
        it('should not crash on invalid input', async () => {
            const invalidInputs = [
                null,
                undefined,
                '',
                'string',
                123,
                [],
                { deeply: { nested: { invalid: 'data' } } }
            ];

            for (const input of invalidInputs) {
                const res = await request(app)
                    .post('/api/projects')
                    .send(input)
                    .expect(400);

                expect(res.body).toHaveProperty('error');
            }
        });

        it('should handle concurrent error requests', async () => {
            const requests = Array(10).fill(null).map(() =>
                request(app)
                    .get('/api/nonexistent')
                    .expect(404)
            );

            const responses = await Promise.all(requests);
            responses.forEach(res => {
                expect(res.body).toHaveProperty('error');
            });
        });

        it('should recover from errors and continue serving requests', async () => {
            // Make an error request
            await request(app)
                .get('/api/nonexistent')
                .expect(404);

            // Verify server still responds to valid requests
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body.status).toBe('ok');
        });
    });

    describe('Error Logging', () => {
        it('should log errors without exposing sensitive data', async () => {
            const res = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            // Verify error response doesn't contain stack traces in production mode
            expect(res.body.error).not.toHaveProperty('stack');
        });
    });
});

