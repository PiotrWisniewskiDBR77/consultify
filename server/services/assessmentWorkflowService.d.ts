export namespace AssessmentWorkflowService {
    export { setDependencies };
    export { initializeWorkflow };
    export { getWorkflowStatus };
    export { submitForReview };
    export { submitReview };
    export { addAxisComment };
    export { getAxisComments };
    export { approveAssessment };
    export { rejectAssessment };
    export { getWorkflowHistory };
    export { getPendingReviews };
    export { getVersionHistory };
    export { restoreVersion };
    export { validateAssessmentCompleteness as _validateAssessmentCompleteness };
    export { checkReviewCompletion as _checkReviewCompletion };
    export { createVersionSnapshot as _createVersionSnapshot };
}
export default AssessmentWorkflowService;
/**
 * Manually set dependencies (primarily for testing)
 */
declare function setDependencies(newDeps: any): void;
/**
 * Initialize assessment workflow
 */
declare function initializeWorkflow(assessmentId: any, projectId: any, organizationId: any, createdBy: any): Promise<{
    workflowId: any;
    assessmentId: any;
    status: string;
    version: number;
}>;
/**
 * Get workflow status for an assessment
 */
declare function getWorkflowStatus(assessmentId: any): Promise<any>;
/**
 * Submit assessment for stakeholder review
 */
declare function submitForReview(assessmentId: any, submittedBy: any, reviewers?: any[]): Promise<{
    workflowId: any;
    status: string;
    reviewIds: any[];
    reviewersCount: number;
    notificationsSent: number;
}>;
/**
 * Submit stakeholder review
 */
declare function submitReview(reviewId: any, reviewerId: any, reviewData: any): Promise<{
    reviewId: any;
    status: string;
    recommendation: any;
}>;
/**
 * Add comment to specific axis during review
 */
declare function addAxisComment(assessmentId: any, axisId: any, userId: any, comment: any, parentCommentId?: null): Promise<{
    commentId: any;
    axisId: any;
    comment: any;
}>;
/**
 * Get all comments for an assessment axis
 */
declare function getAxisComments(assessmentId: any, axisId?: null): Promise<any[]>;
/**
 * Approve assessment (final approval gate)
 */
declare function approveAssessment(assessmentId: any, approverId: any, approvalNotes?: string): Promise<{
    assessmentId: any;
    status: string;
    approvedBy: any;
    version: any;
}>;
/**
 * Reject assessment (send back for revision)
 */
declare function rejectAssessment(assessmentId: any, rejectorId: any, rejectionReason: any, axisIssues?: {}): Promise<{
    assessmentId: any;
    status: string;
    rejectionReason: any;
    axisIssues: {};
}>;
/**
 * Get workflow history for an assessment
 */
declare function getWorkflowHistory(assessmentId: any): Promise<any>;
/**
 * Get pending reviews for a user
 */
declare function getPendingReviews(userId: any, organizationId: any): Promise<any>;
/**
 * Get assessment version history
 */
declare function getVersionHistory(assessmentId: any): Promise<any>;
/**
 * Restore assessment to specific version
 */
declare function restoreVersion(assessmentId: any, version: any, restoredBy: any): Promise<{
    assessmentId: any;
    restoredFromVersion: any;
    newVersion: any;
    status: string;
}>;
/**
 * Validate assessment completeness before submission
 */
declare function validateAssessmentCompleteness(assessmentId: any): Promise<{
    isComplete: boolean;
    missingItems: string[];
    completionPercentage?: undefined;
} | {
    isComplete: boolean;
    missingItems: string[];
    completionPercentage: number;
}>;
/**
 * Check if all reviews are complete and update workflow status
 */
declare function checkReviewCompletion(workflowId: any): Promise<void>;
/**
 * Create a version snapshot of the assessment
 */
declare function createVersionSnapshot(assessmentId: any, version: any): Promise<any>;
export namespace WORKFLOW_STATES {
    let DRAFT: string;
    let IN_REVIEW: string;
    let AWAITING_APPROVAL: string;
    let APPROVED: string;
    let REJECTED: string;
    let ARCHIVED: string;
}
export namespace REVIEW_STATUS {
    let PENDING: string;
    let IN_PROGRESS: string;
    let DONE: string;
    let SKIPPED: string;
}
export namespace WORKFLOW_CONFIG {
    let minReviewers: number;
    let autoArchive: boolean;
    let aiSenseCheck: boolean;
    let requireJustification: boolean;
    let maxReviewDays: number;
    let reviewSlaHours: number;
}
//# sourceMappingURL=assessmentWorkflowService.d.ts.map