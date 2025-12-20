const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * AI Playbook Service
 * Step 10: Multi-Step Action Plans
 * 
 * Manages playbook templates, runs, and step execution.
 */
const AIPlaybookService = {
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

        const id = `apt-${uuidv4()}`;

        return new Promise((resolve, reject) => {
            db.run(
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
            db.get(`SELECT * FROM ai_playbook_templates WHERE key = ?`, [key], async (err, template) => {
                if (err) return reject(err);
                if (!template) return resolve(null);

                // Fetch steps
                db.all(
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
            db.all(sql, [], (err, rows) => {
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
        const id = `aps-${uuidv4()}`;
        const payloadJson = JSON.stringify(payloadTemplate || {});

        return new Promise((resolve, reject) => {
            db.run(
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

        const id = `apt-${uuidv4()}`;
        const graphJson = typeof templateGraph === 'string' ? templateGraph : JSON.stringify(templateGraph || {});

        return new Promise((resolve, reject) => {
            db.run(
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
            db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], (err, row) => {
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
            db.run(`UPDATE ai_playbook_templates SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
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
            db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], (err, row) => {
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
            db.run(
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
            db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!template) throw new Error(`Template ${id} not found`);

        return new Promise((resolve, reject) => {
            db.run(
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
            db.all(sql, params, (err, rows) => {
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
            db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [id], async (err, template) => {
                if (err) return reject(err);
                if (!template) return resolve(null);

                // Fetch steps
                db.all(
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
        const runId = `apr-${uuidv4()}`;
        const correlationId = `corr-${uuidv4()}`;
        const contextJson = JSON.stringify(contextSnapshot);

        // Get template steps
        const template = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_playbook_templates WHERE id = ?`, [templateId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!template) throw new Error(`Template ${templateId} not found`);

        const steps = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ai_playbook_template_steps WHERE template_id = ? ORDER BY step_order`, [templateId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Create run
        await new Promise((resolve, reject) => {
            db.run(
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
            const stepId = `aprs-${uuidv4()}`;
            const resolvedPayload = AIPlaybookService.resolvePayloadTemplate(
                JSON.parse(step.payload_template || '{}'),
                contextSnapshot
            );

            await new Promise((resolve, reject) => {
                db.run(
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
            db.get(`SELECT r.*, t.key as template_key, t.title as template_title
                    FROM ai_playbook_runs r
                    JOIN ai_playbook_templates t ON r.template_id = t.id
                    WHERE r.id = ?`, [runId], async (err, run) => {
                if (err) return reject(err);
                if (!run) return resolve(null);

                db.all(
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
            db.run(`UPDATE ai_playbook_runs SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
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
            db.run(`UPDATE ai_playbook_run_steps SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
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
            db.run(`UPDATE ai_playbook_run_steps SET ${setClauses.join(', ')} WHERE id = ?`, values, function (err) {
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
            db.get(
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
            db.get(
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
    }
};

module.exports = AIPlaybookService;
