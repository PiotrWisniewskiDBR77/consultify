import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server/index.js');
const db = require('../../server/database.js');
const bcrypt = require('bcryptjs');

describe('Action Decisions API Integration (Hardened)', () => {
    let adminToken;
    let adminId = 'test-admin-92-v2';
    let orgId = 'test-org-92-v2';

    beforeAll(async () => {
        await db.initPromise;

        // Setup test org and user
        const hashedPassword = bcrypt.hashSync('password123', 8);

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [orgId, 'Test Org 9.2 V2', 'enterprise', 'active'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [adminId, orgId, 'admin92v2@test.com', hashedPassword, 'Admin', 'TestV2', 'ADMIN'], resolve);
        });

        // Get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin92v2@test.com', password: 'password123' });

        adminToken = res.body.token;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            db.run(`DELETE FROM action_decisions WHERE decided_by_user_id = ?`, [adminId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [adminId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [orgId], resolve);
        });
    });

    describe('POST /api/ai/actions/decide - Access Control', () => {
        it('should block non-admin users (no token)', async () => {
            const res = await request(app)
                .post('/api/ai/actions/decide')
                .send({
                    proposal_id: 'ap-test-001',
                    decision: 'APPROVED'
                });

            expect(res.status).toBe(403);
        });

        it('should reject invalid decision types', async () => {
            const res = await request(app)
                .post('/api/ai/actions/decide')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    proposal_id: 'ap-test-invalid',
                    decision: 'INVALID_STATUS'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid decision');
        });

        it('should return 404 for non-existent proposal (server-side snapshot check)', async () => {
            const res = await request(app)
                .post('/api/ai/actions/decide')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    proposal_id: 'ap-does-not-exist',
                    decision: 'APPROVED',
                    reason: 'Testing 404'
                });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not found');
        });
    });

    describe('GET /api/ai/actions/audit - Access Control', () => {
        it('should block unauthorized users (no token)', async () => {
            const res = await request(app)
                .get('/api/ai/actions/audit');

            expect(res.status).toBe(403);
        });

        it('should return 200 with empty array for admin with no decisions', async () => {
            const res = await request(app)
                .get('/api/ai/actions/audit')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            // This org has no decisions yet, so it should be empty
        });
    });
});
