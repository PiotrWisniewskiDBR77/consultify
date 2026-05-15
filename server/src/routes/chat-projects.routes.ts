// @ts-nocheck
/**
 * Chat Projects Routes
 *
 * CRUD routes for managing chat projects (folders/categories).
 * Supports both PERSONAL and TEAM scopes.
 *
 * - Personal projects: visible only to the creator (scope = 'personal')
 * - Team projects: visible to all org members (scope = 'team')
 *
 * Permission checks for team projects use chatPermissionService.
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { getDatabase } from '../database/index.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { checkChatPermission } from '../services/chatPermissionService.js';
import logger from '../utils/Logger.js';

const router = Router();

const isMissingSqliteTable = (error: any, tableName: string): boolean => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === 'SQLITE_ERROR' && msg.includes(`no such table: ${tableName}`.toLowerCase());
};

// ==================== VALIDATION SCHEMAS ====================

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .default('#6366f1'),
  icon: z.string().max(50).optional().default('folder'),
  /** 'personal' (default) or 'team' */
  scope: z.enum(['personal', 'team']).optional().default('personal'),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
});

// ==================== GET ALL PROJECTS ====================

router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;
    const scopeFilter = (req.query as any).scope; // 'personal' | 'team' | undefined (all)

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    let whereClause: string;
    const params: string[] = [];

    if (scopeFilter === 'personal') {
      // Only personal projects owned by this user
      whereClause = `WHERE cp.user_id = ? AND (cp.scope = 'personal' OR cp.scope IS NULL)`;
      params.push(userId);
    } else if (scopeFilter === 'team') {
      // Only team projects in user's organization
      if (!orgId) {
        return res.json({ projects: [], total: 0 });
      }
      whereClause = `WHERE cp.scope = 'team' AND cp.organization_id = ?`;
      params.push(orgId);
    } else {
      // All: personal + team
      whereClause = `WHERE cp.user_id = ?`;
      params.push(userId);
      if (orgId) {
        whereClause += ` OR (cp.scope = 'team' AND cp.organization_id = ?)`;
        params.push(orgId);
      }
      whereClause = `WHERE (${whereClause.replace('WHERE ', '')})`;
    }

    const projectsResult = await db.query(
      `
            SELECT 
                cp.*,
                (SELECT COUNT(*) FROM conversations WHERE chat_project_id = cp.id) as conversation_count
            FROM chat_projects cp
            ${whereClause}
            ORDER BY cp.scope DESC, cp.updated_at DESC
        `,
      params
    );

    const projects = Array.isArray(projectsResult)
      ? projectsResult
      : (projectsResult as any)?.rows && Array.isArray((projectsResult as any).rows)
        ? (projectsResult as any).rows
        : [];

    res.json({
      projects,
      total: projects.length,
    });
  } catch (error: any) {
    if (isMissingSqliteTable(error, 'chat_projects')) {
      logger.warn('[ChatProjects] chat_projects table missing - returning empty list');
      return res.json({ projects: [], total: 0 });
    }
    logger.error('[ChatProjects] Get all error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ==================== GET SINGLE PROJECT ====================

router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Allow access if user owns it OR it's a team project in their org
    const project = await db.queryOne(
      `
            SELECT 
                cp.*,
                (SELECT COUNT(*) FROM conversations WHERE chat_project_id = cp.id) as conversation_count
            FROM chat_projects cp
            WHERE cp.id = ? AND (
              cp.user_id = ?
              OR (cp.scope = 'team' AND cp.organization_id = ?)
            )
        `,
      [id, userId, orgId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get conversations in this project
    const conversationsResult = await db.query(
      `
            SELECT c.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as created_by_name
            FROM conversations c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.chat_project_id = ?
            ORDER BY c.updated_at DESC
        `,
      [id]
    );

    const conversations = Array.isArray(conversationsResult)
      ? conversationsResult
      : (conversationsResult as any)?.rows && Array.isArray((conversationsResult as any).rows)
        ? (conversationsResult as any).rows
        : [];

    res.json({
      ...project,
      conversations,
    });
  } catch (error: any) {
    if (isMissingSqliteTable(error, 'chat_projects')) {
      logger.warn('[ChatProjects] chat_projects table missing - returning 404');
      return res.status(404).json({ error: 'Project not found' });
    }
    logger.error('[ChatProjects] Get one error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ==================== CREATE PROJECT ====================

router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = CreateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { name, description, color, icon, scope } = validation.data;

    // Team projects require an organization and create_project permission
    if (scope === 'team') {
      if (!orgId) {
        return res.status(400).json({ error: 'Team projects require an organization' });
      }
      const perm = await checkChatPermission(userId, orgId, 'create_project');
      if (!perm.allowed) {
        return res.status(403).json({
          error: 'No permission to create team projects',
          reason: perm.reason,
          role: perm.role,
        });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const db = getDatabase();

    await db.run(
      `
            INSERT INTO chat_projects (id, user_id, organization_id, name, description, color, icon, scope, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        id,
        userId,
        scope === 'team' ? orgId : orgId || null,
        name,
        description || null,
        color,
        icon,
        scope,
        now,
        now,
      ]
    );

    const project = {
      id,
      user_id: userId,
      organization_id: scope === 'team' ? orgId : orgId || null,
      name,
      description,
      color,
      icon,
      scope,
      conversation_count: 0,
      created_at: now,
      updated_at: now,
    };

    logger.info(`[ChatProjects] Created ${scope} project: ${id} by user ${userId}`);
    res.status(201).json(project);
  } catch (error: any) {
    logger.error('[ChatProjects] Create error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ==================== UPDATE PROJECT ====================

router.patch('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = UpdateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const updates = validation.data;
    const db = getDatabase();

    // Find project (personal ownership or team in org)
    const existing = (await db.queryOne(
      `SELECT id, user_id, scope, organization_id FROM chat_projects
       WHERE id = ? AND (user_id = ? OR (scope = 'team' AND organization_id = ?))`,
      [id, userId, orgId]
    )) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // For team projects, check edit_project permission
    if (existing.scope === 'team' && existing.organization_id) {
      const isCreator = existing.user_id === userId;
      const perm = await checkChatPermission(userId, existing.organization_id, 'edit_project', {
        isCreator,
      });
      if (!perm.allowed) {
        return res.status(403).json({
          error: 'No permission to edit this team project',
          reason: perm.reason,
          role: perm.role,
        });
      }
    }

    // Build update query
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }
    if (updates.icon !== undefined) {
      fields.push('icon = ?');
      values.push(updates.icon);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await db.run(`UPDATE chat_projects SET ${fields.join(', ')} WHERE id = ?`, values);

    logger.info(`[ChatProjects] Updated project: ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Update error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ==================== DELETE PROJECT ====================

router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Find project
    const existing = (await db.queryOne(
      `SELECT id, user_id, scope, organization_id FROM chat_projects
       WHERE id = ? AND (user_id = ? OR (scope = 'team' AND organization_id = ?))`,
      [id, userId, orgId]
    )) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // For team projects, check delete_project permission
    if (existing.scope === 'team' && existing.organization_id) {
      const isCreator = existing.user_id === userId;
      const perm = await checkChatPermission(userId, existing.organization_id, 'delete_project', {
        isCreator,
      });
      if (!perm.allowed) {
        return res.status(403).json({
          error: 'No permission to delete this team project',
          reason: perm.reason,
          role: perm.role,
        });
      }
    }

    // Remove project reference from conversations (don't delete conversations)
    await db.run(`UPDATE conversations SET chat_project_id = NULL WHERE chat_project_id = ?`, [id]);

    // Delete project
    await db.run(`DELETE FROM chat_projects WHERE id = ?`, [id]);

    logger.info(`[ChatProjects] Deleted project: ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ==================== MOVE CONVERSATION TO PROJECT ====================

router.post(
  '/:id/conversations/:conversationId',
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const orgId = (req as any).user?.organizationId;
      const { id, conversationId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = getDatabase();

      // Check project access (personal or team)
      const project = (await db.queryOne(
        `SELECT id, scope, organization_id FROM chat_projects
         WHERE id = ? AND (user_id = ? OR (scope = 'team' AND organization_id = ?))`,
        [id, userId, orgId]
      )) as any;

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check conversation access (personal or team in same org)
      const conversation = await db.queryOne(
        `SELECT id FROM conversations
         WHERE id = ? AND (user_id = ? OR organization_id = ?)`,
        [conversationId, userId, orgId]
      );

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Move conversation to project
      await db.run(`UPDATE conversations SET chat_project_id = ?, updated_at = ? WHERE id = ?`, [
        id,
        new Date().toISOString(),
        conversationId,
      ]);

      logger.info(`[ChatProjects] Moved conversation ${conversationId} to project ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      logger.error('[ChatProjects] Move conversation error:', error);
      res.status(500).json({ error: 'Failed to move conversation' });
    }
  }
);

// ==================== REMOVE CONVERSATION FROM PROJECT ====================

router.delete(
  '/:id/conversations/:conversationId',
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const orgId = (req as any).user?.organizationId;
      const { id, conversationId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = getDatabase();

      // Remove from project (personal or team)
      await db.run(
        `UPDATE conversations 
         SET chat_project_id = NULL, updated_at = ? 
         WHERE id = ? AND chat_project_id = ?
           AND (user_id = ? OR organization_id = ?)`,
        [new Date().toISOString(), conversationId, id, userId, orgId]
      );

      logger.info(`[ChatProjects] Removed conversation ${conversationId} from project ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      logger.error('[ChatProjects] Remove conversation error:', error);
      res.status(500).json({ error: 'Failed to remove conversation' });
    }
  }
);

export default router;
