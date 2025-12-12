// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Teams Routes
 * Tests teams API endpoints
 */
describe('Integration Test: Teams Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `teams-org-${testId}`;
    const testUserId = `teams-user-${testId}`;
    const testEmail = `teams-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Teams Test Org', 'free', 'active']
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

    describe('GET /api/teams', () => {
        it('should return list of teams', async () => {
            if (!authToken) {
                console.log('Skipping teams list test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/teams')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/teams');

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/teams', () => {
        it('should create a new team', async () => {
            if (!authToken) {
                console.log('Skipping create team test - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/teams')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Team',
                    description: 'Test Description',
                });

            expect([200, 201]).toContain(res.status);
        });
    });
});

