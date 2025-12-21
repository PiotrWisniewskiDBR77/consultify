import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const app = require('../../server/index.js');

// Helper to wait for DB to sync
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Auth Integration', () => {
    let token;
    const testId = Date.now();
    const email = `auth-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        if (db.initPromise) {
            await db.initPromise;
        }

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);
        const orgId = `org-auth-${testId}`;
        const userId = `user-auth-${testId}`;

        db.serialize(() => {
            // Create org
            db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                [orgId, 'Auth Test Org', 'free', 'active'], (err) => {
                    if (err) console.error('Auth org error:', err.message);
                });

            // Create user
            db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, orgId, email, hash, 'AuthTester', 'ADMIN'], (err) => {
                    if (err) console.error('Auth user error:', err.message);
                });
        });

        await sleep(200);
    });

    it('should login successfully with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toHaveProperty('email', email);
    });

    it('should fail with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('should require email and password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email });

        expect([400, 401, 404]).toContain(res.status);
    });

    it('should validate token via /api/auth/me', async () => {
        // First login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        const token = loginRes.body.token;
        expect(token).toBeDefined();

        // Use token to check me endpoint
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('email', email);
    });

    it('should reject invalid token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid-token');

        expect([401, 403]).toContain(res.status);
    });

    it('should reject request without token', async () => {
        const res = await request(app)
            .get('/api/auth/me');

        expect([401, 403]).toContain(res.status);
    });

    describe('Multi-Tenant Isolation', () => {
        let org1Token;
        let org2Token;
        const testId2 = Date.now();
        const org1Id = `auth-org1-${testId2}`;
        const org2Id = `auth-org2-${testId2}`;
        const user1Email = `auth-user1-${testId2}@test.com`;
        const user2Email = `auth-user2-${testId2}@test.com`;

        beforeAll(async () => {
            const bcrypt = require('bcryptjs');
            const hash = bcrypt.hashSync('test123', 8);

            await new Promise((resolve) => {
                db.serialize(() => {
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [org1Id, 'Auth Org 1', 'free', 'active']
                    );
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [org2Id, 'Auth Org 2', 'free', 'active']
                    );
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                        [`user1-${testId2}`, org1Id, user1Email, hash, 'User1', 'USER'],
                        () => {}
                    );
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                        [`user2-${testId2}`, org2Id, user2Email, hash, 'User2', 'USER'],
                        resolve
                    );
                });
            });

            const res1 = await request(app)
                .post('/api/auth/login')
                .send({ email: user1Email, password: 'test123' });
            org1Token = res1.body.token;

            const res2 = await request(app)
                .post('/api/auth/login')
                .send({ email: user2Email, password: 'test123' });
            org2Token = res2.body.token;
        });

        it('should return correct organizationId in /me endpoint', async () => {
            const res1 = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${org1Token}`);

            const res2 = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${org2Token}`);

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            expect(res1.body.user.organizationId).toBe(org1Id);
            expect(res2.body.user.organizationId).toBe(org2Id);
            expect(res1.body.user.organizationId).not.toBe(res2.body.user.organizationId);
        });
    });
});
