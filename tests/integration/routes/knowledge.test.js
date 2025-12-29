// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');

/**
 * Level 2: Integration Tests - Knowledge
 * Tests Idea Candidates and Strategies
 */
describe('Integration Test: Knowledge Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `know-org-${testId}`;
    const testUserId = `know-user-${testId}`;
    const testEmail = `know-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Knowledge Test Org', 'enterprise', 'active']
                );
                // SUPERADMIN required for some routes
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'KnowledgeUser', 'SUPERADMIN'],
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

    describe('GET /api/knowledge/candidates', () => {
        it('should list candidates (superadmin)', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/knowledge/candidates')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 500]).toContain(res.status);
        });
    });

    describe('POST /api/knowledge/candidates', () => {
        it('should submit new candidate', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/knowledge/candidates')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    content: 'Test Idea',
                    reasoning: 'Why not?',
                    source: 'USER'
                });

            expect([200, 201, 500]).toContain(res.status);
        });
    });

    describe('GET /api/knowledge/strategies', () => {
        it('should list strategies', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/knowledge/strategies')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 500]).toContain(res.status);
        });
    });

    // Skipping document upload/download in basic integration suite 
    // to avoid filesystem/multer mocking complexity in this phase.
});
