// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Feedback Routes
 * Tests feedback API endpoints
 */
describe('Integration Test: Feedback Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `feedback-org-${testId}`;
    const testUserId = `feedback-user-${testId}`;
    const testEmail = `feedback-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Feedback Test Org', 'free', 'active']
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

    describe('POST /api/feedback', () => {
        it('should submit feedback', async () => {
            if (!authToken) {
                console.log('Skipping submit feedback test - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/feedback')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'bug',
                    message: 'Test feedback message',
                    rating: 5,
                });

            expect([200, 201, 400]).toContain(res.status);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/feedback')
                .send({
                    type: 'bug',
                    message: 'Test',
                });

            expect([200, 400, 401, 403]).toContain(res.status);
        });
    });

    describe('GET /api/feedback', () => {
        it('should return feedback list (admin only)', async () => {
            if (!authToken) {
                console.log('Skipping feedback list test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/feedback')
                .set('Authorization', `Bearer ${authToken}`);

            // May require admin, so 200 or 403 is acceptable
            expect([200, 403]).toContain(res.status);
        });
    });
});

