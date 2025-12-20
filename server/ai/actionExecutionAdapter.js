const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const ActionDecisionService = require('./actionDecisionService');

const TaskExecutor = require('./actionExecutors/taskExecutor');
const PlaybookExecutor = require('./actionExecutors/playbookExecutor');
const MeetingExecutor = require('./actionExecutors/meetingExecutor');

/**
 * ActionExecutionAdapter
 * Executes approved decisions using classical services.
 * Step 9.3: Post-Approval Execution Layer.
 */
const ActionExecutionAdapter = {
    /**
     * Executes a decision.
     * @param {string} decisionId - The ID of the action_decision.
     * @param {string} executedBy - The ID of the user triggering execution (usually SYSTEM or Admin).
     * @returns {Promise<Object>} Execution results.
     */
    executeDecision: async (decisionId, executedBy = 'SYSTEM') => {
        // 1. Fetch decision
        const decisions = await ActionDecisionService.getAuditLog(); // Use getAuditLog to find the specific decision
        const decision = decisions.find(d => d.id === decisionId);

        if (!decision) {
            return { success: false, error: `Decision not found: ${decisionId}` };
        }

        // 2. Validate state
        const validStates = ['APPROVED', 'MODIFIED'];
        if (!validStates.includes(decision.decision)) {
            return {
                success: false,
                error: `Decision ${decisionId} is ${decision.decision}, but only APPROVED/MODIFIED are executable`
            };
        }

        // 3. Idempotency check: Check if already executed successfully
        const existingExecution = await new Promise((resolve, reject) => {
            db.get(`SELECT id, status, result FROM action_executions WHERE decision_id = ? AND status = 'SUCCESS'`, [decisionId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingExecution) {
            return {
                success: true,
                alreadyExecuted: true,
                executionId: existingExecution.id,
                result: JSON.parse(existingExecution.result || '{}'),
                message: 'Decision already executed successfully'
            };
        }

        // 4. Resolve payload
        // If MODIFIED, use modified_payload. If APPROVED, use original_payload.
        const payload = decision.decision === 'MODIFIED'
            ? decision.modified_payload
            : decision.original_payload;

        if (!payload) {
            return {
                success: false,
                error: `Execution failed: No payload found for decision ${decisionId}`
            };
        }

        // 5. Select Executor
        // Extract action_type from payload or proposal metadata if needed. 
        // Based on Step 9.1 Mapper, action_type is in the proposal.
        // The payload usually contains the data for that action.
        // We'll need to know which action to run. 
        // We assume the proposal metadata or action_type is passed in the decision if we store it.
        // Given our action_decisions table doesn't have action_type, we might need to peek into the payload
        // or we should have added action_type to action_decisions.

        // Peek into payload for a "type" field if it exists, or infer from properties.
        // Better: Proposals in Step 9.1 HAVE an action_type. Let's assume the payload might have it
        // or we need to fetch the proposal (which we can't because it's not stored).

        // DECISION: We'll peek into the payload for action_type if it was stored there.
        // If not, we'll try to infer it.
        const actionType = payload.action_type || (payload.playbook_key ? 'PLAYBOOK_ASSIGN' : payload.summary ? 'MEETING_SCHEDULE' : 'TASK_CREATE');

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
                throw new Error(`Unknown or unsupported action type: ${actionType}`);
        }

        const metadata = {
            userId: decision.decided_by_user_id,
            organizationId: decision.organization_id || 'org-dbr77-test' // Fallback for testing
        };

        // 6. Execute
        let status = 'SUCCESS';
        let result = null;
        let error = null;

        try {
            result = await executor.execute(payload, metadata);
        } catch (err) {
            status = 'FAILED';
            error = err.message;
            result = { error: err.message };
        }

        // 7. Log execution result
        const executionId = `ax-${uuidv4()}`;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO action_executions (id, decision_id, executed_by, status, result)
                 VALUES (?, ?, ?, ?, ?)`,
                [executionId, decisionId, executedBy, status, JSON.stringify(result)],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        if (error) {
            return {
                success: false,
                executionId,
                error,
                message: `Execution failed: ${error}`
            };
        }

        return {
            success: true,
            executionId,
            result,
            message: `Decision ${decisionId} executed successfully`
        };
    }
};

module.exports = ActionExecutionAdapter;
