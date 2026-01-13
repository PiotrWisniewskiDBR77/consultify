// @ts-nocheck
/**
 * Chat Projects Routes
 *
 * CRUD routes for managing chat projects (folders/categories).
 * Allows organizing conversations into projects like Claude AI or OpenAI's project feature.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

const router = Router();

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

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    const projects = await db.query(
      `
            SELECT 
                cp.*,
                (SELECT COUNT(*) FROM conversations WHERE chat_project_id = cp.id) as conversation_count
            FROM chat_projects cp
            WHERE cp.user_id = ? OR cp.organization_id = ?
            ORDER BY cp.updated_at DESC
        `,
      [userId, orgId]
    );

    res.json({
      projects: projects || [],
      total: projects?.length || 0,
    });
  } catch (error: any) {
    logger.error('[ChatProjects] Get all error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ==================== GET SINGLE PROJECT ====================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    const project = await db.queryOne(
      `
            SELECT 
                cp.*,
                (SELECT COUNT(*) FROM conversations WHERE chat_project_id = cp.id) as conversation_count
            FROM chat_projects cp
            WHERE cp.id = ? AND (cp.user_id = ? OR cp.organization_id = ?)
        `,
      [id, userId, (req as any).user?.organizationId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get conversations in this project
    const conversations = await db.query(
      `
            SELECT * FROM conversations 
            WHERE chat_project_id = ?
            ORDER BY updated_at DESC
        `,
      [id]
    );

    res.json({
      ...project,
      conversations: conversations || [],
    });
  } catch (error: any) {
    logger.error('[ChatProjects] Get one error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ==================== CREATE PROJECT ====================

router.post('/', async (req: Request, res: Response) => {
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

    const { name, description, color, icon } = validation.data;
    const id = uuidv4();
    const now = new Date().toISOString();

    const db = getDatabase();

    await db.run(
      `
            INSERT INTO chat_projects (id, user_id, organization_id, name, description, color, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [id, userId, orgId, name, description || null, color, icon, now, now]
    );

    const project = {
      id,
      user_id: userId,
      organization_id: orgId,
      name,
      description,
      color,
      icon,
      conversation_count: 0,
      created_at: now,
      updated_at: now,
    };

    logger.info(`[ChatProjects] Created project: ${id} by user ${userId}`);
    res.status(201).json(project);
  } catch (error: any) {
    logger.error('[ChatProjects] Create error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ==================== UPDATE PROJECT ====================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
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

    // Check ownership
    const existing = await db.queryOne(
      `
            SELECT id FROM chat_projects WHERE id = ? AND (user_id = ? OR organization_id = ?)
        `,
      [id, userId, (req as any).user?.organizationId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
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

    await db.run(
      `
            UPDATE chat_projects SET ${fields.join(', ')} WHERE id = ?
        `,
      values
    );

    logger.info(`[ChatProjects] Updated project: ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Update error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ==================== DELETE PROJECT ====================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Check ownership
    const existing = await db.queryOne(
      `
            SELECT id FROM chat_projects WHERE id = ? AND (user_id = ? OR organization_id = ?)
        `,
      [id, userId, (req as any).user?.organizationId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove project reference from conversations (don't delete conversations)
    await db.run(
      `
            UPDATE conversations SET chat_project_id = NULL WHERE chat_project_id = ?
        `,
      [id]
    );

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

router.post('/:id/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id, conversationId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Check project ownership
    const project = await db.queryOne(
      `
            SELECT id FROM chat_projects WHERE id = ? AND (user_id = ? OR organization_id = ?)
        `,
      [id, userId, (req as any).user?.organizationId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check conversation ownership
    const conversation = await db.queryOne(
      `
            SELECT id FROM conversations WHERE id = ? AND user_id = ?
        `,
      [conversationId, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Move conversation to project
    await db.run(
      `
            UPDATE conversations SET chat_project_id = ?, updated_at = ? WHERE id = ?
        `,
      [id, new Date().toISOString(), conversationId]
    );

    logger.info(`[ChatProjects] Moved conversation ${conversationId} to project ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Move conversation error:', error);
    res.status(500).json({ error: 'Failed to move conversation' });
  }
});

// ==================== REMOVE CONVERSATION FROM PROJECT ====================

router.delete('/:id/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id, conversationId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Remove from project (set chat_project_id to NULL)
    await db.run(
      `
            UPDATE conversations 
            SET chat_project_id = NULL, updated_at = ? 
            WHERE id = ? AND user_id = ? AND chat_project_id = ?
        `,
      [new Date().toISOString(), conversationId, userId, id]
    );

    logger.info(`[ChatProjects] Removed conversation ${conversationId} from project ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Remove conversation error:', error);
    res.status(500).json({ error: 'Failed to remove conversation' });
  }
});

export default router;
