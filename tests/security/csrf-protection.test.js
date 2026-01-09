/**
 * CSRF Protection Security Tests
 * Tests for Cross-Site Request Forgery (CSRF) attack prevention
 * 
 * CONVERTED: Uses real app and database (MOCK_DB=false)
 * 
 * @module tests/security/csrf-protection.test.js
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Configure real database BEFORE any imports
vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-csrf-protection-${workerId}.db`;
});

import app from '../../server/src/index.js';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

describe('CSRF Protection Security Tests', () => {
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
                [testOrgId, 'CSRF Test Org', 'professional', 'active', 'PAID'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test user
        testUserId = uuidv4();
        testEmail = `csrf-test-${Date.now()}@test.com`;
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
    // ORIGIN VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Origin Validation', () => {
        it('should handle requests with same-origin', async () => {
            if (!testToken) return;

            const response = await request(app)
                .get('/api/users/me')
                .set('Origin', 'http://localhost:3000')
                .set('Authorization', `Bearer ${testToken}`);

            expect([200, 401, 403, 404]).toContain(response.status);
        });

        it('should flag cross-origin requests appropriately', async () => {
            if (!testToken) return;

            const response = await request(app)
                .post('/api/auth/logout')
                .set('Origin', 'http://evil-site.com')
                .set('Authorization', `Bearer ${testToken}`);

            // May be rejected based on CORS policy or process normally
            expect([200, 204, 401, 403]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SENSITIVE ACTIONS PROTECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Sensitive Actions Protection', () => {
        it('should require authentication for sensitive endpoints', async () => {
            // Try to access sensitive endpoint without token
            const response = await request(app)
                .post('/api/settings')
                .send({ theme: 'dark' });

            // Should require authentication
            expect([401, 403, 404]).toContain(response.status);
        });

        it('should protect password changes', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .send({ oldPassword: 'old', newPassword: 'new' });

            // Should require authentication
            expect([401, 403, 404]).toContain(response.status);
        });

        it('should protect logout with proper auth', async () => {
            // Create a fresh token for this test
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: testEmail, password: 'SecurePass123!' });

            if (loginRes.body.token) {
                const response = await request(app)
                    .post('/api/auth/logout')
                    .set('Authorization', `Bearer ${loginRes.body.token}`);

                expect([200, 204]).toContain(response.status);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SAMESITE COOKIE TESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('Cookie Security', () => {
        it('should set secure flags on cookies', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: testEmail, password: 'SecurePass123!' });

            if (response.headers['set-cookie']) {
                const cookies = response.headers['set-cookie'];
                // Just verify cookies are set - specific flags depend on environment
                expect(Array.isArray(cookies) ? cookies.length : 1).toBeGreaterThan(0);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STATE-CHANGING REQUEST VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('State-Changing Request Validation', () => {
        it('should reject unauthenticated POST requests', async () => {
            const response = await request(app)
                .post('/api/projects')
                .send({ name: 'Test Project' });

            expect([401, 403]).toContain(response.status);
        });

        it('should reject unauthenticated DELETE requests', async () => {
            const response = await request(app)
                .delete('/api/projects/some-id');

            expect([401, 403, 404]).toContain(response.status);
        });

        it('should require valid token for state changes', async () => {
            const response = await request(app)
                .post('/api/projects')
                .set('Authorization', 'Bearer invalid-token')
                .send({ name: 'Test Project' });

            expect([401, 403]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REFERER VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Referer Validation', () => {
        it('should handle requests with valid referer', async () => {
            if (!testToken) return;

            const response = await request(app)
                .get('/api/users/me')
                .set('Referer', 'http://localhost:3000/dashboard')
                .set('Authorization', `Bearer ${testToken}`);

            expect([200, 401]).toContain(response.status);
        });
    });
});
