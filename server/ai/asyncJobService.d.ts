export default AsyncJobService;
declare namespace AsyncJobService {
    export { JOB_TYPES };
    export { JOB_STATUSES };
    export { NON_RETRYABLE_ERRORS };
    export { isRetryable };
    export function findActiveJob(type: string, entityId: string): Promise<Object | null>;
    export function claimJob(jobId: string): Promise<boolean>;
    export function enqueueActionExecution({ decisionId, organizationId, correlationId, priority, createdBy }: {
        decisionId: string;
        organizationId: string;
        correlationId: string;
        priority?: string | undefined;
        createdBy?: string | undefined;
    }): Promise<Object>;
    export function enqueuePlaybookAdvance({ runId, stepId, organizationId, correlationId, priority, createdBy }: {
        runId: any;
        stepId: any;
        organizationId: any;
        correlationId: any;
        priority?: string | undefined;
        createdBy: any;
    }): Promise<{
        job_id: any;
        status: any;
        correlation_id: any;
        type: string;
        deduplicated: boolean;
    }>;
    export function getJob(jobId: any, organizationId: any): Promise<any>;
    export function listJobs(organizationId: any, options?: {}): Promise<any>;
    export function getDeadLetterStats(organizationId: any): Promise<any>;
    export function updateJobStatus(jobId: any, status: any, metadata?: {}): Promise<any>;
    export function retryJob(jobId: any, organizationId: any): Promise<{
        job_id: any;
        status: string;
        message: string;
    }>;
    export function cancelJob(jobId: any, organizationId: any): Promise<{
        job_id: any;
        status: string;
        message: string;
    }>;
    export function markDeadLetter(jobId: any, errorCode: any, errorMessage: any): Promise<void>;
    export function incrementAttempts(jobId: any): Promise<any>;
}
declare namespace JOB_TYPES {
    let EXECUTE_DECISION: string;
    let ADVANCE_PLAYBOOK_STEP: string;
}
declare namespace JOB_STATUSES {
    let QUEUED: string;
    let RUNNING: string;
    let SUCCESS: string;
    let FAILED: string;
    let DEAD_LETTER: string;
    let CANCELLED: string;
}
/**
 * Step 11.1 - Retry Classification
 * Non-retryable errors should go directly to DEAD_LETTER.
 */
declare const NON_RETRYABLE_ERRORS: any[];
/**
 * Check if an error code is retryable.
 * @param {string} errorCode - The error code
 * @returns {boolean} True if retryable
 */
declare function isRetryable(errorCode: string): boolean;
//# sourceMappingURL=asyncJobService.d.ts.map