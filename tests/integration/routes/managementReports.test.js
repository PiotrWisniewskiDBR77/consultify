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
 * Level 2: Integration Tests - Management Reports
 * Tests management report generation and retrieval
 */
describe.skip('Integration Test: Management Reports Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `mgmt-rep-org-${testId}`;
    const testUserId = `mgmt-rep-user-${testId}`;
    const testEmail = `mgmt-${testId}@test.com`;

    beforeAll(async () => {
        await initializeDatabase();
        await db.initPromise;

                const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Mgmt Reports Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'MgmtUser', 'MANAGER'],
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

    const db = getDatabase();
describe('GET /api/management-reports/types', () => {
        it('should return available report types', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/management-reports/types')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.types).toBeDefined();
            expect(Array.isArray(res.body.types)).toBe(true);
            expect(res.body.types.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/management-reports/history', () => {
        it('should return empty history initially', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/management-reports/history')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.reports).toBeDefined();
            expect(Array.isArray(res.body.reports)).toBe(true);
        });
    });
});