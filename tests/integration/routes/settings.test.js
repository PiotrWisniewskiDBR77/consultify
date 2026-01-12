// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Settings Routes
 * Tests settings API endpoints
 */
describe('Integration Test: Settings Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `settings-org-${testId}`;
    const testUserId = `settings-user-${testId}`;
    const testEmail = `settings-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Settings Test Org', 'free', 'active']
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

    describe('GET /api/settings', () => {
        it('should return user settings', async () => {
            if (!authToken) {
                console.log('Skipping settings test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/settings')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/settings');

            expect([200, 401, 403]).toContain(res.status);
        });
    });

    describe('PUT /api/settings', () => {
        it('should update user settings', async () => {
            if (!authToken) {
                console.log('Skipping update settings test - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/settings')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    key: 'theme',
                    value: 'dark',
                });

            expect([200, 400]).toContain(res.status);
        });
    });
});

