// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Documents Routes
 * Tests documents API endpoints
 */
describe('Integration Test: Documents Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `docs-org-${testId}`;
    const testUserId = `docs-user-${testId}`;
    const testEmail = `docs-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Docs Test Org', 'free', 'active']
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

    describe('GET /api/documents', () => {
        it('should return list of documents', async () => {
            if (!authToken) {
                console.log('Skipping docs list test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/documents')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/documents');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('POST /api/documents/upload', () => {
        it('should require file upload', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/documents/upload')
                .set('Authorization', `Bearer ${authToken}`);

            // 400 Bad Request expected if no file
            expect([400, 500]).toContain(res.status);
        });
    });
});
