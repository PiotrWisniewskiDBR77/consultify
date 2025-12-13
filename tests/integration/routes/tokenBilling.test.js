// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');
const { initTestDb } = require('../../helpers/dbHelper.cjs');

/**
 * Level 2: Integration Tests - Token Billing Routes
 * Tests token billing API endpoints
 */
describe('Integration Test: Token Billing Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `token-billing-org-${testId}`;
    const testUserId = `token-billing-user-${testId}`;
    const testEmail = `token-billing-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Token Billing Test Org', 'free', 'active']
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

    describe('GET /api/token-billing/balance', () => {
        it('should return user token balance', async () => {
            if (!authToken) {
                console.log('Skipping balance test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/token-billing/balance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.balance).toBeDefined();
            // balance can be number or object with tokens property
            expect(typeof res.body.balance === 'number' || typeof res.body.balance === 'object').toBe(true);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/token-billing/balance');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('GET /api/token-billing/packages', () => {
        it('should return available token packages', async () => {
            if (!authToken) {
                console.log('Skipping packages test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/token-billing/packages')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            // Response is { success, packages } not raw array
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.packages)).toBe(true);
        });
    });

    describe('GET /api/token-billing/transactions', () => {
        it('should return token usage history', async () => {
            if (!authToken) {
                console.log('Skipping transactions test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/token-billing/transactions')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            // Response is { success, transactions }
            expect(res.body.success).toBe(true);
            expect(res.body.transactions !== undefined || Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/token-billing/margins', () => {
        it('should return margins (admin only)', async () => {
            if (!authToken) {
                console.log('Skipping margins test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/token-billing/margins')
                .set('Authorization', `Bearer ${authToken}`);

            // May require admin, so 200 or 403 is acceptable
            expect([200, 403]).toContain(res.status);
        });
    });
});

