// @ts-nocheck
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
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
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
      return (
        translations[userLang] ||
        translations.en ||
        translations[Object.keys(translations)[0]] ||
        text
      );
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

export class ProjectController {
  /**
   * Get all projects for organization
   */
  static getProjects = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      let rows: any[] = [];
      let countResult: { total?: number } | null = null;

      try {
        [rows, countResult] = await Promise.all([
          queryHelpers.queryAll(sql, [orgId, limit, offset]),
          queryHelpers.queryOne<{ total: number }>(countSql, [orgId]),
        ]);
      } catch (error) {
        logger.warn('[ProjectController] Falling back to basic project query:', error);
        const fallbackSql = `
              SELECT 
                  p.*, 
                  u.first_name as owner_first_name, 
                  u.last_name as owner_last_name
              FROM projects p
              LEFT JOIN users u ON p.owner_id = u.id
              WHERE p.organization_id = ?
              ORDER BY p.created_at DESC
              LIMIT ? OFFSET ?
          `;
        [rows, countResult] = await Promise.all([
          queryHelpers.queryAll(fallbackSql, [orgId, limit, offset]),
          queryHelpers.queryOne<{ total: number }>(countSql, [orgId]),
        ]);
      }

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
          name: getMultilingualText(row.name as string, lang),
          description: getMultilingualText(row.description as string, lang),
          memberCount: row.real_member_count ?? 0,
          initiativeCount: row.real_initiative_count ?? 0,
          assessmentCount: row.real_assessment_count ?? 0,
          documentCount: row.real_document_count ?? 0,
        }))
      );
    }
  );

  /**
   * Create a new project
   */
  static createProject = asyncHandler(
    async (req: AuthenticatedRequest<CreateProjectRequest>, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      logger.error(`[ProjectController] createProject called. Org: ${orgId}, User: ${userId}`);

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { name: rawName, description: rawDescription } = req.body;

      if (!rawName) {
        res.status(400).json({ error: 'Project name is required' });
        return;
      }
      // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
      // middleware escaped, before storing — mirrors the notebook/tool_sessions fix.
      const name = decodeHtmlEntities(String(rawName));
      const description =
        typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;
      const id = uuidv4();
      const owner = userId;

      const sql = `INSERT INTO projects (id, organization_id, name, description, status, owner_id) VALUES (?, ?, ?, ?, ?, ?)`;

      logger.error(`[ProjectController] Executing INSERT for project ${id}`);
      await queryHelpers.queryRun(sql, [id, orgId, name, description || null, 'active', owner]);

      // Return only server-confirmed persisted truth from the current schema.
      const created = await queryHelpers.queryOne<any>(
        'SELECT id, name, description, status, owner_id FROM projects WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );
      if (!created) throw new Error('Created project could not be read back');

      res.status(201).json({
        id: created.id,
        name: created.name,
        description: created.description,
        status: created.status,
        ownerId: created.owner_id,
      });
    }
  );

  /**
   * Get single project details
   */
  static getProjectById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id } = req.params;
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
          [id]
        ),
        queryHelpers.queryAll<Workstream>(`SELECT * FROM workstreams WHERE project_id = ?`, [id]),
        queryHelpers.queryAll<Initiative>(`SELECT * FROM initiatives WHERE project_id = ?`, [id]),
        queryHelpers.queryAll<Assessment>(
          `SELECT * FROM multi_framework_assessments WHERE project_id = ?`,
          [id]
        ),
        queryHelpers.queryAll<Document>(
          `SELECT * FROM knowledge_docs WHERE project_id = ? AND deleted_at IS NULL`,
          [id]
        ),
      ]);

      res.json({
        ...project,
        name: getMultilingualText(project.name, lang),
        description: getMultilingualText(project.description, lang),
        team: members,
        workstreams: workstreams.map((w) => ({
          ...w,
          name: getMultilingualText(w.name, lang),
          description: getMultilingualText(w.description, lang),
        })),
        initiatives: initiatives.map((i) => ({
          ...i,
          name: getMultilingualText(i.name, lang),
          description: getMultilingualText(i.description, lang),
        })),
        assessments,
        documents,
      });
    }
  );

  /**
   * Zwornik Delta B (§4.2) — project finance rollup. Read-model only, zero new
   * ledger tables: aggregates the project's own budget container(s), Σ
   * initiative budgets/expenses, Σ initiative value (KPI baseline+ledger,
   * kanon M16), benefits/ROI, and container-vs-initiatives variance (soft
   * warning only). See `projectFinanceRollupService.ts` for the full contract.
   */
  static getProjectFinance = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const { getProjectFinanceRollup } =
        await import('../services/projectFinanceRollupService.js');
      const rollup = await getProjectFinanceRollup(orgId, id);
      res.json(rollup);
    }
  );

  /**
   * Update project
   */
  static updateProject = asyncHandler(
    async (req: AuthenticatedRequest<UpdateProjectRequest>, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id } = req.params;
      const { name: rawName, description: rawDescription, goal: rawGoal, status } = req.body;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      // T5 (Z139 follow-up): decode HTML entities before storing — see createProject.
      const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;
      const description =
        typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;
      const goal = typeof rawGoal === 'string' ? decodeHtmlEntities(rawGoal) : rawGoal;

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
    }
  );

  /**
   * Delete project
   */
  static deleteProject = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    }
  );

  /**
   * Get notification settings for project
   */
  static getNotificationSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const row = await queryHelpers.queryOne(
        `SELECT * FROM project_notification_settings WHERE project_id = ?`,
        [id]
      );

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
    }
  );

  /**
   * Update notification settings for project
   */
  static updateNotificationSettings = asyncHandler(
    async (
      req: AuthenticatedRequest<ProjectNotificationSettingsRequest>,
      res: Response
    ): Promise<void> => {
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
    }
  );

  /**
   * Get AI role for project
   */
  static getAIRole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const AIRoleGuard = await import('../services/aiRoleGuard.js').then((m) => m.default || m);
      if (
        !AIRoleGuard ||
        AIRoleGuard.__unavailable__ === true ||
        typeof AIRoleGuard.getRoleConfig !== 'function'
      ) {
        res.status(503).json({
          success: false,
          code: 'FEATURE_UNAVAILABLE',
          error: 'AI role management is not available',
        });
        return;
      }
      const roleConfig = await AIRoleGuard.getRoleConfig(id);

      res.json({
        projectId: id,
        aiRole: roleConfig.activeRole,
        capabilities: roleConfig.capabilities,
        description: roleConfig.roleDescription,
        roleHierarchy: roleConfig.roleHierarchy,
      });
    }
  );

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

      // Check admin permission (roles are normalized by auth middleware)
      const role = String(req.user?.role || '').toLowerCase();
      const isAdmin =
        role === 'admin' || role === 'administrator' || role === 'owner' || role === 'superadmin';
      if (!isAdmin) {
        res.status(403).json({
          error: 'Only admins can change project AI role',
        });
        return;
      }

      const AIRoleGuard = await import('../services/aiRoleGuard.js').then((m) => m.default || m);
      if (
        !AIRoleGuard ||
        AIRoleGuard.__unavailable__ === true ||
        typeof AIRoleGuard.getProjectRole !== 'function' ||
        typeof AIRoleGuard.setProjectRole !== 'function'
      ) {
        res.status(503).json({
          success: false,
          code: 'FEATURE_UNAVAILABLE',
          error: 'AI role management is not available',
        });
        return;
      }

      const AIAuditLogger = await import('../services/aiAuditLogger.js').then(
        (m) => m.default || m
      );

      // Get current role for audit
      const currentRole = await AIRoleGuard.getProjectRole(projectId);

      // Update role in `project_ai_settings`
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
    }
  );

  /**
   * Get regulatory mode status for project
   */
  static getRegulatoryMode = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const RegulatoryModeGuard = await import('../services/regulatoryModeGuard.js').then(
        (m) => m.default || m
      );
      if (
        !RegulatoryModeGuard ||
        RegulatoryModeGuard.__unavailable__ === true ||
        typeof RegulatoryModeGuard.getStatus !== 'function'
      ) {
        res.status(503).json({
          success: false,
          code: 'FEATURE_UNAVAILABLE',
          error: 'Regulatory mode is not available',
        });
        return;
      }
      const status = await RegulatoryModeGuard.getStatus(id);

      res.json({
        projectId: id,
        ...status,
      });
    }
  );

  /**
   * Update regulatory mode for project
   */
  static updateRegulatoryMode = asyncHandler(
    async (
      req: AuthenticatedRequest<UpdateRegulatoryModeRequest>,
      res: Response
    ): Promise<void> => {
      const { id: projectId } = req.params;
      const { enabled, justification } = req.body;
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check admin permission (roles are normalized by auth middleware)
      const role = String(req.user?.role || '').toLowerCase();
      const isAdmin =
        role === 'admin' || role === 'administrator' || role === 'owner' || role === 'superadmin';
      if (!isAdmin) {
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

      const RegulatoryModeGuard = await import('../services/regulatoryModeGuard.js').then(
        (m) => m.default || m
      );
      if (
        !RegulatoryModeGuard ||
        RegulatoryModeGuard.__unavailable__ === true ||
        typeof RegulatoryModeGuard.isEnabled !== 'function' ||
        typeof RegulatoryModeGuard.setEnabled !== 'function'
      ) {
        res.status(503).json({
          success: false,
          code: 'FEATURE_UNAVAILABLE',
          error: 'Regulatory mode is not available',
        });
        return;
      }

      const AIAuditLogger = await import('../services/aiAuditLogger.js').then(
        (m) => m.default || m
      );

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
    }
  );

  // ==========================================
  // FLOW-PROJECT-001: ARCHIVE MANAGEMENT
  // ==========================================

  /**
   * Archive a project
   */
  static archiveProject = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const projectId = req.params.id;
      const { reason } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check project exists and belongs to org
      const project = await queryHelpers.queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
      );

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Only completed or cancelled projects can be archived
      if (!['completed', 'cancelled'].includes(project.status)) {
        res.status(400).json({
          error: 'Only completed or cancelled projects can be archived',
          currentStatus: project.status,
        });
        return;
      }

      // Archive the project
      await queryHelpers.queryRun(
        `UPDATE projects 
             SET status = 'archived', 
                 archived_at = datetime('now'), 
                 archived_by = ?,
                 updated_at = datetime('now')
             WHERE id = ?`,
        [userId, projectId]
      );

      res.json({
        success: true,
        message: 'Project archived successfully',
        projectId,
        archivedAt: new Date().toISOString(),
      });
    }
  );

  /**
   * Unarchive a project
   */
  static unarchiveProject = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const projectId = req.params.id;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check project is archived
      const project = await queryHelpers.queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM projects WHERE id = ? AND organization_id = ? AND status = ?',
        [projectId, orgId, 'archived']
      );

      if (!project) {
        res.status(404).json({ error: 'Archived project not found' });
        return;
      }

      // Restore to completed status
      await queryHelpers.queryRun(
        `UPDATE projects 
             SET status = 'completed', 
                 archived_at = NULL, 
                 archived_by = NULL,
                 updated_at = datetime('now')
             WHERE id = ?`,
        [projectId]
      );

      res.json({
        success: true,
        message: 'Project restored from archive',
        projectId,
      });
    }
  );

  // ==========================================
  // MY MEMBERSHIPS
  // ==========================================

  /**
   * Get all project memberships for current user
   * Used by useInterviewPermissions hook to determine assignment scope
   */
  static getMyMemberships = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;

      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get all project memberships for this user
      const memberships = await queryHelpers.queryAll<{
        project_id: string;
        project_name: string;
        project_role: string;
        workstream_id: string | null;
        workstream_name: string | null;
      }>(
        `SELECT 
          pm.project_id,
          p.name as project_name,
          pm.project_role,
          pm.workstream_id,
          w.name as workstream_name
        FROM project_members pm
        JOIN projects p ON p.id = pm.project_id
        LEFT JOIN workstreams w ON w.id = pm.workstream_id
        WHERE pm.user_id = ? AND p.organization_id = ?
        ORDER BY p.name`,
        [userId, orgId]
      );

      res.json({
        memberships: (memberships || []).map((m) => ({
          projectId: m.project_id,
          projectName: m.project_name,
          projectRole: m.project_role,
          workstreamId: m.workstream_id,
          workstreamName: m.workstream_name,
        })),
      });
    }
  );

  // ==========================================
  // PROJECT TEAM (CANONICAL MEMBERSHIP)
  // ==========================================

  static getProjectMembers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const projectId = req.params.id;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const rows = await queryHelpers.queryAll<any>(
        `SELECT pm.*,
                u.first_name as "firstName",
                u.last_name as "lastName",
                u.email as email,
                u.avatar_url as "avatarUrl",
                u.role as "accountRole"
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = ?
         ORDER BY pm.project_role, u.last_name, u.first_name`,
        [projectId]
      );

      const members = (rows || []).map((r: any) => ({
        id: String(r.id),
        projectId: String(r.project_id),
        userId: String(r.user_id),
        projectRole: String(r.project_role || ''),
        isInvoked: !!r.is_invoked,
        consultantProfile: String(r.consultant_profile || 'NONE'),
        engagementType: String(r.engagement_type || 'INTERNAL'),
        actingOrgId: r.acting_org_id || null,
        workstreamId: r.workstream_id || null,
        allocationPercent: Number(r.allocation_percent ?? 100),
        permissions:
          typeof r.permissions === 'string'
            ? (() => {
                try {
                  return JSON.parse(r.permissions || '{}');
                } catch {
                  return {};
                }
              })()
            : r.permissions || {},
        startDate: r.start_date || null,
        endDate: r.end_date || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        addedById: r.added_by_id || null,
        firstName: r.firstName || null,
        lastName: r.lastName || null,
        email: r.email || null,
        avatarUrl: r.avatarUrl || null,
        accountRole: r.accountRole || null,
      }));

      res.json({ members });
    }
  );

  static addProjectMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const projectId = req.params.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        userId,
        projectRole,
        allocationPercent,
        isInvoked,
        consultantProfile,
        engagementType,
      } = (req.body || {}) as any;
      if (!userId || !projectRole) {
        res.status(400).json({ error: 'userId and projectRole are required' });
        return;
      }
      if (
        allocationPercent !== undefined &&
        (Number.isNaN(Number(allocationPercent)) ||
          Number(allocationPercent) < 0 ||
          Number(allocationPercent) > 100)
      ) {
        res.status(400).json({ error: 'allocationPercent must be between 0 and 100' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const existing = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM project_members WHERE project_id = ? AND user_id = ?`,
        [projectId, userId]
      );
      if (existing) {
        res.status(400).json({ error: 'User is already a member of this project' });
        return;
      }

      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO project_members (id, project_id, user_id, project_role, allocation_percent, permissions, added_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          projectId,
          userId,
          String(projectRole),
          allocationPercent !== undefined ? Number(allocationPercent) : 100,
          JSON.stringify({}),
          actorId,
        ]
      );

      // Best-effort optional columns (migration 542)
      try {
        const updates: string[] = [];
        const params: any[] = [];
        if (isInvoked !== undefined) {
          updates.push('is_invoked = ?');
          params.push(isInvoked ? 1 : 0);
        }
        if (consultantProfile !== undefined) {
          updates.push('consultant_profile = ?');
          params.push(String(consultantProfile));
        }
        if (engagementType !== undefined) {
          updates.push('engagement_type = ?');
          params.push(String(engagementType));
        }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(projectId, userId);
          await queryHelpers.queryRun(
            `UPDATE project_members SET ${updates.join(', ')} WHERE project_id = ? AND user_id = ?`,
            params
          );
        }
      } catch {
        // best-effort
      }

      res.status(201).json({ success: true, id });
    }
  );

  static updateProjectMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const projectId = req.params.id;
      const userId = req.params.userId;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const existing = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM project_members WHERE project_id = ? AND user_id = ?`,
        [projectId, userId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Project member not found' });
        return;
      }

      const { projectRole, allocationPercent, isInvoked, consultantProfile, engagementType } =
        (req.body || {}) as any;
      const updates: string[] = [];
      const params: any[] = [];

      if (projectRole !== undefined) {
        updates.push('project_role = ?');
        params.push(String(projectRole));
      }
      if (allocationPercent !== undefined) {
        const n = Number(allocationPercent);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          res.status(400).json({ error: 'allocationPercent must be between 0 and 100' });
          return;
        }
        updates.push('allocation_percent = ?');
        params.push(n);
      }
      if (isInvoked !== undefined) {
        updates.push('is_invoked = ?');
        params.push(isInvoked ? 1 : 0);
      }
      if (consultantProfile !== undefined) {
        updates.push('consultant_profile = ?');
        params.push(String(consultantProfile));
      }
      if (engagementType !== undefined) {
        updates.push('engagement_type = ?');
        params.push(String(engagementType));
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push("updated_at = datetime('now')");
      params.push(projectId, userId);
      await queryHelpers.queryRun(
        `UPDATE project_members SET ${updates.join(', ')} WHERE project_id = ? AND user_id = ?`,
        params
      );

      res.json({ success: true });
    }
  );

  static removeProjectMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const projectId = req.params.id;
      const userId = req.params.userId;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
        [projectId, userId]
      );

      res.json({ success: true });
    }
  );

  // ==========================================
  // STEERING BOARD (OPTIONAL)
  // ==========================================

  static getSteeringBoard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const projectId = req.params.id;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      let board: any = null;
      try {
        board = await queryHelpers.queryOne(
          `SELECT project_id as "projectId", enabled, quorum_rule as "quorumRule", sla_hours as "slaHours"
           FROM project_steering_board WHERE project_id = ?`,
          [projectId]
        );
      } catch {
        board = null;
      }

      let members: any[] = [];
      try {
        members = await queryHelpers.queryAll(
          `SELECT m.user_id as "userId", m.member_type as "memberType",
                  u.first_name as "firstName", u.last_name as "lastName", u.email as email, u.avatar_url as "avatarUrl"
           FROM project_steering_board_members m
           JOIN users u ON u.id = m.user_id
           WHERE m.project_id = ?
           ORDER BY m.member_type, u.last_name, u.first_name`,
          [projectId]
        );
      } catch {
        members = [];
      }

      res.json({
        board: board || { projectId, enabled: 0, quorumRule: 'SIMPLE_MAJORITY', slaHours: 72 },
        members,
      });
    }
  );

  static updateSteeringBoard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const projectId = req.params.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { enabled, quorumRule, slaHours } = (req.body || {}) as any;

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      try {
        const existing = await queryHelpers.queryOne(
          `SELECT project_id as "projectId" FROM project_steering_board WHERE project_id = ?`,
          [projectId]
        );
        if (existing) {
          await queryHelpers.queryRun(
            `UPDATE project_steering_board
             SET enabled = COALESCE(?, enabled),
                 quorum_rule = COALESCE(?, quorum_rule),
                 sla_hours = COALESCE(?, sla_hours),
                 updated_at = datetime('now')
             WHERE project_id = ?`,
            [
              enabled !== undefined ? (enabled ? 1 : 0) : null,
              quorumRule || null,
              slaHours || null,
              projectId,
            ]
          );
        } else {
          await queryHelpers.queryRun(
            `INSERT INTO project_steering_board (project_id, enabled, quorum_rule, sla_hours, created_by_id)
             VALUES (?, ?, ?, ?, ?)`,
            [projectId, enabled ? 1 : 0, quorumRule || 'SIMPLE_MAJORITY', slaHours || 72, actorId]
          );
        }
      } catch {
        res
          .status(500)
          .json({ error: 'Steering board tables not available yet (run migrations).' });
        return;
      }

      res.json({ success: true });
    }
  );

  static addSteeringBoardMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const projectId = req.params.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { userId, memberType } = (req.body || {}) as any;
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const project = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      try {
        await queryHelpers.queryRun(
          `INSERT OR REPLACE INTO project_steering_board_members (id, project_id, user_id, member_type)
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), projectId, userId, String(memberType || 'BOARD_MEMBER')]
        );
      } catch {
        res
          .status(500)
          .json({ error: 'Steering board tables not available yet (run migrations).' });
        return;
      }

      res.status(201).json({ success: true });
    }
  );

  static removeSteeringBoardMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const projectId = req.params.id;
      const userId = req.params.userId;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        await queryHelpers.queryRun(
          `DELETE FROM project_steering_board_members WHERE project_id = ? AND user_id = ?`,
          [projectId, userId]
        );
      } catch {
        res
          .status(500)
          .json({ error: 'Steering board tables not available yet (run migrations).' });
        return;
      }

      res.json({ success: true });
    }
  );

  // ==========================================
  // PMO ROLES
  // ==========================================

  /**
   * Get PMO role assignments for project
   */
  static getPMORoles = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const projectId = req.params.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get project's PMO standard
      const project = await queryHelpers.queryOne<{ pmo_standard: string }>(
        'SELECT pmo_standard FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
      );

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const standard = project.pmo_standard || 'pmbok';

      // Get role definitions for this standard
      const roleDefinitions = await queryHelpers.queryAll<{
        role_key: string;
        display_name: string;
        description: string;
        level: number;
        is_required: number;
      }>(
        `SELECT role_key, display_name, description, level, is_required 
             FROM pmo_role_definitions 
             WHERE standard_id = ? 
             ORDER BY level`,
        [standard]
      );

      // Get current role assignments
      const assignments = await queryHelpers.queryAll<{
        id: string;
        user_id: string;
        pmo_role_key: string;
        assigned_at: string;
        first_name: string;
        last_name: string;
        email: string;
      }>(
        `SELECT pra.id, pra.user_id, pra.pmo_role_key, pra.assigned_at,
                    u.first_name, u.last_name, u.email
             FROM project_role_assignments pra
             JOIN users u ON pra.user_id = u.id
             WHERE pra.project_id = ?`,
        [projectId]
      );

      res.json({
        success: true,
        projectId,
        pmoStandard: standard,
        roleDefinitions: roleDefinitions || [],
        assignments: assignments || [],
      });
    }
  );

  /**
   * Assign PMO role to user
   */
  static assignPMORole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const projectId = req.params.id;
      const { targetUserId, roleKey, notes } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!targetUserId || !roleKey) {
        res.status(400).json({ error: 'targetUserId and roleKey are required' });
        return;
      }

      const assignmentId = uuidv4();

      await queryHelpers.queryRun(
        `INSERT INTO project_role_assignments (id, project_id, user_id, pmo_role_key, assigned_by, notes)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(project_id, user_id, pmo_role_key) DO UPDATE SET
                assigned_by = excluded.assigned_by,
                assigned_at = datetime('now'),
                notes = excluded.notes`,
        [assignmentId, projectId, targetUserId, roleKey, userId, notes || null]
      );

      res.json({
        success: true,
        message: 'PMO role assigned successfully',
        assignmentId,
      });
    }
  );

  /**
   * Remove PMO role assignment
   */
  static removePMORole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const projectId = req.params.id;
      const assignmentId = req.params.assignmentId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.queryRun(
        'DELETE FROM project_role_assignments WHERE id = ? AND project_id = ?',
        [assignmentId, projectId]
      );

      res.json({
        success: true,
        message: 'PMO role assignment removed',
      });
    }
  );

  // ==========================================
  // LOCATIONS
  // ==========================================

  /**
   * Get all locations for organization
   */
  static getLocations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const locations = await queryHelpers.queryAll<{
        id: string;
        name: string;
        type: string;
        description: string;
        city: string;
        country: string;
      }>(
        `SELECT id, name, type, description, city, country 
             FROM locations 
             WHERE organization_id = ? AND is_active = 1
             ORDER BY name`,
        [orgId]
      );

      res.json({
        success: true,
        locations: locations || [],
      });
    }
  );
}

export default ProjectController;
