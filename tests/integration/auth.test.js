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
});
