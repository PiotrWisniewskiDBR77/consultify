/**
 * Unit Tests: Assessment Workflow Service
 * Complete test coverage for enterprise workflow management
 * 
 * NOTE: Tests UN-SKIPPED after refactoring to Dependency Injection.
 * DI pattern allows injecting mocks directly, bypassing Vitest/CJS limitations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { AssessmentWorkflowService, WORKFLOW_STATES, REVIEW_STATUS, WORKFLOW_CONFIG } from '../../../server/src/services/assessmentWorkflowService.js';

describe('AssessmentWorkflowService (Modernized DI)', () => {
    let mockDb;
    let mockUuidv4 = vi.fn(() => 'mock-uuid-workflow');
    let mockAuditLogger = {
        log: vi.fn().mockResolvedValue({})
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDb = createMockDb();

        // Ensure logger always returns a promise to avoid .catch() errors
        mockAuditLogger.log.mockResolvedValue({});

        // Inject dependencies directly
        AssessmentWorkflowService.setDependencies({
            db: mockDb,
            uuidv4: mockUuidv4,
            auditLogger: mockAuditLogger
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // WORKFLOW STATE CONSTANTS TESTS
    // =========================================================================

    describe('WORKFLOW_STATES', () => {
        it('should define all required workflow states', () => {
            expect(WORKFLOW_STATES.DRAFT).toBe('DRAFT');
            expect(WORKFLOW_STATES.IN_REVIEW).toBe('IN_REVIEW');
            expect(WORKFLOW_STATES.AWAITING_APPROVAL).toBe('AWAITING_APPROVAL');
            expect(WORKFLOW_STATES.APPROVED).toBe('APPROVED');
            expect(WORKFLOW_STATES.REJECTED).toBe('REJECTED');
            expect(WORKFLOW_STATES.ARCHIVED).toBe('ARCHIVED');
        });
    });

    describe('REVIEW_STATUS', () => {
        it('should define all required review statuses', () => {
            expect(REVIEW_STATUS.PENDING).toBe('PENDING');
            expect(REVIEW_STATUS.IN_PROGRESS).toBe('IN_PROGRESS');
            expect(REVIEW_STATUS.DONE).toBe('DONE');
            expect(REVIEW_STATUS.SKIPPED).toBe('SKIPPED');
        });
    });

    describe('WORKFLOW_CONFIG', () => {
        it('should have valid configuration values', () => {
            expect(WORKFLOW_CONFIG.minReviewers).toBeGreaterThanOrEqual(1);
            expect(typeof WORKFLOW_CONFIG.autoArchive).toBe('boolean');
            expect(typeof WORKFLOW_CONFIG.aiSenseCheck).toBe('boolean');
            expect(typeof WORKFLOW_CONFIG.requireJustification).toBe('boolean');
            expect(WORKFLOW_CONFIG.maxReviewDays).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // initializeWorkflow TESTS
    // =========================================================================

    describe('initializeWorkflow', () => {
        it('should create a new workflow with DRAFT status', async () => {
            mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });

            const result = await AssessmentWorkflowService.initializeWorkflow(
                'assessment-123',
                'project-456',
                'org-789',
                'user-001'
            );

            expect(result).toMatchObject({
                workflowId: 'mock-uuid-workflow',
                assessmentId: 'assessment-123',
                status: WORKFLOW_STATES.DRAFT,
                version: 1
            });

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO assessment_workflows'),
                expect.arrayContaining(['mock-uuid-workflow', 'assessment-123', 'project-456', 'org-789', WORKFLOW_STATES.DRAFT, 'user-001'])
            );
        });

        it('should reject on database error', async () => {
            mockDb.run.mockRejectedValue(new Error('Database error'));

            await expect(
                AssessmentWorkflowService.initializeWorkflow(
                    'assessment-123',
                    'project-456',
                    'org-789',
                    'user-001'
                )
            ).rejects.toThrow('Database error');
        });
    });

    // =========================================================================
    // getWorkflowStatus TESTS
    // =========================================================================

    describe('getWorkflowStatus', () => {
        it('should return workflow status with computed properties', async () => {
            mockDb.get.mockResolvedValue({
                id: 'workflow-123',
                assessment_id: 'assessment-123',
                status: WORKFLOW_STATES.DRAFT,
                current_version: 1,
                completed_reviews: 0,
                total_reviews: 2
            });

            const result = await AssessmentWorkflowService.getWorkflowStatus('assessment-123');

            expect(result.canSubmitForReview).toBe(true);
            expect(result.canApprove).toBe(false);
            expect(result.reviewProgress).toBe(0);
        });

        it('should return null for non-existent workflow', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await AssessmentWorkflowService.getWorkflowStatus('non-existent');
            expect(result).toBeNull();
        });

        it('should calculate review progress correctly', async () => {
            mockDb.get.mockResolvedValue({
                id: 'workflow-123',
                status: WORKFLOW_STATES.IN_REVIEW,
                current_version: 1,
                completed_reviews: 1,
                total_reviews: 2
            });

            const result = await AssessmentWorkflowService.getWorkflowStatus('assessment-123');
            expect(result.reviewProgress).toBe(50);
        });

        it('should handle AWAITING_APPROVAL status', async () => {
            mockDb.get.mockResolvedValue({
                id: 'workflow-123',
                status: WORKFLOW_STATES.AWAITING_APPROVAL,
                current_version: 1,
                completed_reviews: 2,
                total_reviews: 2
            });

            const result = await AssessmentWorkflowService.getWorkflowStatus('assessment-123');
            expect(result.canApprove).toBe(true);
            expect(result.reviewProgress).toBe(100);
        });
    });

    // =========================================================================
    // submitForReview TESTS
    // =========================================================================

    describe('submitForReview', () => {
        beforeEach(() => {
            mockDb.get.mockImplementation((sql, params) => {
                if (sql.includes('assessment_workflows')) {
                    return Promise.resolve({
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.DRAFT,
                        current_version: 1,
                        completed_reviews: 0,
                        total_reviews: 2
                    });
                } else if (sql.includes('maturity_assessments')) {
                    return Promise.resolve({
                        axis_scores: JSON.stringify({
                            processes: { actual: 3, justification: 'Test justification for processes' },
                            digitalProducts: { actual: 4, justification: 'Test justification for digitalProducts' },
                            businessModels: { actual: 3, justification: 'Test justification for businessModels' },
                            dataManagement: { actual: 4, justification: 'Test justification for dataManagement' },
                            culture: { actual: 3, justification: 'Test justification for culture' },
                            cybersecurity: { actual: 4, justification: 'Test justification for cybersecurity' },
                            aiMaturity: { actual: 2, justification: 'Test justification for aiMaturity' }
                        })
                    });
                } else {
                    return Promise.resolve(null);
                }
            });

            mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });
        });

        it('should submit assessment for review', async () => {
            const reviewers = [
                { userId: 'reviewer-1', role: 'CTO' },
                { userId: 'reviewer-2', role: 'CFO' }
            ];

            const result = await AssessmentWorkflowService.submitForReview(
                'assessment-123',
                'submitter-user',
                reviewers
            );

            expect(result.status).toBe(WORKFLOW_STATES.IN_REVIEW);
            expect(result.reviewersCount).toBe(2);
        });

        it('should reject submission from state other than DRAFT or REJECTED', async () => {
            mockDb.get.mockImplementation((sql) => {
                if (sql.includes('assessment_workflows')) {
                    return Promise.resolve({
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.APPROVED,
                        current_version: 1
                    });
                }
                return Promise.resolve(null);
            });

            await expect(
                AssessmentWorkflowService.submitForReview('assessment-123', 'user', [])
            ).rejects.toThrow(/Cannot submit from state/);
        });

        it('should allow submission from REJECTED status', async () => {
            mockDb.get.mockImplementation((sql) => {
                if (sql.includes('assessment_workflows')) {
                    return Promise.resolve({
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.REJECTED,
                        current_version: 1
                    });
                } else if (sql.includes('maturity_assessments')) {
                    return Promise.resolve({
                        axis_scores: JSON.stringify({
                            processes: { actual: 3, justification: 'Test' },
                            digitalProducts: { actual: 4, justification: 'Test' },
                            businessModels: { actual: 3, justification: 'Test' },
                            dataManagement: { actual: 4, justification: 'Test' },
                            culture: { actual: 3, justification: 'Test' },
                            cybersecurity: { actual: 4, justification: 'Test' },
                            aiMaturity: { actual: 2, justification: 'Test' }
                        })
                    });
                }
                return Promise.resolve(null);
            });

            const reviewers = [{ userId: 'reviewer-1', role: 'CTO' }];

            const result = await AssessmentWorkflowService.submitForReview(
                'assessment-123',
                'user',
                reviewers
            );

            expect(result.status).toBe(WORKFLOW_STATES.IN_REVIEW);
        });
    });

    // =========================================================================
    // submitReview TESTS
    // =========================================================================

    describe('submitReview', () => {
        it('should submit a stakeholder review', async () => {
            mockDb.get
                .mockResolvedValueOnce({
                    id: 'review-123',
                    reviewer_id: 'reviewer-1',
                    workflow_id: 'workflow-123',
                    status: REVIEW_STATUS.PENDING
                })
                .mockResolvedValueOnce({ total: 2, completed: 2 });

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await AssessmentWorkflowService.submitReview(
                'review-123',
                'reviewer-1',
                {
                    rating: 4,
                    comments: 'Great assessment',
                    axisComments: { processes: 'Good score' },
                    recommendation: 'APPROVE'
                }
            );

            expect(result.reviewId).toBe('review-123');
            expect(result.status).toBe(REVIEW_STATUS.DONE);
            expect(result.recommendation).toBe('APPROVE');
        });

        it('should throw error for non-existent review', async () => {
            mockDb.get.mockResolvedValue(null);

            await expect(
                AssessmentWorkflowService.submitReview('non-existent', 'user', {})
            ).rejects.toThrow(/Review not found/);
        });
    });

    // =========================================================================
    // addAxisComment TESTS
    // =========================================================================

    describe('addAxisComment', () => {
        it('should add a comment to an axis', async () => {
            mockDb.run.mockResolvedValue({ lastID: 1 });

            const result = await AssessmentWorkflowService.addAxisComment(
                'assessment-123',
                'processes',
                'user-1',
                'This is a test comment'
            );

            expect(result).toMatchObject({
                commentId: 'mock-uuid-workflow',
                axisId: 'processes',
                comment: 'This is a test comment'
            });
        });
    });

    // =========================================================================
    // getAxisComments TESTS
    // =========================================================================

    describe('getAxisComments', () => {
        it('should return all comments for an assessment axis', async () => {
            mockDb.all.mockResolvedValue([
                { id: 'c1', comment: 'Comment 1', parent_comment_id: null, author_name: 'User 1' },
                { id: 'c2', comment: 'Reply', parent_comment_id: 'c1', author_name: 'User 2' }
            ]);

            const result = await AssessmentWorkflowService.getAxisComments('assessment-123');

            expect(result).toHaveLength(1); // Only root comments
            expect(result[0].replies).toHaveLength(1);
        });
    });

    // =========================================================================
    // approveAssessment TESTS
    // =========================================================================

    describe('approveAssessment', () => {
        it('should approve assessment in AWAITING_APPROVAL status', async () => {
            mockDb.get.mockImplementation((sql) => {
                if (sql.includes('assessment_workflows')) {
                    return Promise.resolve({
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.AWAITING_APPROVAL,
                        current_version: 1,
                        completed_reviews: 2,
                        total_reviews: 2
                    });
                } else {
                    return Promise.resolve({
                        id: 'assessment-123',
                        axis_scores: '{}',
                        overall_score: 3.5,
                        gap_analysis: '{}',
                        updated_by: 'user-1'
                    });
                }
            });

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await AssessmentWorkflowService.approveAssessment(
                'assessment-123',
                'approver-user',
                'All axes are well justified'
            );

            expect(result.status).toBe(WORKFLOW_STATES.APPROVED);
            expect(result.approvedBy).toBe('approver-user');
        });

        it('should throw error for non-AWAITING_APPROVAL status', async () => {
            mockDb.get.mockResolvedValue({
                id: 'workflow-123',
                status: WORKFLOW_STATES.DRAFT,
                current_version: 1
            });

            await expect(
                AssessmentWorkflowService.approveAssessment('assessment-123', 'approver', '')
            ).rejects.toThrow(/Cannot approve from state/);
        });
    });

    // =========================================================================
    // rejectAssessment TESTS
    // =========================================================================

    describe('rejectAssessment', () => {
        it('should reject assessment with reason', async () => {
            mockDb.get.mockResolvedValue({
                id: 'workflow-123',
                status: WORKFLOW_STATES.IN_REVIEW,
                current_version: 1,
                completed_reviews: 0,
                total_reviews: 2
            });

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await AssessmentWorkflowService.rejectAssessment(
                'assessment-123',
                'rejector-user',
                'Missing justifications for several axes',
                { processes: 'Justification too short', culture: 'Missing evidence' }
            );

            expect(result.status).toBe(WORKFLOW_STATES.REJECTED);
            expect(result.rejectionReason).toBe('Missing justifications for several axes');
        });
    });

    // =========================================================================
    // getWorkflowHistory TESTS
    // =========================================================================

    describe('getWorkflowHistory', () => {
        it('should return workflow history', async () => {
            mockDb.all.mockResolvedValue([
                { id: 'w1', status: WORKFLOW_STATES.APPROVED, current_version: 2 },
                { id: 'w2', status: WORKFLOW_STATES.DRAFT, current_version: 1 }
            ]);

            const result = await AssessmentWorkflowService.getWorkflowHistory('assessment-123');

            expect(result).toHaveLength(2);
            expect(result[0].current_version).toBe(2);
        });
    });

    // =========================================================================
    // getPendingReviews TESTS
    // =========================================================================

    describe('getPendingReviews', () => {
        it('should return pending reviews for a user', async () => {
            mockDb.all.mockResolvedValue([
                { id: 'review-1', status: REVIEW_STATUS.PENDING, is_overdue: 0 }
            ]);

            const result = await AssessmentWorkflowService.getPendingReviews('user-1', 'org-1');

            expect(result).toHaveLength(1);
            expect(result[0].status).toBe(REVIEW_STATUS.PENDING);
        });
    });

    // =========================================================================
    // restoreVersion TESTS
    // =========================================================================

    describe('restoreVersion', () => {
        it('should restore assessment to specific version', async () => {
            mockDb.get
                .mockResolvedValueOnce({
                    id: 'version-1',
                    version: 1,
                    assessment_data: JSON.stringify({
                        axis_scores: { processes: { actual: 3 } },
                        overall_score: 3
                    })
                })
                .mockResolvedValueOnce({
                    id: 'workflow-123',
                    current_version: 2,
                    status: WORKFLOW_STATES.IN_REVIEW
                })
                .mockResolvedValueOnce({
                    id: 'assessment-123',
                    axis_scores: '{}',
                    overall_score: 4,
                    gap_analysis: '{}',
                    updated_by: 'user-1'
                });

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await AssessmentWorkflowService.restoreVersion('assessment-123', 1, 'restorer-user');

            expect(result.restoredFromVersion).toBe(1);
            expect(result.newVersion).toBe(3);
            expect(result.status).toBe(WORKFLOW_STATES.DRAFT);
        });
    });

    // =========================================================================
    // _validateAssessmentCompleteness TESTS (Private)
    // =========================================================================

    describe('_validateAssessmentCompleteness', () => {
        it('should validate complete assessment', async () => {
            mockDb.get.mockResolvedValue({
                axis_scores: JSON.stringify({
                    processes: { actual: 3, justification: 'Test justification' },
                    digitalProducts: { actual: 4, justification: 'Test' },
                    businessModels: { actual: 3, justification: 'Test' },
                    dataManagement: { actual: 4, justification: 'Test' },
                    culture: { actual: 3, justification: 'Test' },
                    cybersecurity: { actual: 4, justification: 'Test' },
                    aiMaturity: { actual: 2, justification: 'Test' }
                })
            });

            const result = await AssessmentWorkflowService._validateAssessmentCompleteness('assessment-123');

            expect(result.isComplete).toBe(true);
            expect(result.missingItems).toHaveLength(0);
        });

        it('should identify missing axes', async () => {
            mockDb.get.mockResolvedValue({
                axis_scores: JSON.stringify({
                    processes: { actual: 3, justification: 'Test' }
                })
            });

            const result = await AssessmentWorkflowService._validateAssessmentCompleteness('assessment-123');

            expect(result.isComplete).toBe(false);
            expect(result.missingItems.length).toBeGreaterThan(0);
        });
    });
});





