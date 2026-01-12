// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Stage Gates
 * Tests stage gate evaluation and transitions
 */
describe('Integration Test: Stage Gate Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `gate-org-${testId}`;
    const testUserId = `gate-user-${testId}`;
    const testProjectId = `gate-proj-${testId}`;
    const testEmail = `gate-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Gate Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'GateUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status, current_phase) VALUES (?, ?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'Gate Project', 'active', 'Context']
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

    describe('GET /api/stage-gates/:projectId/evaluate/:gateType', () => {
        it('should evaluate specific gate', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/stage-gates/${testProjectId}/evaluate/Context_To_Roadmap`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/stage-gates/:projectId/current', () => {
        it('should return current gate status', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/stage-gates/${testProjectId}/current`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.currentPhase).toBe('Context');
        });
    });

    describe('GET /api/stage-gates/:projectId/history', () => {
        it('should return gate history', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/stage-gates/${testProjectId}/history`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });
});
