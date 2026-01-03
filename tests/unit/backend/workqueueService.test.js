/**
 * WorkqueueService Tests
 * 
 * Tests for approval assignment management service.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { initTestDb, cleanTables, dbRun, db } = require('../../helpers/dbHelper.cjs');
const WorkqueueService = require('../../../server/services/workqueueService');
const { v4: uuidv4 } = require('uuid');

describe('WorkqueueService', () => {
    let testOrgId;
    let testUserId1;
    let testUserId2;
    let testProposalId1;
    let testProposalId2;

    beforeAll(async () => {
        await initTestDb();
        WorkqueueService.setDependencies({ db });
    });

    beforeEach(async () => {
        // Create test organization
        testOrgId = uuidv4();
        await dbRun(
            `INSERT INTO organizations (id, name, plan, status, organization_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [testOrgId, 'Test Org', 'professional', 'active', 'PAID']
        );

        // Create test users
        testUserId1 = uuidv4();
        testUserId2 = uuidv4();
        await dbRun(
            `INSERT INTO users (id, organization_id, email, name, role, created_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [testUserId1, testOrgId, 'user1@test.com', 'User 1', 'client']
        );
        await dbRun(
            `INSERT INTO users (id, organization_id, email, name, role, created_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [testUserId2, testOrgId, 'user2@test.com', 'User 2', 'client']
        );

        // Create test proposals
        testProposalId1 = uuidv4();
        testProposalId2 = uuidv4();
        await dbRun(
            `INSERT INTO action_decisions (id, organization_id, proposal_id, action_type, scope, status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [uuidv4(), testOrgId, testProposalId1, 'CREATE_INITIATIVE', 'PROJECT', 'PENDING']
        );
        await dbRun(
            `INSERT INTO action_decisions (id, organization_id, proposal_id, action_type, scope, status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [uuidv4(), testOrgId, testProposalId2, 'UPDATE_ASSESSMENT', 'PROJECT', 'PENDING']
        );
    });

    afterEach(async () => {
        await cleanTables([
            'approval_assignments',
            'action_decisions',
            'users',
            'organizations'
        ]);
        vi.restoreAllMocks();
    });

    describe('assignApproval', () => {
        it('should assign approval to user', async () => {
            const result = await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId,
                createdBy: testUserId2
            });

            expect(result).toHaveProperty('id');
            expect(result.proposalId).toBe(testProposalId1);
            expect(result.assignedToUserId).toBe(testUserId1);
            expect(result.orgId).toBe(testOrgId);
            expect(result.status).toBe(WorkqueueService.ASSIGNMENT_STATUSES.PENDING);
            expect(result.slaDueAt).toBeDefined();
        });

        it('should use default SLA of 48 hours', async () => {
            const result = await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const dueDate = new Date(result.slaDueAt);
            const now = new Date();
            const hoursDiff = (dueDate - now) / (1000 * 60 * 60);

            // Allow some wiggle room for execution time
            expect(hoursDiff).toBeLessThanOrEqual(WorkqueueService.DEFAULT_SLA_HOURS);
            expect(hoursDiff).toBeGreaterThan(WorkqueueService.DEFAULT_SLA_HOURS - 1);
        });

        it('should use custom SLA when provided', async () => {
            const customDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const result = await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId,
                slaDueAt: customDueAt
            });

            expect(new Date(result.slaDueAt).getTime()).toBe(customDueAt.getTime());
        });

        it('should reject duplicate active assignment', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            await expect(
                WorkqueueService.assignApproval({
                    proposalId: testProposalId1,
                    assignedToUserId: testUserId1,
                    orgId: testOrgId
                })
            ).rejects.toThrow('Active assignment already exists');
        });

        it('should allow assignment after previous is completed', async () => {
            // Create and complete first assignment
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });
            await WorkqueueService.completeApproval(testProposalId1, testUserId1, testOrgId);

            // Should allow new assignment
            const result = await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId2,
                orgId: testOrgId
            });

            expect(result.assignedToUserId).toBe(testUserId2);
        });
    });

    describe('acknowledgeApproval', () => {
        it('should acknowledge pending approval', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const result = await WorkqueueService.acknowledgeApproval(
                testProposalId1,
                testUserId1,
                testOrgId
            );

            expect(result.status).toBe(WorkqueueService.ASSIGNMENT_STATUSES.ACKED);
        });

        it('should reject acknowledgment for non-existent assignment', async () => {
            await expect(
                WorkqueueService.acknowledgeApproval(
                    testProposalId1,
                    testUserId1,
                    testOrgId
                )
            ).rejects.toThrow('Assignment not found');
        });

        it('should reject acknowledgment for wrong user', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            await expect(
                WorkqueueService.acknowledgeApproval(
                    testProposalId1,
                    testUserId2,
                    testOrgId
                )
            ).rejects.toThrow('Assignment not found');
        });
    });

    describe('completeApproval', () => {
        it('should complete pending approval', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const result = await WorkqueueService.completeApproval(
                testProposalId1,
                testUserId1,
                testOrgId
            );

            expect(result.status).toBe(WorkqueueService.ASSIGNMENT_STATUSES.DONE);
        });

        it('should complete acknowledged approval', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });
            await WorkqueueService.acknowledgeApproval(
                testProposalId1,
                testUserId1,
                testOrgId
            );

            const result = await WorkqueueService.completeApproval(
                testProposalId1,
                testUserId1,
                testOrgId
            );

            expect(result.status).toBe(WorkqueueService.ASSIGNMENT_STATUSES.DONE);
        });

        it('should reject completion for non-existent assignment', async () => {
            await expect(
                WorkqueueService.completeApproval(
                    testProposalId1,
                    testUserId1,
                    testOrgId
                )
            ).rejects.toThrow('Assignment not found');
        });
    });

    describe('getMyApprovals', () => {
        it('should return user approvals', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });
            await WorkqueueService.assignApproval({
                proposalId: testProposalId2,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const approvals = await WorkqueueService.getMyApprovals(testUserId1, testOrgId);

            expect(approvals).toHaveLength(2);
            expect(approvals[0].assigned_to_user_id).toBe(testUserId1);
        });

        it('should filter by status', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });
            await WorkqueueService.completeApproval(testProposalId1, testUserId1, testOrgId);
            await WorkqueueService.assignApproval({
                proposalId: testProposalId2,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const pending = await WorkqueueService.getMyApprovals(testUserId1, testOrgId, {
                status: 'PENDING'
            });

            expect(pending).toHaveLength(1);
            expect(pending[0].status).toBe('PENDING');
        });

        it('should mark overdue approvals', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId,
                slaDueAt: pastDate
            });

            const approvals = await WorkqueueService.getMyApprovals(testUserId1, testOrgId);

            expect(approvals).toHaveLength(1);
            expect(approvals[0].isOverdue).toBe(true);
        });
    });

    describe('getOrgApprovals', () => {
        it('should return all org approvals', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });
            await WorkqueueService.assignApproval({
                proposalId: testProposalId2,
                assignedToUserId: testUserId2,
                orgId: testOrgId
            });

            const approvals = await WorkqueueService.getOrgApprovals(testOrgId);

            expect(approvals.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('getOverdueCount', () => {
        it('should return count of overdue approvals', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId,
                slaDueAt: pastDate
            });
            await WorkqueueService.assignApproval({
                proposalId: testProposalId2,
                assignedToUserId: testUserId2,
                orgId: testOrgId,
                slaDueAt: pastDate
            });

            const count = await WorkqueueService.getOverdueCount(testOrgId);

            expect(count).toBeGreaterThanOrEqual(2);
        });
    });

    describe('getAssignmentByProposal', () => {
        it('should return assignment for proposal', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const assignment = await WorkqueueService.getAssignmentByProposal(
                testProposalId1,
                testOrgId
            );

            expect(assignment).toBeDefined();
            expect(assignment.proposal_id).toBe(testProposalId1);
        });
    });
});



