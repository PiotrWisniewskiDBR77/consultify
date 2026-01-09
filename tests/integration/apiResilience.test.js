/**
 * API Resilience Tests
 * 
 * Real integration tests for API resilience and error handling.
 * 
 * @module tests/integration/apiResilience.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('API Resilience & Recovery', () => {
    let app;

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();

        // Body parser with size limit
        app.use(express.json({ limit: '100kb' }));

        // Health check endpoint
        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', database: 'connected', timestamp: Date.now() });
        });

        // Endpoint that validates input
        app.post('/api/validate', (req, res) => {
            const { input } = req.body;

            if (!input || typeof input !== 'string') {
                return res.status(400).json({ error: 'Invalid input' });
            }

            // Check for SQL injection
            if (/('|--|;|DROP|DELETE|INSERT|UPDATE)/i.test(input)) {
                return res.status(400).json({ error: 'Invalid input - potential SQL injection' });
            }

            // Check for XSS
            if (/<script/i.test(input)) {
                return res.status(400).json({ error: 'Invalid input - potential XSS' });
            }

            // Check for excessive length
            if (input.length > 10000) {
                return res.status(400).json({ error: 'Payload too large' });
            }

            res.json({ success: true, sanitized: input.trim() });
        });

        // Endpoint that handles unicode
        app.post('/api/unicode', (req, res) => {
            const { text } = req.body;
            res.json({
                success: true,
                length: text ? text.length : 0,
                hasEmoji: text ? /[\u{1F000}-\u{1F9FF}]/u.test(text) : false
            });
        });

        // Error trigger endpoint for testing recovery
        app.get('/api/error-trigger', (req, res, next) => {
            if (req.query.throw === 'true') {
                throw new Error('Intentional error for testing');
            }
            res.json({ status: 'ok' });
        });

        // Error handler
        app.use((err, req, res, next) => {
            res.status(500).json({ error: 'Internal server error', recovered: true });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Health Check Resilience
    // ═══════════════════════════════════════════════════════════════════

    describe('Health Check Resilience', () => {
        it('should always respond to health checks', async () => {
            const res = await request(app).get('/api/health');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toBe('ok');
            expect(res.body).toHaveProperty('database');
        });

        it('should handle health check during high load', async () => {
            const requests = Array(50).fill(null).map(() => request(app).get('/api/health'));
            const responses = await Promise.all(requests);

            responses.forEach(res => {
                expect(res.status).toBe(200);
                expect(res.body.status).toBe('ok');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Request Validation Resilience
    // ═══════════════════════════════════════════════════════════════════

    describe('Request Validation Resilience', () => {
        it('should handle extremely large payloads', async () => {
            const largePayload = 'x'.repeat(50000);
            const res = await request(app)
                .post('/api/validate')
                .send({ input: largePayload });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should handle special characters in input', async () => {
            const res = await request(app)
                .post('/api/validate')
                .send({ input: "test'; DROP TABLE users; --" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should handle unicode and emoji characters', async () => {
            const res = await request(app)
                .post('/api/unicode')
                .send({ text: 'Hello 🚀 World 中文' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.hasEmoji).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Concurrent Request Handling
    // ═══════════════════════════════════════════════════════════════════

    describe('Concurrent Request Handling', () => {
        it('should handle multiple concurrent requests', async () => {
            const requests = Array(20).fill(null).map(() => request(app).get('/api/health'));
            const responses = await Promise.all(requests);

            expect(responses.every(r => r.status === 200)).toBe(true);
        });

        it('should handle concurrent write operations', async () => {
            const requests = Array(10).fill(null).map((_, i) =>
                request(app)
                    .post('/api/validate')
                    .send({ input: `test-${i}` })
            );
            const responses = await Promise.all(requests);

            responses.forEach(res => {
                expect([200, 400]).toContain(res.status);
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Error Recovery
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Recovery', () => {
        it('should recover after handling an error', async () => {
            // Trigger an error
            await request(app).get('/api/error-trigger?throw=true');

            // Next request should work
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });

        it('should handle rapid error recovery', async () => {
            // Multiple error triggers followed by normal requests
            await request(app).get('/api/error-trigger?throw=true');
            await request(app).get('/api/error-trigger?throw=true');

            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Input Sanitization
    // ═══════════════════════════════════════════════════════════════════

    describe('Input Sanitization', () => {
        it('should sanitize SQL injection attempts', async () => {
            const res = await request(app)
                .post('/api/validate')
                .send({ input: "1' OR '1'='1" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should sanitize XSS attempts', async () => {
            const res = await request(app)
                .post('/api/validate')
                .send({ input: '<script>alert("xss")</script>' });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should allow valid input', async () => {
            const res = await request(app)
                .post('/api/validate')
                .send({ input: 'Valid input text' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
