const AIPlaybookService = require('./aiPlaybookService');
const AIPlaybookRoutingEngine = require('./aiPlaybookRoutingEngine');
const ActionExecutionAdapter = require('./actionExecutionAdapter');
const ActionDecisionService = require('./actionDecisionService');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

/**
 * AI Playbook Executor
 * Step 10 + Step 12: Orchestrates step-by-step execution with conditional branching.
 * 
 * Step Types:
 * - ACTION: Creates Action Proposal (Step 9), awaits approval, executes on approval
 * - CHECK: Evaluates condition, records outputs, routes to next
 * - WAIT: Time-based wait condition
 * - BRANCH: Evaluates branch_rules, selects next step
 * - AI_ROUTER: AI suggests routing (future, deterministic enforcement)
 */
const AIPlaybookExecutor = {
    STEP_TYPES: {
        ACTION: 'ACTION',
        CHECK: 'CHECK',
        WAIT: 'WAIT',
        BRANCH: 'BRANCH',
        AI_ROUTER: 'AI_ROUTER'
    },

    /**
     * Advance a playbook run to the next step.
     * Uses routing engine for BRANCH steps.
     * 
     * @param {string} runId - Playbook run ID
     * @param {string} userId - User advancing the run
     * @returns {Promise<Object>} - Result of the advance operation
     */
    advanceRun: async (runId, userId) => {
        const run = await AIPlaybookService.getRun(runId);

        if (!run) {
            return { success: false, error: `Run ${runId} not found` };
        }

        if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED') {
            return { success: false, error: `Run ${runId} is already ${run.status}` };
        }

        // Find the next pending step
        const nextStep = run.steps.find(s => s.status === 'PENDING');

        if (!nextStep) {
            // All steps complete
            await AIPlaybookService.updateRunStatus(runId, 'COMPLETED');
            return {
                success: true,
                runStatus: 'COMPLETED',
                message: 'All steps completed'
            };
        }

        // Update run to IN_PROGRESS if not already
        if (run.status === 'PENDING') {
            await AIPlaybookService.updateRunStatus(runId, 'IN_PROGRESS');
        }

        // Execute the step based on its type
        const stepType = nextStep.stepType || 'ACTION';
        let stepResult;

        switch (stepType) {
            case 'BRANCH':
                stepResult = await AIPlaybookExecutor._executeBranchStep(nextStep, run, userId);
                break;
            case 'CHECK':
                stepResult = await AIPlaybookExecutor._executeCheckStep(nextStep, run, userId);
                break;
            case 'WAIT':
                stepResult = await AIPlaybookExecutor._executeWaitStep(nextStep, run, userId);
                break;
            case 'AI_ROUTER':
                stepResult = await AIPlaybookExecutor._executeAIRouterStep(nextStep, run, userId);
                break;
            case 'ACTION':
            default:
                stepResult = await AIPlaybookExecutor._executeActionStep(nextStep, run, userId);
                break;
        }

        // Update step status
        await AIPlaybookService.updateStepStatus(nextStep.id, stepResult.status, {
            decisionId: stepResult.decisionId,
            executionId: stepResult.executionId
        });

        // Update routing info if present
        if (stepResult.trace || stepResult.selectedNextStepId) {
            await AIPlaybookService.updateRunStepWithRouting(nextStep.id, {
                outputs: stepResult.outputs,
                evaluationTrace: stepResult.trace,
                selectedNextStepId: stepResult.selectedNextStepId,
                statusReason: stepResult.reason
            });
        }

        // Check run completion status
        const updatedRun = await AIPlaybookService.getRun(runId);
        const allComplete = updatedRun.steps.every(s =>
            s.status === 'EXECUTED' || s.status === 'SKIPPED' ||
            (s.isOptional && s.status === 'REJECTED')
        );

        if (allComplete) {
            await AIPlaybookService.updateRunStatus(runId, 'COMPLETED');
        }

        // Check for failures
        const hasFailed = updatedRun.steps.some(s =>
            s.status === 'FAILED' && !s.isOptional
        );

        if (hasFailed) {
            await AIPlaybookService.updateRunStatus(runId, 'FAILED');
        }

        return {
            success: stepResult.status === 'EXECUTED' || stepResult.status === 'SKIPPED',
            step: {
                id: nextStep.id,
                title: nextStep.title,
                stepType,
                status: stepResult.status,
                selectedNextStepId: stepResult.selectedNextStepId
            },
            trace: stepResult.trace,
            executionId: stepResult.executionId,
            runStatus: updatedRun.status
        };
    },

    /**
     * Execute a BRANCH step - evaluates conditions and routes.
     * No side effects, just routing decision.
     */
    _executeBranchStep: async (step, run, userId) => {
        try {
            // Build context for routing evaluation
            const context = await AIPlaybookRoutingEngine.buildContext(run.id, run.organizationId);

            // Get template step with branch_rules
            const templateStep = await AIPlaybookRoutingEngine.getTemplateStep(step.templateStepId);

            if (!templateStep || !templateStep.branchRules) {
                return {
                    status: 'FAILED',
                    reason: 'No branch_rules defined for BRANCH step',
                    trace: { error: 'Missing branch_rules' }
                };
            }

            // Evaluate routing
            const routingResult = AIPlaybookRoutingEngine.evaluateRouting({
                runId: run.id,
                currentStep: templateStep,
                context
            });

            return {
                status: 'EXECUTED',
                outputs: { routed_to: routingResult.nextStepId },
                selectedNextStepId: routingResult.nextStepId,
                trace: routingResult.trace,
                reason: routingResult.reason
            };
        } catch (err) {
            console.error('[AIPlaybookExecutor] BRANCH step failed:', err);
            return {
                status: 'FAILED',
                reason: err.message,
                trace: { error: err.message }
            };
        }
    },

    /**
     * Execute a CHECK step - validates a condition and outputs result.
     */
    _executeCheckStep: async (step, run, userId) => {
        try {
            const context = await AIPlaybookRoutingEngine.buildContext(run.id, run.organizationId);
            const templateStep = await AIPlaybookRoutingEngine.getTemplateStep(step.templateStepId);

            // CHECK steps use the first rule from branch_rules as the condition
            const branchRules = templateStep?.branchRules;
            let checkResult = { passed: true, reason: 'No condition defined' };

            if (branchRules?.rules?.length > 0) {
                const firstRule = branchRules.rules[0];
                const evalResult = AIPlaybookRoutingEngine.evaluateCondition(firstRule.if, context);
                checkResult = {
                    passed: evalResult.matched,
                    reason: evalResult.reason,
                    contextUsed: evalResult.contextUsed
                };
            }

            // Route based on check result
            let nextStepId = templateStep?.nextStepId;
            if (branchRules) {
                nextStepId = checkResult.passed ? branchRules.rules?.[0]?.goto : branchRules.else_goto;
            }

            return {
                status: 'EXECUTED',
                outputs: checkResult,
                selectedNextStepId: nextStepId,
                trace: { check_result: checkResult, context_snapshot: context },
                reason: checkResult.reason
            };
        } catch (err) {
            console.error('[AIPlaybookExecutor] CHECK step failed:', err);
            return {
                status: 'FAILED',
                reason: err.message,
                trace: { error: err.message }
            };
        }
    },

    /**
     * Execute a WAIT step - checks time condition.
     * Returns SKIPPED if condition not met (caller should retry later).
     */
    _executeWaitStep: async (step, run, userId) => {
        try {
            const context = await AIPlaybookRoutingEngine.buildContext(run.id, run.organizationId);
            const templateStep = await AIPlaybookRoutingEngine.getTemplateStep(step.templateStepId);

            // WAIT steps use time_since_step_gte condition
            const branchRules = templateStep?.branchRules;
            let shouldProceed = true;
            let reason = 'No wait condition defined';

            if (branchRules?.rules?.length > 0) {
                const waitRule = branchRules.rules[0];
                if (waitRule.if?.time_since_step_gte) {
                    const evalResult = AIPlaybookRoutingEngine.evaluateCondition(waitRule.if, context);
                    shouldProceed = evalResult.matched;
                    reason = evalResult.reason;
                }
            }

            if (!shouldProceed) {
                return {
                    status: 'PENDING', // Keep pending - not ready yet
                    outputs: { waiting: true },
                    reason: `Wait condition not met: ${reason}`,
                    trace: { wait_result: 'not_ready', reason }
                };
            }

            return {
                status: 'EXECUTED',
                outputs: { waiting: false, proceeded: true },
                selectedNextStepId: templateStep?.nextStepId,
                reason: 'Wait condition satisfied',
                trace: { wait_result: 'ready', reason }
            };
        } catch (err) {
            console.error('[AIPlaybookExecutor] WAIT step failed:', err);
            return {
                status: 'FAILED',
                reason: err.message,
                trace: { error: err.message }
            };
        }
    },

    /**
     * Execute an AI_ROUTER step - AI suggests routing but with deterministic enforcement.
     * For now, falls back to BRANCH behavior with logging.
     */
    _executeAIRouterStep: async (step, run, userId) => {
        console.log('[AIPlaybookExecutor] AI_ROUTER step - using deterministic BRANCH fallback');

        // AI_ROUTER uses same logic as BRANCH but could incorporate AI suggestion in future
        const result = await AIPlaybookExecutor._executeBranchStep(step, run, userId);
        result.trace = {
            ...result.trace,
            ai_router_note: 'Used deterministic branch rules (AI suggestion not implemented)'
        };
        return result;
    },

    /**
     * Execute an ACTION step - creates Action Proposal through Step 9.
     * Integrates with Policy Engine for auto-approval.
     */
    _executeActionStep: async (step, run, userId) => {
        try {
            const decisionId = `ad-pb-${uuidv4()}`;
            const proposalId = `pbstep-${step.id}`;

            // Build proposal snapshot
            const proposalSnapshot = {
                proposal_id: proposalId,
                action_type: step.actionType,
                scope: 'playbook',
                ...step.resolvedPayload,
                _playbook_run_id: run.id,
                _playbook_step_id: step.id
            };

            // Check Policy Engine for auto-approval
            const policyResult = await ActionDecisionService.evaluatePolicyForProposal(
                proposalSnapshot,
                run.organizationId
            );

            let decision = 'APPROVED'; // Default for playbook steps
            let policyRuleId = null;

            if (policyResult?.matchedRule) {
                decision = policyResult.autoDecision || 'APPROVED';
                policyRuleId = policyResult.matchedRule.id;
            }

            // Insert decision
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO action_decisions 
                     (id, proposal_id, organization_id, correlation_id, action_type, scope, decision, decided_by_user_id, proposal_snapshot, policy_rule_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        decisionId,
                        proposalId,
                        run.organizationId,
                        run.correlationId,
                        step.actionType,
                        'playbook',
                        decision,
                        userId,
                        JSON.stringify(proposalSnapshot),
                        policyRuleId
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            // If approved, execute
            if (decision === 'APPROVED') {
                const execResult = await ActionExecutionAdapter.executeDecision(decisionId, userId);

                return {
                    status: execResult.success ? 'EXECUTED' : 'FAILED',
                    decisionId,
                    executionId: execResult.execution_id,
                    outputs: { execution_result: execResult.success ? 'success' : 'failed' },
                    reason: execResult.success ? 'Action executed successfully' : execResult.error
                };
            } else {
                // Decision was REJECTED by policy - skip step
                return {
                    status: 'SKIPPED',
                    decisionId,
                    reason: `Action rejected by policy: ${policyResult?.matchedRule?.autoDecisionReason || 'Policy engine'}`,
                    outputs: { decision, policy_rule_id: policyRuleId }
                };
            }
        } catch (err) {
            console.error('[AIPlaybookExecutor] ACTION step failed:', err);
            return {
                status: 'FAILED',
                reason: err.message,
                trace: { error: err.message }
            };
        }
    },

    /**
     * Dry-run routing for a step without persisting changes.
     * 
     * @param {string} runId - Playbook run ID
     * @returns {Promise<Object>} Routing preview
     */
    dryRunRoute: async (runId) => {
        const run = await AIPlaybookService.getRun(runId);

        if (!run) {
            return { success: false, error: `Run ${runId} not found` };
        }

        const currentStep = run.steps.find(s => s.status === 'PENDING');

        if (!currentStep) {
            return {
                success: true,
                message: 'No pending steps - run would complete',
                nextStepId: null
            };
        }

        const stepType = currentStep.stepType || 'ACTION';

        if (stepType === 'BRANCH' || stepType === 'CHECK' || stepType === 'AI_ROUTER') {
            // Build context and evaluate routing
            const context = await AIPlaybookRoutingEngine.buildContext(run.id, run.organizationId);
            const templateStep = await AIPlaybookRoutingEngine.getTemplateStep(currentStep.templateStepId);

            const routingResult = AIPlaybookRoutingEngine.evaluateRouting({
                runId: run.id,
                currentStep: templateStep,
                context
            });

            return {
                success: true,
                dry_run: true,
                currentStep: {
                    id: currentStep.id,
                    title: currentStep.title,
                    stepType
                },
                nextStepId: routingResult.nextStepId,
                trace: routingResult.trace,
                reason: routingResult.reason
            };
        }

        // For ACTION/WAIT steps, just show what would happen
        return {
            success: true,
            dry_run: true,
            currentStep: {
                id: currentStep.id,
                title: currentStep.title,
                stepType
            },
            nextStepId: currentStep.nextStepId,
            message: stepType === 'ACTION'
                ? 'Would create Action Proposal and execute if approved'
                : 'Would check wait condition'
        };
    },

    /**
     * Cancel a playbook run
     */
    cancelRun: async (runId, userId) => {
        const run = await AIPlaybookService.getRun(runId);

        if (!run) {
            return { success: false, error: `Run ${runId} not found` };
        }

        if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
            return { success: false, error: `Run ${runId} is already ${run.status}` };
        }

        await AIPlaybookService.updateRunStatus(runId, 'CANCELLED');

        // Mark remaining pending steps as skipped
        for (const step of run.steps) {
            if (step.status === 'PENDING') {
                await AIPlaybookService.updateStepStatus(step.id, 'SKIPPED');
            }
        }

        return { success: true, runStatus: 'CANCELLED' };
    }
};

module.exports = AIPlaybookExecutor;
