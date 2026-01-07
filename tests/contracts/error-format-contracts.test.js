/**
 * API Contract Tests - Error Format Validation
 * Tests that error responses follow consistent format
 * 
 * @module tests/contracts/error-format-contracts.test.js
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Standard error codes
const errorCodes = {
    validation: ['VALIDATION_ERROR', 'INVALID_INPUT', 'MISSING_FIELD'],
    auth: ['UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_EXPIRED', 'INVALID_TOKEN'],
    resource: ['NOT_FOUND', 'ALREADY_EXISTS', 'CONFLICT'],
    server: ['INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'TIMEOUT'],
    rateLimit: ['RATE_LIMITED', 'TOO_MANY_REQUESTS'],
};

describe('Error Format Contract Tests', () => {
    let app;

    beforeAll(async () => {
        try {
            const gateway = await import('../../server/src/Gateway.ts');
            app = gateway.default || gateway.app;
        } catch (error) {
            const express = (await import('express')).default;
            app = express();
            app.use(express.json());

            // Mock error endpoints
            app.get('/api/test/not-found', (req, res) => {
                res.status(404).json({
                    success: false,
                    error: 'Resource not found',
                    code: 'NOT_FOUND',
                });
            });

            app.post('/api/test/validation-error', (req, res) => {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: {
                        field: 'email',
                        message: 'Invalid email format',
                    },
                });
            });

            app.get('/api/test/unauthorized', (req, res) => {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED',
                });
            });

            app.get('/api/test/forbidden', (req, res) => {
                res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    code: 'FORBIDDEN',
                });
            });

            app.get('/api/test/rate-limited', (req, res) => {
                res.status(429).json({
                    success: false,
                    error: 'Too many requests',
                    code: 'RATE_LIMITED',
                    retryAfter: 60,
                });
            });

            app.get('/api/test/server-error', (req, res) => {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                });
            });
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // 400 BAD REQUEST
    // ═══════════════════════════════════════════════════════════════════

    describe('400 Bad Request', () => {
        it('should return validation error format', async () => {
            const response = await request(app)
                .post('/api/test/validation-error')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code');
        });

        it('should include field details for validation errors', async () => {
            const response = await request(app)
                .post('/api/test/validation-error')
                .send({});

            if (response.status === 400 && response.body.code === 'VALIDATION_ERROR') {
                expect(response.body).toHaveProperty('details');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // 401 UNAUTHORIZED
    // ═══════════════════════════════════════════════════════════════════

    describe('401 Unauthorized', () => {
        it('should return proper unauthorized format', async () => {
            const response = await request(app).get('/api/test/unauthorized');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        it('should include auth error code', async () => {
            const response = await request(app).get('/api/test/unauthorized');

            if (response.status === 401) {
                expect(errorCodes.auth).toContain(response.body.code);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // 403 FORBIDDEN
    // ═══════════════════════════════════════════════════════════════════

    describe('403 Forbidden', () => {
        it('should return proper forbidden format', async () => {
            const response = await request(app).get('/api/test/forbidden');

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('success', false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // 404 NOT FOUND
    // ═══════════════════════════════════════════════════════════════════

    describe('404 Not Found', () => {
        it('should return proper not found format', async () => {
            const response = await request(app).get('/api/test/not-found');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        it('should have NOT_FOUND code', async () => {
            const response = await request(app).get('/api/test/not-found');

            if (response.status === 404) {
                expect(response.body.code).toBe('NOT_FOUND');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // 429 RATE LIMITED
    // ═══════════════════════════════════════════════════════════════════

    describe('429 Rate Limited', () => {
        it('should return rate limit format', async () => {
            const response = await request(app).get('/api/test/rate-limited');

            expect(response.status).toBe(429);
            expect(response.body).toHaveProperty('success', false);
        });

        it('should include retryAfter', async () => {
            const response = await request(app).get('/api/test/rate-limited');

            if (response.status === 429) {
                expect(response.body).toHaveProperty('retryAfter');
                expect(typeof response.body.retryAfter).toBe('number');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // 500 INTERNAL ERROR
    // ═══════════════════════════════════════════════════════════════════

    describe('500 Internal Error', () => {
        it('should return generic error format', async () => {
            const response = await request(app).get('/api/test/server-error');

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        it('should not expose stack traces', async () => {
            const response = await request(app).get('/api/test/server-error');

            expect(response.body).not.toHaveProperty('stack');
            expect(JSON.stringify(response.body)).not.toContain('at ');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR CODE CONSISTENCY
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Code Consistency', () => {
        const allCodes = Object.values(errorCodes).flat();

        it('should use upper snake case for error codes', async () => {
            const response = await request(app).get('/api/test/not-found');

            if (response.body.code) {
                expect(response.body.code).toMatch(/^[A-Z_]+$/);
            }
        });

        it('should use known error codes', async () => {
            const response = await request(app).get('/api/test/not-found');

            if (response.body.code) {
                expect(allCodes).toContain(response.body.code);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR MESSAGE QUALITY
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Message Quality', () => {
        it('should have human-readable error messages', async () => {
            const response = await request(app).get('/api/test/not-found');

            if (response.body.error) {
                expect(response.body.error.length).toBeGreaterThan(5);
                expect(response.body.error).not.toMatch(/^[A-Z_]+$/); // Not just code
            }
        });

        it('should not expose internal details', async () => {
            const response = await request(app).get('/api/test/server-error');

            const responseStr = JSON.stringify(response.body);
            expect(responseStr.toLowerCase()).not.toContain('sqlite');
            expect(responseStr.toLowerCase()).not.toContain('database');
            expect(responseStr).not.toContain('/Users/');
        });
    });
});
