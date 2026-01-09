// @ts-nocheck
/**
 * Task Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all task-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import ActivityService from '../services/ActivityService.js';
import NotificationService from '../services/NotificationService.js';
import { PMO_DOMAIN_IDS } from '../services/pmoDomainRegistry.js';
import TaskAssignmentService from '../services/taskAssignmentService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type {
    AddTaskCommentRequest,
    AssignTaskRequest,
    CreateTaskRequest,
    EscalateTaskRequest,
    GetTasksQuery,
    ReassignTaskRequest,
    ResolveEscalationRequest,
    UpdateTaskRequest,
} from '../validators/task.validators.js';

const ESCALATION_TRIGGERS = {
    SLA_BREACH: 'SLA_BREACH',
    BLOCKED: 'BLOCKED',
    MANUAL: 'MANUAL',
    PRIORITY_CHANGE: 'PRIORITY_CHANGE',
} as const;

// ==========================================
// TYPES
// ==========================================

type SQLParam = string | number | boolean | null | undefined;

interface CommentRow {
    id: string;
    task_id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    content: string;
    created_at: string;
    updated_at: string;
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
    // SLA / Escalation
    sla_hours?: number;
    sla_due_at?: string;
    escalation_level?: number;
    escalated_to_id?: string;
    last_escalated_at?: string;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Parse multilingual text and return translation for user's language
 * @param text - JSON string with translations {pl: '...', en: '...', ...} or plain string
 * @param userLang - User's language code (default: 'en')
 * @returns Translated text or original if not multilingual
 */
const getMultilingualText = (text: string | null | undefined, userLang: string = 'en'): string => {
    if (!text) return '';
    
    // If it's a plain string (not JSON), return as-is
    if (!text.startsWith('{') && !text.startsWith('[')) {
        return text;
    }
    
    try {
        const translations = JSON.parse(text);
        // Check if it's a multilingual object
        if (typeof translations === 'object' && translations !== null && !Array.isArray(translations)) {
            // Return translation for user's language, fallback to English, then first available
            return translations[userLang] || translations.en || translations[Object.keys(translations)[0]] || text;
        }
        return text;
    } catch {
        // Not JSON, return as-is
        return text;
    }
};

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class TaskController {
    /**
     * Get all tasks with filters
     */
    /**
     * Get all tasks with filters
     */
    static getTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        logger.info('[TaskController] getTasks called', { user: req.user?.id, org: req.user?.organizationId });
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Get user language from Accept-Language header or default to English
        const acceptLang = req.headers['accept-language'] || req.headers['Accept-Language'] || 'en';
        const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
        const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
        const lang = supportedLangs.includes(userLang) ? userLang : 'en';

        const query = req.query as unknown as GetTasksQuery;
        // Default page 1, default limit 100 (or from schema default)
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 100;
        const offset = (page - 1) * limit;

        const { projectId, status, assigneeId, priority, initiativeId } = query;

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
                i.name as initiative_name
            FROM tasks t
            LEFT JOIN users a ON t.assignee_id = a.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.organization_id = ?
        `;
        const countSql = `SELECT COUNT(*) as total FROM tasks t WHERE t.organization_id = ?`;

        const params: SQLParam[] = [orgId];
        const countParams: SQLParam[] = [orgId];

        const applyFilters = (baseSql: string, baseParams: SQLParam[]) => {
            let s = baseSql;
            const p = [...baseParams];

            if (projectId) {
                s += ` AND t.project_id = ?`;
                p.push(projectId);
            }
            if (status) {
                s += ` AND t.status = ?`;
                p.push(status);
            }
            if (assigneeId) {
                s += ` AND t.assignee_id = ?`;
                p.push(assigneeId);
            }
            if (priority) {
                s += ` AND t.priority = ?`;
                p.push(priority);
            }
            if (initiativeId) {
                s += ` AND t.initiative_id = ?`;
                p.push(initiativeId);
            }

            // For regular users, show only tasks assigned to them or reported by them
            if (req.user?.role === 'team_member' || req.user?.role === 'viewer') {
                s += ` AND (t.assignee_id = ? OR t.reporter_id = ?)`;
                p.push(userId, userId);
            }
            return { sql: s, params: p };
        };

        // Filter valid parts
        const filteredMain = applyFilters(sql, params);
        const filteredCount = applyFilters(countSql, countParams);

        // Sort and Paginate Main Query
        filteredMain.sql += ` ORDER BY 
            CASE t.priority 
                WHEN 'urgent' THEN 1 
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2 
                WHEN 'medium' THEN 3 
                WHEN 'low' THEN 4 
            END,
            t.due_date ASC,
            t.created_at DESC
            LIMIT ? OFFSET ?`;
        filteredMain.params.push(limit, offset);

        // Execute queries
        const [rows, countResult] = await Promise.all([
            DbPromise.all<TaskRow>(filteredMain.sql, filteredMain.params),
            DbPromise.get<{ total: number }>(filteredCount.sql, filteredCount.params),
        ]);

        const total = countResult?.total || 0;
        const totalPages = Math.ceil(total / limit);

        // Set Pagination Headers
        res.setHeader('X-Total-Count', total);
        res.setHeader('X-Page', page);
        res.setHeader('X-Limit', limit);
        res.setHeader('X-Total-Pages', totalPages);

        const tasks = rows.map((t) => ({
            id: t.id,
            projectId: t.project_id,
            projectName: getMultilingualText(t.project_name, lang),
            organizationId: t.organization_id,
            title: getMultilingualText(t.title, lang),
            description: getMultilingualText(t.description, lang),
            status: t.status,
            priority: t.priority,
            assigneeId: t.assignee_id,
            assignee: t.assignee_id
                ? {
                    id: t.assignee_id,
                    firstName: t.assignee_first_name,
                    lastName: t.assignee_last_name,
                    avatarUrl: t.assignee_avatar,
                }
                : null,
            reporterId: t.reporter_id,
            reporter: t.reporter_id
                ? {
                    id: t.reporter_id,
                    firstName: t.reporter_first_name,
                    lastName: t.reporter_last_name,
                    avatarUrl: t.reporter_avatar,
                }
                : null,
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
            initiativeName: getMultilingualText(t.initiative_name, lang),
            progress: t.progress || 0,
            blockedReason: t.blocked_reason || '',
            // SLA / Escalation
            slaHours: t.sla_hours,
            slaDueAt: t.sla_due_at,
            escalationLevel: t.escalation_level || 0,
            escalatedToId: t.escalated_to_id,
            lastEscalatedAt: t.last_escalated_at,
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

        // Get user language from Accept-Language header or default to English
        const acceptLang = req.headers['accept-language'] || req.headers['Accept-Language'] || 'en';
        const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
        const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
        const lang = supportedLangs.includes(userLang) ? userLang : 'en';

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
                i.name as initiative_name
            FROM tasks t
            LEFT JOIN users a ON t.assignee_id = a.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.id = ? AND t.organization_id = ?
        `;

        const t = await DbPromise.get<TaskRow>(sql, [id, orgId]);
        if (!t) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const task = {
            id: t.id,
            projectId: t.project_id,
            projectName: getMultilingualText(t.project_name, lang),
            organizationId: t.organization_id,
            title: getMultilingualText(t.title, lang),
            description: getMultilingualText(t.description, lang),
            status: t.status,
            priority: t.priority,
            assigneeId: t.assignee_id,
            assignee: t.assignee_id
                ? {
                    id: t.assignee_id,
                    firstName: t.assignee_first_name,
                    lastName: t.assignee_last_name,
                    avatarUrl: t.assignee_avatar,
                }
                : null,
            reporterId: t.reporter_id,
            reporter: t.reporter_id
                ? {
                    id: t.reporter_id,
                    firstName: t.reporter_first_name,
                    lastName: t.reporter_last_name,
                    avatarUrl: t.reporter_avatar,
                }
                : null,
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
            initiativeName: getMultilingualText(t.initiative_name, lang),
            progress: t.progress || 0,
            blockedReason: t.blocked_reason || '',
            // SLA / Escalation
            slaHours: t.sla_hours,
            slaDueAt: t.sla_due_at,
            escalationLevel: t.escalation_level || 0,
            escalatedToId: t.escalated_to_id,
            lastEscalatedAt: t.last_escalated_at,
        };

        res.json(task);
    });

    /**
     * Create a new task
     */
    /**
     * Create a new task
     */
    static createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const body = req.body as CreateTaskRequest;
        const {
            projectId,
            title,
            description,
            status,
            priority,
            assigneeId,
            dueDate,
            estimatedHours,
            tags,
            taskType,
            initiativeId,
            why,
            expectedOutcome,
            decisionImpact,
            evidenceRequired,
            strategicContribution,
            roadmapInitiativeId,
            kpiId,
            raidItemId,
            assignees,
            progress,
            blockedReason,
        } = body;

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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await DbPromise.run(sql, [
            id,
            projectId,
            orgId,
            title,
            description,
            finalStatus,
            finalPriority,
            assigneeId,
            userId,
            dueDate,
            estimatedHours,
            tags ? JSON.stringify(tags) : '[]',
            finalTaskType,
            initiativeId,
            why,
            finalExpectedOutcome,
            finalDecisionImpact,
            finalEvidenceRequired,
            finalStrategicContribution,
            roadmapInitiativeId,
            kpiId,
            raidItemId,
            assignees ? JSON.stringify(assignees) : '[]',
            finalProgress,
            finalBlockedReason,
            now,
            now,
        ]);

        if (!result.success) {
            logger.error('[TaskController] Task creation failed:', result.error);
            res.status(500).json({ error: 'Task creation failed', details: result.error });
            return;
        }

        // Notifications
        if (assigneeId && assigneeId !== userId) {
            (NotificationService as any)
                .create({
                    userId: assigneeId,
                    organizationId: orgId,
                    projectId,
                    type: 'task_assigned',
                    title: 'New Task Assignment',
                    message: `You have been assigned to task "${title}"`,
                    relatedObjectType: 'TASK',
                    relatedObjectId: id,
                })
                .catch((err: any) => logger.error('[TaskController] Notification failed:', err));
        }

        // Activity logging
        (ActivityService as any)
            .log({
                organizationId: orgId,
                userId: userId,
                action: 'created',
                entityType: 'TASK',
                entityId: id,
                entityName: title,
                newValue: body,
            })
            .catch((err: any) => logger.error('[TaskController] Activity log failed:', err));

        // Audit Trail (PMO Standard)
        await DbPromise.run(
            `INSERT INTO pmo_audit_trail (id, project_id, pmo_domain_id, object_type, object_id, action, actor_id, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                projectId,
                PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
                'TASK',
                id,
                'TASK_CREATED',
                userId,
                JSON.stringify(body),
                now,
            ],
        ).catch((err: Error | null) => logger.error('[TaskController] PMO Audit log failed:', err));

        // Recalculate Initiative Progress
        if (initiativeId) {
            // Lazy load for now to avoid circular dependency
            const InitiativeService = await import('../services/initiativeService.js').then((m) => m.default || m);
            if (InitiativeService && (InitiativeService as any).recalculateProgress) {
                (InitiativeService as any)
                    .recalculateProgress({ organizationId: orgId, initiativeId })
                    .catch((err: any) => logger.error('[TaskController] Recalc failed:', err));
            }
        }

        logger.info(`[TaskController DEBUG] Attempting to retrieve created task. ID: ${id}`);
        const createdTask = await DbPromise.get<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [id]);
        logger.info(`[TaskController DEBUG] Retrieved task:`, createdTask);

        res.status(201).json(createdTask);
    });

    /**
     * Update task
     */
    /**
     * Update task
     */
    static updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const updates = req.body as UpdateTaskRequest;
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Get current task
        const currentTask = await DbPromise.get<TaskRow>(`SELECT * FROM tasks WHERE id = ? AND organization_id = ?`, [
            id,
            orgId,
        ]);

        if (!currentTask) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const allowedFields = [
            'title',
            'description',
            'status',
            'priority',
            'assignee_id',
            'due_date',
            'estimated_hours',
            'checklist',
            'attachments',
            'tags',
            'custom_status_id',
            'task_type',
            'initiative_id',
            'why',
            'expected_outcome',
            'decision_impact',
            'evidence_required',
            'strategic_contribution',
            'roadmap_initiative_id',
            'kpi_id',
            'raid_item_id',
            'assignees',
            'progress',
            'blocked_reason',
        ];

        const fieldMap: Record<string, string> = {
            assigneeId: 'assignee_id',
            dueDate: 'due_date',
            estimatedHours: 'estimated_hours',
            customStatusId: 'custom_status_id',
            taskType: 'task_type',
            initiativeId: 'initiative_id',
            expectedOutcome: 'expected_outcome',
            decisionImpact: 'decision_impact',
            evidenceRequired: 'evidence_required',
            strategicContribution: 'strategic_contribution',
            roadmapInitiativeId: 'roadmap_initiative_id',
            kpiId: 'kpi_id',
            raidItemId: 'raid_item_id',
            blockedReason: 'blocked_reason',
        };

        const sqlUpdates: string[] = [];
        const params: SQLParam[] = [];
        const historyEntries: any[] = [];
        const now = new Date().toISOString();

        Object.keys(updates).forEach((key) => {
            const dbKey = fieldMap[key] || key;
            if (allowedFields.includes(dbKey)) {
                let value = (updates as any)[key];

                // Serialize JSON fields
                if (
                    [
                        'checklist',
                        'attachments',
                        'tags',
                        'decision_impact',
                        'evidence_required',
                        'strategic_contribution',
                        'assignees',
                    ].includes(dbKey)
                ) {
                    if (typeof value === 'object') value = JSON.stringify(value);
                }

                // Check for change
                const oldValue = (currentTask as any)[dbKey];
                if (value !== oldValue) {
                    sqlUpdates.push(`${dbKey} = ?`);
                    params.push(value);

                    historyEntries.push({
                        taskId: id,
                        field: dbKey,
                        oldValue: oldValue ? String(oldValue) : '',
                        newValue: value ? String(value) : '',
                        changedBy: userId,
                    });
                }
            }
        });

        if (sqlUpdates.length === 0) {
            res.json(currentTask);
            return;
        }

        // Status change side effects
        if (updates.status === 'done' && currentTask.status !== 'done') {
            sqlUpdates.push(`completed_at = ?`);
            params.push(now);
            if (!updates.progress || updates.progress < 100) {
                sqlUpdates.push(`progress = ?`);
                params.push(100);
            }
        }

        if (updates.status === 'blocked' && (updates.blockedReason || currentTask.blocked_reason) === '') {
            res.status(400).json({ error: 'Blocked reason is required' });
            return;
        }

        sqlUpdates.push(`updated_at = ?`);
        params.push(now);

        const sql = `UPDATE tasks SET ${sqlUpdates.join(', ')} WHERE id = ?`;
        params.push(id);

        await DbPromise.run(sql, params);

        // History logs
        if (historyEntries.length > 0) {
            for (const entry of historyEntries) {
                await DbPromise.run(
                    `INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), entry.taskId, entry.field, entry.oldValue, entry.newValue, entry.changedBy],
                ).catch((err: Error | null) => logger.error('[TaskController] History log failed:', err));
            }
        }

        // Activity log
        (ActivityService as any)
            .log({
                organizationId: orgId,
                userId: userId,
                action: 'updated',
                entityType: 'TASK',
                entityId: id,
                entityName: currentTask.title,
                newValue: updates,
            })
            .catch((err: any) => logger.error('[TaskController] Activity log failed:', err));

        // Notifications
        const affectedUserId = (updates as any).assigneeId || currentTask.assignee_id;
        if (affectedUserId && affectedUserId !== userId) {
            (NotificationService as any)
                .create({
                    userId: affectedUserId,
                    organizationId: orgId,
                    type: 'task_updated',
                    title: 'Task Updated',
                    message: `Task "${currentTask.title}" has been updated`,
                    relatedObjectType: 'TASK',
                    relatedObjectId: id,
                })
                .catch((err: any) => logger.error('[TaskController] Notification failed:', err));
        }

        // Initiative Progress Recalc
        const initiativeId = updates.initiativeId || currentTask.initiative_id;
        if (initiativeId) {
            const InitiativeService = await import('../services/initiativeService.js').then((m) => m.default || m);
            if (InitiativeService && InitiativeService.recalculateProgress) {
                InitiativeService.recalculateProgress({ organizationId: orgId, initiativeId }).catch(
                    (err: Error | null) => logger.error('[TaskController] Recalc failed:', err),
                );
            }
        }

        const updatedTask = await DbPromise.get<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [id]);
        res.json(updatedTask);
    });

    /**
     * Delete task
     */
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
        const task = await DbPromise.get<TaskRow>(
            'SELECT reporter_id, initiative_id, title FROM tasks WHERE id = ? AND organization_id = ?',
            [id, orgId],
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        if (req.user?.role === 'team_member' && task.reporter_id !== userId) {
            res.status(403).json({ error: 'You can only delete tasks you created' });
            return;
        }

        // Delete task comments
        await DbPromise.run('DELETE FROM task_comments WHERE task_id = ?', [id]);

        // Delete task history
        await DbPromise.run('DELETE FROM task_history WHERE task_id = ?', [id]);

        // Delete task
        const result = await DbPromise.run('DELETE FROM tasks WHERE id = ? AND organization_id = ?', [id, orgId]);

        if (result.changes === 0) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        // Activity log
        (ActivityService as any)
            .log({
                organizationId: orgId,
                userId: userId,
                action: 'deleted',
                entityType: 'TASK',
                entityId: id,
                entityName: task.title,
            })
            .catch((err: any) => logger.error('[TaskController] Activity log failed:', err));

        // Recalculate Initiative Progress
        if (task.initiative_id) {
            const InitiativeService = await import('../services/initiativeService.js').then((m) => m.default || m);
            if (InitiativeService && (InitiativeService as any).recalculateProgress) {
                (InitiativeService as any)
                    .recalculateProgress({ organizationId: orgId, initiativeId: task.initiative_id })
                    .catch((err: any) => logger.error('[TaskController] Recalc failed:', err));
            }
        }

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
        const task = await DbPromise.get<{ id: string }>('SELECT id FROM tasks WHERE id = ? AND organization_id = ?', [
            taskId,
            orgId,
        ]);

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

        const rows = await DbPromise.all<CommentRow>(sql, [taskId]);

        const comments = rows.map((c) => ({
            id: c.id,
            taskId: c.task_id,
            userId: c.user_id,
            user: {
                id: c.user_id,
                firstName: c.first_name,
                lastName: c.last_name,
                avatarUrl: c.avatar_url,
            },
            content: c.content,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
        }));

        res.json(comments);
    });

    /**
     * Add comment to task
     */
    static addTaskComment = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id: taskId } = req.params;
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        const { content } = req.body as AddTaskCommentRequest;
        if (!orgId || !userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        // Verify task belongs to org
        const task = await DbPromise.get<{ id: string }>('SELECT id FROM tasks WHERE id = ? AND organization_id = ?', [
            taskId,
            orgId,
        ]);

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `INSERT INTO task_comments (id, task_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;

        await DbPromise.run(sql, [id, taskId, userId, content, now, now]);

        res.json({
            id,
            taskId,
            userId,
            content,
            createdAt: now,
            updatedAt: now,
        });
    });

    /**
     * Delete task comment
     */
    static deleteTaskComment = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { commentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check if user owns the comment or is admin
        const comment = await DbPromise.get<{ user_id: string }>('SELECT user_id FROM task_comments WHERE id = ?', [
            commentId,
        ]);

        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        if (req.user?.role !== 'owner' && req.user?.role !== 'administrator' && comment.user_id !== userId) {
            res.status(403).json({ error: 'You can only delete your own comments' });
            return;
        }

        await DbPromise.run('DELETE FROM task_comments WHERE id = ?', [commentId]);

        res.json({ message: 'Comment deleted' });
    });

    /**
     * Assign task (uses TaskAssignmentService - will be migrated later)
     */
    static assignTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id: taskId } = req.params;
        const { assigneeId, slaHours } = req.body as AssignTaskRequest;

        const result = await TaskAssignmentService.assignTask(taskId, assigneeId, {
            assignedById: req.user?.id,
            slaHours,
        });

        res.json(result);
    });

    /**
     * Reassign task
     */
    static reassignTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id: taskId } = req.params;
        const { toAssigneeId, reason } = req.body as ReassignTaskRequest;

        const result = await TaskAssignmentService.reassignTask(taskId, toAssigneeId, {
            reassignedById: req.user?.id,
            reason,
            resetSla: true,
        });

        res.json(result);
    });

    /**
     * Unassign task
     */
    static unassignTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const result = await TaskAssignmentService.unassignTask(id);

        res.json(result);
    });

    /**
     * Escalate task
     */
    static escalateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id: taskId } = req.params;
        const { reason } = req.body as EscalateTaskRequest;

        const result = await TaskAssignmentService.escalateTask(taskId, {
            reason: reason || 'Manual escalation',
            triggerType: ESCALATION_TRIGGERS.MANUAL,
            escalatedById: req.user?.id,
        });

        res.json(result);
    });

    /**
     * Resolve escalation
     */
    static resolveEscalation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { escalationId } = req.params;
        const { resolution } = req.body as ResolveEscalationRequest;

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

        const tasks = await TaskAssignmentService.getOverdueTasks(projectId, {
            escalationLevel: escalationLevel ? parseInt(String(escalationLevel)) : undefined,
            limit: limit ? parseInt(String(limit)) : undefined,
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

        const tasks = await TaskAssignmentService.getTasksApproachingSLA(
            projectId,
            hoursAhead ? parseInt(String(hoursAhead)) : 4,
        );

        res.json(tasks);
    });

    /**
     * Get user workload
     */
    static getUserWorkload = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId } = req.params;
        const { projectId } = req.query;

        const workload = await TaskAssignmentService.getUserWorkload(userId, {
            projectId: projectId as string | undefined,
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

        const workload = await TaskAssignmentService.getUserWorkload(userId, {
            projectId: projectId as string | undefined,
        });

        res.json(workload);
    });
}

export default TaskController;
