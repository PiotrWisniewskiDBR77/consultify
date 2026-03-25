/**
 * V8 read-only Finance bridge — org-scoped runtime dashboard from
 * `financeIntegrationService.getFinanceDashboard` (Wave 18 aggregates).
 * Namespace: /api/v8/finance (mounted by v8/index).
 *
 * @module routes/v8/finance.routes
 */

import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { getFinanceDashboard } from '../../services/v8/financeIntegrationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 Finance read responses. */
export const V8_FINANCE_READ_CONTRACT = 'finance_runtime_read_v1';

function financeMeta() {
  return { version: 'v8' as const, contract: V8_FINANCE_READ_CONTRACT };
}

/**
 * GET /api/v8/finance/dashboard
 * Ingestion pipeline summary, initiative economics linkage health, unresolved
 * escalations count, stale cloud-linked refreshes, and promotion gate pass rate
 * for the V8 org context.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const dashboard = await getFinanceDashboard(organizationId);
    return res.json({
      data: { dashboard },
      meta: financeMeta(),
    });
  }),
);

export default router;
