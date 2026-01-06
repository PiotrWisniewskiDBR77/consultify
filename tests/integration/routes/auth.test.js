import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('Auth Routes Integration', () => {
    let testUserId;
    let testOrgId;
    let testToken;
    let testRefreshToken;
    const db = getDatabase();

    beforeAll(async () => {
        await initializeDatabase();

        // Wait for DB initialization
        if (db.initPromise) {
            await db.initPromise;
        }

        // Create test organization
        testOrgId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
                [testOrgId, 'Test Org', 'professional', 'active', 'PAID'],
                (err) => (err ? reject(err) : resolve()),
            );
        });

        // Create test user
        testUserId = uuidv4();
        const hashedPassword = await bcrypt.hash('password123', 10);
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [testUserId, testOrgId, `test-${testUserId}@example.com`, hashedPassword, 'ADMIN', 'active'],
                (err) => (err ? reject(err) : resolve()),
            );
        });
    });

    afterAll(async () => {
        // Cleanup
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: `test-${testUserId}@example.com`,
                    password: 'password123',
                });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();

            testToken = res.body.token;
            testRefreshToken = res.body.refreshToken;
        });

        it('should fail with incorrect password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: `test-${testUserId}@example.com`,
                    password: 'wrongpassword',
                });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user details', async () => {
            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${testToken}`);

            expect(res.status).toBe(200);
            expect(res.body.user.id).toBe(testUserId);
            expect(res.body.user.organizationId).toBe(testOrgId);
        });

        it('should fail without token', async () => {
            const res = await request(app).get('/api/auth/me');

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should refresh token using valid refresh token', async () => {
            const res = await request(app).post('/api/auth/refresh').send({
                refreshToken: testRefreshToken,
            });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            testToken = res.body.token;
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout successfully', async () => {
            const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${testToken}`);

            expect(res.status).toBe(200);
        });
    });
});
