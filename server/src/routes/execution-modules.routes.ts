/**
 * Consultify Execution-module UI/UX Standard — Routes (Epic E11, Slice 11.3).
 *
 * Read-only governance surface that exposes the canonical
 * execution-module standard (3-zone layout · Menu 2 chips · right
 * panel collapse contract · Teresa-only agent · Menu 3 AI actions
 * placement) and the system-owned reference manifests so the
 * frontend, governance docs, and CI gates can fetch a single
 * machine-readable source of truth.
 *
 *   GET  /api/execution-modules/standard
 *     Returns the canonical standard:
 *       { zones, menu2ChipOrder, ctaLabels, rightPanelCollapseContract,
 *         allowedAgentIds, allowedAiActionSlots }
 *
 *   GET  /api/execution-modules/manifests
 *     Returns every system-owned reference manifest:
 *       { manifests: ExecutionModuleManifest[] }
 *
 *   GET  /api/execution-modules/manifests/:moduleId
 *     Returns a single reference manifest:
 *       { manifest: ExecutionModuleManifest }
 *     404 module_not_found when the id is not a system manifest.
 *
 *   POST /api/execution-modules/manifests/:moduleId/validate
 *     Body: ExecutionModuleManifest payload to validate.
 *     Returns: { result: ExecutionModuleValidationResult }
 *     The route does NOT cache or persist the candidate manifest —
 *     this is a pure governance gate (run from CI, run from a
 *     pre-release UI panel) that returns the standard violation
 *     envelope so callers decide what to do.
 *
 * Auth: reuses verifyToken (every authenticated user may read the
 * standard / manifests; this is governance metadata with no tenant
 * boundary). The validate POST also requires authentication so we
 * have an audit hook should we ever add CI-side request logging.
 */

import { type Request, type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  EXECUTION_MODULE_ALLOWED_AGENT_IDS,
  EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS,
  EXECUTION_MODULE_CTA_LABELS,
  EXECUTION_MODULE_MENU2_CHIP_ORDER,
  EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT,
  EXECUTION_MODULE_ZONE_ORDER,
  EXECUTION_MODULE_ZONES,
  validateExecutionModuleManifest,
} from '../services/executionModuleStandard/executionModuleStandard.js';
import {
  getSystemExecutionModuleManifest,
  SYSTEM_EXECUTION_MODULE_MANIFESTS,
} from '../services/executionModuleStandard/executionModuleStandardManifests.js';
import type { ExecutionModuleManifest } from '../services/executionModuleStandard/executionModuleStandardTypes.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

function requireAuthContext(req: AuthRequest, res: Response): boolean {
  // Both fields are populated by verifyToken; we only assert
  // presence here so an upstream misconfiguration does not let an
  // anonymous request through.
  const userId = String((req as { user?: { id?: unknown } })?.user?.id ?? '');
  const organizationId = String(
    (req as { user?: { organizationId?: unknown } })?.user?.organizationId ?? ''
  );
  if (!userId || !organizationId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

router.get(
  '/standard',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAuthContext(req as AuthRequest, res)) return;
    res.json({
      standard: {
        zones: EXECUTION_MODULE_ZONES,
        zoneOrder: EXECUTION_MODULE_ZONE_ORDER,
        menu2ChipOrder: EXECUTION_MODULE_MENU2_CHIP_ORDER,
        ctaLabels: EXECUTION_MODULE_CTA_LABELS,
        rightPanelCollapseContract: EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT,
        allowedAgentIds: EXECUTION_MODULE_ALLOWED_AGENT_IDS,
        allowedAiActionSlots: EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS,
      },
    });
  })
);

router.get(
  '/manifests',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAuthContext(req as AuthRequest, res)) return;
    res.json({ manifests: SYSTEM_EXECUTION_MODULE_MANIFESTS });
  })
);

router.get(
  '/manifests/:moduleId',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAuthContext(req as AuthRequest, res)) return;
    const moduleId = String(req.params.moduleId || '');
    if (!moduleId) {
      res.status(400).json({ error: 'moduleId is required' });
      return;
    }
    const manifest = getSystemExecutionModuleManifest(moduleId);
    if (!manifest) {
      res.status(404).json({ error: 'module_not_found' });
      return;
    }
    res.json({ manifest });
  })
);

router.post(
  '/manifests/:moduleId/validate',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAuthContext(req as AuthRequest, res)) return;
    const moduleId = String(req.params.moduleId || '');
    if (!moduleId) {
      res.status(400).json({ error: 'moduleId is required' });
      return;
    }
    const candidate = (req.body ?? {}) as ExecutionModuleManifest;
    // Force the moduleId from the URL to win over any payload
    // value so the caller cannot validate a manifest under a
    // different id and confuse the audit envelope.
    const normalized: ExecutionModuleManifest = { ...candidate, moduleId };
    const result = validateExecutionModuleManifest(normalized);
    res.json({ result });
  })
);

export default router;
