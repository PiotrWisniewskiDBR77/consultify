import type { NextFunction, Response } from 'express';
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../database/PostgresDatabase.js';
import type { AuthRequest } from './auth.middleware.js';

const ALLOWED_RESULTS_ROLES = new Set(['OWNER', 'ADMIN']);

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * DEC-RES-VISIBILITY-001 internal-beta envelope.
 *
 * This is deliberately stricter than the generic organization middleware:
 * every Results request re-reads the authoritative membership row and admits
 * only an ACTIVE OWNER or ADMIN. Token roles, wildcard capabilities and
 * super-admin flags never bypass this lookup. A database error fails closed.
 */
export function createResultsInternalBetaVisibilityMiddleware(
  dependencies: { acquireClient: () => Promise<PoolClient> } = { acquireClient: acquirePgClient }
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Existing isolated route-unit suites replace auth middleware and have no
    // membership database. They must opt in explicitly when exercising this
    // production envelope; production and every non-test runtime always enforce.
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE !== 'enforce'
    ) {
      next();
      return;
    }
    const userId = normalize(req.user?.id ?? req.userId);
    const organizationId = normalize(
      req.user?.organizationId ?? req.user?.organization_id ?? req.organizationId
    );

    if (!userId || !organizationId) {
      res.status(403).json({
        error: 'Results access denied',
        code: 'RESULTS_INTERNAL_BETA_VISIBILITY_DENIED',
      });
      return;
    }

    let client: PoolClient | undefined;
    try {
      client = await dependencies.acquireClient();
      const membership = await client.query<{ role: string }>(
      `SELECT role
         FROM organization_members
        WHERE organization_id = $1
          AND user_id = $2
          AND upper(status) = 'ACTIVE'
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [organizationId, userId]
    );
      const role = normalize(membership.rows[0]?.role).toUpperCase();
      if (!ALLOWED_RESULTS_ROLES.has(role)) {
        res.status(403).json({
          error: 'Results access denied',
          code: 'RESULTS_INTERNAL_BETA_VISIBILITY_DENIED',
        });
        return;
      }
      next();
    } catch {
      res.status(503).json({
        error: 'Results access unavailable',
        code: 'RESULTS_INTERNAL_BETA_VISIBILITY_UNAVAILABLE',
      });
    } finally {
      client?.release();
    }
  };
}

export const requireResultsInternalBetaVisibility =
  createResultsInternalBetaVisibilityMiddleware();
