const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const auditLogger = require('../utils/auditLogger');
const aiQueue = require('../queues/aiQueue');
const { ACTION_ERROR_CODES } = require('./actionErrors');

/**
 * Async Job Service
 * Step 11: Manages async job lifecycle for Action Executions and Playbook Steps.
 * 
 * DB is source of truth, BullMQ is execution mechanism.
 */

const JOB_TYPES = {
    EXECUTE_DECISION: 'EXECUTE_DECISION',
    ADVANCE_PLAYBOOK_STEP: 'ADVANCE_PLAYBOOK_STEP'
};

const JOB_STATUSES = {
    QUEUED: 'QUEUED',
    RUNNING: 'RUNNING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    DEAD_LETTER: 'DEAD_LETTER',
    CANCELLED: 'CANCELLED'
};

const JOB_PRIORITIES = {
    low: { priority: 10 },
    normal: { priority: 5 },
    high: { priority: 1 }
};

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

const AsyncJobService = {
    JOB_TYPES,
    JOB_STATUSES,

    /**
     * Enqueue an action decision execution job.
     * @param {Object} params
     * @param {string} params.decisionId - The decision ID to execute
     * @param {string} params.organizationId - Organization ID
     * @param {string} params.correlationId - Correlation ID for tracing
     * @param {string} [params.priority='normal'] - Job priority (low|normal|high)
     * @param {string} [params.createdBy] - User ID who created the job
     * @returns {Promise<Object>} Created job record
     */
    enqueueActionExecution: async ({ decisionId, organizationId, correlationId, priority = 'normal', createdBy }) => {
        const jobId = `job-${uuidv4()}`;
        const now = new Date().toISOString();

        // Insert job record in DB (source of truth)
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO async_jobs 
                 (id, type, organization_id, correlation_id, entity_id, status, priority, max_attempts, created_by, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [jobId, JOB_TYPES.EXECUTE_DECISION, organizationId, correlationId, decisionId, JOB_STATUSES.QUEUED, priority, DEFAULT_MAX_ATTEMPTS, createdBy, now],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Enqueue to BullMQ (execution mechanism)
        const bullPriority = JOB_PRIORITIES[priority] || JOB_PRIORITIES.normal;
        await aiQueue.add(JOB_TYPES.EXECUTE_DECISION, {
            jobId,
            taskType: JOB_TYPES.EXECUTE_DECISION,
            payload: { decisionId, organizationId, correlationId }
        }, {
            jobId,
            ...bullPriority,
            attempts: DEFAULT_MAX_ATTEMPTS,
            backoff: { type: 'exponential', delay: BASE_BACKOFF_MS }
        });

        auditLogger.info('ASYNC_JOB_ENQUEUED', {
            job_id: jobId,
            correlation_id: correlationId,
            organization_id: organizationId,
            job_type: JOB_TYPES.EXECUTE_DECISION,
            entity_id: decisionId,
            priority
        });

        return {
            job_id: jobId,
            status: JOB_STATUSES.QUEUED,
            correlation_id: correlationId,
            type: JOB_TYPES.EXECUTE_DECISION
        };
    },

    /**
     * Enqueue a playbook step advance job.
     * @param {Object} params
     * @param {string} params.runId - Playbook run ID
     * @param {string} [params.stepId] - Specific step ID (optional, advances next if not provided)
     * @param {string} params.organizationId - Organization ID
     * @param {string} params.correlationId - Correlation ID for tracing
     * @param {string} [params.priority='normal'] - Job priority
     * @param {string} [params.createdBy] - User ID who created the job
     * @returns {Promise<Object>} Created job record
     */
    enqueuePlaybookAdvance: async ({ runId, stepId, organizationId, correlationId, priority = 'normal', createdBy }) => {
        const jobId = `job-${uuidv4()}`;
        const now = new Date().toISOString();
        const entityId = stepId || runId; // Use stepId if specific, otherwise runId

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO async_jobs 
                 (id, type, organization_id, correlation_id, entity_id, status, priority, max_attempts, created_by, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [jobId, JOB_TYPES.ADVANCE_PLAYBOOK_STEP, organizationId, correlationId, entityId, JOB_STATUSES.QUEUED, priority, DEFAULT_MAX_ATTEMPTS, createdBy, now],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        const bullPriority = JOB_PRIORITIES[priority] || JOB_PRIORITIES.normal;
        await aiQueue.add(JOB_TYPES.ADVANCE_PLAYBOOK_STEP, {
            jobId,
            taskType: JOB_TYPES.ADVANCE_PLAYBOOK_STEP,
            payload: { runId, stepId, organizationId, correlationId }
        }, {
            jobId,
            ...bullPriority,
            attempts: DEFAULT_MAX_ATTEMPTS,
            backoff: { type: 'exponential', delay: BASE_BACKOFF_MS }
        });

        auditLogger.info('ASYNC_JOB_ENQUEUED', {
            job_id: jobId,
            correlation_id: correlationId,
            organization_id: organizationId,
            job_type: JOB_TYPES.ADVANCE_PLAYBOOK_STEP,
            entity_id: entityId,
            priority
        });

        return {
            job_id: jobId,
            status: JOB_STATUSES.QUEUED,
            correlation_id: correlationId,
            type: JOB_TYPES.ADVANCE_PLAYBOOK_STEP
        };
    },

    /**
     * Get job by ID with RBAC org isolation.
     * @param {string} jobId - Job ID
     * @param {string} organizationId - Organization ID (for isolation, use 'SUPERADMIN_BYPASS' to skip)
     * @returns {Promise<Object|null>} Job record or null
     */
    getJob: async (jobId, organizationId) => {
        return new Promise((resolve, reject) => {
            const query = organizationId === 'SUPERADMIN_BYPASS'
                ? `SELECT * FROM async_jobs WHERE id = ?`
                : `SELECT * FROM async_jobs WHERE id = ? AND organization_id = ?`;

            const params = organizationId === 'SUPERADMIN_BYPASS'
                ? [jobId]
                : [jobId, organizationId];

            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    },

    /**
     * List jobs for an organization.
     * @param {string} organizationId - Organization ID
     * @param {Object} [options] - Filter options
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.type] - Filter by job type
     * @param {number} [options.limit=50] - Max results
     * @param {number} [options.offset=0] - Pagination offset
     * @returns {Promise<Array>} List of jobs
     */
    listJobs: async (organizationId, options = {}) => {
        const { status, type, limit = 50, offset = 0 } = options;

        let query = `SELECT * FROM async_jobs WHERE organization_id = ?`;
        const params = [organizationId];

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }
        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Update job status (internal use by worker).
     * @param {string} jobId - Job ID
     * @param {string} status - New status
     * @param {Object} [metadata] - Additional fields to update
     * @returns {Promise<void>}
     */
    updateJobStatus: async (jobId, status, metadata = {}) => {
        const updates = ['status = ?'];
        const params = [status];

        if (status === JOB_STATUSES.RUNNING) {
            updates.push('started_at = ?');
            params.push(new Date().toISOString());
        }

        if (status === JOB_STATUSES.SUCCESS || status === JOB_STATUSES.FAILED || status === JOB_STATUSES.DEAD_LETTER) {
            updates.push('finished_at = ?');
            params.push(new Date().toISOString());
        }

        if (metadata.attempts !== undefined) {
            updates.push('attempts = ?');
            params.push(metadata.attempts);
        }

        if (metadata.lastErrorCode) {
            updates.push('last_error_code = ?');
            params.push(metadata.lastErrorCode);
        }

        if (metadata.lastErrorMessage) {
            updates.push('last_error_message = ?');
            params.push(metadata.lastErrorMessage);
        }

        params.push(jobId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE async_jobs SET ${updates.join(', ')} WHERE id = ?`,
                params,
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },

    /**
     * Retry a failed or dead-letter job.
     * @param {string} jobId - Job ID
     * @param {string} organizationId - Organization ID for RBAC
     * @returns {Promise<Object>} Updated job record
     */
    retryJob: async (jobId, organizationId) => {
        const job = await AsyncJobService.getJob(jobId, organizationId);

        if (!job) {
            const error = new Error('Job not found');
            error.code = 'JOB_NOT_FOUND';
            throw error;
        }

        // Only allow retry on FAILED or DEAD_LETTER
        if (job.status !== JOB_STATUSES.FAILED && job.status !== JOB_STATUSES.DEAD_LETTER) {
            const error = new Error(`Cannot retry job in ${job.status} state. Only FAILED or DEAD_LETTER jobs can be retried.`);
            error.code = 'JOB_INVALID_STATE';
            throw error;
        }

        // Reset job status to QUEUED
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE async_jobs SET status = ?, attempts = 0, last_error_code = NULL, last_error_message = NULL, started_at = NULL, finished_at = NULL WHERE id = ?`,
                [JOB_STATUSES.QUEUED, jobId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Re-enqueue to BullMQ
        const bullPriority = JOB_PRIORITIES[job.priority] || JOB_PRIORITIES.normal;
        const payload = job.type === JOB_TYPES.EXECUTE_DECISION
            ? { decisionId: job.entity_id, organizationId: job.organization_id, correlationId: job.correlation_id }
            : { runId: job.entity_id, organizationId: job.organization_id, correlationId: job.correlation_id };

        await aiQueue.add(job.type, {
            jobId,
            taskType: job.type,
            payload
        }, {
            jobId,
            ...bullPriority,
            attempts: DEFAULT_MAX_ATTEMPTS,
            backoff: { type: 'exponential', delay: BASE_BACKOFF_MS }
        });

        auditLogger.info('ASYNC_JOB_RETRIED', {
            job_id: jobId,
            correlation_id: job.correlation_id,
            organization_id: job.organization_id,
            job_type: job.type
        });

        return {
            job_id: jobId,
            status: JOB_STATUSES.QUEUED,
            message: 'Job queued for retry'
        };
    },

    /**
     * Cancel a queued job.
     * @param {string} jobId - Job ID
     * @param {string} organizationId - Organization ID for RBAC
     * @returns {Promise<Object>} Cancelled job record
     */
    cancelJob: async (jobId, organizationId) => {
        const job = await AsyncJobService.getJob(jobId, organizationId);

        if (!job) {
            const error = new Error('Job not found');
            error.code = 'JOB_NOT_FOUND';
            throw error;
        }

        // Only allow cancel on QUEUED
        if (job.status !== JOB_STATUSES.QUEUED) {
            const error = new Error(`Cannot cancel job in ${job.status} state. Only QUEUED jobs can be cancelled.`);
            error.code = 'JOB_INVALID_STATE';
            throw error;
        }

        // Update status to CANCELLED
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE async_jobs SET status = ?, finished_at = ? WHERE id = ?`,
                [JOB_STATUSES.CANCELLED, new Date().toISOString(), jobId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Try to remove from BullMQ (may fail if already picked up)
        try {
            const bullJob = await aiQueue.getJob(jobId);
            if (bullJob) {
                await bullJob.remove();
            }
        } catch (e) {
            // Job may have already been processed, ignore
        }

        auditLogger.info('ASYNC_JOB_CANCELLED', {
            job_id: jobId,
            correlation_id: job.correlation_id,
            organization_id: job.organization_id,
            job_type: job.type
        });

        return {
            job_id: jobId,
            status: JOB_STATUSES.CANCELLED,
            message: 'Job cancelled'
        };
    },

    /**
     * Mark a job as dead-letter (max retries exhausted).
     * @param {string} jobId - Job ID
     * @param {string} errorCode - Error code
     * @param {string} errorMessage - Error message
     * @returns {Promise<void>}
     */
    markDeadLetter: async (jobId, errorCode, errorMessage) => {
        await AsyncJobService.updateJobStatus(jobId, JOB_STATUSES.DEAD_LETTER, {
            lastErrorCode: errorCode,
            lastErrorMessage: errorMessage
        });

        // Get job for logging
        const job = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM async_jobs WHERE id = ?`, [jobId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (job) {
            auditLogger.error('ASYNC_JOB_DEAD_LETTER', {
                job_id: jobId,
                correlation_id: job.correlation_id,
                organization_id: job.organization_id,
                job_type: job.type,
                error_code: errorCode,
                error_message: errorMessage,
                attempts: job.attempts
            });
        }
    },

    /**
     * Increment attempt count for a job.
     * @param {string} jobId - Job ID
     * @returns {Promise<number>} New attempt count
     */
    incrementAttempts: async (jobId) => {
        await new Promise((resolve, reject) => {
            db.run(`UPDATE async_jobs SET attempts = attempts + 1 WHERE id = ?`, [jobId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const job = await new Promise((resolve, reject) => {
            db.get(`SELECT attempts FROM async_jobs WHERE id = ?`, [jobId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        return job ? job.attempts : 0;
    }
};

module.exports = AsyncJobService;
