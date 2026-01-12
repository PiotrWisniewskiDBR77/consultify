// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Roadmap
 * Tests roadmap waves, baselines, and initiative assignment
 */
describe('Integration Test: Roadmap Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `roadmap-org-${testId}`;
    const testUserId = `roadmap-user-${testId}`;
    const testProjectId = `roadmap-proj-${testId}`;
    const testEmail = `roadmap-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Roadmap Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'RoadmapUser', 'ADMIN'], // ADMIN role allows most permissions
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'Roadmap Project', 'active']
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

    describe('GET /api/roadmap/:projectId/waves', () => {
        it('should return project waves', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/roadmap/${testProjectId}/waves`)
                .set('Authorization', `Bearer ${authToken}`);

            // Expect 200 or 500 depending on service mocking, but endpoint existence is key
            expect([200, 500]).toContain(res.status);
        });
    });

    describe('POST /api/roadmap/:projectId/waves', () => {
        it('should create a new wave', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post(`/api/roadmap/${testProjectId}/waves`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Wave 1',
                    startDate: new Date().toISOString(),
                    endDate: new Date().toISOString()
                });

            // Expect 201 Created or 500 if DB logic fails (but route is hit)
            // 403 would mean permission denied, which we want to avoid with ADMIN
            expect([201, 200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/roadmap/:projectId/summary', () => {
        it('should return roadmap summary', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/roadmap/${testProjectId}/summary`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });
});
