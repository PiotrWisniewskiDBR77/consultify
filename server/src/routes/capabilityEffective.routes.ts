/**
 * FAZA C (model ról PM — spec `_SPEC_MODEL_ROL_PM_2026-07-14.md` §2.4/§3).
 *
 * Read-only endpoint for the FRONTEND capability infrastructure:
 * `GET /api/capabilities/effective?projectId=...` returns the caller's
 * effective capability set for the given project PLUS the global rollout
 * `mode` (`shadow` | `enforce`, from the `CAPABILITY_ENFORCE` env flag).
 *
 * The frontend hook `useEffectiveAccess()` needs `mode` to honour the
 * fail-open contract: while mode==='shadow' (the default) the UI must render
 * exactly as today — capability verdicts are diagnostic-only. Only when the
 * backend is flipped to `enforce` may the UI start hiding/disabling actions.
 *
 * Deliberately a NEW file: `access.routes.ts` / `effectiveAccessService.ts`
 * are owned by the parallel Faza B worker and must not be modified here.
 * This router is mounted at `/api/capabilities/effective` BEFORE the
 * capability catalog router (`/api/capabilities`) so the paths never clash.
 */
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { resolveEffectiveAccess } from '../services/effectiveAccessService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

// Same semantics as `capabilityEnforceMode()` in
// `middleware/effectiveCapability.middleware.ts` (not exported there; that
// file is owned by the Faza B worker, so the 2-line rule is mirrored here).
const capabilityEnforceMode = (): 'shadow' | 'enforce' =>
  (process.env.CAPABILITY_ENFORCE ?? 'shadow').trim().toLowerCase() === 'enforce'
    ? 'enforce'
    : 'shadow';

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = String(req.user?.id || req.userId || '').trim();
    const organizationId = String(req.organizationId || req.user?.organizationId || '').trim();
    const projectId = String(req.query.projectId || '').trim() || null;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole: req.userRole || req.user?.role,
      projectId,
      isImpersonating: Boolean(req.user?.impersonatorId),
    });

    return res.json({
      capabilities: access.capabilities,
      projectRole: access.projectRole ?? null,
      applicationRole: access.applicationRole ?? null,
      platformRole: access.platformRole ?? null,
      projectId: access.projectId ?? null,
      mode: capabilityEnforceMode(),
    });
  })
);

export default router;
