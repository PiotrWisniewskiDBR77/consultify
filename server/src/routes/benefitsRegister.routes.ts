/**
 * Benefits Register Routes — M14/F6 handoff (M14 → M15).
 *
 * Persistence layer for the benefits register: tracked outcomes (KPI/ROI) an
 * initiative is expected to keep delivering into sustainment (M15). Backed by
 * `benefitsRegisterService` (table `benefits_register`).
 *
 * The key endpoint is POST /benefits/handoff/:initiativeId — the *real* M14
 * closure handoff (was "preview only"): it materialises an org-scoped benefit
 * row tagged `source = 'M14_CLOSURE_HANDOFF'` so the benefit keeps being tracked
 * after the initiative closes.
 *
 * Auth model mirrors rollout.routes.ts: every route requires an authenticated
 * org member (verifyToken + isAuthenticated); org is taken from
 * req.user.organizationId and 401s when absent. Writes (create + handoff) are
 * gated behind the MANAGE_ROLLOUT permission — the same M14/PMO editor tier that
 * guards the rest of ExecutionHub, so there is no new permission surface to
 * provision for the handoff.
 *
 * NOTE: not mounted in Gateway here — this is the F6 handoff hand-off file for
 * M15 wiring.
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  BenefitsRegisterService,
  type ClosureKpiDelta,
  type CreateBenefitInput,
} from '../services/benefitsRegisterService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Read access: any authenticated org member. Writes are further gated below.
router.use(verifyToken, isAuthenticated);

// Writes (create + closure handoff) reuse the M14 ExecutionHub editor tier.
// MANAGE_ROLLOUT resolves through PermissionService.hasPermission:
//   - SUPERADMIN / OWNER bypass; ADMIN + PROJECT_MANAGER granted via role
//     fallback; TEAM_MEMBER / VIEWER get a 403 (not a silent 200);
//   - per-user org overrides (org_user_permissions) still win.
const requireBenefitsWrite = requirePermission('MANAGE_ROLLOUT');

const requireOrg = (req: AuthRequest, res: Response): string | null => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
};

// ================================================================
// GET /benefits — list, org-scoped, optional ?initiativeId
// ================================================================

router.get(
  '/benefits',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;

    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;

    const benefits = await BenefitsRegisterService.listBenefits(orgId, initiativeId);
    return res.json({ benefits, count: benefits.length });
  })
);

// ================================================================
// POST /benefits — create (write-gated)
// ================================================================

const BenefitCreateSchema = z.object({
  initiativeId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  ownerId: z.string().nullable().optional(),
  kpiName: z.string().max(255).nullable().optional(),
  baselineValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  cadence: z.string().max(64).nullable().optional(),
  status: z.string().max(32).optional(),
  source: z.string().max(64).nullable().optional(),
});

router.post(
  '/benefits',
  requireBenefitsWrite,
  validateBody(BenefitCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;

    const input = req.body as CreateBenefitInput;
    const benefit = await BenefitsRegisterService.createBenefit(orgId, input);
    return res.status(201).json({ benefit });
  })
);

// ================================================================
// POST /benefits/handoff/:initiativeId — real M14 → M15 closure handoff
// body = kpiDelta (ClosureKpiDelta)
// ================================================================

const HandoffSchema = z.object({
  name: z.string().max(255).optional(),
  kpiName: z.string().max(255).optional(),
  ownerId: z.string().nullable().optional(),
  baselineValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  cadence: z.string().max(64).nullable().optional(),
});

router.post(
  '/benefits/handoff/:initiativeId',
  requireBenefitsWrite,
  validateBody(HandoffSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;

    const initiativeId = req.params.initiativeId;
    if (!initiativeId || !initiativeId.trim()) {
      return res.status(400).json({ error: 'initiativeId is required' });
    }

    const kpiDelta = req.body as ClosureKpiDelta;
    const benefit = await BenefitsRegisterService.handoffFromClosure(
      orgId,
      initiativeId.trim(),
      kpiDelta
    );
    return res.status(201).json({ benefit });
  })
);

// ================================================================
// POST /benefits/:id/promote — M15/W1 (G1 bridge): promote a handoff
// benefit into a tracked KPI (initiative_kpis). Makes M14→M15 visible.
// ================================================================
router.post(
  '/benefits/:id/promote',
  requireBenefitsWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;

    const benefitId = req.params.id;
    if (!benefitId || !benefitId.trim()) {
      return res.status(400).json({ error: 'benefit id is required' });
    }

    try {
      const result = await BenefitsRegisterService.promoteBenefitToKpi(orgId, benefitId.trim());
      return res.status(result.alreadyPromoted ? 200 : 201).json(result);
    } catch (err: any) {
      if (err?.message === 'benefit_not_found') {
        return res.status(404).json({ error: 'benefit_not_found' });
      }
      throw err;
    }
  })
);

export default router;
