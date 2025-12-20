import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server/index.js');
const db = require('../../server/database.js');
const bcrypt = require('bcryptjs');

describe('Action Execution Integration (Step 9.3)', () => {
    let adminToken;
    let adminId = 'exec-admin-93';
    let orgId = 'exec-org-93';
    let projectId = 'exec-proj-93';

    beforeAll(async () => {
        await db.initPromise;

        const hashedPassword = bcrypt.hashSync('password123', 8);

        // Setup test environment
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [orgId, 'Execution Test Org', 'enterprise', 'active'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [adminId, orgId, 'admin93@test.com', hashedPassword, 'Admin', 'Exec', 'ADMIN'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO projects (id, organization_id, name, status) 
                VALUES (?, ?, ?, ?)`,
                [projectId, orgId, 'Exec Project', 'active'], resolve);
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin93@test.com', password: 'password123' });

        adminToken = res.body.token;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            db.run(`DELETE FROM action_executions WHERE decision_id IN (SELECT id FROM action_decisions WHERE decided_by_user_id = ?)`, [adminId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM action_decisions WHERE decided_by_user_id = ?`, [adminId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM tasks WHERE project_id = ?`, [projectId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM projects WHERE id = ?`, [projectId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [adminId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [orgId], resolve);
        });
    });

    it('should successfully execute an APPROVED TASK_CREATE action', async () => {
        // 1. Record an approved decision
        const payload = {
            action_type: 'TASK_CREATE',
            title: 'Test Integration Task',
            description: 'Created via execution adapter test',
            project_id: projectId
        };

        const decideRes = await request(app)
            .post('/api/ai/actions/decide')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                proposal_id: 'prop-exec-001',
                decision: 'APPROVED',
                reason: 'Testing execution',
                original_payload: payload
            });

        expect(decideRes.status).toBe(201);
        const decisionId = decideRes.body.audit_id;

        // 2. Execute the decision
        const execRes = await request(app)
            .post(`/api/ai/actions/decisions/${decisionId}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        if (execRes.status !== 200) {
            console.log('EXEC FAIL:', execRes.status, execRes.body, execRes.text?.substring(0, 100));
        }

        expect(execRes.status).toBe(200);
        expect(execRes.body.success).toBe(true);
        expect(execRes.body.executionId).toBeDefined();
        expect(execRes.body.result.taskId).toBeDefined();

        // 3. Verify task creation in DB
        const task = await new Promise((resolve) => {
            db.get(`SELECT * FROM tasks WHERE id = ?`, [execRes.body.result.taskId], (err, row) => resolve(row));
        });

        expect(task).toBeDefined();
        expect(task.title).toBe('Test Integration Task');
        expect(task.organization_id).toBe(orgId);
    });

    it('should maintain idempotency (not execute twice)', async () => {
        // 1. Record another approved decision
        const payload = {
            action_type: 'TASK_CREATE',
            title: 'Idempotent Task',
            project_id: projectId
        };

        const decideRes = await request(app)
            .post('/api/ai/actions/decide')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                proposal_id: 'prop-exec-002',
                decision: 'APPROVED',
                original_payload: payload
            });

        const decisionId = decideRes.body.audit_id;

        // 2. First execution
        const execRes1 = await request(app)
            .post(`/api/ai/actions/decisions/${decisionId}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes1.status).toBe(200);
        expect(execRes1.body.alreadyExecuted).toBeFalsy();

        // 3. Second execution
        const execRes2 = await request(app)
            .post(`/api/ai/actions/decisions/${decisionId}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes2.status).toBe(200);
        expect(execRes2.body.alreadyExecuted).toBe(true);
        expect(execRes2.body.executionId).toBe(execRes1.body.executionId);
    });

    it('should fail if decision is REJECTED', async () => {
        // 1. Record a rejected decision
        const decideRes = await request(app)
            .post('/api/ai/actions/decide')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                proposal_id: 'prop-exec-003',
                decision: 'REJECTED',
                reason: 'Not needed'
            });

        const decisionId = decideRes.body.audit_id;

        // 2. Attempt execution
        const execRes = await request(app)
            .post(`/api/ai/actions/decisions/${decisionId}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes.status).toBe(400);
        expect(execRes.body.error).toContain('only APPROVED/MODIFIED are executable');
    });
});
