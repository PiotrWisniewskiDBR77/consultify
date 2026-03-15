/**
 * Table Platform Permissions Service (v1)
 * Simple base/table access checks and Express middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

const permissionsService = {
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
      const base = result.rows[0];
      if (!base) return false;
      if (base.created_by === userId) return true;
      return base.organization_id === orgId;
    } catch (e) {
      logger.error('[Permissions] canAccessBase failed', { error: (e as Error).message });
      return false;
    }
  },

  /**
   * Check if user can modify a base (v1: same as canAccessBase).
   */
  async canModifyBase(userId: string, orgId: string, baseId: string): Promise<boolean> {
    return permissionsService.canAccessBase(userId, orgId, baseId);
  },

  /**
   * Check if user has access to a table (resolves table → base, then checks base).
   */
  async canAccessTable(userId: string, orgId: string, tableId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT t.base_id FROM tp_tables t WHERE t.id = $1',
        [tableId]
      );
      const table = result.rows[0];
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
    permissionsService.canAccessBase(userId, orgId, baseId)
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
    permissionsService.canAccessTable(userId, orgId, tableId)
      .then((allowed) => {
        if (!allowed) {
          res.status(403).json({ error: 'Access denied to this table' });
          return;
        }
        next();
      })
      .catch(next);
  },
};

export default permissionsService;
