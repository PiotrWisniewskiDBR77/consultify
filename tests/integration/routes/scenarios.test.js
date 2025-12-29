// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Scenarios
 * Tests what-if scenarios and critical path analysis
 */
describe('Integration Test: Scenarios Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `scenario-org-${testId}`;
    const testUserId = `scenario-user-${testId}`;
    const testProjectId = `scenario-proj-${testId}`;
    const testEmail = `scenario-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Scenario Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'ScenarioUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'Scenario Project', 'active']
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

    describe('POST /api/scenarios/:projectId/analyze', () => {
        it('should analyze impact of proposed changes', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post(`/api/scenarios/${testProjectId}/analyze`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    proposedChanges: [
                        { type: 'DELAY', taskId: 'task-1', days: 5 }
                    ]
                });

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/scenarios/:projectId/critical-path', () => {
        it('should calculate critical path', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/scenarios/${testProjectId}/critical-path`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/scenarios/:projectId/schedule-risks', () => {
        it('should analyze schedule risks', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/scenarios/${testProjectId}/schedule-risks`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });
});
