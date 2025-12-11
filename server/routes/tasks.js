const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');
const notificationsRouter = require('./notifications');
const ActivityService = require('../services/activityService');

router.use(verifyToken);

// ==========================================
// GET TASKS (Filtered)
// ==========================================
router.get('/', (req, res) => {
    const orgId = req.user.organizationId;
    const { projectId, status, assigneeId, priority } = req.query;

    let sql = `
        SELECT 
            t.*,
            a.first_name as assignee_first_name,
            a.last_name as assignee_last_name,
            a.avatar_url as assignee_avatar,
            r.first_name as reporter_first_name,
            r.last_name as reporter_last_name,
            r.avatar_url as reporter_avatar,
            p.name as project_name
        FROM tasks t
        LEFT JOIN users a ON t.assignee_id = a.id
        LEFT JOIN users r ON t.reporter_id = r.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.organization_id = ?
    `;
    const params = [orgId];

    // Apply filters
    if (projectId) {
        sql += ` AND t.project_id = ?`;
        params.push(projectId);
    }
    if (status) {
        sql += ` AND t.status = ?`;
        params.push(status);
    }
    if (assigneeId) {
        sql += ` AND t.assignee_id = ?`;
        params.push(assigneeId);
    }
    if (priority) {
        sql += ` AND t.priority = ?`;
        params.push(priority);
    }

    // For regular users, show only tasks assigned to them or reported by them
    // Admins and SuperAdmins see all
    if (req.user.role === 'USER') {
        sql += ` AND (t.assignee_id = ? OR t.reporter_id = ?)`;
        params.push(req.user.id, req.user.id);
    }

    sql += ` ORDER BY 
        CASE t.priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
        END,
        t.due_date ASC,
        t.created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const tasks = rows.map(t => ({
            id: t.id,
            projectId: t.project_id,
            projectName: t.project_name,
            organizationId: t.organization_id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            assigneeId: t.assignee_id,
            assignee: t.assignee_id ? {
                id: t.assignee_id,
                firstName: t.assignee_first_name,
                lastName: t.assignee_last_name,
                avatarUrl: t.assignee_avatar
            } : null,
            reporterId: t.reporter_id,
            reporter: t.reporter_id ? {
                id: t.reporter_id,
                firstName: t.reporter_first_name,
                lastName: t.reporter_last_name,
                avatarUrl: t.reporter_avatar
            } : null,
            dueDate: t.due_date,
            estimatedHours: t.estimated_hours,
            checklist: t.checklist ? JSON.parse(t.checklist) : [],
            attachments: t.attachments ? JSON.parse(t.attachments) : [],
            tags: t.tags ? JSON.parse(t.tags) : [],
            customStatusId: t.custom_status_id,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            completedAt: t.completed_at,
            // Extended Fields
            taskType: t.task_type,
            budgetAllocated: t.budget_allocated,
            budgetSpent: t.budget_spent,
            riskRating: t.risk_rating,
            acceptanceCriteria: t.acceptance_criteria,
            blockingIssues: t.blocking_issues,
            stepPhase: t.step_phase,
            why: t.why
        }));

        res.json(tasks);
    });
});

// ==========================================
// GET SINGLE TASK
// ==========================================
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;

    const sql = `
        SELECT 
            t.*,
            a.first_name as assignee_first_name,
            a.last_name as assignee_last_name,
            a.avatar_url as assignee_avatar,
            r.first_name as reporter_first_name,
            r.last_name as reporter_last_name,
            r.avatar_url as reporter_avatar,
            p.name as project_name
        FROM tasks t
        LEFT JOIN users a ON t.assignee_id = a.id
        LEFT JOIN users r ON t.reporter_id = r.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.id = ? AND t.organization_id = ?
    `;

    db.get(sql, [id, orgId], (err, t) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!t) return res.status(404).json({ error: 'Task not found' });

        const task = {
            id: t.id,
            projectId: t.project_id,
            projectName: t.project_name,
            organizationId: t.organization_id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            assigneeId: t.assignee_id,
            assignee: t.assignee_id ? {
                id: t.assignee_id,
                firstName: t.assignee_first_name,
                lastName: t.assignee_last_name,
                avatarUrl: t.assignee_avatar
            } : null,
            reporterId: t.reporter_id,
            reporter: t.reporter_id ? {
                id: t.reporter_id,
                firstName: t.reporter_first_name,
                lastName: t.reporter_last_name,
                avatarUrl: t.reporter_avatar
            } : null,
            dueDate: t.due_date,
            estimatedHours: t.estimated_hours,
            checklist: t.checklist ? JSON.parse(t.checklist) : [],
            attachments: t.attachments ? JSON.parse(t.attachments) : [],
            tags: t.tags ? JSON.parse(t.tags) : [],
            customStatusId: t.custom_status_id,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            completedAt: t.completed_at,
            // Extended Fields
            taskType: t.task_type,
            budgetAllocated: t.budget_allocated,
            budgetSpent: t.budget_spent,
            riskRating: t.risk_rating,
            acceptanceCriteria: t.acceptance_criteria,
            blockingIssues: t.blocking_issues,
            stepPhase: t.step_phase,
            why: t.why
        };

        res.json(task);
    });
});

// ==========================================
// CREATE TASK
// ==========================================
router.post('/', (req, res) => {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const {
        projectId,
        title,
        description,
        status = 'todo',
        priority = 'medium',
        assigneeId,
        dueDate,
        estimatedHours,
        checklist,
        tags,
        // Extended Fields
        taskType = 'execution',
        budgetAllocated = 0,
        riskRating = 'low',
        acceptanceCriteria,
        stepPhase = 'step3',
        why,
        initiativeId
    } = req.body;

    if (!title) { // Project ID is now optional if Initiative ID is present, but let's keep it required for now or check initiative
        if (!projectId && !initiativeId) {
            return res.status(400).json({ error: 'Title and either ProjectId or InitiativeId are required' });
        }
    }

    // Fallback: if no project_id, maybe we should allow it?
    // Constraints say project_id NOT NULL in schema, so we must provide something or update schema.
    // For now, let's assume UI provides a placeholder project or we update schema (which we didn't).
    // Actually, we didn't touch project_id constraint in `tasks` table, so it remains NOT NULL.
    // We should ensure the frontend sends a projectId or we default it.

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
        INSERT INTO tasks (
            id, project_id, organization_id, title, description, status, priority,
            assignee_id, reporter_id, due_date, estimated_hours, checklist, tags,
            task_type, budget_allocated, risk_rating, acceptance_criteria, step_phase, initiative_id, why,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
        id, projectId, orgId, title, description, status, priority,
        assigneeId || null, userId, dueDate || null, estimatedHours || null,
        checklist ? JSON.stringify(checklist) : null,
        tags ? JSON.stringify(tags) : null,
        taskType, budgetAllocated, riskRating, acceptanceCriteria || '', stepPhase, initiativeId || null, why || '',
        now, now
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Notifications
        if (assigneeId && assigneeId !== userId) {
            notificationsRouter.createNotification(
                assigneeId,
                'task_assigned',
                `New Task Assignment`,
                `You have been assigned to task "${title}"`,
                { entityType: 'task', entityId: id }
            );
        }

        // Log Activity
        ActivityService.log({
            organizationId: orgId,
            userId: userId,
            action: 'created',
            entityType: 'task',
            entityId: id,
            entityName: title,
            newValue: { status, priority, assigneeId }
        });

        res.json({
            id,
            projectId,
            organizationId: orgId,
            title,
            description,
            status,
            priority,
            assigneeId,
            reporterId: userId,
            dueDate,
            estimatedHours,
            checklist: checklist || [],
            tags: tags || [],
            taskType,
            budgetAllocated,
            riskRating,
            stepPhase,
            why,
            createdAt: now,
            updatedAt: now
        });
    });
});

// ==========================================
// UPDATE TASK
// ==========================================
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;
    const {
        title,
        description,
        status,
        priority,
        assigneeId,
        dueDate,
        estimatedHours,
        checklist,
        tags,
        customStatusId,
        // Extended Fields
        taskType,
        budgetAllocated,
        budgetSpent,
        riskRating,
        acceptanceCriteria,
        blockingIssues,
        stepPhase,
        why
    } = req.body;

    // First check if task exists and user has permission
    db.get('SELECT * FROM tasks WHERE id = ? AND organization_id = ?', [id, orgId], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Regular users can only update their own tasks (unless Admin)
        if (req.user.role === 'USER' && task.assignee_id !== req.user.id && task.reporter_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own tasks' });
        }

        // --- DRD LOGIC: PHASE GATING ---
        // If status is changing to 'in_progress' (starting work), check previous phase
        if (status === 'in_progress' && task.status !== 'in_progress') {
            const currentPhase = task.step_phase;
            let requiredPhase = null;
            if (currentPhase === 'pilot') requiredPhase = 'design';
            if (currentPhase === 'rollout') requiredPhase = 'pilot';

            if (requiredPhase && task.initiative_id) {
                const checkSql = `
                    SELECT COUNT(*) as count 
                    FROM tasks 
                    WHERE initiative_id = ? 
                    AND step_phase = ? 
                    AND status != 'completed'
                `;
                db.get(checkSql, [task.initiative_id, requiredPhase], (gateErr, gateRow) => {
                    if (gateErr) return res.status(500).json({ error: gateErr.message });

                    if (gateRow.count > 0) {
                        return res.status(400).json({
                            error: `Cannot start ${currentPhase.toUpperCase()} phase. ${gateRow.count} tasks in ${requiredPhase.toUpperCase()} are not completed.`
                        });
                    }

                    // Proceed with update
                    performUpdate();
                });
                return; // Wait for callback
            }
        }

        // --- DRD LOGIC: STATUS TRANSITIONS ---
        // TODO: Enforce strict transitions if needed (e.g. can't go straight from Not Started to Completed)

        performUpdate();

        function performUpdate() {
            const now = new Date().toISOString();
            const completedAt = status === 'completed' && task.status !== 'completed' ? now : task.completed_at;

            const sql = `
                UPDATE tasks SET
                    title = COALESCE(?, title),
                    description = COALESCE(?, description),
                    status = COALESCE(?, status),
                    priority = COALESCE(?, priority),
                    assignee_id = COALESCE(?, assignee_id),
                    due_date = COALESCE(?, due_date),
                    estimated_hours = COALESCE(?, estimated_hours),
                    checklist = COALESCE(?, checklist),
                    tags = COALESCE(?, tags),
                    custom_status_id = COALESCE(?, custom_status_id),
                    
                    task_type = COALESCE(?, task_type),
                    budget_allocated = COALESCE(?, budget_allocated),
                    budget_spent = COALESCE(?, budget_spent),
                    risk_rating = COALESCE(?, risk_rating),
                    acceptance_criteria = COALESCE(?, acceptance_criteria),
                    blocking_issues = COALESCE(?, blocking_issues),
                    step_phase = COALESCE(?, step_phase),
                    why = COALESCE(?, why),

                    updated_at = ?,
                    completed_at = ?
                WHERE id = ? AND organization_id = ?
            `;

            db.run(sql, [
                title, description, status, priority, assigneeId,
                dueDate, estimatedHours,
                checklist ? JSON.stringify(checklist) : null,
                tags ? JSON.stringify(tags) : null,
                customStatusId,

                taskType, budgetAllocated, budgetSpent, riskRating, acceptanceCriteria, blockingIssues, stepPhase, why,

                now, completedAt, id, orgId
            ], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });

                // Log Activity
                ActivityService.log({
                    organizationId: orgId,
                    userId: req.user.id,
                    action: 'updated',
                    entityType: 'task',
                    entityId: id,
                    entityName: title || 'Task', // Use new title if provided, else fallback (ideal would be old title but we don't have it easily here without another query)
                    newValue: req.body // Log the changes
                });

                res.json({ message: 'Task updated', id, updatedAt: now });
            });
        }
    });
});

// ==========================================
// DELETE TASK
// ==========================================
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;

    // Check permission - only Admin/SuperAdmin or task reporter can delete
    db.get('SELECT reporter_id FROM tasks WHERE id = ? AND organization_id = ?', [id, orgId], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        if (req.user.role === 'USER' && task.reporter_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete tasks you created' });
        }

        // Delete task comments first (cascade)
        db.run('DELETE FROM task_comments WHERE task_id = ?', [id]);

        // Delete task
        db.run('DELETE FROM tasks WHERE id = ? AND organization_id = ?', [id, orgId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Log Activity
            ActivityService.log({
                organizationId: orgId,
                userId: req.user.id,
                action: 'deleted',
                entityType: 'task',
                entityId: id,
                entityName: task.title
            });

            res.json({ message: 'Task deleted' });
        });
    });
});

// ==========================================
// TASK COMMENTS
// ==========================================

// GET Comments for a task
router.get('/:taskId/comments', (req, res) => {
    const { taskId } = req.params;
    const orgId = req.user.organizationId;

    // Verify task belongs to org
    db.get('SELECT id FROM tasks WHERE id = ? AND organization_id = ?', [taskId, orgId], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const sql = `
            SELECT c.*, u.first_name, u.last_name, u.avatar_url
            FROM task_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        `;

        db.all(sql, [taskId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const comments = rows.map(c => ({
                id: c.id,
                taskId: c.task_id,
                userId: c.user_id,
                user: {
                    id: c.user_id,
                    firstName: c.first_name,
                    lastName: c.last_name,
                    avatarUrl: c.avatar_url
                },
                content: c.content,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }));

            res.json(comments);
        });
    });
});

// POST Comment on a task
router.post('/:taskId/comments', (req, res) => {
    const { taskId } = req.params;
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    // Verify task belongs to org
    db.get('SELECT id FROM tasks WHERE id = ? AND organization_id = ?', [taskId, orgId], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `INSERT INTO task_comments (id, task_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sql, [id, taskId, userId, content, now, now], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // TODO: Create notification for @mentions
            // TODO: Log activity

            res.json({
                id,
                taskId,
                userId,
                content,
                createdAt: now,
                updatedAt: now
            });
        });
    });
});

// DELETE Comment
router.delete('/:taskId/comments/:commentId', (req, res) => {
    const { taskId, commentId } = req.params;
    const orgId = req.user.organizationId;
    const userId = req.user.id;

    // Check if user owns the comment or is admin
    db.get('SELECT user_id FROM task_comments WHERE id = ?', [commentId], (err, comment) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (req.user.role === 'USER' && comment.user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        db.run('DELETE FROM task_comments WHERE id = ?', [commentId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Comment deleted' });
        });
    });
});

module.exports = router;
