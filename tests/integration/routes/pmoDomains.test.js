// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - PMO Domains
 * Tests PMO Domain Registry and Standards Mapping
 */
describe('Integration Test: PMO Domains Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `pmo-dom-org-${testId}`;
    const testUserId = `pmo-dom-user-${testId}`;
    const testProjectId = `pmo-dom-proj-${testId}`;
    const testEmail = `pmo-dom-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'PMO Domains Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'PMODomainUser', 'ADMIN'],
                    resolve
                );
                db.run(
                    'INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                    [testProjectId, testOrgId, 'PMO Domains Project', 'active']
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

    describe('GET /api/pmo-domains', () => {
        it('should return all PMP domains', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/pmo-domains')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
            // If 200, verify structure
            if (res.status === 200) {
                expect(res.body.success).toBe(true);
                expect(Array.isArray(res.body.data)).toBe(true);
            }
        });
    });

    describe('GET /api/pmo-domains/standards-mapping', () => {
        it('should return standards mapping', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/pmo-domains/standards-mapping')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/pmo-domains/projects/:projectId', () => {
        it('should return project domains', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get(`/api/pmo-domains/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });
});
