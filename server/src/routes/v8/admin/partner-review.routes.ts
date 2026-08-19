import type { Response } from 'express';
import { Router } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import { requireActiveMembership } from '../../../services/legacyCutover/requireActiveMembership.js';
import {
  PartnerOperatorReviewError,
  reviewPartnerApplicationCommand,
  reviewPartnerCertification,
} from '../../../services/partnerOperatorReviewService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const router = Router();

// These are global platform-operator commands. Active membership proves the
// signed operator context is live; target records are intentionally not scoped
// to that tenant. SUPERADMIN is still mandatory and independently enforced.
router.use(requireActiveMembership, requireSuperAdmin);

function idempotencyKey(req: AuthRequest): string {
  return String(req.headers['idempotency-key'] || '').trim();
}

router.post(
  '/certifications/:certificationId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const reviewState = String(req.body?.reviewState || '') as
      | 'approved'
      | 'changes_requested'
      | 'pending';
    if (!['approved', 'changes_requested', 'pending'].includes(reviewState)) {
      return res.status(400).json({ error: 'Invalid reviewState', code: 'INVALID_REVIEW_STATE' });
    }
    const data = await reviewPartnerCertification({
      actorUserId: req.userId!,
      certificationId: String(req.params.certificationId || '').trim(),
      reviewState,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : null,
      idempotencyKey: idempotencyKey(req),
    });
    return res.json({ data, meta: { version: 'v8', scope: 'global_superadmin' } });
  })
);

router.post(
  '/applications/:applicationId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = String(req.body?.status || '') as
      | 'pending'
      | 'approved'
      | 'rejected'
      | 'needs_follow_up';
    if (!['pending', 'approved', 'rejected', 'needs_follow_up'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', code: 'INVALID_APPLICATION_STATUS' });
    }
    const data = await reviewPartnerApplicationCommand({
      actorUserId: req.userId!,
      applicationId: String(req.params.applicationId || '').trim(),
      status,
      reviewNote: typeof req.body?.reviewNote === 'string' ? req.body.reviewNote : null,
      idempotencyKey: idempotencyKey(req),
    });
    return res.json({ data, meta: { version: 'v8', scope: 'global_superadmin' } });
  })
);

router.use((error: Error, _req: AuthRequest, res: Response, next: (error?: Error) => void) => {
  if (error instanceof PartnerOperatorReviewError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  next(error);
});

export default router;
