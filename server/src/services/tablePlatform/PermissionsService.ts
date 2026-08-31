/**
 * Table Platform Permissions Service (v2)
 * 7-role model: base_owner, schema_editor, data_editor, view_editor,
 * interface_builder, viewer, form_submitter.
 *
 * Falls back to org/creator-based access when tp_base_members has no entries
 * for the base (backwards-compatible with v1).
 */

import type { NextFunction, Request, Response } from 'express';

import { getDatabase } from '../../database/Database.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import logger from '../../utils/Logger.js';

export type BaseRole =
  | 'base_owner'
  | 'schema_editor'
  | 'data_editor'
  | 'view_editor'
  | 'interface_builder'
  | 'viewer'
  | 'form_submitter';

const ROLE_HIERARCHY: Record<BaseRole, number> = {
  base_owner: 7,
  schema_editor: 6,
  data_editor: 5,
  view_editor: 4,
  interface_builder: 3,
  viewer: 2,
  form_submitter: 1,
};

const SCHEMA_WRITE_ROLES: BaseRole[] = ['base_owner', 'schema_editor'];
const DATA_WRITE_ROLES: BaseRole[] = ['base_owner', 'schema_editor', 'data_editor'];
const VIEW_WRITE_ROLES: BaseRole[] = ['base_owner', 'schema_editor', 'data_editor', 'view_editor'];
const INTERFACE_WRITE_ROLES: BaseRole[] = ['base_owner', 'interface_builder'];
const READ_ROLES: BaseRole[] = [
  'base_owner',
  'schema_editor',
  'data_editor',
  'view_editor',
  'interface_builder',
  'viewer',
];

const SCHEMA_ROLES: BaseRole[] = ['base_owner', 'schema_editor'];
const DATA_ROLES: BaseRole[] = ['base_owner', 'schema_editor', 'data_editor'];
const VIEW_ROLES: BaseRole[] = ['base_owner', 'schema_editor', 'view_editor'];
const INTERFACE_ROLES: BaseRole[] = ['base_owner', 'schema_editor', 'interface_builder'];
const ALL_ROLES: BaseRole[] = [
  'base_owner',
  'schema_editor',
  'data_editor',
  'view_editor',
  'interface_builder',
  'viewer',
  'form_submitter',
];

const permissionsService = {
  /**
   * Get user's explicit role in a base, or null if not a member.
   */
  async getUserRole(baseId: string, userId: string): Promise<BaseRole | null> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT role FROM tp_base_members WHERE base_id = $1 AND user_id = $2',
        [baseId, userId]
      );
      const row = result.rows[0] as { role: string } | undefined;
      return (row?.role as BaseRole) ?? null;
    } catch (e) {
      logger.error('[Permissions] getUserRole failed', { error: (e as Error).message });
      return null;
    }
  },

  /**
   * Check if user's role is in the allowed set. Falls back to org-level access
   * when no tp_base_members entries exist for the base.
   */
  async requireRole(
    baseId: string,
    userId: string,
    orgId: string,
    allowedRoles: BaseRole[]
  ): Promise<{ allowed: boolean; role: BaseRole | null }> {
    const role = await permissionsService.getUserRole(baseId, userId);

    if (role) {
      return { allowed: allowedRoles.includes(role), role };
    }

    // Fallback: no tp_base_members entries — check legacy org/creator access
    const hasLegacyAccess = await permissionsService.canAccessBase(userId, orgId, baseId);
    if (hasLegacyAccess) {
      logger.warn(
        '[Permissions] Legacy fallback used — user has no tp_base_members entry, granting base_owner via org/creator access',
        {
          userId,
          baseId,
          allowedRoles,
        }
      );
      return { allowed: true, role: 'base_owner' };
    }
    return { allowed: false, role: null };
  },

  /**
   * Assign or update a role for a user in a base.
   */
  async setUserRole(baseId: string, userId: string, role: BaseRole): Promise<void> {
    const db = getDatabase();
    try {
      await db.query(
        `INSERT INTO tp_base_members (base_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (base_id, user_id) DO UPDATE SET role = $3, updated_at = NOW()`,
        [baseId, userId, role]
      );
    } catch (e) {
      logger.error('[Permissions] setUserRole failed', { error: (e as Error).message });
      throw e;
    }
  },

  /**
   * Remove a user's role from a base.
   */
  async removeUserRole(baseId: string, userId: string): Promise<void> {
    const db = getDatabase();
    try {
      await db.query('DELETE FROM tp_base_members WHERE base_id = $1 AND user_id = $2', [
        baseId,
        userId,
      ]);
    } catch (e) {
      logger.error('[Permissions] removeUserRole failed', { error: (e as Error).message });
      throw e;
    }
  },

  /**
   * List all members of a base.
   */
  async listBaseMembers(
    baseId: string
  ): Promise<Array<{ userId: string; role: BaseRole; createdAt: string }>> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT user_id, role, created_at FROM tp_base_members WHERE base_id = $1 ORDER BY created_at ASC',
        [baseId]
      );
      return result.rows as Array<{ userId: string; role: BaseRole; createdAt: string }>;
    } catch (e) {
      logger.error('[Permissions] listBaseMembers failed', { error: (e as Error).message });
      return [];
    }
  },

  /**
   * Check if user has access to a base (read or write).
   * Base creator always has full access; org members have read/write.
   */
  async canAccessBase(userId: string, orgId: string, baseId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT organization_id, created_by FROM tp_bases WHERE id = $1',
        [baseId]
      );
      const base = result.rows[0] as { created_by: string; organization_id: string } | undefined;
      if (!base) return false;
      if (base.created_by === userId) return true;
      return base.organization_id === orgId;
    } catch (e) {
      logger.error('[Permissions] canAccessBase failed', { error: (e as Error).message });
      return false;
    }
  },

  /**
   * Check if user can modify a base — requires data_editor or higher.
   */
  async canModifyBase(userId: string, orgId: string, baseId: string): Promise<boolean> {
    const { allowed } = await permissionsService.requireRole(baseId, userId, orgId, DATA_WRITE_ROLES);
    return allowed;
  },

  /**
   * Check if user can modify schema — requires schema_editor or base_owner.
   */
  async canModifySchema(userId: string, orgId: string, baseId: string): Promise<boolean> {
    const { allowed } = await permissionsService.requireRole(baseId, userId, orgId, SCHEMA_WRITE_ROLES);
    return allowed;
  },

  /**
   * Check if user has access to a table (resolves table → base, then checks base).
   */
  async canAccessTable(userId: string, orgId: string, tableId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT t.base_id FROM tp_tables t WHERE t.id = $1', [tableId]);
      const table = result.rows[0] as { base_id: string } | undefined;
      if (!table) return false;
      return permissionsService.canAccessBase(userId, orgId, table.base_id);
    } catch (e) {
      logger.error('[Permissions] canAccessTable failed', { error: (e as Error).message });
      return false;
    }
  },

  /**
   * Express middleware: require base access. Extracts baseId from params or body.
   * Returns 403 if denied.
   */
  requireBaseAccess(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const orgId = authReq.organizationId;
    if (!userId || !orgId) {
      res.status(403).json({ error: 'Authentication and organization context required' });
      return;
    }
    const baseId = authReq.params?.baseId ?? authReq.body?.baseId;
    if (!baseId) {
      res.status(400).json({ error: 'baseId required' });
      return;
    }
    permissionsService
      .canAccessBase(userId, orgId, baseId)
      .then((allowed) => {
        if (!allowed) {
          res.status(403).json({ error: 'Access denied to this base' });
          return;
        }
        next();
      })
      .catch(next);
  },

  /**
   * Express middleware: require access to a governed model.
   * Resolves base_id from tp_governed_models, then checks canAccessBase.
   * Returns 403 if denied, 404 if model not found.
   */
  requireGovernedModelAccess(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const orgId = authReq.organizationId;
    if (!userId || !orgId) {
      res.status(403).json({ error: 'Authentication and organization context required' });
      return;
    }
    const modelId = authReq.params?.modelId;
    if (!modelId) {
      res.status(400).json({ error: 'modelId required' });
      return;
    }
    const db = getDatabase();
    db.query('SELECT base_id FROM tp_governed_models WHERE model_id = $1', [modelId])
      .then(async (result) => {
        const row = result.rows[0] as { base_id: string } | undefined;
        if (!row) {
          res.status(404).json({ error: 'Governed model not found' });
          return;
        }
        const allowed = await permissionsService.canAccessBase(userId, orgId, row.base_id);
        if (!allowed) {
          res.status(403).json({ error: 'Access denied to this governed model' });
          return;
        }
        next();
      })
      .catch(next);
  },

  /**
   * Express middleware: require table access. Extracts tableId from params.
   * Returns 403 if denied.
   */
  requireTableAccess(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const orgId = authReq.organizationId;
    if (!userId || !orgId) {
      res.status(403).json({ error: 'Authentication and organization context required' });
      return;
    }
    const tableId = authReq.params?.tableId;
    if (!tableId) {
      res.status(400).json({ error: 'tableId required' });
      return;
    }
    permissionsService
      .canAccessTable(userId, orgId, tableId)
      .then((allowed) => {
        if (!allowed) {
          res.status(403).json({ error: 'Access denied to this table' });
          return;
        }
        next();
      })
      .catch(next);
  },

  /**
   * Express middleware factory: require specific roles for an operation.
   * Resolves baseId from params (baseId, tableId, fieldId, viewId, recordId,
   * interfaceId, proposalId), body, or cached `req.resolvedBaseId`.
   */
  requireRoles(...roles: BaseRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;
      const orgId = authReq.organizationId;
      if (!userId || !orgId) {
        res.status(403).json({ error: 'Authentication and organization context required' });
        return;
      }

      const resolveBaseId = async (): Promise<string | null> => {
        const cached = (authReq as any).resolvedBaseId;
        if (cached) return cached;

        if (authReq.params?.baseId) return authReq.params.baseId;
        if (authReq.body?.baseId) return authReq.body.baseId;

        const db = getDatabase();

        const tableId = authReq.params?.tableId;
        if (tableId) {
          const r = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
          return (r.rows[0] as { base_id?: string })?.base_id ?? null;
        }

        const fieldId = authReq.params?.fieldId;
        if (fieldId) {
          const r = await db.query(
            'SELECT t.base_id FROM tp_fields f JOIN tp_tables t ON f.table_id = t.id WHERE f.id = $1',
            [fieldId]
          );
          return (r.rows[0] as { base_id?: string })?.base_id ?? null;
        }

        const viewId = authReq.params?.viewId;
        if (viewId) {
          const r = await db.query(
            'SELECT t.base_id FROM tp_views v JOIN tp_tables t ON v.table_id = t.id WHERE v.id = $1',
            [viewId]
          );
          return (r.rows[0] as { base_id?: string })?.base_id ?? null;
        }

        const recordId = authReq.params?.recordId;
        if (recordId) {
          const r = await db.query(
            'SELECT t.base_id FROM tp_records r JOIN tp_tables t ON r.table_id = t.id WHERE r.id = $1',
            [recordId]
          );
          return (r.rows[0] as { base_id?: string })?.base_id ?? null;
        }

        const interfaceId = authReq.params?.interfaceId;
        if (interfaceId) {
          const r = await db.query('SELECT base_id FROM tp_interfaces WHERE id = $1', [
            interfaceId,
          ]);
          return (r.rows[0] as { base_id?: string })?.base_id ?? null;
        }

        const proposalId = authReq.params?.proposalId;
        if (proposalId) {
          const r = await db.query('SELECT operations FROM tp_schema_proposals WHERE id = $1', [
            proposalId,
          ]);
          const row = r.rows[0] as { operations?: string | unknown[] } | undefined;
          if (row?.operations) {
            const ops =
              typeof row.operations === 'string' ? JSON.parse(row.operations) : row.operations;
            if (Array.isArray(ops) && ops.length > 0) {
              return (ops[0] as any)?.target?.base_id ?? null;
            }
          }
          return null;
        }

        return null;
      };

      resolveBaseId()
        .then(async (baseId) => {
          if (!baseId) {
            res.status(400).json({ error: 'Cannot resolve baseId for permission check' });
            return;
          }
          (authReq as any).resolvedBaseId = baseId;

          const { allowed, role } = await permissionsService.requireRole(
            baseId,
            userId,
            orgId,
            roles
          );
          if (!allowed) {
            res.status(403).json({
              error: `Access denied. Required roles: ${roles.join(', ')}. Current role: ${role ?? 'none'}`,
            });
            return;
          }
          (authReq as any).userRole = role;
          next();
        })
        .catch(next);
    };
  },

  /**
   * Express middleware: resolve field → table access.
   */
  requireFieldAccess(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthRequest;
    const fieldId = authReq.params?.fieldId;
    if (!fieldId) {
      res.status(400).json({ error: 'fieldId required' });
      return;
    }
    const db = getDatabase();
    db.query('SELECT table_id FROM tp_fields WHERE id = $1', [fieldId])
      .then((result) => {
        const row = result.rows[0] as { table_id?: string } | undefined;
        if (!row?.table_id) {
          res.status(404).json({ error: 'Field not found' });
          return;
        }
        authReq.params.tableId = row.table_id;
        permissionsService.requireTableAccess(req, res, next);
      })
      .catch(next);
  },

  /**
   * Express middleware: resolve record → table access.
   */
  requireRecordAccess(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthRequest;
    const recordId = authReq.params?.recordId;
    if (!recordId) {
      res.status(400).json({ error: 'recordId required' });
      return;
    }
    const db = getDatabase();
    db.query('SELECT table_id FROM tp_records WHERE id = $1', [recordId])
      .then((result) => {
        const row = result.rows[0] as { table_id?: string } | undefined;
        if (!row?.table_id) {
          res.status(404).json({ error: 'Record not found' });
          return;
        }
        authReq.params.tableId = row.table_id;
        permissionsService.requireTableAccess(req, res, next);
      })
      .catch(next);
  },

  /**
   * Express middleware: resolve view → table access.
   */
  requireViewAccess(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthRequest;
    const viewId = authReq.params?.viewId;
    if (!viewId) {
      res.status(400).json({ error: 'viewId required' });
      return;
    }
    const db = getDatabase();
    db.query('SELECT table_id FROM tp_views WHERE id = $1', [viewId])
      .then((result) => {
        const row = result.rows[0] as { table_id?: string } | undefined;
        if (!row?.table_id) {
          res.status(404).json({ error: 'View not found' });
          return;
        }
        authReq.params.tableId = row.table_id;
        permissionsService.requireTableAccess(req, res, next);
      })
      .catch(next);
  },

  // Re-export constants for external use
  SCHEMA_WRITE_ROLES,
  DATA_WRITE_ROLES,
  VIEW_WRITE_ROLES,
  INTERFACE_WRITE_ROLES,
  READ_ROLES,
  ROLE_HIERARCHY,
  SCHEMA_ROLES,
  DATA_ROLES,
  VIEW_ROLES,
  INTERFACE_ROLES,
  ALL_ROLES,
};

export default permissionsService;
