/**
 * WorkqueueService Tests
 * 
 * Tests for approval assignment management service.
 */

const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
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

            expect(hoursDiff).toBeCloseTo(WorkqueueService.DEFAULT_SLA_HOURS, 1);
        });

        it('should use custom SLA when provided', async () => {
            const customDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const result = await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId,
                slaDueAt: customDueAt
            });

            expect(new Date(result.slaDueAt).getTime()).toBeCloseTo(customDueAt.getTime(), -1000);
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

        it('should support pagination', async () => {
            // Create multiple approvals
            for (let i = 0; i < 5; i++) {
                await WorkqueueService.assignApproval({
                    proposalId: uuidv4(),
                    assignedToUserId: testUserId1,
                    orgId: testOrgId
                });
            }

            const page1 = await WorkqueueService.getMyApprovals(testUserId1, testOrgId, {
                limit: 2,
                offset: 0
            });
            const page2 = await WorkqueueService.getMyApprovals(testUserId1, testOrgId, {
                limit: 2,
                offset: 2
            });

            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(2);
            expect(page1[0].id).not.toBe(page2[0].id);
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

        it('should include overdue approvals when requested', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId,
                slaDueAt: pastDate
            });

            const overdue = await WorkqueueService.getOrgApprovals(testOrgId, {
                includeOverdue: true
            });

            expect(overdue.length).toBeGreaterThanOrEqual(1);
            expect(overdue[0].isOverdue).toBe(true);
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

        it('should return 0 when no overdue approvals', async () => {
            await WorkqueueService.assignApproval({
                proposalId: testProposalId1,
                assignedToUserId: testUserId1,
                orgId: testOrgId
            });

            const count = await WorkqueueService.getOverdueCount(testOrgId);

            expect(count).toBe(0);
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

        it('should return null for non-existent proposal', async () => {
            const assignment = await WorkqueueService.getAssignmentByProposal(
                uuidv4(),
                testOrgId
            );

            expect(assignment).toBeNull();
        });
    });
});



