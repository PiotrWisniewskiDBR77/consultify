/**
 * Task Advisor API Routes
 * 
 * Endpoints for the Virtual PMO Coach functionality:
 * - Break down tasks into subtasks
 * - Unblock stuck tasks
 * - Review task descriptions
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { taskAdvisorService } = require('../services/ai/taskAdvisorService');
const { aiLogger } = require('../services/ai/logger');
const db = require('../database');

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/task-advisor/:taskId/break-down
 * Break down a task into subtasks
 */
router.post('/:taskId/break-down', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { projectContext } = req.body;

        // Get task details
        const task = await taskAdvisorService.getTask(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get project details
        const project = await getProject(task.project_id);

        const result = await taskAdvisorService.breakDown(task, {
            projectId: task.project_id,
            userId: req.user.id,
            organizationId: req.user.organizationId,
            projectName: project?.name || task.project_name,
            projectContext: projectContext || project?.context_data || ''
        });

        if (result.success) {
            res.json({
                success: true,
                taskId,
                subtasks: result.subtasks,
                reasoning: result.reasoning,
                draftCreated: result.draftCreated
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        aiLogger.error('TaskAdvisorAPI', `break-down error: ${error.message}`);
        res.status(500).json({ error: 'Failed to break down task' });
    }
});

/**
 * POST /api/task-advisor/:taskId/unblock
 * Get suggestions to unblock a task
 */
router.post('/:taskId/unblock', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { blockerDescription, duration, previousAttempts, additionalContext } = req.body;

        if (!blockerDescription) {
            return res.status(400).json({ error: 'blockerDescription is required' });
        }

        // Get task details
        const task = await taskAdvisorService.getTask(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get project details
        const project = await getProject(task.project_id);
        const teamSize = await getProjectTeamSize(task.project_id);

        const result = await taskAdvisorService.unblock(
            task,
            {
                description: blockerDescription,
                duration: duration || 'Unknown',
                previousAttempts: previousAttempts || 'None documented',
                additionalContext
            },
            {
                projectId: task.project_id,
                userId: req.user.id,
                organizationId: req.user.organizationId,
                projectName: project?.name || task.project_name,
                teamSize: teamSize || 'Unknown'
            }
        );

        if (result.success) {
            res.json({
                success: true,
                taskId,
                rootCause: result.rootCause,
                recommendations: result.recommendations,
                contingencyPlan: result.contingencyPlan,
                escalationNeeded: result.escalationNeeded,
                reasoning: result.reasoning
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        aiLogger.error('TaskAdvisorAPI', `unblock error: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate unblock suggestions' });
    }
});

/**
 * POST /api/task-advisor/:taskId/review
 * Review a task description
 */
router.post('/:taskId/review', async (req, res) => {
    try {
        const { taskId } = req.params;

        // Get task details
        const task = await taskAdvisorService.getTask(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get project and initiative details
        const project = await getProject(task.project_id);
        const initiative = task.initiative_id ? await getInitiative(task.initiative_id) : null;

        const result = await taskAdvisorService.review(task, {
            projectId: task.project_id,
            userId: req.user.id,
            organizationId: req.user.organizationId,
            projectName: project?.name || task.project_name,
            initiativeName: initiative?.name || 'No initiative'
        });

        if (result.success) {
            res.json({
                success: true,
                taskId,
                scores: result.scores,
                overallScore: result.overallScore,
                strengths: result.strengths,
                improvements: result.improvements,
                suggestedTitle: result.suggestedTitle,
                suggestedDescription: result.suggestedDescription
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        aiLogger.error('TaskAdvisorAPI', `review error: ${error.message}`);
        res.status(500).json({ error: 'Failed to review task' });
    }
});

/**
 * POST /api/task-advisor/:taskId/apply-subtasks
 * Apply generated subtasks to a task (create actual subtasks)
 */
router.post('/:taskId/apply-subtasks', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { subtasks, draftId } = req.body;

        if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
            return res.status(400).json({ error: 'subtasks array is required' });
        }

        // Get parent task
        const parentTask = await taskAdvisorService.getTask(taskId);
        if (!parentTask) {
            return res.status(404).json({ error: 'Parent task not found' });
        }

        // Create subtasks
        const createdSubtasks = [];
        for (let i = 0; i < subtasks.length; i++) {
            const subtask = subtasks[i];
            const id = require('uuid').v4();

            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO tasks 
                     (id, project_id, initiative_id, title, description, status, priority, 
                      parent_task_id, estimated_hours, created_by, created_at, updated_at, sort_order)
                     VALUES (?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
                    [
                        id,
                        parentTask.project_id,
                        parentTask.initiative_id,
                        subtask.title,
                        subtask.description,
                        subtask.priority || 'MEDIUM',
                        taskId, // parent_task_id
                        subtask.estimatedHours || null,
                        req.user.id,
                        i
                    ],
                    (err) => {
                        if (err) reject(err);
                        else {
                            createdSubtasks.push({ id, ...subtask });
                            resolve();
                        }
                    }
                );
            });
        }

        // If draft provided, approve it
        if (draftId) {
            const { draftService } = require('../services/ai/draftService');
            await draftService.approveDraft(draftId, {
                reviewedBy: req.user.id,
                notes: `Applied ${createdSubtasks.length} subtasks`
            });
        }

        res.json({
            success: true,
            parentTaskId: taskId,
            subtasksCreated: createdSubtasks.length,
            subtasks: createdSubtasks
        });

    } catch (error) {
        aiLogger.error('TaskAdvisorAPI', `apply-subtasks error: ${error.message}`);
        res.status(500).json({ error: 'Failed to apply subtasks' });
    }
});

// Helper functions
async function getProject(projectId) {
    if (!projectId) return null;
    return new Promise((resolve) => {
        db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
            resolve(err ? null : row);
        });
    });
}

async function getInitiative(initiativeId) {
    if (!initiativeId) return null;
    return new Promise((resolve) => {
        db.get('SELECT * FROM initiatives WHERE id = ?', [initiativeId], (err, row) => {
            resolve(err ? null : row);
        });
    });
}

async function getProjectTeamSize(projectId) {
    if (!projectId) return null;
    return new Promise((resolve) => {
        db.get(
            'SELECT COUNT(DISTINCT assignee_id) as team_size FROM tasks WHERE project_id = ? AND assignee_id IS NOT NULL',
            [projectId],
            (err, row) => {
                resolve(err ? null : row?.team_size);
            }
        );
    });
}

module.exports = router;

