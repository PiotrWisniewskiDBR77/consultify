/**
 * Unit Tests: Assessment Workflow Service
 * Complete test coverage for enterprise workflow management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn()
};

const mockUuidv4 = vi.fn(() => 'mock-uuid-workflow');

vi.mock('../../../server/database', () => ({ default: mockDb }));
vi.mock('uuid', () => ({ v4: mockUuidv4 }));
vi.mock('../../../server/utils/assessmentAuditLogger', () => ({
    default: { log: vi.fn() }
}));

describe('AssessmentWorkflowService', () => {
    let AssessmentWorkflowService;
    let WORKFLOW_STATES;
    let REVIEW_STATUS;
    let WORKFLOW_CONFIG;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const module = await import('../../../server/services/assessmentWorkflowService.js');
        AssessmentWorkflowService = module.AssessmentWorkflowService;
        WORKFLOW_STATES = module.WORKFLOW_STATES;
        REVIEW_STATUS = module.REVIEW_STATUS;
        WORKFLOW_CONFIG = module.WORKFLOW_CONFIG;
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
            expect(REVIEW_STATUS.COMPLETED).toBe('COMPLETED');
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
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

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

            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should reject on database error', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'));
            });

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
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'workflow-123',
                    assessment_id: 'assessment-123',
                    status: WORKFLOW_STATES.DRAFT,
                    current_version: 1,
                    completed_reviews: 0,
                    total_reviews: 2
                });
            });

            const result = await AssessmentWorkflowService.getWorkflowStatus('assessment-123');

            expect(result.canSubmitForReview).toBe(true);
            expect(result.canApprove).toBe(false);
            expect(result.reviewProgress).toBe(0);
        });

        it('should return null for non-existent workflow', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await AssessmentWorkflowService.getWorkflowStatus('non-existent');
            expect(result).toBeNull();
        });

        it('should calculate review progress correctly', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'workflow-123',
                    status: WORKFLOW_STATES.IN_REVIEW,
                    current_version: 1,
                    completed_reviews: 1,
                    total_reviews: 2
                });
            });

            const result = await AssessmentWorkflowService.getWorkflowStatus('assessment-123');
            expect(result.reviewProgress).toBe(50);
        });

        it('should handle AWAITING_APPROVAL status', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'workflow-123',
                    status: WORKFLOW_STATES.AWAITING_APPROVAL,
                    current_version: 1,
                    completed_reviews: 2,
                    total_reviews: 2
                });
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
            // Mock getWorkflowStatus
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('assessment_workflows')) {
                    callback(null, {
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.DRAFT,
                        current_version: 1
                    });
                } else if (sql.includes('maturity_assessments')) {
                    callback(null, {
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
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
            });
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

        it('should throw error for non-DRAFT status', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'workflow-123',
                    status: WORKFLOW_STATES.APPROVED,
                    current_version: 1
                });
            });

            await expect(
                AssessmentWorkflowService.submitForReview('assessment-123', 'user', [])
            ).rejects.toThrow(/Cannot submit from state/);
        });

        it('should allow submission from REJECTED status', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('assessment_workflows')) {
                    callback(null, {
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.REJECTED,
                        current_version: 1
                    });
                } else if (sql.includes('maturity_assessments')) {
                    callback(null, {
                        axis_scores: JSON.stringify({
                            processes: { actual: 3, justification: 'Test justification for processes' },
                            digitalProducts: { actual: 4, justification: 'Test' },
                            businessModels: { actual: 3, justification: 'Test' },
                            dataManagement: { actual: 4, justification: 'Test' },
                            culture: { actual: 3, justification: 'Test' },
                            cybersecurity: { actual: 4, justification: 'Test' },
                            aiMaturity: { actual: 2, justification: 'Test' }
                        })
                    });
                } else {
                    callback(null, null);
                }
            });

            const reviewers = [{ userId: 'reviewer-1', role: 'CTO' }];

            const result = await AssessmentWorkflowService.submitForReview(
                'assessment-123',
                'user',
                reviewers
            );

            expect(result.status).toBe(WORKFLOW_STATES.IN_REVIEW);
        });

        it('should throw error if workflow not found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            await expect(
                AssessmentWorkflowService.submitForReview('non-existent', 'user', [])
            ).rejects.toThrow(/Workflow not found/);
        });
    });

    // =========================================================================
    // submitReview TESTS
    // =========================================================================

    describe('submitReview', () => {
        it('should submit a stakeholder review', async () => {
            // Mock finding the review
            mockDb.get
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, {
                        id: 'review-123',
                        reviewer_id: 'reviewer-1',
                        workflow_id: 'workflow-123',
                        status: REVIEW_STATUS.PENDING
                    });
                })
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, { total: 2, completed: 2 });
                });

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

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
            expect(result.status).toBe(REVIEW_STATUS.COMPLETED);
            expect(result.recommendation).toBe('APPROVE');
        });

        it('should throw error for non-existent review', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            await expect(
                AssessmentWorkflowService.submitReview('non-existent', 'user', {})
            ).rejects.toThrow(/Review not found/);
        });

        it('should throw error for wrong reviewer', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null); // reviewer_id mismatch
            });

            await expect(
                AssessmentWorkflowService.submitReview('review-123', 'wrong-user', {})
            ).rejects.toThrow(/Review not found/);
        });
    });

    // =========================================================================
    // addAxisComment TESTS
    // =========================================================================

    describe('addAxisComment', () => {
        it('should add a comment to an axis', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

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

        it('should support parent comment ID for threading', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const result = await AssessmentWorkflowService.addAxisComment(
                'assessment-123',
                'processes',
                'user-1',
                'This is a reply',
                'parent-comment-123'
            );

            expect(result.commentId).toBe('mock-uuid-workflow');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining(['parent-comment-123']),
                expect.any(Function)
            );
        });
    });

    // =========================================================================
    // getAxisComments TESTS
    // =========================================================================

    describe('getAxisComments', () => {
        it('should return all comments for an assessment', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'c1', comment: 'Comment 1', parent_comment_id: null, author_name: 'User 1' },
                    { id: 'c2', comment: 'Reply', parent_comment_id: 'c1', author_name: 'User 2' }
                ]);
            });

            const result = await AssessmentWorkflowService.getAxisComments('assessment-123');

            expect(result).toHaveLength(1); // Only root comments
            expect(result[0].replies).toHaveLength(1);
        });

        it('should filter by axisId when provided', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(params).toContain('processes');
                callback(null, []);
            });

            await AssessmentWorkflowService.getAxisComments('assessment-123', 'processes');

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('axis_id'),
                expect.arrayContaining(['processes']),
                expect.any(Function)
            );
        });
    });

    // =========================================================================
    // approveAssessment TESTS
    // =========================================================================

    describe('approveAssessment', () => {
        it('should approve assessment in AWAITING_APPROVAL status', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('assessment_workflows')) {
                    callback(null, {
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.AWAITING_APPROVAL,
                        current_version: 1
                    });
                } else {
                    callback(null, {
                        id: 'assessment-123',
                        axis_scores: '{}',
                        overall_score: 3.5,
                        gap_analysis: '{}'
                    });
                }
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AssessmentWorkflowService.approveAssessment(
                'assessment-123',
                'approver-user',
                'All axes are well justified'
            );

            expect(result.status).toBe(WORKFLOW_STATES.APPROVED);
            expect(result.approvedBy).toBe('approver-user');
        });

        it('should throw error for non-AWAITING_APPROVAL status', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'workflow-123',
                    status: WORKFLOW_STATES.DRAFT,
                    current_version: 1
                });
            });

            await expect(
                AssessmentWorkflowService.approveAssessment('assessment-123', 'approver', '')
            ).rejects.toThrow(/Cannot approve from state/);
        });

        it('should create version snapshot before approval', async () => {
            let versionCreated = false;

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('assessment_workflows')) {
                    callback(null, {
                        id: 'workflow-123',
                        status: WORKFLOW_STATES.AWAITING_APPROVAL,
                        current_version: 1
                    });
                } else {
                    callback(null, {
                        id: 'assessment-123',
                        axis_scores: '{}',
                        overall_score: 3.5,
                        gap_analysis: '{}'
                    });
                }
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                if (sql.includes('assessment_versions')) {
                    versionCreated = true;
                }
                callback.call({ changes: 1 }, null);
            });

            await AssessmentWorkflowService.approveAssessment('assessment-123', 'approver', '');

            expect(versionCreated).toBe(true);
        });
    });

    // =========================================================================
    // rejectAssessment TESTS
    // =========================================================================

    describe('rejectAssessment', () => {
        it('should reject assessment with reason', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'workflow-123',
                    status: WORKFLOW_STATES.IN_REVIEW,
                    current_version: 1
                });
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AssessmentWorkflowService.rejectAssessment(
                'assessment-123',
                'rejector-user',
                'Missing justifications for several axes',
                { processes: 'Justification too short', culture: 'Missing evidence' }
            );

            expect(result.status).toBe(WORKFLOW_STATES.REJECTED);
            expect(result.rejectionReason).toBe('Missing justifications for several axes');
            expect(result.axisIssues).toMatchObject({
                processes: 'Justification too short',
                culture: 'Missing evidence'
            });
        });

        it('should throw error if workflow not found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            await expect(
                AssessmentWorkflowService.rejectAssessment('non-existent', 'user', 'reason')
            ).rejects.toThrow(/Workflow not found/);
        });
    });

    // =========================================================================
    // getWorkflowHistory TESTS
    // =========================================================================

    describe('getWorkflowHistory', () => {
        it('should return workflow history with user names', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'w1',
                        status: WORKFLOW_STATES.APPROVED,
                        current_version: 2,
                        approved_by_name: 'John Doe'
                    },
                    {
                        id: 'w2',
                        status: WORKFLOW_STATES.DRAFT,
                        current_version: 1,
                        submitted_by_name: 'Jane Smith'
                    }
                ]);
            });

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
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'review-1',
                        assessment_name: 'Assessment 1',
                        project_name: 'Project A',
                        status: REVIEW_STATUS.PENDING
                    }
                ]);
            });

            const result = await AssessmentWorkflowService.getPendingReviews('user-1', 'org-1');

            expect(result).toHaveLength(1);
            expect(result[0].status).toBe(REVIEW_STATUS.PENDING);
        });

        it('should return empty array for user with no pending reviews', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            const result = await AssessmentWorkflowService.getPendingReviews('user-1', 'org-1');

            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // getVersionHistory TESTS
    // =========================================================================

    describe('getVersionHistory', () => {
        it('should return version history ordered by version DESC', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'v2', version: 2, created_by_name: 'User B' },
                    { id: 'v1', version: 1, created_by_name: 'User A' }
                ]);
            });

            const result = await AssessmentWorkflowService.getVersionHistory('assessment-123');

            expect(result).toHaveLength(2);
            expect(result[0].version).toBe(2);
        });
    });

    // =========================================================================
    // restoreVersion TESTS
    // =========================================================================

    describe('restoreVersion', () => {
        it('should restore assessment to specific version', async () => {
            mockDb.get
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, {
                        id: 'version-1',
                        version: 1,
                        assessment_data: JSON.stringify({
                            axis_scores: { processes: { actual: 3 } },
                            overall_score: 3
                        })
                    });
                })
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, {
                        id: 'workflow-123',
                        current_version: 2
                    });
                })
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, {
                        id: 'assessment-123',
                        axis_scores: '{}',
                        overall_score: 4,
                        gap_analysis: '{}'
                    });
                });

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AssessmentWorkflowService.restoreVersion(
                'assessment-123',
                1,
                'restorer-user'
            );

            expect(result.restoredFromVersion).toBe(1);
            expect(result.newVersion).toBe(3);
            expect(result.status).toBe(WORKFLOW_STATES.DRAFT);
        });

        it('should throw error for non-existent version', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            await expect(
                AssessmentWorkflowService.restoreVersion('assessment-123', 999, 'user')
            ).rejects.toThrow(/Version 999 not found/);
        });
    });

    // =========================================================================
    // _validateAssessmentCompleteness TESTS (Private)
    // =========================================================================

    describe('_validateAssessmentCompleteness', () => {
        it('should validate complete assessment', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    axis_scores: JSON.stringify({
                        processes: { actual: 3, justification: 'Test justification for processes' },
                        digitalProducts: { actual: 4, justification: 'Test justification for products' },
                        businessModels: { actual: 3, justification: 'Test justification for models' },
                        dataManagement: { actual: 4, justification: 'Test justification for data' },
                        culture: { actual: 3, justification: 'Test justification for culture' },
                        cybersecurity: { actual: 4, justification: 'Test justification for cyber' },
                        aiMaturity: { actual: 2, justification: 'Test justification for AI' }
                    })
                });
            });

            const result = await AssessmentWorkflowService._validateAssessmentCompleteness('assessment-123');

            expect(result.isComplete).toBe(true);
            expect(result.missingItems).toHaveLength(0);
        });

        it('should identify missing axes', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    axis_scores: JSON.stringify({
                        processes: { actual: 3, justification: 'Test' }
                        // Missing other axes
                    })
                });
            });

            const result = await AssessmentWorkflowService._validateAssessmentCompleteness('assessment-123');

            expect(result.isComplete).toBe(false);
            expect(result.missingItems.length).toBeGreaterThan(0);
        });

        it('should identify missing justifications when required', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    axis_scores: JSON.stringify({
                        processes: { actual: 3 }, // Missing justification
                        digitalProducts: { actual: 4, justification: '' }, // Empty justification
                        businessModels: { actual: 3, justification: 'Valid' },
                        dataManagement: { actual: 4, justification: 'Valid' },
                        culture: { actual: 3, justification: 'Valid' },
                        cybersecurity: { actual: 4, justification: 'Valid' },
                        aiMaturity: { actual: 2, justification: 'Valid' }
                    })
                });
            });

            const result = await AssessmentWorkflowService._validateAssessmentCompleteness('assessment-123');

            expect(result.isComplete).toBe(false);
            expect(result.missingItems).toContainEqual(expect.stringContaining('justification'));
        });

        it('should return not found when assessment does not exist', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await AssessmentWorkflowService._validateAssessmentCompleteness('non-existent');

            expect(result.isComplete).toBe(false);
            expect(result.missingItems).toContain('Assessment not found');
        });
    });

    // =========================================================================
    // _buildCommentTree TESTS (Private)
    // =========================================================================

    describe('_buildCommentTree', () => {
        it('should build a nested comment tree from flat list', () => {
            const comments = [
                { id: 'c1', comment: 'Root 1', parent_comment_id: null },
                { id: 'c2', comment: 'Reply to c1', parent_comment_id: 'c1' },
                { id: 'c3', comment: 'Root 2', parent_comment_id: null },
                { id: 'c4', comment: 'Reply to c2', parent_comment_id: 'c2' }
            ];

            const tree = AssessmentWorkflowService._buildCommentTree(comments);

            expect(tree).toHaveLength(2); // 2 root comments
            expect(tree[0].replies).toHaveLength(1); // c1 has 1 reply
            expect(tree[0].replies[0].replies).toHaveLength(1); // c2 has 1 reply
        });

        it('should handle empty input', () => {
            const tree = AssessmentWorkflowService._buildCommentTree([]);
            expect(tree).toHaveLength(0);
        });

        it('should handle orphaned comments (parent not found)', () => {
            const comments = [
                { id: 'c1', comment: 'Orphan', parent_comment_id: 'non-existent' }
            ];

            const tree = AssessmentWorkflowService._buildCommentTree(comments);
            expect(tree).toHaveLength(1); // Orphan treated as root
        });
    });

    // =========================================================================
    // _checkReviewCompletion TESTS (Private)
    // =========================================================================

    describe('_checkReviewCompletion', () => {
        it('should move to AWAITING_APPROVAL when all reviews complete', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 2, completed: 2 });
            });

            let statusUpdated = false;
            mockDb.run.mockImplementation((sql, params, callback) => {
                if (sql.includes('AWAITING_APPROVAL')) {
                    statusUpdated = true;
                }
                callback.call({ changes: 1 }, null);
            });

            await AssessmentWorkflowService._checkReviewCompletion('workflow-123');

            expect(statusUpdated).toBe(true);
        });

        it('should not change status when reviews are incomplete', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 3, completed: 1 });
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            await AssessmentWorkflowService._checkReviewCompletion('workflow-123');

            // run should not be called with AWAITING_APPROVAL
            expect(mockDb.run).not.toHaveBeenCalledWith(
                expect.stringContaining('AWAITING_APPROVAL'),
                expect.anything(),
                expect.anything()
            );
        });
    });
});



