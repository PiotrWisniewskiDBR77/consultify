/**
 * Audit Events Routes — V4-ENT-03
 * GET /api/audit/events with filters (resource, actor, dateRange)
 */

import { Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import auditEventsService from '../services/AuditEventsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthRequest } from './auth.middleware.js';

const router = Router();

router.get(
  '/events',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { resourceType, resourceId, actorId, actorType, from, to, limit, offset } = req.query;

    const { data, total } = await auditEventsService.query({
      organizationId: orgId,
      resourceType: resourceType as string,
      resourceId: resourceId as string,
      actorId: actorId as string,
      actorType: actorType as string,
      fromDate: from as string,
      toDate: to as string,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({ data, total });
  })
);

export default router;
