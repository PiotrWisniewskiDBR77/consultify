import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server/index.js');
const db = require('../../server/database.js');
const bcrypt = require('bcryptjs');

describe('Action Decisions API Integration', () => {
    let adminToken;
    let adminId = 'test-admin-92';
    let orgId = 'test-org-92';

    beforeAll(async () => {
        await db.initPromise;

        // Setup test org and user
        const hashedPassword = bcrypt.hashSync('password123', 8);

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [orgId, 'Test Org 9.2', 'enterprise', 'active'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [adminId, orgId, 'admin92@test.com', hashedPassword, 'Admin', 'Test', 'ADMIN'], resolve);
        });

        // Get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin92@test.com', password: 'password123' });

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

    describe('POST /api/ai/actions/decide', () => {
        it('should record an APPROVED decision', async () => {
            const res = await request(app)
                .post('/api/ai/actions/decide')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    proposal_id: 'ap-92-001',
                    decision: 'APPROVED',
                    reason: 'Necessary for growth'
                });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Decision recorded successfully');
            expect(res.body.audit_id).toBeDefined();
        });

        it('should block non-admin users', async () => {
            // No token provided
            const res = await request(app)
                .post('/api/ai/actions/decide')
                .send({
                    proposal_id: 'ap-92-002',
                    decision: 'APPROVED'
                });

            expect(res.status).toBe(403); // Or 401 depending on middleware
        });

        it('should reject invalid decision types', async () => {
            const res = await request(app)
                .post('/api/ai/actions/decide')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    proposal_id: 'ap-92-001',
                    decision: 'INVALID_STATUS'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid decision');
        });
    });

    describe('GET /api/ai/actions/audit', () => {
        it('should fetch the audit log', async () => {
            const res = await request(app)
                .get('/api/ai/actions/audit')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0].proposal_id).toBe('ap-92-001');
        });
    });
});
