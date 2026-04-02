/**
 * Admin Integrations Monitoring (PO1)
 *
 * Admin surface is monitoring-only: who connected what, health posture, and audit visibility.
 */

import type { Response } from 'express';
import { Router } from 'express';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { listIntegrationConnectionEvents } from '../services/integrationConnectionLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';

const router = Router();

router.use(verifyToken);
router.use(verifyAdmin);

router.get(
  '/users',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rows =
      (await dbAll(
        `
        SELECT
          io.integration_id as "integrationId",
          io.owner_user_id as "userId",
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.email as "email",
          i.connector_id as "connectorId",
          i.name as "integrationName",
          i.category as "category",
          i.status as "status",
          i.updated_at as "updatedAt"
        FROM integration_ownership io
        JOIN integrations i ON i.id = io.integration_id AND i.organization_id = io.organization_id
        JOIN users u ON u.id = io.owner_user_id
        WHERE io.organization_id = ?
        ORDER BY u.last_name ASC, u.first_name ASC, i.updated_at DESC
      `,
        [orgId],
        { fallback: false }
      )) || [];

    return res.json({ items: rows });
  })
);

router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const totals =
      (await dbAll(
        `
        SELECT
          COUNT(*)::int as total,
          COUNT(DISTINCT owner_user_id)::int as users
        FROM integration_ownership
        WHERE organization_id = ?
      `,
        [orgId],
        { fallback: false }
      )) || [];

    const byStatus =
      (await dbAll(
        `
        SELECT
          i.status as status,
          COUNT(*)::int as count
        FROM integration_ownership io
        JOIN integrations i ON i.id = io.integration_id AND i.organization_id = io.organization_id
        WHERE io.organization_id = ?
        GROUP BY i.status
        ORDER BY count DESC
      `,
        [orgId],
        { fallback: false }
      )) || [];

    const byConnector =
      (await dbAll(
        `
        SELECT
          i.connector_id as "connectorId",
          COUNT(*)::int as count
        FROM integration_ownership io
        JOIN integrations i ON i.id = io.integration_id AND i.organization_id = io.organization_id
        WHERE io.organization_id = ?
        GROUP BY i.connector_id
        ORDER BY count DESC
      `,
        [orgId],
        { fallback: false }
      )) || [];

    return res.json({
      totals: totals[0] || { total: 0, users: 0 },
      byStatus,
      byConnector,
    });
  })
);

router.get(
  '/logs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined;
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : undefined;
    const connectorId =
      typeof req.query.connectorId === 'string' ? req.query.connectorId.trim() : undefined;
    const integrationId =
      typeof req.query.integrationId === 'string' ? req.query.integrationId.trim() : undefined;
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim() : undefined;

    const data = await listIntegrationConnectionEvents({
      organizationId: orgId,
      limit,
      offset,
      userId,
      connectorId,
      integrationId,
      eventType,
    });

    return res.json(data);
  })
);

export default router;

