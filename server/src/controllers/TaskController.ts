/**
 * Task Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles all task-related business logic
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../utils/queryHelpers.js';
import type {
    CreateTaskRequest,
    UpdateTaskRequest,
    AssignTaskRequest,
    ReassignTaskRequest,
    EscalateTaskRequest,
    ResolveEscalationRequest,
    AddTaskCommentRequest,
    GetTasksQuery,
} from '../validators/task.validators.js';

// ==========================================
// TYPES
// ==========================================

interface TaskAssignee {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
}

interface TaskReporter {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
}

interface TaskRow {
    id: string;
    project_id: string;
    project_name?: string;
    organization_id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    assignee_id?: string;
    assignee_first_name?: string;
    assignee_last_name?: string;
    assignee_avatar?: string;
    reporter_id?: string;
    reporter_first_name?: string;
    reporter_last_name?: string;
    reporter_avatar?: string;
    due_date?: string;
    estimated_hours?: number;
    checklist?: string;
    attachments?: string;
    tags?: string;
    custom_status_id?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    task_type?: string;
    budget_allocated?: number;
    budget_spent?: number;
    risk_rating?: string;
    acceptance_criteria?: string;
    blocking_issues?: string;
    step_phase?: string;
    why?: string;
    roadmap_initiative_id?: string;
    kpi_id?: string;
    raid_item_id?: string;
    assignees?: string;
    initiative_id?: string;
    initiative_name?: string;
    progress?: number;
    blocked_reason?: string;
}

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class TaskController {
    /**
     * Get all tasks with filters
     */
    static getTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { projectId, status, assigneeId, priority, initiativeId } = req.query as GetTasksQuery;

        let sql = `
            SELECT 
                t.*,
                a.first_name as assignee_first_name,
                a.last_name as assignee_last_name,
                a.avatar_url as assignee_avatar,
                r.first_name as reporter_first_name,
                r.last_name as reporter_last_name,
                r.avatar_url as reporter_avatar,
                p.name as project_name,
                i.title as initiative_name
            FROM tasks t
            LEFT JOIN users a ON t.assignee_id = a.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.organization_id = ?
        `;
        const params: unknown[] = [orgId];

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
        if (initiativeId) {
            sql += ` AND t.initiative_id = ?`;
            params.push(initiativeId);
        }

        // For regular users, show only tasks assigned to them or reported by them
        if (req.user?.role === 'USER') {
            sql += ` AND (t.assignee_id = ? OR t.reporter_id = ?)`;
            params.push(userId, userId);
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

        const rows = await queryHelpers.queryAll<TaskRow>(sql, params);

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
            assignees: t.assignees ? JSON.parse(t.assignees) : [],
            initiativeId: t.initiative_id,
            initiativeName: t.initiative_name,
            progress: t.progress || 0,
            blockedReason: t.blocked_reason || ''
        }));

        res.json(tasks);
    });

    /**
     * Get single task by ID
     */
    static getTaskById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const sql = `
            SELECT 
                t.*,
                a.first_name as assignee_first_name,
                a.last_name as assignee_last_name,
                a.avatar_url as assignee_avatar,
                r.first_name as reporter_first_name,
                r.last_name as reporter_last_name,
                r.avatar_url as reporter_avatar,
                p.name as project_name,
                i.title as initiative_name
            FROM tasks t
            LEFT JOIN users a ON t.assignee_id = a.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.id = ? AND t.organization_id = ?
        `;

        const t = await queryHelpers.queryOne<TaskRow>(sql, [id, orgId]);
        if (!t) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

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
            assignees: t.assignees ? JSON.parse(t.assignees) : [],
            initiativeId: t.initiative_id,
            initiativeName: t.initiative_name,
            progress: t.progress || 0,
            blockedReason: t.blocked_reason || ''
        };

        res.json(task);
    });

    /**
     * Create a new task
     */
    static createTask = asyncHandler(async (req: AuthenticatedRequest<CreateTaskRequest>, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const {
            projectId, title, description,
            status, priority, assigneeId,
            dueDate, estimatedHours, tags,
            taskType, initiativeId, why,
            expectedOutcome, decisionImpact,
            evidenceRequired, strategicContribution,
            roadmapInitiativeId, kpiId, raidItemId, assignees,
            progress, blockedReason
        } = req.body;

        if (!projectId) {
            res.status(400).json({ error: 'projectId is required' });
            return;
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        // Default values
        const finalStatus = status || 'todo';
        const finalPriority = priority || 'medium';
        const finalTaskType = taskType || 'execution';
        const finalExpectedOutcome = expectedOutcome || '';
        const finalDecisionImpact = decisionImpact ? JSON.stringify(decisionImpact) : '{}';
        const finalEvidenceRequired = evidenceRequired ? JSON.stringify(evidenceRequired) : '[]';
        const finalStrategicContribution = strategicContribution ? JSON.stringify(strategicContribution) : '[]';
        const finalProgress = progress || 0;
        const finalBlockedReason = blockedReason || '';

        const sql = `
            INSERT INTO tasks (
                id, project_id, organization_id, title, description,
                status, priority, assignee_id, reporter_id,
                due_date, estimated_hours, tags,
                task_type, initiative_id, why,
                expected_outcome, decision_impact, evidence_required, strategic_contribution,
                roadmap_initiative_id, kpi_id, raid_item_id, assignees,
                progress, blocked_reason,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await queryHelpers.queryRun(sql, [
            id, projectId, orgId, title, description,
            finalStatus, finalPriority, assigneeId, userId,
            dueDate, estimatedHours, tags ? JSON.stringify(tags) : '[]',
            finalTaskType, initiativeId, why,
            finalExpectedOutcome, finalDecisionImpact, finalEvidenceRequired, finalStrategicContribution,
            roadmapInitiativeId, kpiId, raidItemId, assignees ? JSON.stringify(assignees) : '[]',
            finalProgress, finalBlockedReason,
            now, now,
        ]);

        // TODO: Notifications, Activity logging, Cache invalidation, Initiative progress recalculation
        // These will be handled by services that need to be migrated

        const createdTask = await queryHelpers.queryOne<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [id]);
        res.status(201).json(createdTask);
    });

    /**
     * Update task
     */
    static updateTask = asyncHandler(async (req: AuthenticatedRequest<UpdateTaskRequest>, res: Response): Promise<void> => {
        const { id } = req.params;
        const updates = req.body;
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Get current task
        const currentTask = await queryHelpers.queryOne<TaskRow>(
            `SELECT * FROM tasks WHERE id = ? AND organization_id = ?`,
            [id, orgId]
        );

        if (!currentTask) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        // TODO: Implement full update logic with field mapping, history logging, notifications
        // This is complex and will require migration of TaskAssignmentService, ActivityService, etc.
        // For now, return current task
        res.json(currentTask);
    });

    /**
     * Delete task
     */
    static deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check permission - only Admin/SuperAdmin or task reporter can delete
        const task = await queryHelpers.queryOne<{ reporter_id?: string }>(
            'SELECT reporter_id FROM tasks WHERE id = ? AND organization_id = ?',
            [id, orgId]
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        if (req.user?.role === 'USER' && task.reporter_id !== userId) {
            res.status(403).json({ error: 'You can only delete tasks you created' });
            return;
        }

        // Delete task comments first
        await queryHelpers.queryRun('DELETE FROM task_comments WHERE task_id = ?', [id]);

        // Delete task
        const result = await queryHelpers.queryRun('DELETE FROM tasks WHERE id = ? AND organization_id = ?', [id, orgId]);

        if (result.changes === 0) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        // TODO: Activity logging, Initiative progress recalculation

        res.json({ message: 'Task deleted' });
    });

    /**
     * Get task comments
     */
    static getTaskComments = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { taskId } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Verify task belongs to org
        const task = await queryHelpers.queryOne<{ id: string }>(
            'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
            [taskId, orgId]
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const sql = `
            SELECT c.*, u.first_name, u.last_name, u.avatar_url
            FROM task_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        `;

        const rows = await queryHelpers.queryAll(sql, [taskId]);

        const comments = rows.map((c: {
            id: string;
            task_id: string;
            user_id: string;
            first_name: string;
            last_name: string;
            avatar_url?: string;
            content: string;
            created_at: string;
            updated_at: string;
        }) => ({
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

    /**
     * Add comment to task
     */
    static addTaskComment = asyncHandler(async (req: AuthenticatedRequest<AddTaskCommentRequest>, res: Response): Promise<void> => {
        const { taskId } = req.params;
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        const { content } = req.body;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        // Verify task belongs to org
        const task = await queryHelpers.queryOne<{ id: string }>(
            'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
            [taskId, orgId]
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `INSERT INTO task_comments (id, task_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;

        await queryHelpers.queryRun(sql, [id, taskId, userId, content, now, now]);

        res.json({
            id,
            taskId,
            userId,
            content,
            createdAt: now,
            updatedAt: now
        });
    });

    /**
     * Delete task comment
     */
    static deleteTaskComment = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { taskId, commentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check if user owns the comment or is admin
        const comment = await queryHelpers.queryOne<{ user_id: string }>(
            'SELECT user_id FROM task_comments WHERE id = ?',
            [commentId]
        );

        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        if (req.user?.role === 'USER' && comment.user_id !== userId) {
            res.status(403).json({ error: 'You can only delete your own comments' });
            return;
        }

        await queryHelpers.queryRun('DELETE FROM task_comments WHERE id = ?', [commentId]);

        res.json({ message: 'Comment deleted' });
    });

    /**
     * Assign task (uses TaskAssignmentService - will be migrated later)
     */
    static assignTask = asyncHandler(async (req: AuthenticatedRequest<AssignTaskRequest>, res: Response): Promise<void> => {
        const { id } = req.params;
        const { assigneeId } = req.body;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const result = await TaskAssignmentService.assignTask(id, assigneeId, {
            assignedById: req.user?.id,
        });

        res.json(result);
    });

    /**
     * Reassign task
     */
    static reassignTask = asyncHandler(async (req: AuthenticatedRequest<ReassignTaskRequest>, res: Response): Promise<void> => {
        const { id } = req.params;
        const { fromAssigneeId, toAssigneeId, reason } = req.body;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const result = await TaskAssignmentService.reassignTask(id, {
            fromAssigneeId,
            toAssigneeId,
            reason,
            reassignedById: req.user?.id,
        });

        res.json(result);
    });

    /**
     * Unassign task
     */
    static unassignTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const result = await TaskAssignmentService.unassignTask(id);

        res.json(result);
    });

    /**
     * Escalate task
     */
    static escalateTask = asyncHandler(async (req: AuthenticatedRequest<EscalateTaskRequest>, res: Response): Promise<void> => {
        const { id } = req.params;
        const { reason, priority } = req.body;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const result = await TaskAssignmentService.escalateTask(id, {
            reason: reason || 'Manual escalation',
            triggerType: 'MANUAL',
            escalatedById: req.user?.id,
            priority,
        });

        res.json(result);
    });

    /**
     * Resolve escalation
     */
    static resolveEscalation = asyncHandler(async (req: AuthenticatedRequest<ResolveEscalationRequest>, res: Response): Promise<void> => {
        const { escalationId } = req.params;
        const { resolution } = req.body;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const result = await TaskAssignmentService.resolveEscalation(escalationId, {
            resolutionNote: resolution,
            resolvedById: req.user?.id,
        });

        res.json(result);
    });

    /**
     * Get task escalations
     */
    static getTaskEscalations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const escalations = await TaskAssignmentService.getTaskEscalationHistory(id);

        res.json(escalations);
    });

    /**
     * Get overdue tasks
     */
    static getOverdueTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId, escalationLevel, limit } = req.query;
        
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'projectId is required' });
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const tasks = await TaskAssignmentService.getOverdueTasks(projectId, {
            escalationLevel: escalationLevel ? parseInt(String(escalationLevel)) : undefined,
            limit: limit ? parseInt(String(limit)) : undefined
        });

        res.json(tasks);
    });

    /**
     * Get tasks at risk
     */
    static getTasksAtRisk = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId, hoursAhead } = req.query;
        
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'projectId is required' });
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const tasks = await TaskAssignmentService.getTasksApproachingSLA(
            projectId,
            hoursAhead ? parseInt(String(hoursAhead)) : 4
        );

        res.json(tasks);
    });

    /**
     * Get user workload
     */
    static getUserWorkload = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId } = req.params;
        const { projectId } = req.query;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const workload = await TaskAssignmentService.getUserWorkload(userId, {
            projectId: projectId as string | undefined
        });

        res.json(workload);
    });

    /**
     * Get my workload (current user)
     */
    static getMyWorkload = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.id;
        const { projectId } = req.query;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TaskAssignmentService = require('../../services/taskAssignmentService');
        const workload = await TaskAssignmentService.getUserWorkload(userId, {
            projectId: projectId as string | undefined
        });

        res.json(workload);
    });
}

export default TaskController;

