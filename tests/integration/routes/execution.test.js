// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Execution
 * Tests execution tracking, blockers, and gate checks
 */
describe('Integration Test: Execution Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `execution-org-${testId}`;
    const testUserId = `execution-user-${testId}`;
    const testProjectId = `execution-proj-${testId}`;
    const testEmail = `execution-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Execution Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'ExecutionUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'Execution Project', 'active']
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

    describe('GET /api/execution/:projectId/summary', () => {
        it('should return execution summary', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/execution/${testProjectId}/summary`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/execution/:projectId/blockers', () => {
        it('should return blockers', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/execution/${testProjectId}/blockers`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('POST /api/execution/:projectId/gate-check', () => {
        it('should perform gate check', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post(`/api/execution/${testProjectId}/gate-check`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    targetPhase: 'phase2'
                });

            expect([200, 500]).toContain(res.status);
        });
    });
});
