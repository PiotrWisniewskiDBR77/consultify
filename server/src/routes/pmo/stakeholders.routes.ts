/**
 * Stakeholder Registry Routes (Zwornik Delta A)
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §3+§9 FAZA 1.
 * Mirrors the `pmo/projects.routes.ts` wiring pattern.
 *
 * Mutation routes are gated behind `requireAnyProjectCapability` (existing
 * D1 rollout middleware, effectiveCapability.middleware.ts) — no-op unless
 * EFFECTIVE_ACCESS_ENFORCE / EFFECTIVE_ACCESS_SHADOW env flags are set,
 * consistent with how the rest of the codebase rolls this out.
 */

import { Router } from 'express';

import StakeholderRegistryControllerRaw from '../../controllers/StakeholderRegistryController.js';
const StakeholderRegistryController = StakeholderRegistryControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import {
  requireAnyProjectCapability,
  resolveProjectIdFromRequest,
} from '../../middleware/effectiveCapability.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// §3.5 capability gate for mutations: org-level registry manager
// (`stakeholder.registry.manage`, e.g. PMO/Admin/Owner) OR the project's
// Sponsor/Leader (`stakeholder.engagement.manage.project`) may write.
const CAPS = ['stakeholder.registry.manage', 'stakeholder.engagement.manage.project'];
const requireStakeholderWrite = (resolveProjectId = resolveProjectIdFromRequest) =>
  requireAnyProjectCapability(CAPS, resolveProjectId, {
    allowWithoutProject: true,
    reason: 'stakeholder_registry_mutation',
  });

/**
 * Resolve an engagement's project (for the capability check) by looking up
 * the row before the mutation runs. `null` (org-baseline engagement, or
 * engagement not found — the handler itself 404s) falls back to org-level
 * capability via `allowWithoutProject`.
 */
const resolveEngagementProjectId = async (req: any): Promise<string | null> => {
  const engagementId = req.params?.engagementId;
  if (!engagementId) return null;
  const row = await queryHelpers.queryOne<{ project_id: string | null }>(
    `SELECT project_id FROM stakeholder_engagements WHERE id = ?`,
    [engagementId]
  );
  return row?.project_id || null;
};

/**
 * `POST /:id/engagements` — `:id` is the STAKEHOLDER registry id, not a
 * project id. The shared `resolveProjectIdFromRequest` default falls back to
 * `req.params.id` when `req.params.projectId` is absent, which would
 * misread the stakeholder id as a project id here — so this route uses an
 * explicit body-only resolver instead.
 */
const resolveEngagementBodyProjectId = async (req: any): Promise<string | null> =>
  req.body?.projectId || req.body?.project_id || null;

// ==========================================
// REGISTRY (identity, org-level)
// ==========================================

router.get('/', StakeholderRegistryController.list);
router.post(
  '/',
  requireStakeholderWrite(async () => null),
  StakeholderRegistryController.create
);
router.get('/:id', StakeholderRegistryController.getOne);
router.patch(
  '/:id',
  requireStakeholderWrite(async () => null),
  StakeholderRegistryController.update
);
router.delete(
  '/:id',
  requireStakeholderWrite(async () => null),
  StakeholderRegistryController.remove
);

// ==========================================
// ENGAGEMENTS (RACI + influence/interest per context)
// ==========================================

router.get('/:id/engagements', StakeholderRegistryController.listEngagements);
router.post(
  '/:id/engagements',
  requireStakeholderWrite(resolveEngagementBodyProjectId),
  StakeholderRegistryController.upsertEngagement
);
router.patch(
  '/engagements/:engagementId',
  requireStakeholderWrite(resolveEngagementProjectId),
  StakeholderRegistryController.updateEngagement
);
router.delete(
  '/engagements/:engagementId',
  requireStakeholderWrite(resolveEngagementProjectId),
  StakeholderRegistryController.deleteEngagement
);

// ==========================================
// EFFECTIVE / INHERITANCE READ-MODELS (§3.3) + F12 prefill hook
// ==========================================

router.get('/project/:projectId/effective', StakeholderRegistryController.getProjectEffective);
router.get('/project/:projectId/prefill', StakeholderRegistryController.getProjectPrefill);
router.get(
  '/initiative/:initiativeId/effective',
  StakeholderRegistryController.getInitiativeEffective
);

export default router;
