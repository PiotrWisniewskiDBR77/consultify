const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const ActivityService = require('../../services/activityService');
const InitiativeService = require('../../services/initiativeService');

/**
 * TaskExecutor
 * Executes TASK_CREATE action.
 */
const TaskExecutor = {
    /**
     * Executes the task creation.
     * @param {Object} payload - The action payload.
     * @param {Object} metadata - Execution context (userId, organizationId).
     */
    execute: async (payload, metadata) => {
        const { entity_id, title, description, due_date, priority, assignee_id } = payload;
        const { userId, organizationId } = metadata;

        if (!title) throw new Error('Task title is required');

        // Note: entity_id might be the initiativeId or projectId
        // Based on mapper, it's often the entity that triggered the signal.
        // For USER_AT_RISK, it's the userId. 
        // We'll need to figure out which project/initiative to link it to.
        // For now, we'll try to find a default project for the org if not provided.

        let projectId = payload.project_id;
        if (!projectId) {
            const project = await new Promise((resolve, reject) => {
                db.get(`SELECT id FROM projects WHERE organization_id = ? LIMIT 1`, [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            projectId = project?.id;
        }

        if (!projectId) throw new Error('No project found to link the task to');

        const taskId = uuidv4();
        const now = new Date().toISOString();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO tasks (
                    id, project_id, organization_id, title, description, 
                    status, priority, assignee_id, reporter_id, 
                    due_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    taskId, projectId, organizationId, title, description || '',
                    'todo', priority || 'medium', assignee_id || userId, userId,
                    due_date || null, now, now
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Log Activity
        ActivityService.log({
            organizationId,
            userId,
            action: 'created',
            entityType: 'task',
            entityId: taskId,
            entityName: title,
            newValue: { taskId, title, projectId }
        });

        // If it's linked to an initiative, recalculate
        if (payload.initiative_id) {
            InitiativeService.recalculateProgress(payload.initiative_id).catch(console.error);
        }

        return {
            success: true,
            taskId,
            title,
            message: `Task "${title}" created successfully in project ${projectId}`
        };
    }
};

module.exports = TaskExecutor;
