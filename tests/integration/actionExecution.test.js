import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server/index.js');
const db = require('../../server/database.js');
const bcrypt = require('bcryptjs');

/**
 * Action Execution Hardening Integration Tests (Step 9.3)
 * 
 * These tests focus on the EXECUTION ADAPTER functionality:
 * - Idempotency (idempotent_replay)
 * - Cross-org RBAC guards
 * - REJECTED decision handling
 * - Mock metadata for MEETING_SCHEDULE
 * 
 * Since ActionDecisionService now fetches proposals server-side, 
 * we seed decisions directly into the database for execution tests.
 */
describe('Action Execution Hardening Integration (Step 9.3)', () => {
    let adminToken, otherAdminToken;
    const adminId = 'harden-admin-1';
    const otherAdminId = 'harden-admin-2';
    const orgId = 'harden-org-1';
    const otherOrgId = 'harden-org-2';
    const projectId = 'harden-proj-1';

    // Decision IDs for direct insertion
    const decisionIds = {
        task: 'ad-test-task-exec',
        idempotent: 'ad-test-idempotent',
        rejected: 'ad-test-rejected',
        crossOrg: 'ad-test-cross-org',
        meeting: 'ad-test-meeting'
    };

    beforeAll(async () => {
        await db.initPromise;

        const hashedPassword = bcrypt.hashSync('password123', 8);

        // Setup Org 1
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [orgId, 'Harden Org 1', 'enterprise', 'active'], resolve);
        });
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [adminId, orgId, 'admin1@harden.com', hashedPassword, 'Admin', 'One', 'ADMIN'], resolve);
        });
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO projects (id, organization_id, name, status) 
                VALUES (?, ?, ?, ?)`,
                [projectId, orgId, 'Harden Project', 'active'], resolve);
        });

        // Setup Org 2
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [otherOrgId, 'Harden Org 2', 'enterprise', 'active'], resolve);
        });
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [otherAdminId, otherOrgId, 'admin2@harden.com', hashedPassword, 'Admin', 'Two', 'ADMIN'], resolve);
        });

        // Login both admins
        const res1 = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin1@harden.com', password: 'password123' });
        adminToken = res1.body.token;

        const res2 = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin2@harden.com', password: 'password123' });
        otherAdminToken = res2.body.token;

        // Seed test decisions directly into database
        const taskSnapshot = JSON.stringify({
            proposal_id: 'prop-task-1',
            action_type: 'TASK_CREATE',
            title: 'Hardened Task',
            project_id: projectId
        });

        const meetingSnapshot = JSON.stringify({
            proposal_id: 'prop-meeting-1',
            action_type: 'MEETING_SCHEDULE',
            summary: 'Hardened Sync',
            participants: ['admin1@harden.com']
        });

        // Insert test decisions
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO action_decisions 
                (id, proposal_id, organization_id, action_type, scope, decision, decided_by_user_id, proposal_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [decisionIds.task, 'prop-task-1', orgId, 'TASK_CREATE', 'project', 'APPROVED', adminId, taskSnapshot], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO action_decisions 
                (id, proposal_id, organization_id, action_type, scope, decision, decided_by_user_id, proposal_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [decisionIds.idempotent, 'prop-idempot-1', orgId, 'TASK_CREATE', 'project', 'APPROVED', adminId, taskSnapshot], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO action_decisions 
                (id, proposal_id, organization_id, action_type, scope, decision, decided_by_user_id, proposal_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [decisionIds.rejected, 'prop-rejected-1', orgId, 'TASK_CREATE', 'project', 'REJECTED', adminId, taskSnapshot], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO action_decisions 
                (id, proposal_id, organization_id, action_type, scope, decision, decided_by_user_id, proposal_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [decisionIds.crossOrg, 'prop-crossorg-1', orgId, 'TASK_CREATE', 'project', 'APPROVED', adminId, taskSnapshot], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO action_decisions 
                (id, proposal_id, organization_id, action_type, scope, decision, decided_by_user_id, proposal_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [decisionIds.meeting, 'prop-meeting-1', orgId, 'MEETING_SCHEDULE', 'initiative', 'APPROVED', adminId, meetingSnapshot], resolve);
        });
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            db.run(`DELETE FROM action_executions WHERE organization_id IN (?, ?)`, [orgId, otherOrgId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM action_decisions WHERE organization_id IN (?, ?)`, [orgId, otherOrgId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM tasks WHERE project_id = ?`, [projectId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM projects WHERE organization_id = ?`, [orgId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE organization_id IN (?, ?)`, [orgId, otherOrgId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id IN (?, ?)`, [orgId, otherOrgId], resolve);
        });
    });

    it('should successfully execute an APPROVED TASK_CREATE action', async () => {
        const execRes = await request(app)
            .post(`/api/ai/actions/decisions/${decisionIds.task}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes.status).toBe(200);
        expect(execRes.body.success).toBe(true);
        expect(execRes.body.idempotent_replay).toBe(false);
        expect(execRes.body.result.taskId).toBeDefined();
        expect(execRes.body.action_type).toBe('TASK_CREATE');
    });

    it('should return idempotent_replay: true on second execution', async () => {
        // First execution
        await request(app)
            .post(`/api/ai/actions/decisions/${decisionIds.idempotent}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        // Second execution
        const execRes2 = await request(app)
            .post(`/api/ai/actions/decisions/${decisionIds.idempotent}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes2.status).toBe(200);
        expect(execRes2.body.idempotent_replay).toBe(true);
        expect(execRes2.body.success).toBe(true);
    });

    it('should reject execution of REJECTED decision with 400', async () => {
        const execRes = await request(app)
            .post(`/api/ai/actions/decisions/${decisionIds.rejected}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes.status).toBe(400);
        expect(execRes.body.success).toBe(false);
        expect(execRes.body.error).toContain('only APPROVED/MODIFIED are executable');
    });

    it('should block admin from executing decision of another organization (403)', async () => {
        // Admin 2 tries to execute Admin 1's decision
        const execRes = await request(app)
            .post(`/api/ai/actions/decisions/${decisionIds.crossOrg}/execute`)
            .set('Authorization', `Bearer ${otherAdminToken}`);

        expect(execRes.status).toBe(404); // 404 because orgId filter excludes it
    });

    it('should return mock metadata for MEETING_SCHEDULE', async () => {
        const execRes = await request(app)
            .post(`/api/ai/actions/decisions/${decisionIds.meeting}/execute`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(execRes.status).toBe(200);
        expect(execRes.body.success).toBe(true);
        expect(execRes.body.result.metadata.mock).toBe(true);
    });
});
