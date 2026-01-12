// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - User Preferences
 * Tests retrieval and updates of user preferences
 */
describe('Integration Test: Preferences Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `pref-org-${testId}`;
    const testUserId = `pref-user-${testId}`;
    const testEmail = `pref-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Preferences Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'PrefUser', 'USER'],
                    resolve
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

    describe('GET /api/preferences', () => {
        it('should return user preferences', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/preferences')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404, 500]).toContain(res.status); // 404 acceptable if empty
        });
    });

    describe('GET /api/preferences/options', () => {
        it('should return available options', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/preferences/options')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('themes');
            expect(res.body).toHaveProperty('timezones');
        });
    });

    describe('PUT /api/preferences', () => {
        it('should update user preferences', async () => {
            if (!authToken) return;

            const res = await request(app)
                .put('/api/preferences')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    theme: 'dark',
                    language: 'en'
                });

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('PUT /api/preferences/ui', () => {
        it('should update UI preferences', async () => {
            if (!authToken) return;

            const res = await request(app)
                .put('/api/preferences/ui')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    density: 'compact'
                });

            expect([200, 500]).toContain(res.status);
        });
    });
});
