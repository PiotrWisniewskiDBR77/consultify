import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import db from '../../server/database.js';
import app from '../../server/index.js';

// Helper to wait for DB to sync
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Auth Integration', () => {
    const testId = Date.now() + Math.floor(Math.random() * 10000);
    const orgId = `org-auth-${testId}`;
    const userId = `user-auth-${testId}`;
    const email = `auth-${testId}@dbr77.com`;
    const password = '123456';

    beforeAll(async () => {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);

        // Create org first
        await new Promise((resolve) => {
            db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                [orgId, 'Auth Test Org', 'free', 'active'], (err) => {
                    if (err) console.error('Auth org error:', err.message);
                    resolve();
                });
        });

        // Wait for DB sync
        await sleep(100);

        // Create user
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, orgId, email, hash, 'Test', 'ADMIN'], (err) => {
                    if (err) {
                        console.error('Auth user error:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
        });

        // Wait for DB sync
        await sleep(100);
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
