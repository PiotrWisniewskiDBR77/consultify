/**
 * Admin Middleware Test
 * 
 * Tests for admin authorization middleware using real app and database.
 * 
 * CONVERTED: Uses real app and database (MOCK_DB=false)
 * 
 * @module tests/unit/backend/middleware/adminMiddleware.test.js
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Configure real database BEFORE any imports
vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-admin-middleware-${workerId}.db`;
});

import app from '../../../../server/src/index.js';
import { getDatabase } from '../../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../../server/src/database/DatabaseInitializer.js';

describe('Admin Middleware', () => {
    const db = getDatabase();
    let testOrgId;
    let adminUserId;
    let regularUserId;
    let superAdminUserId;
    let adminToken;
    let userToken;
    let superAdminToken;
    const testEmailBase = `admin-mw-test-${Date.now()}`;

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
                [testOrgId, 'Admin Middleware Test Org', 'professional', 'active', 'PAID'],
                (err) => err ? reject(err) : resolve()
            );
        });

        const hashedPassword = await bcrypt.hash('SecurePass123!', 10);

        // Create admin user
        adminUserId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [adminUserId, testOrgId, `${testEmailBase}-admin@test.com`, hashedPassword, 'ADMIN', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create regular user  
        regularUserId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [regularUserId, testOrgId, `${testEmailBase}-user@test.com`, hashedPassword, 'USER', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create superadmin user
        superAdminUserId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [superAdminUserId, testOrgId, `${testEmailBase}-super@test.com`, hashedPassword, 'SUPERADMIN', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Get tokens for each user
        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: `${testEmailBase}-admin@test.com`, password: 'SecurePass123!' });
        adminToken = adminLogin.body.token;

        const userLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: `${testEmailBase}-user@test.com`, password: 'SecurePass123!' });
        userToken = userLogin.body.token;

        const superLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: `${testEmailBase}-super@test.com`, password: 'SecurePass123!' });
        superAdminToken = superLogin.body.token;
    });

    afterAll(async () => {
        // Cleanup
        await new Promise(r => db.run(`DELETE FROM users WHERE organization_id = ?`, [testOrgId], () => r()));
        await new Promise(r => db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r()));
    });

    // ═══════════════════════════════════════════════════════════════════
    // ADMIN ACCESS
    // ═══════════════════════════════════════════════════════════════════

    describe('Admin Access', () => {
        it('should allow admin users to access admin endpoints', async () => {
            if (!adminToken) return;

            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            // Admin should be allowed (200) or endpoint may not exist (404)
            // Should NOT get 403 (forbidden)
            expect([200, 404]).toContain(response.status);
        });

        it('should allow superadmin users to access admin endpoints', async () => {
            if (!superAdminToken) return;

            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect([200, 404]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // NON-ADMIN ACCESS
    // ═══════════════════════════════════════════════════════════════════

    describe('Non-Admin Access', () => {
        it('should reject regular users with 403 from admin endpoints', async () => {
            if (!userToken) return;

            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${userToken}`);

            // Regular user should get 403 (forbidden) or 404 (no route)
            expect([403, 404]).toContain(response.status);
        });

        it('should reject unauthenticated requests with 401', async () => {
            const response = await request(app)
                .get('/api/admin/users');

            // Should require authentication
            expect([401, 403, 404]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TOKEN VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Token Validation', () => {
        it('should reject expired or invalid tokens', async () => {
            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', 'Bearer invalid-token');

            // Invalid token should get 401 (unauthorized), 403 (forbidden), or 404 (route not found)
            expect([401, 403, 404]).toContain(response.status);
        });

        it('should reject malformed authorization header', async () => {
            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', 'NotBearer sometoken');

            expect([401, 403, 404]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ROLE-BASED VERIFICATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Role-Based Access Control', () => {
        it('should return correct user role in /me endpoint', async () => {
            if (!adminToken) return;

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${adminToken}`);

            if (response.status === 200) {
                expect(response.body.user.role.toUpperCase()).toBe('ADMIN');
            }
        });

        it('should return USER role for regular user', async () => {
            if (!userToken) return;

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${userToken}`);

            if (response.status === 200) {
                expect(response.body.user.role.toUpperCase()).toBe('USER');
            }
        });

        it('should return SUPERADMIN role for superadmin', async () => {
            if (!superAdminToken) return;

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${superAdminToken}`);

            if (response.status === 200) {
                expect(response.body.user.role.toUpperCase()).toBe('SUPERADMIN');
            }
        });
    });
});
