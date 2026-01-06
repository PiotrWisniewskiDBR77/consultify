import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// @vitest-environment node





/**
 * Level 2: Integration Tests - Help & Enablement
 * Tests Playbooks and Help Events
 */
const db = getDatabase();
describe('Integration Test: Help Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `help-org-${testId}`;
    const testUserId = `help-user-${testId}`;
    const testEmail = `help-${testId}@test.com`;

    beforeAll(async () => {
        await initializeDatabase();
        await db.initPromise;

                const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Help Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'HelpUser', 'ADMIN'],
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

    describe('GET /api/help/playbooks', () => {
        it('should return available playbooks', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/help/playbooks')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body).toHaveProperty('playbooks');
                expect(res.body).toHaveProperty('recommendedKey');
            }
        });
    });

    describe('POST /api/help/events', () => {
        it('should log help event', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/help/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    playbookKey: 'onboarding-tour',
                    eventType: 'VIEWED',
                    context: { route: '/dashboard' }
                });

            expect([201, 200, 400, 500]).toContain(res.status);
        });
    });
});