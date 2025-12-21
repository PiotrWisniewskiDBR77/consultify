const AsyncJobService = require('../ai/asyncJobService');
const ActionExecutionAdapter = require('../ai/actionExecutionAdapter');
const AIPlaybookExecutor = require('../ai/aiPlaybookExecutor');
const auditLogger = require('../utils/auditLogger');
const { classifyError } = require('../ai/actionErrors');

/**
 * Async Job Processor
 * Step 11: Processes async jobs from the queue.
 * Step 11.1: Enterprise hardening with optimistic locking and retry classification.
 * 
 * Handles EXECUTE_DECISION and ADVANCE_PLAYBOOK_STEP job types.
 */

const AsyncJobProcessor = {
    /**
     * Process an action decision execution job.
     * @param {Object} job - BullMQ job object
     * @returns {Promise<Object>} Execution result
     */
    processDecisionExecution: async (job) => {
        const { jobId, payload } = job.data;
        const { decisionId, organizationId, correlationId } = payload;

        try {
            // Step 11.1 - Optimistic locking: Claim the job atomically
            const claimed = await AsyncJobService.claimJob(jobId);
            if (!claimed) {
                // Job was already picked up by another worker
                auditLogger.info('ASYNC_JOB_ALREADY_CLAIMED', {
                    job_id: jobId,
                    correlation_id: correlationId,
                    organization_id: organizationId
                });
                return { skipped: true, reason: 'Job already claimed by another worker' };
            }

            await AsyncJobService.incrementAttempts(jobId);

            auditLogger.info('ASYNC_JOB_STARTED', {
                job_id: jobId,
                correlation_id: correlationId,
                organization_id: organizationId,
                job_type: AsyncJobService.JOB_TYPES.EXECUTE_DECISION,
                entity_id: decisionId
            });

            // Execute the decision using existing adapter
            const execResult = await ActionExecutionAdapter.executeDecision(decisionId, 'SYSTEM', { dry_run: false });

            // Link job_id to action_execution if created
            if (execResult.execution_id) {
                const db = require('../database');
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE action_executions SET job_id = ? WHERE id = ?`,
                        [jobId, execResult.execution_id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            if (execResult.success) {
                await AsyncJobService.updateJobStatus(jobId, AsyncJobService.JOB_STATUSES.SUCCESS);

                auditLogger.info('ASYNC_JOB_SUCCEEDED', {
                    job_id: jobId,
                    correlation_id: correlationId,
                    organization_id: organizationId,
                    job_type: AsyncJobService.JOB_TYPES.EXECUTE_DECISION,
                    entity_id: decisionId,
                    execution_id: execResult.execution_id,
                    duration_ms: execResult.duration_ms
                });

                return execResult;
            } else {
                // Execution failed but didn't throw - treat as failure
                const errorCode = execResult.error_code || 'EXECUTION_ERROR';
                const errorMessage = execResult.error || 'Execution failed';

                // Step 11.1 - Non-retryable errors go straight to dead-letter
                if (!AsyncJobService.isRetryable(errorCode)) {
                    await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
                    return execResult;
                }

                // Check if max attempts reached
                const dbJob = await AsyncJobService.getJob(jobId, 'SUPERADMIN_BYPASS');
                if (dbJob && dbJob.attempts >= dbJob.max_attempts) {
                    await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
                } else {
                    await AsyncJobService.updateJobStatus(jobId, AsyncJobService.JOB_STATUSES.FAILED, {
                        lastErrorCode: errorCode,
                        lastErrorMessage: errorMessage
                    });

                    auditLogger.warn('ASYNC_JOB_FAILED', {
                        job_id: jobId,
                        correlation_id: correlationId,
                        organization_id: organizationId,
                        job_type: AsyncJobService.JOB_TYPES.EXECUTE_DECISION,
                        entity_id: decisionId,
                        error_code: errorCode,
                        error_message: errorMessage,
                        retryable: true
                    });

                    // Throw to trigger BullMQ retry
                    throw new Error(errorMessage);
                }

                return execResult;
            }
        } catch (err) {
            const errorCode = classifyError(err);
            const errorMessage = err.message;

            // Step 11.1 - Non-retryable errors go straight to dead-letter
            if (!AsyncJobService.isRetryable(errorCode)) {
                await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
                return { success: false, error: errorMessage, error_code: errorCode };
            }

            // Check if max attempts reached
            const dbJob = await AsyncJobService.getJob(jobId, 'SUPERADMIN_BYPASS');
            if (dbJob && dbJob.attempts >= dbJob.max_attempts) {
                await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
            } else {
                await AsyncJobService.updateJobStatus(jobId, AsyncJobService.JOB_STATUSES.FAILED, {
                    lastErrorCode: errorCode,
                    lastErrorMessage: errorMessage
                });

                auditLogger.warn('ASYNC_JOB_FAILED', {
                    job_id: jobId,
                    correlation_id: correlationId,
                    organization_id: organizationId,
                    job_type: AsyncJobService.JOB_TYPES.EXECUTE_DECISION,
                    entity_id: decisionId,
                    error_code: errorCode,
                    error_message: errorMessage,
                    retryable: true
                });
            }

            throw err; // Re-throw for BullMQ to handle retry
        }
    },

    /**
     * Process a playbook step advance job.
     * @param {Object} job - BullMQ job object
     * @returns {Promise<Object>} Advance result
     */
    processPlaybookAdvance: async (job) => {
        const { jobId, payload } = job.data;
        const { runId, stepId, organizationId, correlationId } = payload;

        try {
            // Step 11.1 - Optimistic locking
            const claimed = await AsyncJobService.claimJob(jobId);
            if (!claimed) {
                auditLogger.info('ASYNC_JOB_ALREADY_CLAIMED', {
                    job_id: jobId,
                    correlation_id: correlationId,
                    organization_id: organizationId
                });
                return { skipped: true, reason: 'Job already claimed by another worker' };
            }

            await AsyncJobService.incrementAttempts(jobId);

            auditLogger.info('ASYNC_JOB_STARTED', {
                job_id: jobId,
                correlation_id: correlationId,
                organization_id: organizationId,
                job_type: AsyncJobService.JOB_TYPES.ADVANCE_PLAYBOOK_STEP,
                entity_id: runId
            });

            // Advance the playbook run
            const advanceResult = await AIPlaybookExecutor.advanceRun(runId, 'SYSTEM');

            // Update ai_playbook_run_steps with job_id if step was executed
            if (advanceResult.step && advanceResult.step.id) {
                const db = require('../database');
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE ai_playbook_run_steps SET job_id = ?, async_status = ? WHERE id = ?`,
                        [jobId, advanceResult.step.status, advanceResult.step.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            if (advanceResult.success) {
                await AsyncJobService.updateJobStatus(jobId, AsyncJobService.JOB_STATUSES.SUCCESS);

                auditLogger.info('ASYNC_JOB_SUCCEEDED', {
                    job_id: jobId,
                    correlation_id: correlationId,
                    organization_id: organizationId,
                    job_type: AsyncJobService.JOB_TYPES.ADVANCE_PLAYBOOK_STEP,
                    entity_id: runId,
                    step_id: advanceResult.step?.id,
                    run_status: advanceResult.runStatus
                });

                return advanceResult;
            } else {
                const errorCode = 'PLAYBOOK_ADVANCE_FAILED';
                const errorMessage = advanceResult.error || 'Playbook advance failed';

                // Step 11.1 - Non-retryable check
                if (!AsyncJobService.isRetryable(errorCode)) {
                    await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
                    return advanceResult;
                }

                const dbJob = await AsyncJobService.getJob(jobId, 'SUPERADMIN_BYPASS');
                if (dbJob && dbJob.attempts >= dbJob.max_attempts) {
                    await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
                } else {
                    await AsyncJobService.updateJobStatus(jobId, AsyncJobService.JOB_STATUSES.FAILED, {
                        lastErrorCode: errorCode,
                        lastErrorMessage: errorMessage
                    });

                    auditLogger.warn('ASYNC_JOB_FAILED', {
                        job_id: jobId,
                        correlation_id: correlationId,
                        organization_id: organizationId,
                        job_type: AsyncJobService.JOB_TYPES.ADVANCE_PLAYBOOK_STEP,
                        entity_id: runId,
                        error_code: errorCode,
                        error_message: errorMessage,
                        retryable: true
                    });

                    throw new Error(errorMessage);
                }

                return advanceResult;
            }
        } catch (err) {
            const errorCode = classifyError(err);
            const errorMessage = err.message;

            // Step 11.1 - Non-retryable check
            if (!AsyncJobService.isRetryable(errorCode)) {
                await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
                return { success: false, error: errorMessage, error_code: errorCode };
            }

            const dbJob = await AsyncJobService.getJob(jobId, 'SUPERADMIN_BYPASS');
            if (dbJob && dbJob.attempts >= dbJob.max_attempts) {
                await AsyncJobService.markDeadLetter(jobId, errorCode, errorMessage);
            } else {
                await AsyncJobService.updateJobStatus(jobId, AsyncJobService.JOB_STATUSES.FAILED, {
                    lastErrorCode: errorCode,
                    lastErrorMessage: errorMessage
                });

                auditLogger.warn('ASYNC_JOB_FAILED', {
                    job_id: jobId,
                    correlation_id: correlationId,
                    organization_id: organizationId,
                    job_type: AsyncJobService.JOB_TYPES.ADVANCE_PLAYBOOK_STEP,
                    entity_id: runId,
                    error_code: errorCode,
                    error_message: errorMessage,
                    retryable: true
                });
            }

            throw err;
        }
    }
};

module.exports = AsyncJobProcessor;
