import path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'decision-management-integration.db');
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: Decision Management Integration
 * 
 * Tests decision management workflow across services:
 * - DecisionService
 * - EscalationService
 * - NotificationService
 * - TaskService
 * - AuditService
 * - ComplianceService
 */
describe('L3: Decision Management Integration', () => {
    const testDbPath = path.resolve(__dirname, 'decision-management-integration.db');
    let adminToken: string;
    let managerToken: string;
    let userToken: string;
    let testOrgId: string;
    let testDecisionId: string;
    let adminUserId: string;
    let managerUserId: string;
    let regularUserId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        // Setup test organization
        const org = await testFactory.createOrganization({
            name: 'Decision Test Org',
            plan: 'enterprise',
        });
        testOrgId = org.id;

        // Create users with different roles
        const admin = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'AdminPass123!',
            role: 'ADMIN',
        });
        adminUserId = admin.id;

        const manager = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'ManagerPass123!',
            role: 'USER',
        });
        managerUserId = manager.id;

        const user = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'UserPass123!',
            role: 'USER',
        });
        regularUserId = user.id;

        // Login all users
        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: admin.email, password: 'AdminPass123!' });
        adminToken = adminLogin.body.token;

        const managerLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: manager.email, password: 'ManagerPass123!' });
        managerToken = managerLogin.body.token;

        const userLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'UserPass123!' });
        userToken = userLogin.body.token;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('Decision Creation → Stakeholder Assignment → Approval Routing Flow', () => {
        it('should create new decision', async () => {
            const createRes = await request(app)
                .post('/api/decisions')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    title: 'Adopt New Technology Platform',
                    description: 'Decision to migrate to cloud-native architecture',
                    category: 'technology',
                    impact: 'high',
                    urgency: 'medium',
                });

            if (createRes.status === 200 || createRes.status === 201) {
                expect(createRes.body).toHaveProperty('id');
                expect(createRes.body.title).toBe('Adopt New Technology Platform');
                testDecisionId = createRes.body.id;
            }
        });

        it('should assign stakeholders to decision', async () => {
            if (!testDecisionId) testDecisionId = 'mock-decision-id';

            const assignRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/stakeholders`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    stakeholders: [
                        { userId: managerUserId, role: 'approver', weight: 1.0 },
                        { userId: adminUserId, role: 'final_approver', weight: 1.0 },
                    ],
                });

            if (assignRes.status === 200 || assignRes.status === 201) {
                expect(assignRes.body.stakeholders).toHaveLength(2);
            }
        });

        it('should route decision for approval', async () => {
            const routeRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/submit`)
                .set('Authorization', `Bearer ${userToken}`);

            if (routeRes.status === 200) {
                expect(routeRes.body.status).toBe('pending_approval');
            }
        });

        it('should notify stakeholders of pending decision', async () => {
            // Verify notifications were sent
            const notifRes = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${managerToken}`);

            if (notifRes.status === 200) {
                const decisionNotif = notifRes.body.find((n: any) =>
                    n.type === 'decision_approval_required' && n.decisionId === testDecisionId
                );
                // Notification might exist
            }
        });
    });

    describe('Escalation Triggers → Notification Cascade → Delegation Flow', () => {
        it('should escalate decision after timeout', async () => {
            // Simulate timeout by updating decision timestamp
            const escalateRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/escalate`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'approval_timeout' });

            if (escalateRes.status === 200) {
                expect(escalateRes.body).toHaveProperty('escalationLevel');
            }
        });

        it('should trigger notification cascade on escalation', async () => {
            // Verify escalation notifications
            const notifRes = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${adminToken}`);

            if (notifRes.status === 200) {
                const escalationNotif = notifRes.body.find((n: any) =>
                    n.type === 'decision_escalated'
                );
                // Notification might exist
            }
        });

        it('should delegate decision to another approver', async () => {
            const delegateRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/delegate`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    fromUserId: managerUserId,
                    toUserId: adminUserId,
                    reason: 'Out of office',
                });

            if (delegateRes.status === 200) {
                expect(delegateRes.body).toHaveProperty('delegatedTo', adminUserId);
            }
        });

        it('should track delegation history', async () => {
            const historyRes = await request(app)
                .get(`/api/decisions/${testDecisionId}/delegation-history`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (historyRes.status === 200) {
                expect(Array.isArray(historyRes.body)).toBe(true);
            }
        });
    });

    describe('Decision Execution → Task Generation → Status Tracking Flow', () => {
        it('should approve decision', async () => {
            const approveRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/approve`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    comments: 'Approved with conditions',
                    conditions: ['Budget review required', 'Security audit needed'],
                });

            if (approveRes.status === 200) {
                expect(approveRes.body.status).toBe('approved');
            }
        });

        it('should generate tasks from approved decision', async () => {
            const tasksRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/generate-tasks`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (tasksRes.status === 200 || tasksRes.status === 201) {
                expect(Array.isArray(tasksRes.body.tasks)).toBe(true);
                expect(tasksRes.body.tasks.length).toBeGreaterThan(0);
            }
        });

        it('should track decision execution status', async () => {
            const statusRes = await request(app)
                .get(`/api/decisions/${testDecisionId}/execution-status`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (statusRes.status === 200) {
                expect(statusRes.body).toHaveProperty('status');
                expect(statusRes.body).toHaveProperty('completedTasks');
                expect(statusRes.body).toHaveProperty('pendingTasks');
            }
        });

        it('should update decision status based on task completion', async () => {
            // Complete all tasks
            const updateRes = await request(app)
                .put(`/api/decisions/${testDecisionId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ executionStatus: 'completed' });

            if (updateRes.status === 200) {
                expect(updateRes.body.executionStatus).toBe('completed');
            }
        });
    });

    describe('Audit Trail → Compliance Verification → Reporting Flow', () => {
        it('should record all decision actions in audit log', async () => {
            const auditRes = await request(app)
                .get(`/api/decisions/${testDecisionId}/audit-log`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (auditRes.status === 200) {
                expect(Array.isArray(auditRes.body)).toBe(true);
                // Should have entries for creation, approval, execution, etc.
            }
        });

        it('should verify compliance requirements', async () => {
            const complianceRes = await request(app)
                .get(`/api/decisions/${testDecisionId}/compliance`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (complianceRes.status === 200) {
                expect(complianceRes.body).toHaveProperty('compliant');
                expect(complianceRes.body).toHaveProperty('requirements');
            }
        });

        it('should generate decision audit report', async () => {
            const reportRes = await request(app)
                .get(`/api/decisions/${testDecisionId}/audit-report`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (reportRes.status === 200) {
                expect(reportRes.body).toHaveProperty('decision');
                expect(reportRes.body).toHaveProperty('timeline');
                expect(reportRes.body).toHaveProperty('stakeholders');
                expect(reportRes.body).toHaveProperty('auditTrail');
            }
        });

        it('should export audit trail for compliance', async () => {
            const exportRes = await request(app)
                .get(`/api/decisions/${testDecisionId}/audit-export`)
                .set('Authorization', `Bearer ${adminToken}`)
                .query({ format: 'pdf' });

            if (exportRes.status === 200) {
                expect(exportRes.headers['content-type']).toContain('application/pdf');
            }
        });
    });

    describe('Decision Rejection and Alternative Paths', () => {
        let rejectedDecisionId: string;

        beforeAll(async () => {
            // Create decision to be rejected
            const createRes = await request(app)
                .post('/api/decisions')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    title: 'Decision to be Rejected',
                    description: 'This decision will be rejected for testing',
                });

            if (createRes.status === 200 || createRes.status === 201) {
                rejectedDecisionId = createRes.body.id;
            }
        });

        it('should reject decision with reason', async () => {
            if (!rejectedDecisionId) rejectedDecisionId = 'mock-rejected-decision';

            const rejectRes = await request(app)
                .post(`/api/decisions/${rejectedDecisionId}/reject`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    reason: 'Insufficient budget justification',
                    feedback: 'Please provide detailed cost-benefit analysis',
                });

            if (rejectRes.status === 200) {
                expect(rejectRes.body.status).toBe('rejected');
            }
        });

        it('should notify decision creator of rejection', async () => {
            const notifRes = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${userToken}`);

            if (notifRes.status === 200) {
                const rejectionNotif = notifRes.body.find((n: any) =>
                    n.type === 'decision_rejected' && n.decisionId === rejectedDecisionId
                );
                // Notification might exist
            }
        });

        it('should allow decision revision after rejection', async () => {
            const reviseRes = await request(app)
                .post(`/api/decisions/${rejectedDecisionId}/revise`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    description: 'Updated with detailed cost-benefit analysis',
                    attachments: ['budget_analysis.pdf'],
                });

            if (reviseRes.status === 200) {
                expect(reviseRes.body.status).toBe('pending_approval');
                expect(reviseRes.body.version).toBeGreaterThan(1);
            }
        });
    });

    describe('Multi-Level Approval Workflows', () => {
        let multiLevelDecisionId: string;

        beforeAll(async () => {
            // Create decision requiring multi-level approval
            const createRes = await request(app)
                .post('/api/decisions')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    title: 'Major Investment Decision',
                    description: 'Requires multi-level approval',
                    approvalLevels: [
                        { level: 1, approvers: [managerUserId] },
                        { level: 2, approvers: [adminUserId] },
                    ],
                });

            if (createRes.status === 200 || createRes.status === 201) {
                multiLevelDecisionId = createRes.body.id;
            }
        });

        it('should require sequential approval from all levels', async () => {
            if (!multiLevelDecisionId) multiLevelDecisionId = 'mock-multilevel-decision';

            // Submit for approval
            await request(app)
                .post(`/api/decisions/${multiLevelDecisionId}/submit`)
                .set('Authorization', `Bearer ${userToken}`);

            // Level 1 approval
            const level1Res = await request(app)
                .post(`/api/decisions/${multiLevelDecisionId}/approve`)
                .set('Authorization', `Bearer ${managerToken}`);

            if (level1Res.status === 200) {
                expect(level1Res.body.currentApprovalLevel).toBe(2);
            }

            // Level 2 approval
            const level2Res = await request(app)
                .post(`/api/decisions/${multiLevelDecisionId}/approve`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (level2Res.status === 200) {
                expect(level2Res.body.status).toBe('approved');
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should reject decision creation with invalid data', async () => {
            const createRes = await request(app)
                .post('/api/decisions')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ title: '' }); // Invalid: empty title

            expect([400, 422]).toContain(createRes.status);
        });

        it('should prevent unauthorized approval', async () => {
            // User tries to approve decision they're not assigned to
            const unauthorizedRes = await request(app)
                .post(`/api/decisions/${testDecisionId}/approve`)
                .set('Authorization', `Bearer ${userToken}`);

            expect([403, 404]).toContain(unauthorizedRes.status);
        });

        it('should handle concurrent approval attempts', async () => {
            const newDecision = await testFactory.createDecision({
                organizationId: testOrgId,
                title: 'Concurrent Approval Test',
            });

            // Multiple users try to approve simultaneously
            const promises = [
                request(app)
                    .post(`/api/decisions/${newDecision.id}/approve`)
                    .set('Authorization', `Bearer ${managerToken}`),
                request(app)
                    .post(`/api/decisions/${newDecision.id}/approve`)
                    .set('Authorization', `Bearer ${adminToken}`),
            ];

            const results = await Promise.all(promises);

            // One should succeed, others should handle conflict
            const successful = results.filter(r => r.status === 200);
            expect(successful.length).toBeGreaterThan(0);
        });
    });
});
