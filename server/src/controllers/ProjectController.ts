/**
 * Project Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all project-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type {
    CreateProjectRequest,
    ProjectNotificationSettingsRequest,
    UpdateAIRoleRequest,
    UpdateProjectRequest,
    UpdateRegulatoryModeRequest,
} from '../validators/project.validators.js';

// ==========================================
// TYPES
// ==========================================

interface ProjectMember {
    id: string;
    user_id: string;
    project_id: string;
    role: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    account_role: string;
}

interface Workstream {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // Allow additional fields from database
}

interface Initiative {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    status: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // Allow additional fields from database
}

interface Assessment {
    id: string;
    project_id: string;
    framework: string;
    status: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // Allow additional fields from database
}

interface Document {
    id: string;
    project_id: string;
    title: string;
    content?: string;
    type: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    [key: string]: unknown; // Allow additional fields from database
}

interface ProjectDetails {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    goal?: string;
    status: string;
    owner_id: string;
    owner_first_name?: string;
    owner_last_name?: string;
    created_at: string;
    updated_at: string;
    team?: ProjectMember[];
    workstreams?: Workstream[];
    initiatives?: Initiative[];
    assessments?: Assessment[];
    documents?: Document[];
}

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class ProjectController {
    /**
     * Get all projects for organization
     */
    static getProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Pagination
        const query = req.query as unknown as { page?: string; limit?: string };
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 50; // Default to 50 for projects
        const offset = (page - 1) * limit;

        const countSql = `SELECT COUNT(*) as total FROM projects WHERE organization_id = ?`;
        const sql = `
            SELECT 
                p.*, 
                u.first_name as owner_first_name, 
                u.last_name as owner_last_name,
                (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as real_member_count,
                (SELECT COUNT(*) FROM initiatives WHERE project_id = p.id) as real_initiative_count,
                (SELECT COUNT(*) FROM multi_framework_assessments WHERE project_id = p.id) as real_assessment_count,
                (SELECT COUNT(*) FROM knowledge_docs WHERE project_id = p.id) as real_document_count
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.organization_id = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [rows, countResult] = await Promise.all([
            queryHelpers.queryAll(sql, [orgId, limit, offset]),
            queryHelpers.queryOne<{ total: number }>(countSql, [orgId]),
        ]);

        const total = countResult?.total || 0;
        const totalPages = Math.ceil(total / limit);

        // Set Pagination Headers
        res.setHeader('X-Total-Count', total);
        res.setHeader('X-Page', page);
        res.setHeader('X-Limit', limit);
        res.setHeader('X-Total-Pages', totalPages);

        res.json(
            rows.map((row) => ({
                ...row,
                memberCount: row.real_member_count,
                initiativeCount: row.real_initiative_count,
                assessmentCount: row.real_assessment_count,
                documentCount: row.real_document_count,
            })),
        );
    });

    /**
     * Create a new project
     */
    static createProject = asyncHandler(
        async (req: AuthenticatedRequest<CreateProjectRequest>, res: Response): Promise<void> => {
            const orgId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!orgId || !userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { name, ownerId, description, goal } = req.body;

            if (!name) {
                res.status(400).json({ error: 'Project name is required' });
                return;
            }

            const id = uuidv4();
            const owner = ownerId || userId;

            const sql = `INSERT INTO projects (id, organization_id, name, description, goal, status, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;

            await queryHelpers.queryRun(sql, [id, orgId, name, description || null, goal || null, 'active', owner]);
            res.json({ id, name, description, goal, status: 'active', ownerId: owner });
        },
    );

    /**
     * Get single project details
     */
    static getProjectById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const sql = `
            SELECT 
                p.*, 
                u.first_name as owner_first_name, 
                u.last_name as owner_last_name
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.id = ? AND p.organization_id = ?
        `;

        const project = await queryHelpers.queryOne<ProjectDetails>(sql, [id, orgId]);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        // Parallelize detailed fetches
        const [members, workstreams, initiatives, assessments, documents] = await Promise.all([
            queryHelpers.queryAll<ProjectMember>(
                `
                SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url, u.role as account_role
                FROM project_members pm
                JOIN users u ON pm.user_id = u.id
                WHERE pm.project_id = ?
            `,
                [id],
            ),
            queryHelpers.queryAll<Workstream>(`SELECT * FROM workstreams WHERE project_id = ?`, [id]),
            queryHelpers.queryAll<Initiative>(`SELECT * FROM initiatives WHERE project_id = ?`, [id]),
            queryHelpers.queryAll<Assessment>(`SELECT * FROM multi_framework_assessments WHERE project_id = ?`, [id]),
            queryHelpers.queryAll<Document>(
                `SELECT * FROM knowledge_docs WHERE project_id = ? AND deleted_at IS NULL`,
                [id],
            ),
        ]);

        res.json({
            ...project,
            team: members,
            workstreams,
            initiatives,
            assessments,
            documents,
        });
    });

    /**
     * Update project
     */
    static updateProject = asyncHandler(
        async (req: AuthenticatedRequest<UpdateProjectRequest>, res: Response): Promise<void> => {
            const orgId = req.user?.organizationId;
            const { id } = req.params;
            const { name, description, goal, status } = req.body;
            if (!orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const sql = `
            UPDATE projects 
            SET name = COALESCE(?, name), 
                description = COALESCE(?, description), 
                goal = COALESCE(?, goal), 
                status = COALESCE(?, status)
            WHERE id = ? AND organization_id = ?
        `;

            const result = await queryHelpers.queryRun(sql, [name, description, goal, status, id, orgId]);
            if (result.changes === 0) {
                res.status(404).json({ error: 'Project not found or access denied' });
                return;
            }

            res.json({ message: 'Project updated' });
        },
    );

    /**
     * Delete project
     */
    static deleteProject = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const sql = `DELETE FROM projects WHERE id = ? AND organization_id = ?`;

        const result = await queryHelpers.queryRun(sql, [id, orgId]);
        if (result.changes === 0) {
            res.status(404).json({ error: 'Project not found or access denied' });
            return;
        }
        res.json({ message: 'Project deleted' });
    });

    /**
     * Get notification settings for project
     */
    static getNotificationSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const row = await queryHelpers.queryOne(`SELECT * FROM project_notification_settings WHERE project_id = ?`, [
            id,
        ]);

        // Return default settings if none exist
        if (!row) {
            res.json({
                project_id: id,
                task_overdue_enabled: true,
                task_due_today_enabled: true,
                blocker_detected_enabled: true,
                gate_ready_enabled: true,
                decision_required_enabled: true,
                escalation_enabled: true,
                escalation_days: 3,
                email_notifications: false,
                in_app_notifications: true,
            });
            return;
        }

        res.json(row);
    });

    /**
     * Update notification settings for project
     */
    static updateNotificationSettings = asyncHandler(
        async (req: AuthenticatedRequest<ProjectNotificationSettingsRequest>, res: Response): Promise<void> => {
            const { id: projectId } = req.params;
            const {
                task_overdue_enabled = true,
                task_due_today_enabled = true,
                blocker_detected_enabled = true,
                gate_ready_enabled = true,
                decision_required_enabled = true,
                escalation_enabled = true,
                escalation_days = 3,
                email_notifications = false,
                in_app_notifications = true,
            } = req.body;

            const settingsId = uuidv4();

            // Upsert using REPLACE
            const sql = `
            INSERT OR REPLACE INTO project_notification_settings 
            (id, project_id, task_overdue_enabled, task_due_today_enabled, blocker_detected_enabled,
             gate_ready_enabled, decision_required_enabled, escalation_enabled, escalation_days,
             email_notifications, in_app_notifications, updated_at)
            VALUES (
                COALESCE((SELECT id FROM project_notification_settings WHERE project_id = ?), ?),
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
        `;

            await queryHelpers.queryRun(sql, [
                projectId,
                settingsId,
                projectId,
                task_overdue_enabled ? 1 : 0,
                task_due_today_enabled ? 1 : 0,
                blocker_detected_enabled ? 1 : 0,
                gate_ready_enabled ? 1 : 0,
                decision_required_enabled ? 1 : 0,
                escalation_enabled ? 1 : 0,
                escalation_days,
                email_notifications ? 1 : 0,
                in_app_notifications ? 1 : 0,
            ]);

            res.json({ success: true, message: 'Notification settings saved' });
        },
    );

    /**
     * Get AI role for project
     */
    static getAIRole = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

// const AIRoleGuard = await import('../services/aiRoleGuard.js').then((m) => m.default || m);
        const AIRoleGuard = {} as any; // Stubbed missing service
        const roleConfig = await AIRoleGuard.getRoleConfig(id);

        res.json({
            projectId: id,
            aiRole: roleConfig.activeRole,
            capabilities: roleConfig.capabilities,
            description: roleConfig.roleDescription,
            roleHierarchy: roleConfig.roleHierarchy,
        });
    });

    /**
     * Update AI role for project
     */
    static updateAIRole = asyncHandler(
        async (req: AuthenticatedRequest<UpdateAIRoleRequest>, res: Response): Promise<void> => {
            const { id: projectId } = req.params;
            const { aiRole, justification } = req.body;
            const userId = req.user?.id;
            const orgId = req.user?.organizationId;
            if (!userId || !orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Validate role
            const validRoles = ['ADVISOR', 'MANAGER', 'OPERATOR'];
            if (!validRoles.includes(aiRole)) {
                res.status(400).json({
                    error: `Invalid AI role: ${aiRole}. Must be one of: ${validRoles.join(', ')}`,
                });
                return;
            }

            // Check admin permission
            if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
                res.status(403).json({
                    error: 'Only admins can change project AI role',
                });
                return;
            }

// const AIRoleGuard = await import('../services/aiRoleGuard.js').then((m) => m.default || m);
            const AIRoleGuard = {} as any; // Stubbed missing service

            const AIAuditLogger = await import('../services/aiAuditLogger.js').then((m) => m.default || m);

            // Get current role for audit
            const currentRole = await AIRoleGuard.getProjectRole(projectId);

            // Update the role
            await AIRoleGuard.setProjectRole(projectId, aiRole, userId);

            // Audit the change
            await AIAuditLogger.logInteraction({
                userId,
                organizationId: orgId,
                projectId,
                actionType: 'AI_ROLE_CHANGE',
                actionDescription: `AI role changed from ${currentRole} to ${aiRole}`,
                aiRole: 'SYSTEM',
                policyLevel: 'ADMIN',
                aiProjectRole: aiRole,
                justification: justification || 'Admin action',
            });

            // Get updated config
            const roleConfig = await AIRoleGuard.getRoleConfig(projectId);

            res.json({
                success: true,
                projectId,
                previousRole: currentRole,
                newRole: aiRole,
                capabilities: roleConfig.capabilities,
                description: roleConfig.roleDescription,
            });
        },
    );

    /**
     * Get regulatory mode status for project
     */
    static getRegulatoryMode = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

// const RegulatoryModeGuard = await import('../services/regulatoryModeGuard.js').then((m) => m.default || m);
        const RegulatoryModeGuard = {} as any; // Stubbed missing service
        const status = await RegulatoryModeGuard.getStatus(id);

        res.json({
            projectId: id,
            ...status,
        });
    });

    /**
     * Update regulatory mode for project
     */
    static updateRegulatoryMode = asyncHandler(
        async (req: AuthenticatedRequest<UpdateRegulatoryModeRequest>, res: Response): Promise<void> => {
            const { id: projectId } = req.params;
            const { enabled, justification } = req.body;
            const userId = req.user?.id;
            const orgId = req.user?.organizationId;
            if (!userId || !orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Check admin permission
            if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
                res.status(403).json({
                    error: 'Only admins can change Regulatory Mode settings',
                });
                return;
            }

            // Validate input
            if (typeof enabled !== 'boolean') {
                res.status(400).json({
                    error: 'enabled must be a boolean value',
                });
                return;
            }

// const RegulatoryModeGuard = await import('../services/regulatoryModeGuard.js').then((m) => m.default || m);
            const RegulatoryModeGuard = {} as any; // Stubbed missing service

            const AIAuditLogger = await import('../services/aiAuditLogger.js').then((m) => m.default || m);

            // Get current status for audit
            const currentStatus = await RegulatoryModeGuard.isEnabled(projectId);

            // Update the setting
            const result = await RegulatoryModeGuard.setEnabled(projectId, enabled);

            if (!result.success) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Audit the change
            await AIAuditLogger.logInteraction({
                userId,
                organizationId: orgId,
                projectId,
                actionType: 'REGULATORY_MODE_CHANGE',
                actionDescription: `Regulatory Mode ${enabled ? 'enabled' : 'disabled'}`,
                contextSnapshot: {
                    previousValue: currentStatus,
                    newValue: enabled,
                    justification: justification || 'Admin action',
                },
                aiRole: 'SYSTEM',
                policyLevel: 'ADMIN',
            });

            // Get updated status
            const newStatus = await RegulatoryModeGuard.getStatus(projectId);

            res.json({
                success: true,
                projectId,
                previousEnabled: currentStatus,
                ...newStatus,
                message: enabled
                    ? 'Regulatory Mode enabled. AI is now in advisory-only mode.'
                    : 'Regulatory Mode disabled. AI can operate with normal permissions.',
            });
        },
    );
}

export default ProjectController;
