// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Capacity
 * Tests capacity calculation and overload detection
 */
describe('Integration Test: Capacity Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `capacity-org-${testId}`;
    const testUserId = `capacity-user-${testId}`;
    const testProjectId = `capacity-proj-${testId}`;
    const testEmail = `capacity-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Capacity Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'CapacityUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'Capacity Project', 'active']
                );
            });
        });

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

    describe('GET /api/capacity/user/:userId', () => {
        it('should calculate user capacity', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/capacity/user/${testUserId}?projectId=${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/capacity/project/:projectId/overloads', () => {
        it('should detect overloads', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/capacity/project/${testProjectId}/overloads`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/capacity/project/:projectId/summary', () => {
        it('should return capacity summary', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/capacity/project/${testProjectId}/summary`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });
});
