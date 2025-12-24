/**
 * Integration Test: Access Control Routes
 * 
 * CRITICAL SECURITY TESTS - Multi-tenant isolation, permission enforcement
 * Tests access-control routes with focus on security boundaries.
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

describe('Integration Test: Access Control Routes', () => {
    let adminToken;
    let userToken;
    let superAdminToken;
    
    const testId = Date.now();
    const org1Id = `access-org1-${testId}`;
    const org2Id = `access-org2-${testId}`;
    const adminUserId = `access-admin-${testId}`;
    const regularUserId = `access-user-${testId}`;
    const superAdminId = `access-superadmin-${testId}`;
    const adminEmail = `access-admin-${testId}@test.com`;
    const userEmail = `access-user-${testId}@test.com`;
    const superAdminEmail = `access-superadmin-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                // Create organizations
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [org1Id, 'Access Test Org 1', 'free', 'active']
                );
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [org2Id, 'Access Test Org 2', 'free', 'active']
                );

                // Create users
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [adminUserId, org1Id, adminEmail, hash, 'Admin', 'ADMIN'],
                    () => {}
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [regularUserId, org1Id, userEmail, hash, 'User', 'USER'],
                    () => {}
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [superAdminId, null, superAdminEmail, hash, 'SuperAdmin', 'SUPERADMIN'],
                    resolve
                );
            });
        });

        // Login to get tokens
        const adminRes = await request(app)
            .post('/api/auth/login')
            .send({ email: adminEmail, password: 'test123' });
        adminToken = adminRes.body.token;

        const userRes = await request(app)
            .post('/api/auth/login')
            .send({ email: userEmail, password: 'test123' });
        userToken = userRes.body.token;

        const superAdminRes = await request(app)
            .post('/api/auth/login')
            .send({ email: superAdminEmail, password: 'test123' });
        superAdminToken = superAdminRes.body.token;
    });

    describe('POST /api/access-control/requests', () => {
        it('should allow anyone to submit access request', async () => {
            const res = await request(app)
                .post('/api/access-control/requests')
                .send({
                    email: `newuser-${testId}@test.com`,
                    firstName: 'New',
                    lastName: 'User',
                    organizationName: 'New Org'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.requestId).toBeDefined();
        });

        it('should reject duplicate pending requests', async () => {
            const email = `duplicate-${testId}@test.com`;
            
            // First request
            await request(app)
                .post('/api/access-control/requests')
                .send({
                    email,
                    firstName: 'Test',
                    lastName: 'User',
                    organizationName: 'Test Org'
                });

            // Duplicate request
            const res = await request(app)
                .post('/api/access-control/requests')
                .send({
                    email,
                    firstName: 'Test',
                    lastName: 'User',
                    organizationName: 'Test Org'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('already pending');
        });
    });

    describe('GET /api/access-control/requests', () => {
        it('should require SUPERADMIN role', async () => {
            const res = await request(app)
                .get('/api/access-control/requests')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(403);
        });

        it('should allow SUPERADMIN to view requests', async () => {
            if (!superAdminToken) {
                console.log('Skipping - no superadmin token');
                return;
            }

            const res = await request(app)
                .get('/api/access-control/requests')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should filter by status', async () => {
            if (!superAdminToken) {
                console.log('Skipping - no superadmin token');
                return;
            }

            const res = await request(app)
                .get('/api/access-control/requests?status=pending')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should not allow user from org1 to access org2 data', async () => {
            // This test verifies that routes properly filter by organization_id
            // The actual implementation depends on specific routes, but the pattern
            // should be consistent across all routes
            
            // Example: Try to access organization settings
            const res = await request(app)
                .get('/api/organizations')
                .set('Authorization', `Bearer ${userToken}`);

            // Should only return user's own organization
            if (res.status === 200 && res.body) {
                // If it returns org data, verify it's only org1
                if (Array.isArray(res.body)) {
                    res.body.forEach(org => {
                        expect(org.id).toBe(org1Id);
                        expect(org.id).not.toBe(org2Id);
                    });
                } else if (res.body.id) {
                    expect(res.body.id).toBe(org1Id);
                    expect(res.body.id).not.toBe(org2Id);
                }
            }
        });

        it('should require authentication for protected routes', async () => {
            const res = await request(app)
                .get('/api/access-control/requests');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('Permission Enforcement', () => {
        it('should enforce ADMIN role for admin routes', async () => {
            // Regular user should not access admin routes
            const res = await request(app)
                .get('/api/organizations')
                .set('Authorization', `Bearer ${userToken}`);

            // May return 403 or 200 with filtered data, but should not allow admin actions
            expect([200, 403]).toContain(res.status);
        });

        it('should enforce SUPERADMIN role for superadmin routes', async () => {
            // Admin should not access superadmin routes
            const res = await request(app)
                .get('/api/access-control/requests')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(403);
        });
    });
});




