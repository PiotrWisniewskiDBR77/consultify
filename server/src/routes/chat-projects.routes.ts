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
import { emitChatProjectsChanged } from '../realtime/chatProjectsRealtime.js';
import { checkChatPermission } from '../services/chatPermissionService.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

const router = Router();

const isMissingSqliteTable = (error: any, tableName: string): boolean => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === 'SQLITE_ERROR' && msg.includes(`no such table: ${tableName}`.toLowerCase());
};

// Per-project custom instructions (composer #5). DB_MANAGED_SCHEMA may be off in
// dev, so a migration alone won't apply — ensure the column exists lazily with an
// idempotent, additive, nullable ALTER (Postgres `IF NOT EXISTS`). Runs once.
let _ciColumnReady: boolean | null = null;
async function ensureCustomInstructionsColumn(): Promise<boolean> {
  if (_ciColumnReady !== null) return _ciColumnReady;
  try {
    const db = getDatabase();
    await db.run('ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS custom_instructions TEXT');
    _ciColumnReady = true;
  } catch (e: any) {
    logger.warn(`[ChatProjects] ensure custom_instructions column failed: ${e?.message}`);
    _ciColumnReady = false;
  }
  return _ciColumnReady;
}

// F2: Team projects RBAC schema (visibility + members + per-chat sharing).
// Lazy, idempotent, additive — defaults preserve current behaviour (visibility
// 'org'). Backfills creator-as-owner for existing team projects.
let _rbacReady: boolean | null = null;
async function ensureProjectRbacSchema(): Promise<boolean> {
  if (_rbacReady !== null) return _rbacReady;
  try {
    const db = getDatabase();
    await db.run("ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'org'");
    // F4c: nested folders.
    await db.run('ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS parent_id TEXT');
    await db.run(`CREATE TABLE IF NOT EXISTS chat_project_members (
      project_id TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'viewer',
      added_by   TEXT,
      added_at   TEXT,
      PRIMARY KEY (project_id, user_id)
    )`);
    await db.run('CREATE INDEX IF NOT EXISTS idx_cpm_user ON chat_project_members(user_id)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cpm_project ON chat_project_members(project_id)');
    await db.run(
      'ALTER TABLE conversations ADD COLUMN IF NOT EXISTS shared_to_project BOOLEAN DEFAULT FALSE'
    );
    // F3: per-project knowledge (text snippets + uploaded files) shared with members.
    await db.run(`CREATE TABLE IF NOT EXISTS project_knowledge (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind       TEXT NOT NULL DEFAULT 'text',
      title      TEXT,
      content    TEXT,
      doc_id     TEXT,
      added_by   TEXT,
      added_at   TEXT
    )`);
    await db.run('CREATE INDEX IF NOT EXISTS idx_pk_project ON project_knowledge(project_id)');
    // Backfill creator-as-owner for team projects missing it.
    await db.run(`INSERT INTO chat_project_members (project_id, user_id, role, added_by, added_at)
      SELECT cp.id, cp.user_id, 'owner', cp.user_id, NOW()::TEXT
      FROM chat_projects cp
      WHERE cp.scope = 'team' AND cp.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM chat_project_members m
          WHERE m.project_id = cp.id AND m.user_id = cp.user_id
        )`);
    _rbacReady = true;
  } catch (e: any) {
    logger.warn(`[ChatProjects] ensure RBAC schema failed: ${e?.message}`);
    _rbacReady = false;
  }
  return _rbacReady;
}

const dbGetOne = (db: any, sql: string, params: unknown[]) => {
  const getOne = typeof db.get === 'function' ? db.get : db.queryOne;
  return getOne.call(db, sql, params);
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
  /** F2: team-project visibility. 'org' = whole org · 'private' = invited members only. */
  visibility: z.enum(['org', 'private']).optional(),
  /** F4c: parent folder id for nesting (null/omit = top level). */
  parentId: z.string().optional().nullable(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  /** Per-project brief injected into Teresa's system prompt (composer #5). */
  customInstructions: z.string().max(4000).optional().nullable(),
  /** F2: team-project visibility (owner-only). */
  visibility: z.enum(['org', 'private']).optional(),
  /** F4c: move folder under another (null = move to top level). */
  parentId: z.string().nullable().optional(),
});

// ==================== GET ALL PROJECTS ====================

router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
    const scopeFilter = (req.query as any).scope; // 'personal' | 'team' | undefined (all)

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();
    await ensureCustomInstructionsColumn();
    const rbacReady = await ensureProjectRbacSchema();

    let whereClause: string;
    const params: string[] = [];

    // F2: a team project is visible to a user when it's org-wide ('org'/legacy
    // NULL) OR the user is an explicit member. Personal projects are unaffected.
    const teamVisible = (): string => {
      if (!rbacReady) return '';
      params.push(userId);
      return ` AND (cp.visibility <> 'private' OR cp.visibility IS NULL OR EXISTS (SELECT 1 FROM chat_project_members m WHERE m.project_id = cp.id AND m.user_id = ?))`;
    };

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
      whereClause += teamVisible();
    } else {
      // All: personal (owned) + visible team projects.
      whereClause = `WHERE (cp.user_id = ?`;
      params.push(userId);
      if (orgId) {
        params.push(orgId);
        const tv = teamVisible(); // pushes userId (member check) AFTER orgId
        whereClause += ` OR (cp.scope = 'team' AND cp.organization_id = ?${tv})`;
      }
      whereClause += `)`;
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
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Allow access if user owns it OR it's a team project in their org
    const project = await dbGetOne(
      db,
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
      [id, userId, orgId || null]
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
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;

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

    const { name, description, color, icon, scope, visibility, parentId } = validation.data;

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
    // F2: team projects get a visibility (default 'org' = current behaviour);
    // personal projects are always effectively private to the owner.
    const effectiveVisibility = scope === 'team' ? visibility || 'org' : 'org';

    const db = getDatabase();
    const rbacReady = await ensureProjectRbacSchema();

    const cols = await getTableColumns('chat_projects');
    const insertCols = [
      'id',
      'user_id',
      'organization_id',
      'name',
      'description',
      'color',
      'icon',
      'scope',
      'created_at',
      'updated_at',
    ];
    const insertVals = [
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
    ];
    if (rbacReady && cols.has('visibility')) {
      insertCols.push('visibility');
      insertVals.push(effectiveVisibility);
    }
    if (rbacReady && cols.has('parent_id') && parentId) {
      insertCols.push('parent_id');
      insertVals.push(String(parentId));
    }
    await db.run(
      `INSERT INTO chat_projects (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`,
      insertVals
    );

    // F2: creator becomes the project owner member.
    if (rbacReady && scope === 'team') {
      try {
        await db.run(
          `INSERT INTO chat_project_members (project_id, user_id, role, added_by, added_at)
           VALUES (?, ?, 'owner', ?, ?)`,
          [id, userId, userId, now]
        );
      } catch (e: any) {
        logger.warn(`[ChatProjects] owner membership insert failed: ${e?.message}`);
      }
    }

    const project = {
      id,
      user_id: userId,
      organization_id: scope === 'team' ? orgId : orgId || null,
      name,
      description,
      color,
      icon,
      scope,
      visibility: effectiveVisibility,
      parent_id: parentId || null,
      my_role: scope === 'team' ? 'owner' : undefined,
      conversation_count: 0,
      created_at: now,
      updated_at: now,
    };

    logger.info(`[ChatProjects] Created ${scope} project: ${id} by user ${userId}`);
    if (scope === 'team') emitChatProjectsChanged(orgId);
    res.status(201).json(project);
  } catch (error: any) {
    logger.error('[ChatProjects] Create error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ==================== UPDATE PROJECT ====================

router.patch('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
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
    const existing = (await dbGetOne(
      db,
      `SELECT id, user_id, scope, organization_id FROM chat_projects
       WHERE id = ? AND (user_id = ? OR (scope = 'team' AND organization_id = ?))`,
      [id, userId, orgId || null]
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
    if (updates.customInstructions !== undefined) {
      const ok = await ensureCustomInstructionsColumn();
      if (ok) {
        fields.push('custom_instructions = ?');
        values.push(updates.customInstructions ? String(updates.customInstructions).slice(0, 4000) : null);
      }
    }
    if (updates.visibility !== undefined) {
      // Only the project owner may change visibility (F2).
      const ok = await ensureProjectRbacSchema();
      const ownerRow = ok
        ? ((await dbGetOne(
            db,
            `SELECT role FROM chat_project_members WHERE project_id = ? AND user_id = ?`,
            [id, userId]
          )) as any)
        : null;
      const isOwner = ownerRow?.role === 'owner' || existing.user_id === userId;
      if (ok && isOwner) {
        fields.push('visibility = ?');
        values.push(updates.visibility);
      } else if (!isOwner) {
        return res.status(403).json({ error: 'Only the project owner can change visibility' });
      }
    }
    if (updates.parentId !== undefined) {
      const ok = await ensureProjectRbacSchema();
      const newParent = updates.parentId ? String(updates.parentId) : null;
      if (newParent === id) {
        return res.status(400).json({ error: 'A folder cannot be its own parent' });
      }
      // Cycle guard: the new parent must not be a descendant of this folder.
      if (ok && newParent) {
        let cursor: string | null = newParent;
        let depth = 0;
        while (cursor && depth < 50) {
          if (cursor === id) {
            return res.status(400).json({ error: 'That move would create a folder loop' });
          }
          const prow = (await dbGetOne(db, `SELECT parent_id FROM chat_projects WHERE id = ?`, [
            cursor,
          ])) as any;
          cursor = prow?.parent_id || null;
          depth++;
        }
      }
      if (ok) {
        fields.push('parent_id = ?');
        values.push(newParent);
      }
    }

    if (fields.length === 0) {
      return res.json({ success: true, noop: true });
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await db.run(`UPDATE chat_projects SET ${fields.join(', ')} WHERE id = ?`, values);

    logger.info(`[ChatProjects] Updated project: ${id}`);
    if (existing.scope === 'team') emitChatProjectsChanged(existing.organization_id || orgId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Update error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ==================== TEAM PROJECT MEMBERS (F2) ====================

/** Resolve the requester's role on a project, or null if not a member. */
async function getProjectRole(
  db: any,
  projectId: string,
  userId: string
): Promise<'owner' | 'editor' | 'viewer' | null> {
  try {
    const row = (await dbGetOne(
      db,
      `SELECT role FROM chat_project_members WHERE project_id = ? AND user_id = ?`,
      [projectId, userId]
    )) as any;
    return (row?.role as any) || null;
  } catch {
    return null;
  }
}

// List members of a team project.
router.get('/:id/members', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDatabase();
    await ensureProjectRbacSchema();

    const project = (await dbGetOne(
      db,
      `SELECT id, user_id, scope, organization_id, visibility FROM chat_projects WHERE id = ?`,
      [id]
    )) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Must be a member, the creator, or (for org-visible team projects) an org member.
    const myRole = await getProjectRole(db, id, userId);
    const orgVisible =
      project.scope === 'team' &&
      project.organization_id === orgId &&
      (project.visibility !== 'private' || !project.visibility);
    if (!myRole && project.user_id !== userId && !orgVisible) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const rows = (await db.query(
      `SELECT m.user_id, m.role, m.added_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS name,
              u.email AS email
       FROM chat_project_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.project_id = ?
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, m.added_at`,
      [id]
    )) as any;
    const members = Array.isArray(rows) ? rows : rows?.rows || [];
    return res.json({ members, myRole: myRole || (project.user_id === userId ? 'owner' : null) });
  } catch (error: any) {
    logger.error('[ChatProjects] List members error:', error?.message);
    return res.status(500).json({ error: 'Failed to list members' });
  }
});

// Add a member (by email or userId). Owner/editor only; same org.
router.post('/:id/members', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
    const { id } = req.params;
    const { email, memberUserId, role } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDatabase();
    await ensureProjectRbacSchema();

    const project = (await dbGetOne(
      db,
      `SELECT id, user_id, scope, organization_id FROM chat_projects WHERE id = ?`,
      [id]
    )) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.scope !== 'team') {
      return res.status(400).json({ error: 'Members apply to team projects only' });
    }
    const myRole = (await getProjectRole(db, id, userId)) || (project.user_id === userId ? 'owner' : null);
    if (myRole !== 'owner' && myRole !== 'editor') {
      return res.status(403).json({ error: 'Only owners or editors can add members' });
    }

    // Resolve the target user (by id or email) within the same org.
    let target: any = null;
    if (memberUserId) {
      target = (await dbGetOne(db, `SELECT id FROM users WHERE id = ?`, [memberUserId])) as any;
    } else if (email) {
      target = (await dbGetOne(db, `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [
        String(email).trim(),
      ])) as any;
    }
    if (!target?.id) return res.status(404).json({ error: 'User not found' });

    const newRole = ['owner', 'editor', 'viewer'].includes(role) ? role : 'viewer';
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO chat_project_members (project_id, user_id, role, added_by, added_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [id, target.id, newRole, userId, now]
    );
    emitChatProjectsChanged((req as any).organizationId);
    return res.status(201).json({ success: true, userId: target.id, role: newRole });
  } catch (error: any) {
    logger.error('[ChatProjects] Add member error:', error?.message);
    return res.status(500).json({ error: 'Failed to add member' });
  }
});

// Change a member's role. Owner only.
router.patch('/:id/members/:memberUserId', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const { id, memberUserId } = req.params;
    const { role } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const db = getDatabase();
    await ensureProjectRbacSchema();
    const project = (await dbGetOne(db, `SELECT user_id FROM chat_projects WHERE id = ?`, [
      id,
    ])) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const myRole = (await getProjectRole(db, id, userId)) || (project.user_id === userId ? 'owner' : null);
    if (myRole !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can change roles' });
    }
    await db.run(`UPDATE chat_project_members SET role = ? WHERE project_id = ? AND user_id = ?`, [
      role,
      id,
      memberUserId,
    ]);
    emitChatProjectsChanged((req as any).organizationId);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Update member role error:', error?.message);
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove a member. Owner removes anyone; a member may remove themselves (leave).
router.delete('/:id/members/:memberUserId', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const { id, memberUserId } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDatabase();
    await ensureProjectRbacSchema();
    const project = (await dbGetOne(db, `SELECT user_id FROM chat_projects WHERE id = ?`, [
      id,
    ])) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const myRole = (await getProjectRole(db, id, userId)) || (project.user_id === userId ? 'owner' : null);
    const isSelf = memberUserId === userId;
    if (myRole !== 'owner' && !isSelf) {
      return res.status(403).json({ error: 'Only the owner can remove members' });
    }
    // Never leave a project ownerless: block removing the last owner.
    const tgt = (await getProjectRole(db, id, memberUserId)) as any;
    if (tgt === 'owner') {
      const owners = (await db.query(
        `SELECT COUNT(*) AS cnt FROM chat_project_members WHERE project_id = ? AND role = 'owner'`,
        [id]
      )) as any;
      const cnt = Number((Array.isArray(owners) ? owners[0] : owners?.rows?.[0])?.cnt || 0);
      if (cnt <= 1) return res.status(400).json({ error: 'Cannot remove the last owner' });
    }
    await db.run(`DELETE FROM chat_project_members WHERE project_id = ? AND user_id = ?`, [
      id,
      memberUserId,
    ]);
    emitChatProjectsChanged((req as any).organizationId);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Remove member error:', error?.message);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ==================== PROJECT KNOWLEDGE (F3) ====================

// Determine if a user can see a project (member, creator, or org-visible team).
async function canSeeProject(db: any, project: any, userId: string, orgId: string | null) {
  if (!project) return false;
  if (project.user_id === userId) return true;
  const role = await getProjectRole(db, project.id, userId);
  if (role) return true;
  if (
    project.scope === 'team' &&
    project.organization_id === orgId &&
    (project.visibility !== 'private' || !project.visibility)
  ) {
    return true;
  }
  return project.scope !== 'team' && project.user_id === userId;
}

router.get('/:id/knowledge', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDatabase();
    await ensureProjectRbacSchema();
    const project = (await dbGetOne(
      db,
      `SELECT id, user_id, scope, organization_id, visibility FROM chat_projects WHERE id = ?`,
      [id]
    )) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!(await canSeeProject(db, project, userId, orgId))) {
      return res.status(403).json({ error: 'No access to this project' });
    }
    const rows = (await db.query(
      `SELECT id, kind, title, content, doc_id, added_by, added_at
       FROM project_knowledge WHERE project_id = ? ORDER BY added_at DESC`,
      [id]
    )) as any;
    return res.json({ knowledge: Array.isArray(rows) ? rows : rows?.rows || [] });
  } catch (error: any) {
    logger.error('[ChatProjects] List knowledge error:', error?.message);
    return res.status(500).json({ error: 'Failed to load knowledge' });
  }
});

router.post('/:id/knowledge', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const { id } = req.params;
    const { kind, title, content, docId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDatabase();
    await ensureProjectRbacSchema();
    const project = (await dbGetOne(db, `SELECT id, user_id, scope FROM chat_projects WHERE id = ?`, [
      id,
    ])) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Owner/editor (team) or the personal-project owner may add knowledge.
    const role = (await getProjectRole(db, id, userId)) || (project.user_id === userId ? 'owner' : null);
    const canWrite = role === 'owner' || role === 'editor' || project.user_id === userId;
    if (!canWrite) return res.status(403).json({ error: 'No permission to add knowledge' });

    const itemKind = kind === 'file' ? 'file' : 'text';
    if (itemKind === 'text' && !String(content || '').trim()) {
      return res.status(400).json({ error: 'content is required for a text item' });
    }
    if (itemKind === 'file' && !String(docId || '').trim()) {
      return res.status(400).json({ error: 'docId is required for a file item' });
    }
    const kid = uuidv4();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO project_knowledge (id, project_id, kind, title, content, doc_id, added_by, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kid,
        id,
        itemKind,
        title ? String(title).slice(0, 300) : null,
        itemKind === 'text' ? String(content).slice(0, 8000) : null,
        itemKind === 'file' ? String(docId) : null,
        userId,
        now,
      ]
    );
    return res
      .status(201)
      .json({ id: kid, kind: itemKind, title: title || null, doc_id: docId || null, added_at: now });
  } catch (error: any) {
    logger.error('[ChatProjects] Add knowledge error:', error?.message);
    return res.status(500).json({ error: 'Failed to add knowledge' });
  }
});

router.delete('/:id/knowledge/:knowledgeId', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const { id, knowledgeId } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDatabase();
    await ensureProjectRbacSchema();
    const project = (await dbGetOne(db, `SELECT user_id FROM chat_projects WHERE id = ?`, [
      id,
    ])) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const role = (await getProjectRole(db, id, userId)) || (project.user_id === userId ? 'owner' : null);
    const canWrite = role === 'owner' || role === 'editor' || project.user_id === userId;
    if (!canWrite) return res.status(403).json({ error: 'No permission' });
    await db.run(`DELETE FROM project_knowledge WHERE id = ? AND project_id = ?`, [knowledgeId, id]);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[ChatProjects] Delete knowledge error:', error?.message);
    return res.status(500).json({ error: 'Failed to delete knowledge' });
  }
});

// ==================== DELETE PROJECT ====================

router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    const orgId = (req as any).organizationId || (req as any).user?.organizationId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();

    // Find project
    const existing = (await dbGetOne(
      db,
      `SELECT id, user_id, scope, organization_id FROM chat_projects
       WHERE id = ? AND (user_id = ? OR (scope = 'team' AND organization_id = ?))`,
      [id, userId, orgId || null]
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
    emitChatProjectsChanged((req as any).organizationId);
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
      const userId = (req as any).userId || (req as any).user?.id;
      const orgId = (req as any).organizationId || (req as any).user?.organizationId;
      const { id, conversationId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = getDatabase();

      // Check project access (personal or team)
      const project = (await dbGetOne(
        db,
        `SELECT id, user_id, scope, organization_id FROM chat_projects
         WHERE id = ? AND (user_id = ? OR (scope = 'team' AND organization_id = ?))`,
        [id, userId, orgId || null]
      )) as any;

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.scope === 'team' && project.organization_id) {
        const perm = await checkChatPermission(userId, project.organization_id, 'manage_thread', {
          isCreator: project.user_id === userId,
        });
        if (!perm.allowed) {
          return res.status(403).json({
            error: 'No permission to move conversations into this team project',
            reason: perm.reason,
            role: perm.role,
          });
        }
      }

      // Check conversation access (personal ownership/creator or same org).
      // Some legacy rows use created_by as the owner field, so accept both.
      const conversation = await dbGetOne(
        db,
        `SELECT id FROM conversations
         WHERE id = ? AND (
           user_id = ?
           OR created_by = ?
           OR (organization_id IS NOT NULL AND organization_id = ?)
         )`,
        [conversationId, userId, userId, orgId || null]
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
      emitChatProjectsChanged((req as any).organizationId);
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
      const userId = (req as any).userId || (req as any).user?.id;
      const orgId = (req as any).organizationId || (req as any).user?.organizationId;
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
           AND (
             user_id = ?
             OR created_by = ?
             OR (organization_id IS NOT NULL AND organization_id = ?)
           )`,
        [new Date().toISOString(), conversationId, id, userId, userId, orgId || null]
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
