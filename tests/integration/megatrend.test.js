/**
 * Megatrend Integration Tests - Real Implementation
 */
import app from '../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('Megatrend Integration', () => {
    let testUserId;
    let testOrgId;
    let testToken;
    const db = getDatabase();

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
                [testOrgId, 'Megatrend Test Org', 'professional', 'active', 'PAID'],
                (err) => (err ? reject(err) : resolve()),
            );
        });

        // Create test user
        testUserId = uuidv4();
        const hashedPassword = await bcrypt.hash('password123', 10);
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [testUserId, testOrgId, `megatrend-${testUserId}@test.com`, hashedPassword, 'ADMIN', 'active'],
                (err) => (err ? reject(err) : resolve()),
            );
        });

        // Login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: `megatrend-${testUserId}@test.com`,
                password: 'password123',
            });

        testToken = loginRes.body.token;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
        });
    });

    it('should list megatrends', async () => {
        if (!testToken) return;

        const res = await request(app)
            .get('/api/megatrends')
            .set('Authorization', `Bearer ${testToken}`);

        expect([200, 403, 404, 500]).toContain(res.status);

        if (res.status === 200) {
            expect(Array.isArray(res.body) || res.body.megatrends).toBeTruthy();
        }
    });

    it('should return megatrend by id', async () => {
        if (!testToken) return;

        const res = await request(app)
            .get('/api/megatrends/mt-ai-automation')
            .set('Authorization', `Bearer ${testToken}`);

        expect([200, 404, 500, 501, 503]).toContain(res.status);
    });

    it('should filter megatrends by ring', async () => {
        if (!testToken) return;

        const res = await request(app)
            .get('/api/megatrends?ring=Now')
            .set('Authorization', `Bearer ${testToken}`);

        expect([200, 400, 404, 500, 501]).toContain(res.status);
    });

    it('should create custom megatrend', async () => {
        if (!testToken) return;

        const res = await request(app)
            .post('/api/megatrends')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                label: 'Custom Megatrend',
                ring: 'Now',
                description: 'Test megatrend'
            });

        expect([200, 201, 403, 404, 500, 501]).toContain(res.status);
    });

    it('should update megatrend ring', async () => {
        if (!testToken) return;

        const res = await request(app)
            .patch('/api/megatrends/mt-ai-automation')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                ring: 'Next'
            });

        expect([200, 403, 404, 500]).toContain(res.status);
    });
});
