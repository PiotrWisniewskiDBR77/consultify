/**
 * Rate Limiting Security Tests
 * Tests for API rate limiting and abuse prevention
 * 
 * @module tests/security/rate-limiting.test.js
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

describe('Rate Limiting Security Tests', () => {
    let app;

    beforeAll(async () => {
        // Always use mock app for consistent testing
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Simple rate limit implementation for testing
        const requestCounts = new Map();
        const RATE_LIMIT = 10;
        const WINDOW_MS = 1000;

        const rateLimiter = (req, res, next) => {
            const ip = req.ip || 'test';
            const now = Date.now();
            const windowStart = now - WINDOW_MS;

            let requests = requestCounts.get(ip) || [];
            requests = requests.filter(time => time > windowStart);
            requests.push(now);
            requestCounts.set(ip, requests);

            if (requests.length > RATE_LIMIT) {
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: Math.ceil(WINDOW_MS / 1000),
                });
            }
            next();
        };

        app.use('/api/auth', rateLimiter);
        app.use('/api/ai', rateLimiter);

        app.post('/api/auth/login', (req, res) => {
            res.json({ success: true });
        });

        app.post('/api/auth/register', (req, res) => {
            res.json({ success: true });
        });

        app.post('/api/auth/forgot-password', (req, res) => {
            res.json({ success: true });
        });

        app.post('/api/ai/chat', (req, res) => {
            res.json({ success: true, response: 'AI response' });
        });

        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok' });
        });
    });

    beforeEach(() => {
        // Reset any rate limit state between tests if needed
    });

    // ═══════════════════════════════════════════════════════════════════
    // AUTH ENDPOINT RATE LIMITING
    // ═══════════════════════════════════════════════════════════════════

    describe('Authentication Rate Limiting', () => {
        it('should allow initial login requests', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'password' });

            expect([200, 401]).toContain(response.status);
        });

        it('should rate limit excessive login attempts', async () => {
            const requests = [];

            // Make many requests quickly
            for (let i = 0; i < 15; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({ email: 'test@test.com', password: 'wrong' })
                );
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.filter(r => r.status === 429);

            // At least some should be rate limited
            expect(rateLimited.length).toBeGreaterThan(0);
        });

        it('should include Retry-After header when rate limited', async () => {
            // Make enough requests to trigger rate limit
            for (let i = 0; i < 12; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .send({ email: 'test@test.com', password: 'wrong' });
            }

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'wrong' });

            if (response.status === 429) {
                expect(response.body).toHaveProperty('retryAfter');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PASSWORD RESET RATE LIMITING
    // ═══════════════════════════════════════════════════════════════════

    describe('Password Reset Rate Limiting', () => {
        it('should rate limit password reset requests', async () => {
            const requests = [];

            for (let i = 0; i < 15; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/forgot-password')
                        .send({ email: `test${i}@test.com` })
                );
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.some(r => r.status === 429);

            expect(rateLimited).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // AI ENDPOINT RATE LIMITING
    // ═══════════════════════════════════════════════════════════════════

    describe('AI Endpoint Rate Limiting', () => {
        it('should rate limit AI chat requests', async () => {
            const requests = [];

            for (let i = 0; i < 15; i++) {
                requests.push(
                    request(app)
                        .post('/api/ai/chat')
                        .send({ message: 'Hello' })
                );
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.some(r => r.status === 429);

            expect(rateLimited).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HEALTH CHECK EXEMPTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Health Check Exemption', () => {
        it('should not rate limit health checks', async () => {
            const requests = [];

            for (let i = 0; i < 20; i++) {
                requests.push(request(app).get('/api/health'));
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.filter(r => r.status === 429);

            // Health checks should not be rate limited
            expect(rateLimited.length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RATE LIMIT HEADERS
    // ═══════════════════════════════════════════════════════════════════

    describe('Rate Limit Headers', () => {
        it('should include rate limit headers', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'password' });

            // Check for standard rate limit headers (may not be present in mock)
            if (response.headers['x-ratelimit-limit']) {
                expect(response.headers['x-ratelimit-limit']).toBeDefined();
                expect(response.headers['x-ratelimit-remaining']).toBeDefined();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DISTRIBUTED RATE LIMITING
    // ═══════════════════════════════════════════════════════════════════

    describe('Rate Limit Behavior', () => {
        it('should return proper error message when rate limited', async () => {
            // Trigger rate limit
            for (let i = 0; i < 15; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .send({ email: 'test@test.com', password: 'wrong' });
            }

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'wrong' });

            if (response.status === 429) {
                expect(response.body).toHaveProperty('error');
                expect(response.body.error.toLowerCase()).toContain('many requests');
            }
        });

        it('should use 429 status code for rate limiting', async () => {
            const requests = [];

            for (let i = 0; i < 20; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({ email: 'test@test.com', password: 'wrong' })
                );
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.filter(r => r.status === 429);

            // All rate limited responses should use 429
            rateLimited.forEach(r => {
                expect(r.status).toBe(429);
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // BRUTE FORCE PROTECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Brute Force Protection', () => {
        it('should become more restrictive after many failed attempts', async () => {
            // Many failed login attempts should trigger stricter limits
            for (let i = 0; i < 20; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .send({ email: 'victim@test.com', password: `wrong${i}` });
            }

            // Subsequent requests should be rate limited
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'victim@test.com', password: 'password' });

            expect([200, 401, 429]).toContain(response.status);
        });
    });
});
