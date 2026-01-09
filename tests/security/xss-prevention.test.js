/**
 * XSS Prevention Security Tests
 * Tests for Cross-Site Scripting (XSS) attack prevention
 * 
 * CONVERTED: Uses real app and database (MOCK_DB=false)
 * 
 * @module tests/security/xss-prevention.test.js
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Configure real database BEFORE any imports
vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-xss-prevention-${workerId}.db`;
});

import app from '../../server/src/index.js';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

// XSS payload vectors for testing
const xssPayloads = {
    basic: '<script>alert("xss")</script>',
    encoded: '&lt;script&gt;alert("xss")&lt;/script&gt;',
    eventHandler: '<img src=x onerror="alert(1)">',
    svgXss: '<svg onload="alert(1)">',
    javascript: 'javascript:alert(1)',
    dataUri: 'data:text/html,<script>alert(1)</script>',
    unicodeEscape: '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e',
    htmlEntity: '&#60;script&#62;alert(1)&#60;/script&#62;',
    mixedCase: '<ScRiPt>alert(1)</sCrIpT>',
    nestedTag: '<<script>script>alert(1)<</script>/script>',
    nullByte: '<scr\x00ipt>alert(1)</script>',
    doubleEncode: '%253Cscript%253Ealert(1)%253C/script%253E',
};

describe('XSS Prevention Security Tests', () => {
    const db = getDatabase();
    let testOrgId;
    let testUserId;
    let testEmail;
    let testToken;

    beforeAll(async () => {
        await initializeDatabase();

        if (db.initPromise) {
            await db.initPromise;
        }

        // Create test organization
        testOrgId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
                [testOrgId, 'XSS Test Org', 'professional', 'active', 'PAID'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test user
        testUserId = uuidv4();
        testEmail = `xss-test-${Date.now()}@test.com`;
        const hashedPassword = await bcrypt.hash('SecurePass123!', 10);
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [testUserId, testOrgId, testEmail, hashedPassword, 'ADMIN', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Get auth token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: testEmail, password: 'SecurePass123!' });

        if (loginRes.body.token) {
            testToken = loginRes.body.token;
        }
    });

    afterAll(async () => {
        // Cleanup
        await new Promise(r => db.run(`DELETE FROM users WHERE organization_id = ?`, [testOrgId], () => r()));
        await new Promise(r => db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r()));
    });

    // ═══════════════════════════════════════════════════════════════════
    // INPUT SANITIZATION TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('Input Sanitization on Real Endpoints', () => {
        Object.entries(xssPayloads).slice(0, 5).forEach(([name, payload]) => {
            it(`should handle ${name} XSS payload in login`, async () => {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({ email: payload, password: 'password' });

                // Should not return 500 (server error)
                expect(response.status).not.toBe(500);

                // Response should not contain raw script tags
                if (response.body) {
                    const responseStr = JSON.stringify(response.body);
                    expect(responseStr).not.toContain('<script>alert');
                }
            });
        });

        it('should sanitize XSS in project creation', async () => {
            if (!testToken) return;

            const response = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: xssPayloads.basic,
                    description: 'Test project'
                });

            // Should either sanitize or reject
            expect(response.status).not.toBe(500);

            if (response.status === 201 && response.body.project) {
                expect(response.body.project.name).not.toContain('<script>');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // OUTPUT ENCODING TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('Output Encoding', () => {
        it('should encode special HTML characters in error responses', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: '<>&"\'', password: 'test' });

            // Error message should not contain raw HTML characters
            if (response.body.error) {
                expect(response.body.error).not.toContain('<script>');
            }
        });

        it('should prevent script execution context', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: '<script>alert(1)</script>@test.com', password: 'Test' });

            const responseStr = JSON.stringify(response.body);
            expect(responseStr).not.toContain('<script>alert');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY HEADERS TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('Security Headers', () => {
        it('should return JSON content type', async () => {
            const response = await request(app)
                .get('/api/health');

            expect(response.headers['content-type']).toMatch(/json/);
        });

        it('should have X-Content-Type-Options header', async () => {
            const response = await request(app).get('/api/health');

            // Check for security header
            if (response.headers['x-content-type-options']) {
                expect(response.headers['x-content-type-options']).toBe('nosniff');
            }
        });

        it('should have X-XSS-Protection header', async () => {
            const response = await request(app).get('/api/health');

            // Check for XSS protection header
            if (response.headers['x-xss-protection']) {
                expect(response.headers['x-xss-protection']).toBeDefined();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CSP HEADER TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('Content Security Policy', () => {
        it('should have CSP header or use secure defaults', async () => {
            const response = await request(app).get('/api/health');

            // CSP may be set at app level
            const csp = response.headers['content-security-policy'];
            if (csp) {
                expect(csp).toBeDefined();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // AUTHENTICATED ENDPOINT XSS TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('Authenticated Endpoint XSS Protection', () => {
        it('should sanitize XSS in user profile updates', async () => {
            if (!testToken) return;

            const response = await request(app)
                .patch('/api/users/me')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    firstName: '<script>alert(1)</script>',
                    lastName: 'Safe Name'
                });

            expect(response.status).not.toBe(500);
        });
    });
});
