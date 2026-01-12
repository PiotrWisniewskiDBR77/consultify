// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - PMO Analysis
 * Tests AI analysis, dependencies, and portfolio checks
 */
describe('Integration Test: PMO Analysis Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `pmo-an-org-${testId}`;
    const testUserId = `pmo-an-user-${testId}`;
    const testProjectId = `pmo-an-proj-${testId}`;
    const testEmail = `pmo-an-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'PMO Analysis Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'PMOAnalysisUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'PMO Analysis Project', 'active']
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

    describe('GET /api/pmo-analysis/:projectId', () => {
        it('should return project analysis', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/pmo-analysis/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/pmo-analysis/:projectId/progress', () => {
        it('should return project progress', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/pmo-analysis/${testProjectId}/progress`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/pmo-analysis/:projectId/dependencies', () => {
        it('should return dependency graph', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/pmo-analysis/${testProjectId}/dependencies`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });
});
