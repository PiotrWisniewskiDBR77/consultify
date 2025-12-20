/**
 * AI Playbook Routing Engine
 * Step 12: Conditional Branching & Dynamic Playbooks
 * 
 * Evaluates branch rules and determines next step routing.
 * Supports: metric_lte, metric_gte, flag_eq, has_open_tasks, signal_present, time_since_step_gte
 */

const db = require('../database');

const AIPlaybookRoutingEngine = {
    /**
     * Supported condition types for branch rules.
     */
    CONDITION_TYPES: {
        METRIC_LTE: 'metric_lte',
        METRIC_GTE: 'metric_gte',
        FLAG_EQ: 'flag_eq',
        HAS_OPEN_TASKS: 'has_open_tasks',
        SIGNAL_PRESENT: 'signal_present',
        TIME_SINCE_STEP_GTE: 'time_since_step_gte'
    },

    /**
     * Evaluate routing for a step with branch rules.
     * 
     * @param {Object} params
     * @param {string} params.runId - Playbook run ID
     * @param {Object} params.currentStep - Template step with branch_rules
     * @param {Object} params.context - Runtime context from buildContext()
     * @returns {{ nextStepId: string|null, trace: Object, reason: string }}
     */
    evaluateRouting: ({ runId, currentStep, context }) => {
        const branchRules = currentStep.branchRules || currentStep.branch_rules;

        // If no branch rules, use default next_step_id or null (linear flow)
        if (!branchRules || typeof branchRules !== 'object') {
            return {
                nextStepId: currentStep.nextStepId || currentStep.next_step_id || null,
                trace: { mode: 'linear', reason: 'No branch rules defined' },
                reason: 'Linear flow - no branch rules'
            };
        }

        const { mode = 'first_match', rules = [], else_goto } = branchRules;

        if (mode !== 'first_match') {
            console.warn(`[AIPlaybookRoutingEngine] Unsupported mode: ${mode}, defaulting to first_match`);
        }

        const trace = {
            mode,
            rules_evaluated: [],
            context_used: {}
        };

        // Evaluate rules in order (first_match)
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const condition = rule.if;

            if (!condition || typeof condition !== 'object') {
                trace.rules_evaluated.push({ index: i, skipped: true, reason: 'Invalid condition' });
                continue;
            }

            const evaluationResult = AIPlaybookRoutingEngine.evaluateCondition(condition, context);
            trace.rules_evaluated.push({
                index: i,
                condition,
                matched: evaluationResult.matched,
                reason: evaluationResult.reason
            });

            // Track which context values were used
            if (evaluationResult.contextUsed) {
                Object.assign(trace.context_used, evaluationResult.contextUsed);
            }

            if (evaluationResult.matched) {
                trace.matched_rule = rule;
                return {
                    nextStepId: rule.goto,
                    trace,
                    reason: rule.reason || `Matched rule ${i + 1}`
                };
            }
        }

        // No match - use else_goto
        trace.matched_rule = null;
        trace.fell_through_to_else = true;

        return {
            nextStepId: else_goto || null,
            trace,
            reason: else_goto ? 'Fell through to else_goto' : 'No matching rule, no else_goto defined'
        };
    },

    /**
     * Evaluate a single condition.
     * 
     * @param {Object} condition - Condition object, e.g. { metric_lte: ["help_adoption", 0.2] }
     * @param {Object} context - Runtime context
     * @returns {{ matched: boolean, reason: string, contextUsed?: Object }}
     */
    evaluateCondition: (condition, context) => {
        const ctx = context || {};
        const conditionKeys = Object.keys(condition);

        if (conditionKeys.length === 0) {
            return { matched: false, reason: 'Empty condition' };
        }

        // Handle first condition key (we support single-condition per rule.if)
        const condType = conditionKeys[0];
        const condValue = condition[condType];

        try {
            switch (condType) {
                case 'metric_lte': {
                    // Format: ["metric_name", threshold]
                    if (!Array.isArray(condValue) || condValue.length !== 2) {
                        return { matched: false, reason: 'Invalid metric_lte format' };
                    }
                    const [metricName, threshold] = condValue;
                    const metricValue = ctx.metrics?.[metricName];

                    if (metricValue === undefined || metricValue === null) {
                        return {
                            matched: false,
                            reason: `Metric '${metricName}' not found in context`,
                            contextUsed: { [`metrics.${metricName}`]: undefined }
                        };
                    }

                    const matched = metricValue <= threshold;
                    return {
                        matched,
                        reason: `${metricName}=${metricValue} ${matched ? '<=' : '>'} ${threshold}`,
                        contextUsed: { [`metrics.${metricName}`]: metricValue }
                    };
                }

                case 'metric_gte': {
                    if (!Array.isArray(condValue) || condValue.length !== 2) {
                        return { matched: false, reason: 'Invalid metric_gte format' };
                    }
                    const [metricName, threshold] = condValue;
                    const metricValue = ctx.metrics?.[metricName];

                    if (metricValue === undefined || metricValue === null) {
                        return {
                            matched: false,
                            reason: `Metric '${metricName}' not found in context`,
                            contextUsed: { [`metrics.${metricName}`]: undefined }
                        };
                    }

                    const matched = metricValue >= threshold;
                    return {
                        matched,
                        reason: `${metricName}=${metricValue} ${matched ? '>=' : '<'} ${threshold}`,
                        contextUsed: { [`metrics.${metricName}`]: metricValue }
                    };
                }

                case 'flag_eq': {
                    // Format: ["flag_name", expected_value]
                    if (!Array.isArray(condValue) || condValue.length !== 2) {
                        return { matched: false, reason: 'Invalid flag_eq format' };
                    }
                    const [flagName, expectedValue] = condValue;
                    const flagValue = ctx.flags?.[flagName];
                    const matched = flagValue === expectedValue;
                    return {
                        matched,
                        reason: `Flag ${flagName}=${flagValue} ${matched ? '==' : '!='} ${expectedValue}`,
                        contextUsed: { [`flags.${flagName}`]: flagValue }
                    };
                }

                case 'has_open_tasks': {
                    // Format: true/false
                    const hasOpenTasks = Array.isArray(ctx.tasks) && ctx.tasks.some(t =>
                        t.status === 'open' || t.status === 'in_progress' || t.status === 'PENDING'
                    );
                    const matched = hasOpenTasks === condValue;
                    return {
                        matched,
                        reason: `has_open_tasks=${hasOpenTasks} ${matched ? '==' : '!='} ${condValue}`,
                        contextUsed: { has_open_tasks: hasOpenTasks, task_count: ctx.tasks?.length || 0 }
                    };
                }

                case 'signal_present': {
                    // Format: "SIGNAL_TYPE"
                    const signals = ctx.signals || [];
                    const signalPresent = signals.some(s => s.type === condValue || s === condValue);
                    return {
                        matched: signalPresent,
                        reason: `Signal '${condValue}' ${signalPresent ? 'present' : 'not present'}`,
                        contextUsed: { signals: signals.map(s => s.type || s) }
                    };
                }

                case 'time_since_step_gte': {
                    // Format: ["step_id", minutes]
                    if (!Array.isArray(condValue) || condValue.length !== 2) {
                        return { matched: false, reason: 'Invalid time_since_step_gte format' };
                    }
                    const [stepId, minutes] = condValue;
                    const stepTimestamp = ctx.stepTimestamps?.[stepId];

                    if (!stepTimestamp) {
                        return {
                            matched: false,
                            reason: `Step '${stepId}' timestamp not found`,
                            contextUsed: { [`stepTimestamps.${stepId}`]: undefined }
                        };
                    }

                    const elapsedMs = Date.now() - new Date(stepTimestamp).getTime();
                    const elapsedMins = elapsedMs / (1000 * 60);
                    const matched = elapsedMins >= minutes;
                    return {
                        matched,
                        reason: `Time since ${stepId}=${elapsedMins.toFixed(1)}min ${matched ? '>=' : '<'} ${minutes}min`,
                        contextUsed: { [`stepTimestamps.${stepId}`]: stepTimestamp, elapsed_mins: elapsedMins }
                    };
                }

                default:
                    // Unknown condition type - fail safely
                    console.warn(`[AIPlaybookRoutingEngine] Unknown condition type: ${condType}`);
                    return {
                        matched: false,
                        reason: `Unknown condition type: ${condType} (fail-safe)`
                    };
            }
        } catch (err) {
            console.error(`[AIPlaybookRoutingEngine] Error evaluating condition:`, err);
            return {
                matched: false,
                reason: `Evaluation error: ${err.message}`
            };
        }
    },

    /**
     * Build runtime context for routing evaluation.
     * 
     * @param {string} runId - Playbook run ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Context snapshot
     */
    buildContext: async (runId, organizationId) => {
        const context = {
            runId,
            organizationId,
            metrics: {},
            flags: {},
            tasks: [],
            signals: [],
            stepTimestamps: {},
            stepOutputs: {},
            timestamp: new Date().toISOString()
        };

        try {
            // 1. Get run metadata and step outputs
            const runSteps = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT rs.id, rs.template_step_id, rs.status, rs.outputs, rs.created_at, ts.step_order
                     FROM ai_playbook_run_steps rs
                     JOIN ai_playbook_template_steps ts ON rs.template_step_id = ts.id
                     WHERE rs.run_id = ?
                     ORDER BY ts.step_order`,
                    [runId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            for (const step of runSteps) {
                context.stepTimestamps[step.template_step_id] = step.created_at;
                if (step.outputs) {
                    try {
                        context.stepOutputs[step.template_step_id] = JSON.parse(step.outputs);
                    } catch (e) { }
                }
            }

            // 2. Get open tasks for org
            const tasks = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, status FROM tasks WHERE organization_id = ? AND status NOT IN ('completed', 'cancelled')`,
                    [organizationId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });
            context.tasks = tasks;

            // 3. Get active signals/recommendations
            // (Integration with signalEngine - simplified for now)
            // This would normally call SignalEngine.detect() or read cached signals

            // 4. Get key metrics from metrics_snapshots
            const latestMetrics = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT metric_key, metric_value 
                     FROM metrics_snapshots 
                     WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM metrics_snapshots)
                     LIMIT 20`,
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            for (const m of latestMetrics) {
                context.metrics[m.metric_key] = m.metric_value;
            }

            // 5. Get org-specific metrics
            const orgMetrics = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT 
                        (SELECT COUNT(*) FROM help_events WHERE organization_id = ? AND event_type = 'COMPLETED') as help_completed,
                        (SELECT COUNT(*) FROM help_events WHERE organization_id = ? AND event_type = 'STARTED') as help_started
                    `,
                    [organizationId, organizationId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row || {});
                    }
                );
            });

            if (orgMetrics.help_started > 0) {
                context.metrics.help_adoption = orgMetrics.help_completed / orgMetrics.help_started;
            } else {
                context.metrics.help_adoption = 0;
            }

        } catch (err) {
            console.error('[AIPlaybookRoutingEngine] Error building context:', err);
        }

        return context;
    },

    /**
     * Get step template by ID with parsed branch_rules.
     * 
     * @param {string} stepId - Template step ID
     * @returns {Promise<Object|null>}
     */
    getTemplateStep: async (stepId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM ai_playbook_template_steps WHERE id = ?`,
                [stepId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        templateId: row.template_id,
                        stepOrder: row.step_order,
                        stepType: row.step_type || 'ACTION',
                        actionType: row.action_type,
                        title: row.title,
                        description: row.description,
                        payloadTemplate: JSON.parse(row.payload_template || '{}'),
                        isOptional: !!row.is_optional,
                        waitForPrevious: !!row.wait_for_previous,
                        nextStepId: row.next_step_id,
                        branchRules: row.branch_rules ? JSON.parse(row.branch_rules) : null,
                        inputsSchema: JSON.parse(row.inputs_schema || '{}'),
                        outputsSchema: JSON.parse(row.outputs_schema || '{}')
                    });
                }
            );
        });
    }
};

module.exports = AIPlaybookRoutingEngine;
