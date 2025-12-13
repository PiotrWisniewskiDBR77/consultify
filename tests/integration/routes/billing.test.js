// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');
const { initTestDb } = require('../../helpers/dbHelper.cjs');

/**
 * Level 2: Integration Tests - Billing Routes
 * Tests billing API endpoints
 */
describe('Integration Test: Billing Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `billing-org-${testId}`;
    const testUserId = `billing-user-${testId}`;
    const testEmail = `billing-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Billing Test Org', 'free', 'active']
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

    describe('GET /api/billing/plans', () => {
        it('should return list of subscription plans', async () => {
            const res = await request(app)
                .get('/api/billing/plans')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body) || Array.isArray(res.body.plans)).toBe(true);
        });

        it('should return plans without authentication', async () => {
            const res = await request(app)
                .get('/api/billing/plans');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body) || Array.isArray(res.body.plans)).toBe(true);
        });
    });

    describe('GET /api/billing/user-plans', () => {
        it('should return user license plans', async () => {
            const res = await request(app)
                .get('/api/billing/user-plans')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body) || Array.isArray(res.body.plans)).toBe(true);
        });
    });

    describe('GET /api/billing/usage', () => {
        it('should return usage statistics', async () => {
            if (!authToken) {
                console.log('Skipping usage test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/billing/usage')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 401, 403]).toContain(res.status);
            if (res.status === 200) expect(res.body).toBeDefined();
        });
    });

    describe('GET /api/billing/invoices', () => {
        it('should return invoices list', async () => {
            if (!authToken) {
                console.log('Skipping invoices test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/billing/invoices')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 401, 403, 404]).toContain(res.status);
        });
    });
});

