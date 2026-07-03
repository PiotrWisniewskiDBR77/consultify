/**
 * M16/9.1 — V8 Finance Value-layer write/compute endpoints.
 *
 * Exposes the new M16 value services (value bridge, portfolio prioritization,
 * capital rationing, investment appraisal, budget variance, value assurance)
 * so the cockpit can consume them WITHOUT touching the legacy finance routes.
 *
 * All endpoints are org-scoped (org resolved from req.user; 401 when absent)
 * and pure-compute — they accept a payload, run a deterministic service, and
 * return the result. No DB access.
 *
 * NOTE: intentionally NOT mounted in Gateway here — wiring is a separate step.
 *
 * @module routes/v8/financeValueRoutes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { knapsack } from '../../services/capitalRationingService.js';
import { varianceBridge } from '../../services/budgetVarianceService.js';
import { appraise } from '../../services/investmentAppraisalService.js';
import { prioritize } from '../../services/portfolioPrioritizationService.js';
import { buildValueBridge } from '../../services/valueBridgeService.js';
import { assuranceSummary } from '../../services/valueAssuranceService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 Finance value-layer responses. */
export const V8_FINANCE_VALUE_CONTRACT = 'finance_value_compute_v1';

function financeValueMeta() {
  return { version: 'v8' as const, contract: V8_FINANCE_VALUE_CONTRACT };
}

/**
 * Resolve the org id from req.user. Returns null when the caller is not
 * authenticated, letting handlers short-circuit with 401.
 */
function resolveOrganizationId(req: AuthRequest): string | null {
  const org =
    (req.user && (req.user.organizationId || (req.user as any).organization_id)) ||
    req.organizationId ||
    '';
  const normalized = String(org || '').trim();
  return normalized || null;
}

/**
 * POST /value-bridge
 * Body: { initiatives: ValueBridgeInitiative[] }
 */
router.post(
  '/value-bridge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const initiatives = Array.isArray(req.body?.initiatives) ? req.body.initiatives : [];
    const result = buildValueBridge(initiatives);
    return res.json({ data: result, meta: financeValueMeta() });
  })
);

/**
 * POST /portfolio/prioritize
 * Body: { initiatives: PrioritizationInitiative[] }
 */
router.post(
  '/portfolio/prioritize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const initiatives = Array.isArray(req.body?.initiatives) ? req.body.initiatives : [];
    const result = prioritize(initiatives);
    return res.json({ data: result, meta: financeValueMeta() });
  })
);

/**
 * POST /capital/ration
 * Body: { projects: RationingProject[], budget: number }
 */
router.post(
  '/capital/ration',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const projects = Array.isArray(req.body?.projects) ? req.body.projects : [];
    const budget = Number(req.body?.budget) || 0;
    const result = knapsack(projects, budget);
    return res.json({ data: result, meta: financeValueMeta() });
  })
);

/**
 * POST /appraise
 * Body: AppraisalInput { cashFlows: number[], discountRate?: number }
 */
router.post(
  '/appraise',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const cashFlows = Array.isArray(req.body?.cashFlows)
      ? req.body.cashFlows
      : Array.isArray(req.body?.cashflows)
        ? req.body.cashflows
        : [];
    const discountRatePct = Number(req.body?.discountRatePct ?? req.body?.discountRate) || 0;
    const hurdleRatePct = Number(req.body?.hurdleRatePct ?? discountRatePct) || 0;
    // First negative flow is treated as the initial investment when not given explicitly.
    let initialInvestment = Number(req.body?.initialInvestment) || 0;
    let flows = cashFlows as number[];
    if (initialInvestment === 0 && flows.length && Number(flows[0]) < 0) {
      initialInvestment = -Number(flows[0]);
      flows = flows.slice(1);
    }
    const result = appraise({ cashflows: flows, initialInvestment, discountRatePct, hurdleRatePct });
    return res.json({ data: result, meta: financeValueMeta() });
  })
);

/**
 * POST /variance-bridge
 * Body: { lines: VarianceLine[] }
 */
router.post(
  '/variance-bridge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const result = varianceBridge(lines);
    return res.json({ data: result, meta: financeValueMeta() });
  })
);

/**
 * POST /value-assurance
 * Body: { items: AssuranceItem[] }
 */
router.post(
  '/value-assurance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = assuranceSummary(items);
    return res.json({ data: result, meta: financeValueMeta() });
  })
);

export default router;
