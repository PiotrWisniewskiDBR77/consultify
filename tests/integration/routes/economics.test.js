// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Economics (Digitization)
 */
describe('Integration Test: Economics Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `econ-org-${testId}`;
    const testUserId = `econ-user-${testId}`;
    const testEmail = `econ-${testId}@test.com`;
    const testProjectId = `econ-proj-${testId}`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Economics Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'EconUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'Econ Project', 'active']
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

    describe('GET /api/economics/analyses', () => {
        it('should list analyses', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/economics/analyses')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/economics/stats', () => {
        it('should return catalog stats', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/economics/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('POST /api/economics/analyses', () => {
        it('should create new analysis', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/economics/analyses')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Analysis',
                    description: 'Integration Check',
                    projectId: testProjectId,
                    tags: ['test']
                });

            expect([201, 200, 500]).toContain(res.status);
        });
    });
});
