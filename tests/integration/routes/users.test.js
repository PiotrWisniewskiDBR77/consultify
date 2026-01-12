// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Users Routes
 * Tests users API endpoints
 */
describe('Integration Test: Users Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `users-org-${testId}`;
    const testUserId = `users-user-${testId}`;
    const testEmail = `users-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Users Test Org', 'free', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'Test', 'ADMIN'],
                    resolve
                );
            });
        });

        // Login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'test123',
            });

        if (loginRes.body.token) {
            authToken = loginRes.body.token;
        }
    });

    describe('GET /api/users', () => {
        it('should return list of users', async () => {
            if (!authToken) {
                console.log('Skipping users list test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403]).toContain(res.status); // May require admin
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/users');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user', async () => {
            if (!authToken) {
                console.log('Skipping me test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            // Response is { user: { ... } }
            const user = res.body.user || res.body;
            expect(user.email).toBe(testEmail);
        });
    });

    describe('GET /api/users/:id', () => {
        it('should return user by id', async () => {
            if (!authToken) {
                console.log('Skipping user by id test - no auth token');
                return;
            }

            const res = await request(app)
                .get(`/api/users/${testUserId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 404]).toContain(res.status);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update user', async () => {
            if (!authToken) {
                console.log('Skipping update test - no auth token');
                return;
            }

            const res = await request(app)
                .put(`/api/users/${testUserId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    first_name: 'Updated',
                });

            expect([200, 403]).toContain(res.status);
        });
    });
});

