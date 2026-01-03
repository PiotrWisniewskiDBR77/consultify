/**
 * Workspace Defaults API Routes
 * 
 * Manage organization-level workspace default settings for:
 * - Project defaults (view mode, privacy, etc.)
 * - Task defaults (priority, due offset, etc.)
 * - Workflow states
 * - Regional settings (timezone, date format, etc.)
 */

import express from 'express';
const router = express.Router();
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import authMiddleware from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

// ==========================================
// DEFAULT VALUES
// ==========================================

const DEFAULT_WORKFLOW_STATES = [
    { id: 'backlog', name: 'Backlog', color: 'slate', type: 'todo', isDefault: true },
    { id: 'todo', name: 'To Do', color: 'blue', type: 'todo', isDefault: false },
    { id: 'in_progress', name: 'In Progress', color: 'amber', type: 'in_progress', isDefault: false },
    { id: 'review', name: 'Review', color: 'violet', type: 'in_progress', isDefault: false },
    { id: 'done', name: 'Done', color: 'green', type: 'done', isDefault: false },
    { id: 'blocked', name: 'Blocked', color: 'red', type: 'blocked', isDefault: false }
];

const DEFAULT_PRIORITIES = [
    { id: 'critical', name: 'Critical', color: '#EF4444', weight: 4 },
    { id: 'high', name: 'High', color: '#F97316', weight: 3 },
    { id: 'medium', name: 'Medium', color: '#EAB308', weight: 2 },
    { id: 'low', name: 'Low', color: '#22C55E', weight: 1 }
];

const DEFAULT_SETTINGS = {
    projectDefaults: {
        defaultViewMode: 'kanban',
        autoAssignCreator: true,
        defaultPrivacy: 'team',
        enableTimeTracking: true,
        enableDependencies: true,
        defaultEstimationUnit: 'hours'
    },
    taskDefaults: {
        defaultPriority: 'medium',
        defaultDueOffset: 7,
        defaultAssignee: 'creator',
        autoAddToMyWork: true
    },
    workflowStates: DEFAULT_WORKFLOW_STATES,
    priorities: DEFAULT_PRIORITIES,
    timezone: 'Europe/Warsaw',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    weekStart: 'monday',
    workingDays: [1, 2, 3, 4, 5],
    workingHours: {
        start: '09:00',
        end: '17:00'
    }
};

// ==========================================
// HELPERS
// ==========================================

function rowToSettings(row) {
    if (!row) return DEFAULT_SETTINGS;
    
    return {
        projectDefaults: {
            defaultViewMode: row.project_default_view_mode || 'kanban',
            autoAssignCreator: !!row.project_auto_assign_creator,
            defaultPrivacy: row.project_default_privacy || 'team',
            enableTimeTracking: !!row.project_enable_time_tracking,
            enableDependencies: !!row.project_enable_dependencies,
            defaultEstimationUnit: row.project_default_estimation_unit || 'hours'
        },
        taskDefaults: {
            defaultPriority: row.task_default_priority || 'medium',
            defaultDueOffset: row.task_default_due_offset || 7,
            defaultAssignee: row.task_default_assignee || 'creator',
            autoAddToMyWork: !!row.task_auto_add_to_my_work
        },
        workflowStates: safeJsonParse(row.workflow_states, DEFAULT_WORKFLOW_STATES),
        priorities: safeJsonParse(row.priorities, DEFAULT_PRIORITIES),
        timezone: row.timezone || 'Europe/Warsaw',
        dateFormat: row.date_format || 'DD/MM/YYYY',
        timeFormat: row.time_format || '24h',
        weekStart: row.week_start || 'monday',
        workingDays: safeJsonParse(row.working_days, [1, 2, 3, 4, 5]),
        workingHours: {
            start: row.working_hours_start || '09:00',
            end: row.working_hours_end || '17:00'
        }
    };
}

function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return fallback;
    }
}

// ==========================================
// GET WORKSPACE DEFAULTS
// ==========================================

/**
 * GET /api/workspace-defaults/:orgId
 * Get workspace defaults for organization
 */
router.get('/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const userOrgId = req.user.organizationId || req.user.organization_id;
        
        // Verify access
        if (req.user.role !== 'SUPERADMIN' && userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const row = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM workspace_defaults WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
        
        const settings = rowToSettings(row);
        
        res.json({
            exists: !!row,
            settings
        });
        
    } catch (error) {
        console.error('[WorkspaceDefaults] Get error:', error);
        res.status(500).json({ error: 'Failed to get workspace defaults' });
    }
});

// ==========================================
// UPDATE WORKSPACE DEFAULTS
// ==========================================

/**
 * PUT /api/workspace-defaults/:orgId
 * Update or create workspace defaults
 */
router.put('/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const userOrgId = req.user.organizationId || req.user.organization_id;
        const userRole = req.user.role;
        
        // Verify admin access
        const isAdmin = userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'OWNER';
        if (!isAdmin && userOrgId !== orgId) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const settings = req.body;
        
        // Check if exists
        const existing = await new Promise((resolve, reject) => {
            db.get(
                'SELECT organization_id FROM workspace_defaults WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
        
        const now = new Date().toISOString();
        
        if (existing) {
            // Update
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE workspace_defaults SET
                        project_default_view_mode = ?,
                        project_auto_assign_creator = ?,
                        project_default_privacy = ?,
                        project_enable_time_tracking = ?,
                        project_enable_dependencies = ?,
                        project_default_estimation_unit = ?,
                        task_default_priority = ?,
                        task_default_due_offset = ?,
                        task_default_assignee = ?,
                        task_auto_add_to_my_work = ?,
                        workflow_states = ?,
                        priorities = ?,
                        timezone = ?,
                        date_format = ?,
                        time_format = ?,
                        week_start = ?,
                        working_days = ?,
                        working_hours_start = ?,
                        working_hours_end = ?,
                        updated_at = ?
                    WHERE organization_id = ?
                `, [
                    settings.projectDefaults?.defaultViewMode || 'kanban',
                    settings.projectDefaults?.autoAssignCreator ? 1 : 0,
                    settings.projectDefaults?.defaultPrivacy || 'team',
                    settings.projectDefaults?.enableTimeTracking ? 1 : 0,
                    settings.projectDefaults?.enableDependencies ? 1 : 0,
                    settings.projectDefaults?.defaultEstimationUnit || 'hours',
                    settings.taskDefaults?.defaultPriority || 'medium',
                    settings.taskDefaults?.defaultDueOffset || 7,
                    settings.taskDefaults?.defaultAssignee || 'creator',
                    settings.taskDefaults?.autoAddToMyWork ? 1 : 0,
                    JSON.stringify(settings.workflowStates || DEFAULT_WORKFLOW_STATES),
                    JSON.stringify(settings.priorities || DEFAULT_PRIORITIES),
                    settings.timezone || 'Europe/Warsaw',
                    settings.dateFormat || 'DD/MM/YYYY',
                    settings.timeFormat || '24h',
                    settings.weekStart || 'monday',
                    JSON.stringify(settings.workingDays || [1,2,3,4,5]),
                    settings.workingHours?.start || '09:00',
                    settings.workingHours?.end || '17:00',
                    now,
                    orgId
                ], (err) => err ? reject(err) : resolve());
            });
        } else {
            // Insert
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO workspace_defaults (
                        organization_id,
                        project_default_view_mode,
                        project_auto_assign_creator,
                        project_default_privacy,
                        project_enable_time_tracking,
                        project_enable_dependencies,
                        project_default_estimation_unit,
                        task_default_priority,
                        task_default_due_offset,
                        task_default_assignee,
                        task_auto_add_to_my_work,
                        workflow_states,
                        priorities,
                        timezone,
                        date_format,
                        time_format,
                        week_start,
                        working_days,
                        working_hours_start,
                        working_hours_end,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    orgId,
                    settings.projectDefaults?.defaultViewMode || 'kanban',
                    settings.projectDefaults?.autoAssignCreator ? 1 : 0,
                    settings.projectDefaults?.defaultPrivacy || 'team',
                    settings.projectDefaults?.enableTimeTracking ? 1 : 0,
                    settings.projectDefaults?.enableDependencies ? 1 : 0,
                    settings.projectDefaults?.defaultEstimationUnit || 'hours',
                    settings.taskDefaults?.defaultPriority || 'medium',
                    settings.taskDefaults?.defaultDueOffset || 7,
                    settings.taskDefaults?.defaultAssignee || 'creator',
                    settings.taskDefaults?.autoAddToMyWork ? 1 : 0,
                    JSON.stringify(settings.workflowStates || DEFAULT_WORKFLOW_STATES),
                    JSON.stringify(settings.priorities || DEFAULT_PRIORITIES),
                    settings.timezone || 'Europe/Warsaw',
                    settings.dateFormat || 'DD/MM/YYYY',
                    settings.timeFormat || '24h',
                    settings.weekStart || 'monday',
                    JSON.stringify(settings.workingDays || [1,2,3,4,5]),
                    settings.workingHours?.start || '09:00',
                    settings.workingHours?.end || '17:00',
                    now,
                    now
                ], (err) => err ? reject(err) : resolve());
            });
        }
        
        res.json({ success: true, message: 'Workspace defaults saved' });
        
    } catch (error) {
        console.error('[WorkspaceDefaults] Update error:', error);
        res.status(500).json({ error: 'Failed to save workspace defaults' });
    }
});

export default router;







