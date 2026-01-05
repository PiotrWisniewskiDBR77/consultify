import { getDatabase } from '../database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Dependency injection container
const deps = {
    db,
    uuidv4
};

/**
 * AI Playbook Service
 * Step 10: Multi-Step Action Plans
 * 
 * Manages playbook templates, runs, and step execution.
 */
const AIPlaybookService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    RUN_STATUSES: {
        PENDING: 'PENDING',
        IN_PROGRESS: 'IN_PROGRESS',
        COMPLETED: 'COMPLETED',
        FAILED: 'FAILED',
        CANCELLED: 'CANCELLED'
    },

    STEP_STATUSES: {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
        EXECUTED: 'EXECUTED',
        FAILED: 'FAILED',
        SKIPPED: 'SKIPPED'
    },

    // Step 13: Visual Playbook Editor - Template versioning statuses
    TEMPLATE_STATUSES: {
        DRAFT: 'DRAFT',
        PUBLISHED: 'PUBLISHED',
        DEPRECATED: 'DEPRECATED'
    },

    // ==========================================
    // TEMPLATE CRUD
    // ==========================================

    /**
     * Create a playbook template
     */
    createTemplate: async ({ key, title, description, triggerSignal, estimatedDurationMins = 30 }) => {
        if (!key || !title) throw new Error('key and title are required');

        const id = `apt-${deps.uuidv4()}`;

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO ai_playbook_templates (id, key, title, description, trigger_signal, estimated_duration_mins)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, key, title, description, triggerSignal, estimatedDurationMins],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            return reject(new Error(`Template with key '${key}' already exists`));
                        }
                        return reject(err);
                    }
                    resolve({ id, key, title, description, triggerSignal, estimatedDurationMins, isActive: true });
                }
            );
        });
    },

    /**
     * Get template by key
     */
    getTemplateByKey: async (key) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_playbook_templates WHERE key = ?`, [key], async (err, template) => {
                if (err) return reject(err);
                if (!template) return resolve(null);

                // Fetch steps
                deps.db.all(
                    `SELECT * FROM ai_playbook_template_steps WHERE template_id = ? ORDER BY step_order ASC`,
                    [template.id],
                    (stepsErr, steps) => {
                        if (stepsErr) return reject(stepsErr);

                        resolve({
                            id: template.id,
                            key: template.key,
                            title: template.title,
                            description: template.description,
                            triggerSignal: template.trigger_signal,
                            estimatedDurationMins: template.estimated_duration_mins,
                            isActive: !!template.is_active,
                            steps: (steps || []).map(s => ({
                                id: s.id,
                                stepOrder: s.step_order,
                                stepType: s.step_type || 'ACTION',
                                actionType: s.action_type,
                                title: s.title,
                                description: s.description,
                                payloadTemplate: JSON.parse(s.payload_template || '{}'),
                                isOptional: !!s.is_optional,
                                waitForPrevious: !!s.wait_for_previous,
                                nextStepId: s.next_step_id,
                                branchRules: s.branch_rules ? JSON.parse(s.branch_rules) : null,
                                inputsSchema: JSON.parse(s.inputs_schema || '{}'),
                                outputsSchema: JSON.parse(s.outputs_schema || '{}')
                            }))
                        });
                    }
                );
            });
        });
    },

    /**
     * List all active templates
     */
    listTemplates: async (includeInactive = false) => {
        const sql = includeInactive
            ? `SELECT * FROM ai_playbook_templates ORDER BY title`
            : `SELECT * FROM ai_playbook_templates WHERE is_active = 1 ORDER BY title`;

        return new Promise((resolve, reject) => {
            deps.db.all(sql, [], (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(t => ({
                    id: t.id,
                    key: t.key,
                    title: t.title,
                    description: t.description,
                    triggerSignal: t.trigger_signal,
                    estimatedDurationMins: t.estimated_duration_mins,
                    isActive: !!t.is_active
                })));
            });
        });
    },

    /**
     * Add step to template
     */
    addTemplateStep: async ({ templateId, stepOrder, actionType, title, description, payloadTemplate, isOptional = false, waitForPrevious = true }) => {
        const id = `aps-${deps.uuidv4()}`;
        const payloadJson = JSON.stringify(payloadTemplate || {});

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO ai_playbook_template_steps 
                 (id, template_id, step_order, action_type, title, description, payload_template, is_optional, wait_for_previous)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, templateId, stepOrder, actionType, title, description, payloadJson, isOptional ? 1 : 0, waitForPrevious ? 1 : 0],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, templateId, stepOrder, actionType, title, description, payloadTemplate, isOptional, waitForPrevious });
                }
            );
        });
    },

    // ==========================================
    // STEP 13: TEMPLATE VERSIONING (Visual Playbook Editor)
    // ==========================================

    /**
     * Create a draft template with graph
     */
    createDraftTemplate: async ({ key, title, description, triggerSignal, templateGraph, estimatedDurationMins = 30 }) => {
        if (!key || !title) throw new Error('key and title are required');

        const id = `apt-${deps.uuidv4()}`;
        const graphJson = typeof templateGraph === 'string' ? templateGraph : JSON.stringify(templateGraph || {});

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO ai_playbook_templates 
                 (id, key, title, description, trigger_signal, estimated_duration_mins, template_graph, version, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'DRAFT')`,
                [id, key, title, description, triggerSignal, estimatedDurationMins, graphJson],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            return reject(new Error(`Template with key '${key}' already exists`));
                        }
                        return reject(err);
                    }
                    resolve({
                        id, key, title, description, triggerSignal, estimatedDurationMins,
                        templateGraph: templateGraph || {},
                        version: 1,
                        status: 'DRAFT',
                        isActive: true
                    });
                }
            );
        });
    },

    /**
     * Update a draft template (only DRAFT status allowed)
     */
    updateDraftTemplate: async (id, updates) => {
        // First check if template is DRAFT
        const template = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!template) throw new Error(`Template ${id} not found`);
        if (template.status && template.status !== 'DRAFT') {
            throw new Error(`Cannot edit template with status '${template.status}'. Only DRAFT templates can be edited.`);
        }

        const setClauses = [];
        const values = [];

        if (updates.title !== undefined) {
            setClauses.push('title = ?');
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            setClauses.push('description = ?');
            values.push(updates.description);
        }
        if (updates.triggerSignal !== undefined) {
            setClauses.push('trigger_signal = ?');
            values.push(updates.triggerSignal);
        }
        if (updates.templateGraph !== undefined) {
            setClauses.push('template_graph = ?');
            values.push(typeof updates.templateGraph === 'string' ? updates.templateGraph : JSON.stringify(updates.templateGraph));
        }
        if (updates.estimatedDurationMins !== undefined) {
            setClauses.push('estimated_duration_mins = ?');
            values.push(updates.estimatedDurationMins);
        }
        if (updates.isActive !== undefined) {
            setClauses.push('is_active = ?');
            values.push(updates.isActive ? 1 : 0);
        }

        if (setClauses.length === 0) return false;

        values.push(id);

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_playbook_templates SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    },

    /**
     * Publish a template (creates immutable version)
     */
    publishTemplate: async (id, userId) => {
        // Get current template
        const template = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!template) throw new Error(`Template ${id} not found`);
        if (template.status === 'PUBLISHED') {
            throw new Error('Template is already published');
        }

        // For DRAFT: just update to PUBLISHED
        // For creating new version from published: would create new record (not implemented yet)
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE ai_playbook_templates 
                 SET status = 'PUBLISHED', published_at = ?, published_by_user_id = ?
                 WHERE id = ?`,
                [now, userId, id],
                function (err) {
                    if (err) reject(err);
                    else resolve({
                        id,
                        key: template.key,
                        version: template.version || 1,
                        status: 'PUBLISHED',
                        publishedAt: now,
                        publishedByUserId: userId
                    });
                }
            );
        });
    },

    /**
     * Deprecate a published template
     */
    deprecateTemplate: async (id) => {
        const template = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!template) throw new Error(`Template ${id} not found`);

        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE ai_playbook_templates SET status = 'DEPRECATED' WHERE id = ?`,
                [id],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id, status: 'DEPRECATED' });
                }
            );
        });
    },

    /**
     * Get templates filtered by status
     */
    getTemplatesByStatus: async (status) => {
        const validStatuses = ['DRAFT', 'PUBLISHED', 'DEPRECATED'];
        if (status && !validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
        }

        const sql = status
            ? `SELECT * FROM ai_playbook_templates WHERE status = ? ORDER BY title`
            : `SELECT * FROM ai_playbook_templates ORDER BY title`;
        const params = status ? [status] : [];

        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(t => ({
                    id: t.id,
                    key: t.key,
                    title: t.title,
                    description: t.description,
                    triggerSignal: t.trigger_signal,
                    estimatedDurationMins: t.estimated_duration_mins,
                    templateGraph: t.template_graph ? JSON.parse(t.template_graph) : null,
                    version: t.version || 1,
                    status: t.status || 'DRAFT',
                    publishedAt: t.published_at,
                    publishedByUserId: t.published_by_user_id,
                    isActive: !!t.is_active,
                    createdAt: t.created_at
                })));
            });
        });
    },

    /**
     * Get template by ID with full details
     */
    getTemplateById: async (id) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], async (err, template) => {
                if (err) return reject(err);
                if (!template) return resolve(null);

                // Fetch steps
                deps.db.all(
                    `SELECT * FROM ai_playbook_template_steps WHERE template_id = ? ORDER BY step_order ASC`,
                    [id],
                    (stepsErr, steps) => {
                        if (stepsErr) return reject(stepsErr);

                        resolve({
                            id: template.id,
                            key: template.key,
                            title: template.title,
                            description: template.description,
                            triggerSignal: template.trigger_signal,
                            estimatedDurationMins: template.estimated_duration_mins,
                            templateGraph: template.template_graph ? JSON.parse(template.template_graph) : null,
                            version: template.version || 1,
                            status: template.status || 'DRAFT',
                            publishedAt: template.published_at,
                            publishedByUserId: template.published_by_user_id,
                            parentTemplateId: template.parent_template_id,
                            isActive: !!template.is_active,
                            createdAt: template.created_at,
                            steps: (steps || []).map(s => ({
                                id: s.id,
                                stepOrder: s.step_order,
                                actionType: s.action_type,
                                title: s.title,
                                description: s.description,
                                payloadTemplate: JSON.parse(s.payload_template || '{}'),
                                isOptional: !!s.is_optional,
                                waitForPrevious: !!s.wait_for_previous
                            }))
                        });
                    }
                );
            });
        });
    },

    /**
     * Export template as JSON
     */
    exportTemplate: async (id) => {
        const template = await AIPlaybookService.getTemplateById(id);
        if (!template) throw new Error(`Template ${id} not found`);

        return {
            exportVersion: '1.0',
            exportedAt: new Date().toISOString(),
            template: {
                key: template.key,
                title: template.title,
                description: template.description,
                triggerSignal: template.triggerSignal,
                estimatedDurationMins: template.estimatedDurationMins,
                templateGraph: template.templateGraph,
                steps: template.steps
            }
        };
    },

    /**
     * Import template from JSON (creates as DRAFT)
     */
    importTemplate: async (exportData, userId) => {
        if (!exportData || !exportData.template) {
            throw new Error('Invalid export data format');
        }

        const { template } = exportData;

        // Generate new key to avoid conflicts
        const newKey = `${template.key}-import-${Date.now()}`;

        const result = await AIPlaybookService.createDraftTemplate({
            key: newKey,
            title: `${template.title} (Imported)`,
            description: template.description,
            triggerSignal: template.triggerSignal,
            templateGraph: template.templateGraph,
            estimatedDurationMins: template.estimatedDurationMins
        });

        // Import steps if templateGraph is not present
        if (template.steps && (!template.templateGraph || !template.templateGraph.nodes)) {
            for (const step of template.steps) {
                await AIPlaybookService.addTemplateStep({
                    templateId: result.id,
                    stepOrder: step.stepOrder,
                    actionType: step.actionType,
                    title: step.title,
                    description: step.description,
                    payloadTemplate: step.payloadTemplate,
                    isOptional: step.isOptional,
                    waitForPrevious: step.waitForPrevious
                });
            }
        }

        return result;
    },

    // ==========================================
    // RUN MANAGEMENT
    // ==========================================

    /**
     * Initiate a playbook run
     */
    initiateRun: async ({ templateId, organizationId, initiatedBy, contextSnapshot = {} }) => {
        const runId = `apr-${deps.uuidv4()}`;
        const correlationId = `corr-${deps.uuidv4()}`;
        const contextJson = JSON.stringify(contextSnapshot);

        // Get template steps
        const template = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [templateId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!template) throw new Error(`Template ${templateId} not found`);

        const steps = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT * FROM ai_playbook_template_steps WHERE template_id = ? ORDER BY step_order`, [templateId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Create run
        await new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO ai_playbook_runs (id, template_id, organization_id, correlation_id, initiated_by, status, context_snapshot)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [runId, templateId, organizationId, correlationId, initiatedBy, 'PENDING', contextJson],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Create run steps
        for (const step of steps) {
            const stepId = `aprs-${deps.uuidv4()}`;
            const resolvedPayload = AIPlaybookService.resolvePayloadTemplate(
                JSON.parse(step.payload_template || '{}'),
                contextSnapshot
            );

            await new Promise((resolve, reject) => {
                deps.db.run(
                    `INSERT INTO ai_playbook_run_steps (id, run_id, template_step_id, status, resolved_payload)
                     VALUES (?, ?, ?, ?, ?)`,
                    [stepId, runId, step.id, 'PENDING', JSON.stringify(resolvedPayload)],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        return {
            runId,
            correlationId,
            templateId,
            templateKey: template.key,
            organizationId,
            status: 'PENDING',
            stepCount: steps.length
        };
    },

    /**
     * Get run with steps
     */
    getRun: async (runId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT r.*, t.key as template_key, t.title as template_title
                    FROM ai_playbook_runs r
                    JOIN ai_playbook_templates t ON r.template_id = t.id
                    WHERE r.id = ?`, [runId], async (err, run) => {
                if (err) return reject(err);
                if (!run) return resolve(null);

                deps.db.all(
                    `SELECT rs.*, ts.step_order, ts.step_type, ts.action_type, ts.title, ts.is_optional, ts.next_step_id, ts.branch_rules
                     FROM ai_playbook_run_steps rs
                     JOIN ai_playbook_template_steps ts ON rs.template_step_id = ts.id
                     WHERE rs.run_id = ? ORDER BY ts.step_order`,
                    [runId],
                    (stepsErr, steps) => {
                        if (stepsErr) return reject(stepsErr);

                        resolve({
                            id: run.id,
                            templateId: run.template_id,
                            templateKey: run.template_key,
                            templateTitle: run.template_title,
                            organizationId: run.organization_id,
                            correlationId: run.correlation_id,
                            initiatedBy: run.initiated_by,
                            status: run.status,
                            contextSnapshot: JSON.parse(run.context_snapshot || '{}'),
                            startedAt: run.started_at,
                            completedAt: run.completed_at,
                            createdAt: run.created_at,
                            steps: (steps || []).map(s => ({
                                id: s.id,
                                templateStepId: s.template_step_id,
                                stepOrder: s.step_order,
                                stepType: s.step_type || 'ACTION',
                                actionType: s.action_type,
                                title: s.title,
                                status: s.status,
                                statusReason: s.status_reason,
                                isOptional: !!s.is_optional,
                                decisionId: s.decision_id,
                                executionId: s.execution_id,
                                resolvedPayload: JSON.parse(s.resolved_payload || '{}'),
                                outputs: JSON.parse(s.outputs || '{}'),
                                selectedNextStepId: s.selected_next_step_id,
                                evaluationTrace: JSON.parse(s.evaluation_trace || '{}'),
                                nextStepId: s.next_step_id,
                                branchRules: s.branch_rules ? JSON.parse(s.branch_rules) : null
                            }))
                        });
                    }
                );
            });
        });
    },

    /**
     * Update run status
     */
    updateRunStatus: async (runId, status, extraFields = {}) => {
        const setClauses = ['status = ?'];
        const values = [status];

        if (status === 'IN_PROGRESS' && !extraFields.started_at) {
            setClauses.push('started_at = ?');
            values.push(new Date().toISOString());
        }

        if ((status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') && !extraFields.completed_at) {
            setClauses.push('completed_at = ?');
            values.push(new Date().toISOString());
        }

        values.push(runId);

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_playbook_runs SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    },

    /**
     * Update step status
     */
    updateStepStatus: async (stepId, status, { decisionId = null, executionId = null } = {}) => {
        const setClauses = ['status = ?'];
        const values = [status];

        if (decisionId) {
            setClauses.push('decision_id = ?');
            values.push(decisionId);
        }
        if (executionId) {
            setClauses.push('execution_id = ?');
            values.push(executionId);
        }

        values.push(stepId);

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_playbook_run_steps SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    },

    // ==========================================
    // HELPERS
    // ==========================================

    /**
     * Resolve payload template placeholders
     */
    resolvePayloadTemplate: (template, context) => {
        const resolved = {};
        const ctx = context || {};

        for (const [key, value] of Object.entries(template)) {
            if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
                const path = value.slice(2, -2).trim();
                resolved[key] = AIPlaybookService._getNestedValue(ctx, path) || value;
            } else if (typeof value === 'object' && value !== null) {
                resolved[key] = AIPlaybookService.resolvePayloadTemplate(value, context);
            } else {
                resolved[key] = value;
            }
        }

        return resolved;
    },

    _getNestedValue: (obj, path) => {
        return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
    },

    // ==========================================
    // STEP 12: ROUTING HELPERS
    // ==========================================

    /**
     * Update a run step with routing results (outputs, trace, selected_next_step_id).
     * 
     * @param {string} stepId - Run step ID
     * @param {Object} data - { outputs, evaluationTrace, selectedNextStepId, statusReason }
     * @returns {Promise<boolean>}
     */
    updateRunStepWithRouting: async (stepId, { outputs, evaluationTrace, selectedNextStepId, statusReason }) => {
        const setClauses = [];
        const values = [];

        if (outputs !== undefined) {
            setClauses.push('outputs = ?');
            values.push(JSON.stringify(outputs));
        }
        if (evaluationTrace !== undefined) {
            setClauses.push('evaluation_trace = ?');
            values.push(JSON.stringify(evaluationTrace));
        }
        if (selectedNextStepId !== undefined) {
            setClauses.push('selected_next_step_id = ?');
            values.push(selectedNextStepId);
        }
        if (statusReason !== undefined) {
            setClauses.push('status_reason = ?');
            values.push(statusReason);
        }

        if (setClauses.length === 0) return false;

        values.push(stepId);

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_playbook_run_steps SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    },

    /**
     * Get run step by template step ID.
     * 
     * @param {string} runId - Playbook run ID
     * @param {string} templateStepId - Template step ID
     * @returns {Promise<Object|null>}
     */
    getRunStepByTemplateStepId: async (runId, templateStepId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT rs.*, ts.step_order, ts.step_type, ts.action_type, ts.title, ts.next_step_id, ts.branch_rules
                 FROM ai_playbook_run_steps rs
                 JOIN ai_playbook_template_steps ts ON rs.template_step_id = ts.id
                 WHERE rs.run_id = ? AND rs.template_step_id = ?`,
                [runId, templateStepId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        runId: row.run_id,
                        templateStepId: row.template_step_id,
                        stepOrder: row.step_order,
                        stepType: row.step_type || 'ACTION',
                        actionType: row.action_type,
                        title: row.title,
                        status: row.status,
                        statusReason: row.status_reason,
                        decisionId: row.decision_id,
                        executionId: row.execution_id,
                        resolvedPayload: JSON.parse(row.resolved_payload || '{}'),
                        outputs: JSON.parse(row.outputs || '{}'),
                        selectedNextStepId: row.selected_next_step_id,
                        evaluationTrace: JSON.parse(row.evaluation_trace || '{}'),
                        nextStepId: row.next_step_id,
                        branchRules: row.branch_rules ? JSON.parse(row.branch_rules) : null
                    });
                }
            );
        });
    },

    /**
     * Find the next step in a run based on routing.
     * Uses selected_next_step_id if set, otherwise falls back to step_order.
     * 
     * @param {string} runId - Playbook run ID
     * @param {string} currentTemplateStepId - Current template step ID
     * @returns {Promise<Object|null>} Next run step or null
     */
    getNextStepInRun: async (runId, currentTemplateStepId) => {
        // Get current step to check for explicit routing
        const currentStep = await AIPlaybookService.getRunStepByTemplateStepId(runId, currentTemplateStepId);

        if (currentStep?.selectedNextStepId) {
            // Explicit routing: find run step by template step ID
            return AIPlaybookService.getRunStepByTemplateStepId(runId, currentStep.selectedNextStepId);
        }

        if (currentStep?.nextStepId) {
            // Default next from template
            return AIPlaybookService.getRunStepByTemplateStepId(runId, currentStep.nextStepId);
        }

        // Fallback: linear by step_order
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT rs.*, ts.step_order, ts.step_type, ts.action_type, ts.title
                 FROM ai_playbook_run_steps rs
                 JOIN ai_playbook_template_steps ts ON rs.template_step_id = ts.id
                 WHERE rs.run_id = ? AND ts.step_order > ? AND rs.status = 'PENDING'
                 ORDER BY ts.step_order ASC
                 LIMIT 1`,
                [runId, currentStep?.stepOrder || 0],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        runId: row.run_id,
                        templateStepId: row.template_step_id,
                        stepOrder: row.step_order,
                        stepType: row.step_type || 'ACTION',
                        actionType: row.action_type,
                        title: row.title,
                        status: row.status
                    });
                }
            );
        });
    },

    // ==========================================
    // ENTERPRISE EXTENSIONS
    // Version history, comments, reviews, analytics, clone, bulk, search
    // ==========================================

    /**
     * Create version record for playbook template
     */
    createTemplateVersion: async ({
        templateId,
        version,
        title,
        description,
        triggerSignal,
        templateGraph,
        estimatedDurationMins,
        changedBy = null,
        changeNotes = '',
        changeType = 'UPDATE',
        statusAtVersion = 'DRAFT'
    }) => {
        const id = `aptv-${deps.uuidv4()}`;
        const now = new Date().toISOString();
        const graphJson = typeof templateGraph === 'string' ? templateGraph : JSON.stringify(templateGraph || {});

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO ai_playbook_template_versions (
                    id, template_id, version, title, description, trigger_signal,
                    template_graph, estimated_duration_mins, changed_by, change_notes,
                    change_type, status_at_version, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, templateId, version, title, description, triggerSignal,
                    graphJson, estimatedDurationMins, changedBy, changeNotes,
                    changeType, statusAtVersion, now
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({
                        id,
                        templateId,
                        version,
                        title,
                        description,
                        triggerSignal,
                        templateGraph: templateGraph || {},
                        estimatedDurationMins,
                        changedBy,
                        changeNotes,
                        changeType,
                        statusAtVersion,
                        createdAt: now
                    });
                }
            );
        });
    },

    /**
     * Get version history for a playbook template
     */
    getTemplateVersionHistory: async (templateId) => {
        return new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT * FROM ai_playbook_template_versions 
                 WHERE template_id = ? 
                 ORDER BY version DESC`,
                [templateId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        templateId: row.template_id,
                        version: row.version,
                        title: row.title,
                        description: row.description,
                        triggerSignal: row.trigger_signal,
                        templateGraph: row.template_graph ? JSON.parse(row.template_graph) : null,
                        estimatedDurationMins: row.estimated_duration_mins,
                        changedBy: row.changed_by,
                        changeNotes: row.change_notes,
                        changeType: row.change_type,
                        statusAtVersion: row.status_at_version,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Get specific version of a playbook template
     */
    getTemplateVersion: async (templateId, version) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT * FROM ai_playbook_template_versions 
                 WHERE template_id = ? AND version = ?`,
                [templateId, version],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve({
                        id: row.id,
                        templateId: row.template_id,
                        version: row.version,
                        title: row.title,
                        description: row.description,
                        triggerSignal: row.trigger_signal,
                        templateGraph: row.template_graph ? JSON.parse(row.template_graph) : null,
                        estimatedDurationMins: row.estimated_duration_mins,
                        changedBy: row.changed_by,
                        changeNotes: row.change_notes,
                        changeType: row.change_type,
                        statusAtVersion: row.status_at_version,
                        createdAt: row.created_at
                    });
                }
            );
        });
    },

    /**
     * Restore template to a previous version
     */
    restoreTemplateVersion: async (templateId, version, userId = null) => {
        const template = await AIPlaybookService.getTemplateById(templateId);

        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        if (template.status !== 'DRAFT') {
            throw new Error('Can only restore versions of DRAFT templates');
        }

        const versionToRestore = await AIPlaybookService.getTemplateVersion(templateId, version);

        if (!versionToRestore) {
            throw new Error(`Version ${version} not found`);
        }

        const newVersion = template.version + 1;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE ai_playbook_templates SET 
                    title = ?, description = ?, trigger_signal = ?, template_graph = ?,
                    estimated_duration_mins = ?, version = ?, updated_at = ?
                 WHERE id = ?`,
                [
                    versionToRestore.title,
                    versionToRestore.description,
                    versionToRestore.triggerSignal,
                    JSON.stringify(versionToRestore.templateGraph),
                    versionToRestore.estimatedDurationMins,
                    newVersion,
                    now,
                    templateId
                ],
                async function (err) {
                    if (err) return reject(err);

                    // Create version record for restore
                    await AIPlaybookService.createTemplateVersion({
                        templateId,
                        version: newVersion,
                        title: versionToRestore.title,
                        description: versionToRestore.description,
                        triggerSignal: versionToRestore.triggerSignal,
                        templateGraph: versionToRestore.templateGraph,
                        estimatedDurationMins: versionToRestore.estimatedDurationMins,
                        changedBy: userId,
                        changeNotes: `Restored from version ${version}`,
                        changeType: 'RESTORE',
                        statusAtVersion: 'DRAFT'
                    });

                    const updatedTemplate = await AIPlaybookService.getTemplateById(templateId);
                    resolve(updatedTemplate);
                }
            );
        });
    },

    /**
     * Clone a playbook template
     */
    cloneTemplate: async (templateId, overrides = {}, userId = null) => {
        const template = await AIPlaybookService.getTemplateById(templateId);

        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        const newKey = overrides.key || `${template.key}-copy-${Date.now()}`;
        const newTitle = overrides.title || `${template.title} (Copy)`;

        const cloned = await AIPlaybookService.createDraftTemplate({
            key: newKey,
            title: newTitle,
            description: overrides.description || template.description,
            triggerSignal: template.triggerSignal,
            templateGraph: template.templateGraph,
            estimatedDurationMins: template.estimatedDurationMins
        });

        // Copy steps if they exist
        if (template.steps && template.steps.length > 0) {
            for (const step of template.steps) {
                await AIPlaybookService.addTemplateStep({
                    templateId: cloned.id,
                    stepOrder: step.stepOrder,
                    actionType: step.actionType,
                    title: step.title,
                    description: step.description,
                    payloadTemplate: step.payloadTemplate,
                    isOptional: step.isOptional,
                    waitForPrevious: step.waitForPrevious
                });
            }
        }

        // Log analytics event
        await AIPlaybookService.logAnalyticsEvent({
            contentId: templateId,
            eventType: 'CLONE',
            userId,
            metadata: { clonedToId: cloned.id }
        });

        return cloned;
    },

    /**
     * Log analytics event for playbook template
     */
    logAnalyticsEvent: async ({
        contentId,
        eventType,
        userId = null,
        organizationId = null,
        metadata = {},
        sessionId = null,
        durationMs = null
    }) => {
        const id = `ca-${deps.uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO content_analytics (
                    id, content_id, content_type, event_type, user_id, organization_id,
                    metadata, session_id, duration_ms, created_at
                ) VALUES (?, ?, 'PLAYBOOK_TEMPLATE', ?, ?, ?, ?, ?, ?, ?)`,
                [id, contentId, eventType, userId, organizationId, JSON.stringify(metadata), sessionId, durationMs, now],
                function (err) {
                    if (err) return reject(err);
                    resolve({
                        id,
                        contentId,
                        contentType: 'PLAYBOOK_TEMPLATE',
                        eventType,
                        userId,
                        organizationId,
                        metadata,
                        sessionId,
                        durationMs,
                        createdAt: now
                    });
                }
            );
        });
    },

    /**
     * Get template statistics
     */
    getTemplateStats: async (templateId) => {
        const template = await AIPlaybookService.getTemplateById(templateId);

        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT 
                    COUNT(*) as total_runs,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_runs,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_runs,
                    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_runs,
                    AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
                        THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 
                        ELSE NULL END) as avg_duration_mins
                 FROM ai_playbook_runs WHERE template_id = ?`,
                [templateId],
                (err, stats) => {
                    if (err) return reject(err);

                    const totalRuns = stats?.total_runs || 0;
                    const completedRuns = stats?.completed_runs || 0;

                    resolve({
                        id: templateId,
                        key: template.key,
                        title: template.title,
                        status: template.status,
                        version: template.version || 1,
                        usageCount: template.usageCount || 0,
                        successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : null,
                        avgExecutionTimeMins: stats?.avg_duration_mins ? Math.round(stats.avg_duration_mins) : null,
                        totalRuns,
                        completedRuns,
                        failedRuns: stats?.failed_runs || 0,
                        cancelledRuns: stats?.cancelled_runs || 0
                    });
                }
            );
        });
    },

    /**
     * Get analytics events for a template
     */
    getTemplateAnalytics: async (templateId, { limit = 100, eventType = null, dateFrom = null, dateTo = null } = {}) => {
        const conditions = ['content_id = ?', "content_type = 'PLAYBOOK_TEMPLATE'"];
        const params = [templateId];

        if (eventType) {
            conditions.push('event_type = ?');
            params.push(eventType);
        }

        if (dateFrom) {
            conditions.push('created_at >= ?');
            params.push(dateFrom);
        }

        if (dateTo) {
            conditions.push('created_at <= ?');
            params.push(dateTo);
        }

        return new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT * FROM content_analytics 
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [...params, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        contentId: row.content_id,
                        contentType: row.content_type,
                        eventType: row.event_type,
                        userId: row.user_id,
                        organizationId: row.organization_id,
                        metadata: row.metadata ? JSON.parse(row.metadata) : {},
                        sessionId: row.session_id,
                        durationMs: row.duration_ms,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Search playbook templates
     */
    searchTemplates: async ({
        query = null,
        status = null,
        categoryId = null,
        triggerSignal = null,
        organizationId = null,
        sortBy = 'updated_at',
        sortOrder = 'DESC',
        limit = 50,
        offset = 0
    } = {}) => {
        const conditions = [];
        const params = [];

        if (query) {
            conditions.push('(title LIKE ? OR description LIKE ? OR key LIKE ?)');
            const searchTerm = `%${query}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }

        if (categoryId) {
            conditions.push('category_id = ?');
            params.push(categoryId);
        }

        if (triggerSignal) {
            conditions.push('trigger_signal = ?');
            params.push(triggerSignal);
        }

        if (organizationId) {
            conditions.push('(organization_id = ? OR organization_id IS NULL)');
            params.push(organizationId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const validSortColumns = ['title', 'key', 'created_at', 'updated_at', 'usage_count', 'status'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'updated_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        return new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT * FROM ai_playbook_templates 
                 ${whereClause}
                 ORDER BY ${sortColumn} ${order}
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(t => ({
                        id: t.id,
                        key: t.key,
                        title: t.title,
                        description: t.description,
                        triggerSignal: t.trigger_signal,
                        estimatedDurationMins: t.estimated_duration_mins,
                        templateGraph: t.template_graph ? JSON.parse(t.template_graph) : null,
                        version: t.version || 1,
                        status: t.status || 'DRAFT',
                        categoryId: t.category_id,
                        organizationId: t.organization_id,
                        usageCount: t.usage_count || 0,
                        publishedAt: t.published_at,
                        publishedByUserId: t.published_by_user_id,
                        isActive: !!t.is_active,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at
                    })));
                }
            );
        });
    },

    /**
     * Bulk update templates
     */
    bulkUpdateTemplates: async (templateIds, updates, userId = null) => {
        const results = {
            success: [],
            failed: []
        };

        for (const id of templateIds) {
            try {
                if (updates.status === 'PUBLISHED') {
                    await AIPlaybookService.publishTemplate(id, userId);
                } else if (updates.status === 'DEPRECATED') {
                    await AIPlaybookService.deprecateTemplate(id);
                } else if (updates.categoryId !== undefined) {
                    await new Promise((resolve, reject) => {
                        deps.db.run(
                            'UPDATE ai_playbook_templates SET category_id = ?, updated_at = ? WHERE id = ?',
                            [updates.categoryId, new Date().toISOString(), id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                } else if (updates.isActive !== undefined) {
                    await new Promise((resolve, reject) => {
                        deps.db.run(
                            'UPDATE ai_playbook_templates SET is_active = ?, updated_at = ? WHERE id = ?',
                            [updates.isActive ? 1 : 0, new Date().toISOString(), id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                }
                results.success.push(id);
            } catch (err) {
                results.failed.push({ id, error: err.message });
            }
        }

        return results;
    },

    /**
     * Get tags for a playbook template
     */
    getTemplateTags: async (templateId) => {
        return new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT ct.* FROM content_tags ct
                 JOIN content_tag_mappings ctm ON ct.id = ctm.tag_id
                 WHERE ctm.content_id = ? AND ctm.content_type = 'PLAYBOOK_TEMPLATE'`,
                [templateId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        name: row.name,
                        slug: row.slug,
                        contentType: row.content_type,
                        color: row.color,
                        organizationId: row.organization_id,
                        usageCount: row.usage_count,
                        isActive: !!row.is_active,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Add tag to playbook template
     */
    addTemplateTag: async (templateId, tagId, userId = null) => {
        const id = `ctm-${deps.uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT OR IGNORE INTO content_tag_mappings (id, content_id, content_type, tag_id, created_at, created_by)
                 VALUES (?, ?, 'PLAYBOOK_TEMPLATE', ?, ?, ?)`,
                [id, templateId, tagId, now, userId],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes > 0) {
                        deps.db.run(
                            'UPDATE content_tags SET usage_count = usage_count + 1 WHERE id = ?',
                            [tagId],
                            () => resolve(true)
                        );
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    },

    /**
     * Remove tag from playbook template
     */
    removeTemplateTag: async (templateId, tagId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `DELETE FROM content_tag_mappings 
                 WHERE content_id = ? AND content_type = 'PLAYBOOK_TEMPLATE' AND tag_id = ?`,
                [templateId, tagId],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes > 0) {
                        deps.db.run(
                            'UPDATE content_tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?',
                            [tagId],
                            () => resolve(true)
                        );
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    },

    /**
     * Increment usage count when a template is used
     */
    incrementUsageCount: async (templateId) => {
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            deps.db.run(
                'UPDATE ai_playbook_templates SET usage_count = COALESCE(usage_count, 0) + 1, last_used_at = ? WHERE id = ?',
                [now, templateId],
                function (err) {
                    if (err) return reject(err);
                    resolve(this.changes > 0);
                }
            );
        });
    }
};

export default AIPlaybookService;
