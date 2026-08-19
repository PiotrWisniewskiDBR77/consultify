/**
 * user-data-controls Routes
 * Data export and privacy controls (no stubs)
 */
import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

/**
 * GET /api/user/data-export
 * Retired direct JSON export fallback.
 *
 * A direct response has no durable request, immutable receipt, content hash or
 * cold-replay contract.  All mounted callers must use the governed GDPR
 * request/status/download lifecycle instead.
 */
router.get(
  '/data-export',
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(410).json({
      error: 'Direct data export is retired. Use the governed GDPR export lifecycle.',
      code: 'GDPR_DIRECT_EXPORT_RETIRED',
      successor: {
        request: '/api/gdpr/export-request',
        status: '/api/gdpr/export-status',
        download: '/api/gdpr/download-export/:requestId',
      },
    });
  })
);

export default router;
