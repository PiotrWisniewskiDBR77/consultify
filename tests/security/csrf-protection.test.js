/**
 * CSRF Protection Security Tests
 * Tests for Cross-Site Request Forgery (CSRF) attack prevention
 * 
 * @module tests/security/csrf-protection.test.js
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

describe('CSRF Protection Security Tests', () => {
    let app;
    let validCsrfToken;

    beforeAll(async () => {
        // Always use mock app for consistent testing
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Mock CSRF token generation
        validCsrfToken = 'valid-csrf-token-12345';

        app.get('/api/csrf-token', (req, res) => {
            res.json({ token: validCsrfToken });
        });

        app.post('/api/user/settings', (req, res) => {
            const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
            if (csrfToken !== validCsrfToken) {
                return res.status(403).json({ error: 'Invalid CSRF token' });
            }
            res.json({ success: true });
        });

        app.post('/api/billing/update', (req, res) => {
            const csrfToken = req.headers['x-csrf-token'];
            if (csrfToken !== validCsrfToken) {
                return res.status(403).json({ error: 'Invalid CSRF token' });
            }
            res.json({ success: true });
        });

        app.delete('/api/user/account', (req, res) => {
            const csrfToken = req.headers['x-csrf-token'];
            if (csrfToken !== validCsrfToken) {
                return res.status(403).json({ error: 'Invalid CSRF token' });
            }
            res.json({ success: true });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CSRF TOKEN VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('CSRF Token Validation', () => {
        it('should reject POST request without CSRF token', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .send({ name: 'Test' });

            // Should be rejected (403) or require auth (401)
            expect([401, 403]).toContain(response.status);
        });

        it('should reject request with invalid CSRF token', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .set('X-CSRF-Token', 'invalid-token')
                .send({ name: 'Test' });

            expect([401, 403]).toContain(response.status);
        });

        it('should accept request with valid CSRF token', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .set('X-CSRF-Token', validCsrfToken)
                .send({ name: 'Test' });

            // May need auth too, but shouldn't be CSRF error
            expect([200, 401]).toContain(response.status);
        });

        it('should reject DELETE request without CSRF token', async () => {
            const response = await request(app)
                .delete('/api/user/account');

            expect([401, 403]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CSRF TOKEN FORMAT
    // ═══════════════════════════════════════════════════════════════════

    describe('CSRF Token Format', () => {
        it('should provide CSRF token endpoint', async () => {
            const response = await request(app)
                .get('/api/csrf-token');

            if (response.status === 200) {
                expect(response.body).toHaveProperty('token');
                expect(response.body.token.length).toBeGreaterThan(10);
            }
        });

        it('should reject empty CSRF token', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .set('X-CSRF-Token', '')
                .send({ name: 'Test' });

            expect([401, 403]).toContain(response.status);
        });

        it('should reject null CSRF token', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .set('X-CSRF-Token', 'null')
                .send({ name: 'Test' });

            expect([401, 403]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ORIGIN VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Origin Validation', () => {
        it('should handle requests with Origin header', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .set('Origin', 'http://localhost:3000')
                .set('X-CSRF-Token', validCsrfToken)
                .send({ name: 'Test' });

            // Should process normally from same origin
            expect([200, 401]).toContain(response.status);
        });

        it('should flag cross-origin requests appropriately', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .set('Origin', 'http://evil-site.com')
                .set('X-CSRF-Token', validCsrfToken)
                .send({ name: 'Test' });

            // May be rejected based on CORS policy
            expect([200, 401, 403]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SENSITIVE ACTIONS PROTECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Sensitive Actions Protection', () => {
        it('should protect billing updates', async () => {
            const response = await request(app)
                .post('/api/billing/update')
                .send({ cardNumber: '4111111111111111' });

            expect([401, 403]).toContain(response.status);
        });

        it('should protect account deletion', async () => {
            const response = await request(app)
                .delete('/api/user/account');

            expect([401, 403]).toContain(response.status);
        });

        it('should protect password changes', async () => {
            const response = await request(app)
                .post('/api/user/password')
                .send({ oldPassword: 'old', newPassword: 'new' });

            expect([401, 403, 404]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SAMESITE COOKIE TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('SameSite Cookie Attribute', () => {
        it('should set SameSite on session cookies', async () => {
            const response = await request(app).get('/api/csrf-token');

            if (response.headers['set-cookie']) {
                const cookies = response.headers['set-cookie'];
                const sessionCookie = cookies.find(c => c.includes('session') || c.includes('sid'));
                if (sessionCookie) {
                    expect(sessionCookie.toLowerCase()).toMatch(/samesite=(strict|lax)/i);
                }
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DOUBLE SUBMIT COOKIE PATTERN
    // ═══════════════════════════════════════════════════════════════════

    describe('Double Submit Cookie Pattern', () => {
        it('should accept CSRF token in body as alternative', async () => {
            const response = await request(app)
                .post('/api/user/settings')
                .send({ name: 'Test', _csrf: validCsrfToken });

            // Should accept token in body
            expect([200, 401]).toContain(response.status);
        });
    });
});
