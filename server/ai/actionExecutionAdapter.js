const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const ActionDecisionService = require('./actionDecisionService');
const auditLogger = require('../utils/auditLogger');
const { ACTION_ERROR_CODES, classifyError } = require('./actionErrors');

const TaskExecutor = require('./actionExecutors/taskExecutor');
const PlaybookExecutor = require('./actionExecutors/playbookExecutor');
const MeetingExecutor = require('./actionExecutors/meetingExecutor');

/**
 * ActionExecutionAdapter
 * Executes approved decisions using classical services.
 * Step 9.3: Post-Approval Execution Layer.
 * Step 9.5: Observability with correlation_id, duration_ms, structured logging.
 * Step 9.6: Dry-run support.
 */
const ActionExecutionAdapter = {
    /**
     * Executes a decision.
     * @param {string} decisionId - The ID of the action_decision.
     * @param {string} executedBy - The ID of the user triggering execution (usually SYSTEM or Admin).
     * @param {Object} [options] - Execution options.
     * @param {boolean} [options.dry_run] - If true, simulate without side effects.
     * @returns {Promise<Object>} Execution results.
     */
    executeDecision: async (decisionId, executedBy = 'SYSTEM', options = {}) => {
        const { dry_run = false } = options;
        const startTime = Date.now();

        // 1. Fetch decision
        const decisions = await ActionDecisionService.getAuditLog('SUPERADMIN_BYPASS');
        const decision = decisions.find(d => d.id === decisionId);

        if (!decision) {
            auditLogger.warn('EXECUTION_DECISION_NOT_FOUND', {
                decision_id: decisionId,
                error_code: ACTION_ERROR_CODES.NOT_FOUND
            });
            return {
                success: false,
                error: `Decision not found: ${decisionId}`,
                error_code: ACTION_ERROR_CODES.NOT_FOUND
            };
        }

        const correlationId = decision.correlation_id || `corr-${uuidv4()}`;
        const orgId = decision.organization_id;

        // 2. Validate state
        const validStates = ['APPROVED', 'MODIFIED'];
        if (!validStates.includes(decision.decision)) {
            auditLogger.warn('EXECUTION_INVALID_STATE', {
                correlation_id: correlationId,
                decision_id: decisionId,
                organization_id: orgId,
                status: decision.decision,
                error_code: ACTION_ERROR_CODES.VALIDATION_ERROR
            });
            return {
                success: false,
                error: `Decision ${decisionId} is ${decision.decision}, but only APPROVED/MODIFIED are executable`,
                error_code: ACTION_ERROR_CODES.VALIDATION_ERROR,
                correlation_id: correlationId
            };
        }

        // 3. Idempotency check: Check if already executed successfully
        const existingExecution = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM action_executions WHERE decision_id = ? AND status = 'SUCCESS'`, [decisionId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingExecution && !dry_run) {
            const result = JSON.parse(existingExecution.result || '{}');
            auditLogger.info('EXECUTION_IDEMPOTENT_REPLAY', {
                correlation_id: correlationId,
                decision_id: decisionId,
                execution_id: existingExecution.id,
                organization_id: orgId,
                action_type: existingExecution.action_type
            });
            return {
                execution_id: existingExecution.id,
                decision_id: decisionId,
                proposal_id: existingExecution.proposal_id,
                action_type: existingExecution.action_type,
                correlation_id: correlationId,
                status: 'SUCCESS',
                result,
                idempotent_replay: true,
                created_at: existingExecution.created_at,
                success: true
            };
        }

        // 4. Resolve payload from proposal_snapshot
        const snapshot = decision.proposal_snapshot;
        if (!snapshot) {
            auditLogger.error('EXECUTION_NO_SNAPSHOT', {
                correlation_id: correlationId,
                decision_id: decisionId,
                organization_id: orgId,
                error_code: ACTION_ERROR_CODES.VALIDATION_ERROR
            });
            return {
                success: false,
                error: `Execution failed: No proposal_snapshot found for decision ${decisionId}`,
                error_code: ACTION_ERROR_CODES.VALIDATION_ERROR,
                correlation_id: correlationId
            };
        }

        // Base payload from snapshot
        let payload = { ...snapshot };

        // If MODIFIED, merge modified_payload (allowlist approach)
        if (decision.decision === 'MODIFIED' && decision.modified_payload) {
            const allowList = ['title', 'description', 'due_date', 'priority', 'assignee_id', 'summary', 'participants'];
            for (const key of allowList) {
                if (decision.modified_payload[key] !== undefined) {
                    payload[key] = decision.modified_payload[key];
                }
            }
        }

        // 5. Select Executor
        const actionType = snapshot.action_type || 'TASK_CREATE';

        let executor;
        switch (actionType) {
            case 'TASK_CREATE':
                executor = TaskExecutor;
                break;
            case 'PLAYBOOK_ASSIGN':
                executor = PlaybookExecutor;
                break;
            case 'MEETING_SCHEDULE':
                executor = MeetingExecutor;
                break;
            default:
                auditLogger.error('EXECUTION_UNKNOWN_ACTION_TYPE', {
                    correlation_id: correlationId,
                    decision_id: decisionId,
                    organization_id: orgId,
                    action_type: actionType,
                    error_code: ACTION_ERROR_CODES.VALIDATION_ERROR
                });
                return {
                    success: false,
                    error: `Unknown or unsupported action type: ${actionType}`,
                    error_code: ACTION_ERROR_CODES.VALIDATION_ERROR,
                    correlation_id: correlationId
                };
        }

        const metadata = {
            userId: decision.decided_by_user_id,
            organizationId: orgId
        };

        // DRY-RUN MODE: Return plan without execution
        if (dry_run) {
            const dryRunResult = await ActionExecutionAdapter._dryRunExecutor(executor, actionType, payload, metadata);
            auditLogger.info('EXECUTION_DRY_RUN', {
                correlation_id: correlationId,
                decision_id: decisionId,
                organization_id: orgId,
                action_type: actionType,
                duration_ms: Date.now() - startTime
            });
            return {
                dry_run: true,
                decision_id: decisionId,
                proposal_id: snapshot.proposal_id || 'unknown',
                action_type: actionType,
                correlation_id: correlationId,
                ...dryRunResult
            };
        }

        // 6. Execute
        auditLogger.info('EXECUTION_STARTED', {
            correlation_id: correlationId,
            decision_id: decisionId,
            organization_id: orgId,
            action_type: actionType
        });

        let status = 'SUCCESS';
        let execResult = null;
        let errorCode = null;
        let errorMessage = null;

        try {
            execResult = await executor.execute(payload, metadata);
        } catch (err) {
            status = 'FAILED';
            errorCode = classifyError(err);
            errorMessage = err.message;
            execResult = { error: err.message };
        }

        const durationMs = Date.now() - startTime;

        // 7. Log execution result
        const executionId = `ax-${uuidv4()}`;
        const now = new Date().toISOString();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO action_executions (
                    id, decision_id, proposal_id, action_type, organization_id, correlation_id,
                    executed_by, status, result, error_code, error_message, duration_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    executionId, decisionId, snapshot.proposal_id || 'unknown', actionType, orgId, correlationId,
                    executedBy, status, JSON.stringify(execResult), errorCode, errorMessage, durationMs, now
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Structured log
        if (status === 'SUCCESS') {
            auditLogger.info('EXECUTION_COMPLETED', {
                correlation_id: correlationId,
                decision_id: decisionId,
                execution_id: executionId,
                organization_id: orgId,
                action_type: actionType,
                status,
                duration_ms: durationMs
            });
        } else {
            auditLogger.error('EXECUTION_FAILED', {
                correlation_id: correlationId,
                decision_id: decisionId,
                execution_id: executionId,
                organization_id: orgId,
                action_type: actionType,
                status,
                duration_ms: durationMs,
                error_code: errorCode,
                error_message: errorMessage
            });
        }

        return {
            execution_id: executionId,
            decision_id: decisionId,
            proposal_id: snapshot.proposal_id || 'unknown',
            action_type: actionType,
            correlation_id: correlationId,
            status,
            result: execResult,
            idempotent_replay: false,
            duration_ms: durationMs,
            created_at: now,
            success: status === 'SUCCESS',
            error: errorMessage,
            error_code: errorCode
        };
    },

    /**
     * Internal: Generate dry-run plan from executor.
     * @private
     */
    _dryRunExecutor: async (executor, actionType, payload, metadata) => {
        // If executor has dryRun method, use it
        if (typeof executor.dryRun === 'function') {
            return executor.dryRun(payload, metadata);
        }

        // Default dry-run response
        const wouldDo = [];
        const externalCalls = [];
        const requiredInputsMissing = [];

        switch (actionType) {
            case 'TASK_CREATE':
                wouldDo.push('Create task in database');
                if (!payload.title) requiredInputsMissing.push('title');
                break;
            case 'PLAYBOOK_ASSIGN':
                wouldDo.push('Assign playbook to user');
                if (!payload.playbook_key) requiredInputsMissing.push('playbook_key');
                if (!payload.entity_id) requiredInputsMissing.push('entity_id (user)');
                break;
            case 'MEETING_SCHEDULE':
                wouldDo.push('Schedule meeting (mock integration)');
                externalCalls.push('Calendar API (mock)');
                break;
        }

        return {
            would_do: wouldDo,
            external_calls: externalCalls,
            required_inputs_missing: requiredInputsMissing,
            validation: {
                ok: requiredInputsMissing.length === 0,
                notes: requiredInputsMissing.length > 0 ? ['Missing required inputs'] : []
            }
        };
    }
};

module.exports = ActionExecutionAdapter;
