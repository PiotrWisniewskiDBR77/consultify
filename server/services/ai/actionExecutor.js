/**
 * Action Executor
 * 
 * Executes actions on behalf of the user through AI conversation.
 * Handles navigation, entity creation, form filling, and content generation.
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

// Action types supported by the executor

// Action types supported by the executor
const { v4: uuidv4 } = require('uuid');
const ACTION_TYPES = {
    NAVIGATE: 'navigate',
    CREATE_PROJECT: 'create_project',
    CREATE_INITIATIVE: 'create_initiative',
    CREATE_TASK: 'create_task',
    UPDATE_ASSESSMENT: 'update_assessment',
    FILL_FORM: 'fill_form',
    GENERATE_CONTENT: 'generate_content',
    SHOW_DATA: 'show_data',
    HIGHLIGHT_ELEMENT: 'highlight',
    OPEN_MODAL: 'open_modal',
    TRIGGER_WORKFLOW: 'trigger_workflow',
    TRIGGER_RESEARCH: 'trigger_research'
};

// View mappings for navigation
const VIEW_MAPPINGS = {
    'dashboard': 'USER_DASHBOARD',
    'assessment': 'ASSESSMENT_WIZARD',
    'initiatives': 'INITIATIVES',
    'initiative_detail': 'INITIATIVE_DETAIL',
    'roadmap': 'ROADMAP',
    'reports': 'REPORTS',
    'report_builder': 'REPORT_BUILDER',
    'settings': 'SETTINGS',
    'project_detail': 'PROJECT_DETAIL',
    'chat': 'AI_CHAT'
};

class ActionExecutor {
    constructor(dependencies = {}) {
        this.pendingActions = new Map();
        this.actionHistory = [];

        // Dependency Injection
        this.db = dependencies.db || require('../../database');
        this.intelligentResearch = dependencies.intelligentResearch || require('./intelligentResearch').intelligentResearch;
        this.aiPipeline = dependencies.aiPipeline; // Lazy load if not provided
        this.aiLogger = dependencies.aiLogger || require('./logger').aiLogger;
    }

    /**
     * Execute an action and return the result
     * @param {Object} action - Action to execute
     * @param {Object} context - Execution context
     * @returns {Object} Execution result
     */
    async execute(action, context = {}) {
        const { type, payload, requiresConfirmation = false } = action;
        const { userId, organizationId, projectId } = context;

        const actionId = uuidv4();


        const timestamp = new Date().toISOString();

        if (this.aiLogger) this.aiLogger.info('ActionExecutor', `Executing action: ${type}`, { actionId, payload });

        try {
            // If confirmation required, store pending and return prompt
            if (requiresConfirmation && !action.confirmed) {
                this.pendingActions.set(actionId, {
                    action,
                    context,
                    createdAt: timestamp
                });

                return {
                    status: 'pending_confirmation',
                    actionId,
                    type,
                    message: this.getConfirmationMessage(type, payload),
                    payload: this.sanitizePayload(payload)
                };
            }

            // Execute the action
            let result;
            switch (type) {
                case ACTION_TYPES.NAVIGATE:
                    result = await this.executeNavigate(payload);
                    break;

                case ACTION_TYPES.CREATE_PROJECT:
                    result = await this.executeCreateProject(payload, context);
                    break;

                case ACTION_TYPES.CREATE_INITIATIVE:
                    result = await this.executeCreateInitiative(payload, context);
                    break;

                case ACTION_TYPES.CREATE_TASK:
                    result = await this.executeCreateTask(payload, context);
                    break;

                case ACTION_TYPES.UPDATE_ASSESSMENT:
                    result = await this.executeUpdateAssessment(payload, context);
                    break;

                case ACTION_TYPES.FILL_FORM:
                    result = await this.executeFillForm(payload, context);
                    break;

                case ACTION_TYPES.GENERATE_CONTENT:
                    result = await this.executeGenerateContent(payload, context);
                    break;

                case ACTION_TYPES.SHOW_DATA:
                    result = await this.executeShowData(payload, context);
                    break;

                case ACTION_TYPES.HIGHLIGHT_ELEMENT:
                    result = this.executeHighlight(payload);
                    break;

                case ACTION_TYPES.OPEN_MODAL:
                    result = this.executeOpenModal(payload);
                    break;

                case ACTION_TYPES.TRIGGER_WORKFLOW:
                    result = await this.executeTriggerWorkflow(payload, context);
                    break;

                case ACTION_TYPES.TRIGGER_RESEARCH:
                    result = await this.executeTriggerResearch(payload, context);
                    break;

                default:
                    throw new Error(`Unknown action type: ${type}`);
            }

            // Record in history
            this.actionHistory.push({
                actionId,
                type,
                payload: this.sanitizePayload(payload),
                result: this.sanitizeResult(result),
                timestamp,
                userId
            });

            // Keep history manageable
            if (this.actionHistory.length > 100) {
                this.actionHistory = this.actionHistory.slice(-100);
            }

            return {
                status: 'success',
                actionId,
                type,
                result,
                timestamp
            };

        } catch (error) {
            if (this.aiLogger) this.aiLogger.error('ActionExecutor', `Action failed: ${error.message}`, { actionId, type });

            return {
                status: 'error',
                actionId,
                type,
                error: error.message,
                timestamp
            };
        }
    }

    /**
     * Confirm a pending action
     */
    async confirmAction(actionId, confirmed = true) {
        const pending = this.pendingActions.get(actionId);
        if (!pending) {
            return { status: 'error', error: 'Action not found or expired' };
        }

        this.pendingActions.delete(actionId);

        if (confirmed) {
            return this.execute(
                { ...pending.action, confirmed: true },
                pending.context
            );
        }

        return { status: 'cancelled', actionId };
    }

    // =========================================================================
    // Action Implementations
    // =========================================================================

    /**
     * Navigate to a view
     */
    async executeNavigate(payload) {
        const { view, params = {} } = payload;
        const mappedView = VIEW_MAPPINGS[view.toLowerCase()] || view;

        return {
            type: 'navigate',
            view: mappedView,
            params,
            confirmation: `Navigating to ${view}`
        };
    }

    /**
     * Create a new project
     */
    async executeCreateProject(payload, context) {
        const { name, description, industry, goals = [] } = payload;
        const { userId, organizationId } = context;

        const projectId = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO projects (id, name, description, industry, organization_id, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [projectId, name, description || '', industry || '', organizationId, userId, now, now], function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Record project creation in memory
                aiLogger.info('ActionExecutor', `Project created: ${projectId}`);

                resolve({
                    type: 'entity_created',
                    entity: 'project',
                    data: {
                        id: projectId,
                        name,
                        description,
                        industry
                    },
                    nextAction: {
                        type: 'navigate',
                        view: 'ASSESSMENT_WIZARD',
                        params: { projectId }
                    },
                    message: `Created project "${name}"`
                });
            });
        });
    }

    /**
     * Create a new initiative
     */
    async executeCreateInitiative(payload, context) {
        const {
            name,
            summary,
            hypothesis,
            expectedOutcome,
            axisId,
            priority = 'medium',
            estimatedEffort,
            estimatedBenefit
        } = payload;
        const { userId, organizationId, projectId } = context;

        const initiativeId = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO initiatives (
                    id, project_id, name, summary, hypothesis, expected_outcome,
                    axis_id, priority, estimated_effort, estimated_benefit,
                    status, created_by, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
            `, [
                initiativeId, projectId, name, summary || '', hypothesis || '',
                expectedOutcome || '', axisId || '', priority,
                estimatedEffort || '', estimatedBenefit || '',
                userId, now, now
            ], function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    type: 'entity_created',
                    entity: 'initiative',
                    data: {
                        id: initiativeId,
                        name,
                        summary,
                        priority
                    },
                    message: `Created initiative "${name}"`,
                    suggestions: [
                        'Add success metrics',
                        'Estimate timeline',
                        'Assign owner'
                    ]
                });
            });
        });
    }

    /**
     * Create a task
     */
    async executeCreateTask(payload, context) {
        const {
            title,
            description,
            initiativeId,
            assigneeId,
            dueDate,
            priority = 'medium',
            estimatedHours
        } = payload;
        const { userId, organizationId, projectId } = context;

        const taskId = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO tasks (
                    id, project_id, initiative_id, title, description,
                    assignee_id, due_date, priority, estimated_hours,
                    status, created_by, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?)
            `, [
                taskId, projectId, initiativeId || null, title, description || '',
                assigneeId || null, dueDate || null, priority, estimatedHours || null,
                userId, now, now
            ], function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    type: 'entity_created',
                    entity: 'task',
                    data: {
                        id: taskId,
                        title,
                        priority,
                        status: 'todo'
                    },
                    message: `Created task "${title}"`
                });
            });
        });
    }

    /**
     * Update assessment level for an axis
     */
    async executeUpdateAssessment(payload, context) {
        const { axisId, level, evidence, notes } = payload;
        const { userId, projectId } = context;

        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            // First, check if assessment entry exists
            this.db.get(
                'SELECT id FROM assessment_scores WHERE project_id = ? AND axis_id = ?',
                [projectId, axisId],
                (err, existing) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const query = existing
                        ? `UPDATE assessment_scores SET current_level = ?, evidence = ?, notes = ?, updated_at = ?, updated_by = ? WHERE project_id = ? AND axis_id = ?`
                        : `INSERT INTO assessment_scores (id, project_id, axis_id, current_level, evidence, notes, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                    const params = existing
                        ? [level, evidence || '', notes || '', now, userId, projectId, axisId]
                        : [uuidv4(), projectId, axisId, level, evidence || '', notes || '', now, now, userId, userId];

                    db.run(query, params, function (err2) {
                        if (err2) {
                            reject(err2);
                            return;
                        }

                        resolve({
                            type: 'assessment_updated',
                            axis: axisId,
                            level,
                            message: `Updated ${axisId} to level ${level}`,
                            nextQuestion: null // Will be populated by flow engine
                        });
                    });
                }
            );
        });
    }

    /**
     * Fill a form field
     */
    async executeFillForm(payload, context) {
        const { formId, fieldId, value, explanation } = payload;

        return {
            type: 'form_fill',
            formId,
            fieldId,
            value,
            explanation: explanation || `AI suggested value: ${value}`,
            requiresConfirmation: true
        };
    }

    /**
     * Generate content using AI
     */
    async executeGenerateContent(payload, context) {
        const { contentType, prompt, params = {} } = payload;
        const { userId, organizationId, projectId } = context;

        // Use the AI pipeline to generate content
        try {
            const { aiPipeline } = require('./aiPipeline');

            const result = await aiPipeline.process({
                capability: `generate_${contentType}`,
                prompt,
                userId,
                organizationId,
                projectId,
                ...params
            });

            return {
                type: 'generated_content',
                contentType,
                content: result.content,
                metadata: result.metadata
            };

        } catch (error) {
            if (this.aiLogger) this.aiLogger.error('ActionExecutor', `Content generation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Show data in the UI
     */
    async executeShowData(payload, context) {
        const { dataType, filters = {} } = payload;
        const { projectId, organizationId } = context;

        let data;

        switch (dataType) {
            case 'assessment_scores':
                data = await this.getAssessmentScores(projectId);
                break;
            case 'initiatives':
                data = await this.getInitiatives(projectId);
                break;
            case 'roadmap':
                data = await this.getRoadmap(projectId);
                break;
            default:
                data = null;
        }

        return {
            type: 'show_data',
            dataType,
            data,
            filters
        };
    }

    /**
     * Highlight an element in the UI
     */
    executeHighlight(payload) {
        const { elementId, duration = 3000 } = payload;

        return {
            type: 'highlight',
            elementId,
            duration
        };
    }

    /**
     * Open a modal
     */
    executeOpenModal(payload) {
        const { modalId, data = {} } = payload;

        return {
            type: 'open_modal',
            modalId,
            data
        };
    }

    /**
     * Trigger a workflow
     */
    async executeTriggerWorkflow(payload, context) {
        const { workflowId, params = {} } = payload;
        const { userId, organizationId, projectId } = context;

        if (this.aiLogger) this.aiLogger.info('ActionExecutor', `Triggering workflow: ${workflowId}`);

        // Workflow execution would depend on specific workflows defined
        return {
            type: 'workflow_triggered',
            workflowId,
            status: 'initiated',
            message: `Started workflow: ${workflowId}`
        };
    }

    /**
     * Trigger proactive research
     */
    async executeTriggerResearch(payload, context) {
        const { topic, depth = 'standard', question } = payload;
        const { userId, organizationId, projectId } = context;

        if (this.aiLogger) this.aiLogger.info('ActionExecutor', `Triggering research: ${topic}`);

        try {
            // Trigger deep research
            const researchResult = await this.intelligentResearch.deepResearch(
                question || topic,
                {
                    organizationId,
                    projectId,
                    depth,
                    format: 'markdown'
                }
            );

            return {
                type: 'research_completed',
                topic,
                summary: researchResult.summary,
                keyInsights: researchResult.keyInsights,
                sources: researchResult.sources,
                reportPath: researchResult.reportPath // If generated
            };
        } catch (error) {
            if (this.aiLogger) this.aiLogger.error('ActionExecutor', `Research failed: ${error.message}`);
            throw error;
        }
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    /**
     * Get confirmation message for an action
     */
    getConfirmationMessage(type, payload) {
        const messages = {
            [ACTION_TYPES.CREATE_PROJECT]: `Create project "${payload.name}"?`,
            [ACTION_TYPES.CREATE_INITIATIVE]: `Create initiative "${payload.name}"?`,
            [ACTION_TYPES.CREATE_TASK]: `Create task "${payload.title}"?`,
            [ACTION_TYPES.UPDATE_ASSESSMENT]: `Set ${payload.axisId} to level ${payload.level}?`,
            [ACTION_TYPES.FILL_FORM]: `Fill ${payload.fieldId} with "${payload.value}"?`,
            [ACTION_TYPES.NAVIGATE]: `Navigate to ${payload.view}?`
        };

        return messages[type] || `Confirm action: ${type}?`;
    }

    /**
     * Sanitize payload for storage (remove sensitive data)
     */
    sanitizePayload(payload) {
        if (!payload) return null;

        const sanitized = { ...payload };
        // Remove any sensitive fields
        delete sanitized.password;
        delete sanitized.apiKey;
        delete sanitized.token;

        return sanitized;
    }

    /**
     * Sanitize result for history
     */
    sanitizeResult(result) {
        if (!result) return null;

        const sanitized = { ...result };

        // Truncate large content
        if (sanitized.content && sanitized.content.length > 500) {
            sanitized.content = sanitized.content.substring(0, 500) + '...';
        }

        return sanitized;
    }

    /**
     * Get assessment scores for a project
     */
    async getAssessmentScores(projectId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM assessment_scores WHERE project_id = ?',
                [projectId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get initiatives for a project
     */
    async getInitiatives(projectId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM initiatives WHERE project_id = ? ORDER BY priority DESC, created_at DESC',
                [projectId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get roadmap for a project
     */
    async getRoadmap(projectId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM roadmap_items WHERE project_id = ? ORDER BY quarter, sequence',
                [projectId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get action history
     */
    getHistory(limit = 20) {
        return this.actionHistory.slice(-limit);
    }

    /**
     * Clear pending actions older than specified minutes
     */
    cleanupPendingActions(maxAgeMinutes = 30) {
        const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

        for (const [actionId, pending] of this.pendingActions) {
            if (pending.createdAt < cutoff) {
                this.pendingActions.delete(actionId);
                if (this.aiLogger) this.aiLogger.debug('ActionExecutor', `Cleaned up expired action: ${actionId}`);
            }
        }
    }
}

// Singleton instance
const actionExecutor = new ActionExecutor();

// Periodic cleanup
setInterval(() => {
    actionExecutor.cleanupPendingActions();
}, 10 * 60 * 1000); // Every 10 minutes

module.exports = {
    ActionExecutor,
    actionExecutor,
    ACTION_TYPES,
    VIEW_MAPPINGS
};

