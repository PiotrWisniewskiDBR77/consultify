import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { TestDatabaseFactory } from '../utils/TestDatabaseFactory.js';

// We delay importing app/db until after we set up the mock DB
let app;
let db;

describe('Auth Integration', () => {
    let token;
    const testId = Date.now();
    const email = `auth-${testId}@dbr77.com`;
    const password = 'password123';

    // Explicitly mock Sentry here to survive resetModules or ensure it's picked up


    beforeAll(async () => {
        // 1. Create a fresh in-memory DB with schema
        const testDb = await TestDatabaseFactory.create();

        // 2. Inject it into the global mock slot (which server/database.js uses when MOCK_DB=true)
        // Note: tests/setup.ts sets MOCK_DB=true
        global.__TEST_DB_MOCK__ = testDb;

        // 3. Reset modules to ensure server/database.js is re-evaluated and picks up the new global mock
        vi.resetModules();

        // 4. Import the app and db (using dynamic import to ensure freshness)
        // We use createRequire for compatibility if needed, or just import
        const dbModule = await import('../../server/database.js');
        db = dbModule.default;

        const appModule = await import('../../server/index.js');
        app = appModule.default || appModule; // Handle CJS/ESM interop

        const bcrypt = await import('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);
        const orgId = `org-auth-${testId}`;
        const userId = `user-auth-${testId}`;

        // 5. Seed data using the testDb directly (or the imported db wrapper, they should be the same now)
        await new Promise((resolve, reject) => {
            testDb.serialize(() => {
                // Create org
                testDb.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [orgId, 'Auth Test Org', 'free', 'active'], (err) => {
                        if (err) console.error('Auth org error:', err.message);
                    });

                // Create user
                testDb.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, orgId, email, hash, 'AuthTester', 'ADMIN'], (err) => {
                        if (err) console.error('Auth user error:', err.message);
                        resolve();
                    });
            });
        });
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
            const bcrypt = await import('bcryptjs');
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
                        () => { }
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
            // Need to verify tokens were actually obtained
            expect(org1Token).toBeDefined();
            expect(org2Token).toBeDefined();

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
