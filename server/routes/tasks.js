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
    if (req.query.initiativeId) {
        sql += ` AND t.initiative_id = ?`;
        params.push(req.query.initiativeId);
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
            why: t.why,
            roadmapInitiativeId: t.roadmap_initiative_id,
            kpiId: t.kpi_id,
            raidItemId: t.raid_item_id,
            assignees: t.assignees ? JSON.parse(t.assignees) : []
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
            why: t.why,
            roadmapInitiativeId: t.roadmap_initiative_id,
            kpiId: t.kpi_id,
            raidItemId: t.raid_item_id,
            assignees: t.assignees ? JSON.parse(t.assignees) : []
        };

        res.json(task);
    });
});

// ==========================================
// CREATE TASK
// ==========================================
router.post('/', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const userId = req.user.id;
        const {
            projectId, title, description,
            status, priority, assigneeId,
            dueDate, estimatedHours, tags,
            taskType, initiativeId, why,
            // New Strategic Fields
            expectedOutcome, decisionImpact,
            evidenceRequired, strategicContribution,
            // My Work Fields
            roadmapInitiativeId, kpiId, raidItemId, assignees
        } = req.body;

        const id = uuidv4();
        const now = new Date().toISOString();

        // Default values for new fields
        const finalStatus = status || 'todo';
        const finalPriority = priority || 'medium';
        const finalTaskType = taskType || 'execution';
        const finalExpectedOutcome = expectedOutcome || '';
        const finalDecisionImpact = decisionImpact ? JSON.stringify(decisionImpact) : '{}';
        const finalEvidenceRequired = evidenceRequired ? JSON.stringify(evidenceRequired) : '[]';
        const finalStrategicContribution = strategicContribution ? JSON.stringify(strategicContribution) : '[]';

        const stmt = db.prepare(`
            INSERT INTO tasks (
                id, project_id, organization_id, title, description,
                status, priority, assignee_id, reporter_id,
                due_date, estimated_hours, tags,
                task_type, initiative_id, why,
                expected_outcome, decision_impact, evidence_required, strategic_contribution,
                roadmap_initiative_id, kpi_id, raid_item_id, assignees,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id, projectId, orgId, title, description,
            finalStatus, finalPriority, assigneeId, userId,
            dueDate, estimatedHours, tags ? JSON.stringify(tags) : '[]',
            finalTaskType, initiativeId, why,
            finalExpectedOutcome, finalDecisionImpact, finalEvidenceRequired, finalStrategicContribution,
            roadmapInitiativeId, kpiId, raidItemId, assignees ? JSON.stringify(assignees) : '[]',
            now, now,
            function (err) {
                if (err) {
                    console.error("Error creating task:", err.message);
                    return res.status(500).json({ error: err.message });
                }

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
                    newValue: req.body
                });

                // Fetch created task
                db.get(`SELECT * FROM tasks WHERE id = ?`, [id], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json(row); // Use raw row or parse function if available
                });
            }
        );
        stmt.finalize();

    } catch (e) {
        console.error("Server error creating task:", e);
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// UPDATE TASK
// ==========================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Allowed fields to update
    const allowedFields = [
        'title', 'description', 'status', 'priority',
        'assignee_id', 'due_date', 'estimated_hours',
        'checklist', 'attachments', 'tags', 'custom_status_id',
        'task_type', 'initiative_id', 'why',
        'expected_outcome', 'decision_impact', 'evidence_required',
        'evidence_items', 'strategic_contribution', 'ai_insight',
        'roadmap_initiative_id', 'kpi_id', 'raid_item_id', 'assignees'
    ];

    // Helper to map generic names to DB column names if mixed
    const fieldMap = {
        assigneeId: 'assignee_id',
        projectId: 'project_id',
        dueDate: 'due_date',
        estimatedHours: 'estimated_hours',
        customStatusId: 'custom_status_id',
        taskType: 'task_type',
        initiativeId: 'initiative_id',
        expectedOutcome: 'expected_outcome',
        decisionImpact: 'decision_impact',
        evidenceRequired: 'evidence_required',
        evidenceItems: 'evidence_items',
        strategicContribution: 'strategic_contribution',
        aiInsight: 'ai_insight',
        roadmapInitiativeId: 'roadmap_initiative_id',
        kpiId: 'kpi_id',
        raidItemId: 'raid_item_id',
        assignees: 'assignees'
    };

    db.get(`SELECT * FROM tasks WHERE id = ? AND organization_id = ?`, [id, req.user.organizationId], (err, currentTask) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!currentTask) return res.status(404).json({ error: 'Task not found' });

        const sqlUpdates = [];
        const params = [];
        const historyEntries = [];

        Object.keys(updates).forEach(key => {
            const dbKey = fieldMap[key] || key;
            if (allowedFields.includes(dbKey)) {
                let value = updates[key];

                // Serialize JSON fields
                if (['checklist', 'attachments', 'tags', 'decision_impact', 'evidence_required', 'evidence_items', 'strategic_contribution', 'ai_insight', 'assignees'].includes(dbKey)) {
                    if (typeof value === 'object') value = JSON.stringify(value);
                }

                // Check for change to log
                const oldValue = currentTask[dbKey];
                // Simple equality check (loose for numbers/strings)
                if (value != oldValue) {
                    sqlUpdates.push(`${dbKey} = ?`);
                    params.push(value);

                    // Add to history log
                    historyEntries.push({
                        taskId: id,
                        field: dbKey,
                        oldValue: oldValue ? String(oldValue) : '',
                        newValue: value ? String(value) : '',
                        changedBy: userId
                    });
                }
            }
        });

        if (sqlUpdates.length === 0) {
            return res.json(currentTask);
        }

        // Special handling for completion
        if (updates.status === 'done' && currentTask.status !== 'done') {
            sqlUpdates.push(`completed_at = ?`);
            params.push(new Date().toISOString());
        }

        sqlUpdates.push(`updated_at = ?`);
        params.push(new Date().toISOString());

        const sql = `UPDATE tasks SET ${sqlUpdates.join(', ')} WHERE id = ?`;
        params.push(id);

        db.run(sql, params, function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Insert history logs asynchronously
            if (historyEntries.length > 0) {
                const historyStmt = db.prepare(`INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)`);
                historyEntries.forEach(entry => {
                    historyStmt.run(uuidv4(), entry.taskId, entry.field, entry.oldValue, entry.newValue, entry.changedBy);
                });
                historyStmt.finalize();
            }

            // Log Activity
            ActivityService.log({
                organizationId: req.user.organizationId,
                userId: userId,
                action: 'updated',
                entityType: 'task',
                entityId: id,
                entityName: currentTask.title, // Use old title
                newValue: updates
            });

            // Return updated task
            db.get(`SELECT * FROM tasks WHERE id = ?`, [id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(row);
            });
        });
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
