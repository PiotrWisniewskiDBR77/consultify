/**
 * Deliverables — lekki runtime: ROUTER KONTRAKTU GENERACJI (L1, krok 3)
 *
 * POST /api/deliverables/generations                → krok PLAN (edytowalny outline)
 * POST /api/deliverables/generations/:id/generate   → krok GENERATE (202, w tle)
 * GET  /api/deliverables/generations/:id            → poll stanu
 *
 * Za flagą ENABLE_DELIVERABLES_LIGHT (wzorzec MELS): gdy off — 404 na całej
 * powierzchni, mount w Gateway jest behavior-neutral. Cienka warstwa HTTP:
 * cała logika w deliverablesGenerationService.
 */

import { type Response, Router } from 'express';

import { featureFlags } from '../config/FeatureFlags.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import {
  DeliverablesGenerationError,
  plan,
  start,
  status,
} from '../services/deliverables/deliverablesGenerationService.js';
import { hasPresentationCapability } from '../services/presentationAccessPolicyService.js';
import type {
  CreateGenerationRequest,
  DeliverableFormat,
  StartGenerationRequest,
} from '../types/deliverablesGeneration.js';
import logger from '../utils/Logger.js';

const router = Router();

// Flaga sprawdzana per-request (nie przy mount), żeby zmiana env + restart
// nie wymagała zmian w Gateway i żeby testy mogły ją przestawiać.
router.use((_req, res, next) => {
  if (!featureFlags.ENABLE_DELIVERABLES_LIGHT) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
});

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function ensureGenerateCapability(req: any, res: Response): boolean {
  const role = req.user?.role || req.userRole || 'VIEWER';
  if (hasPresentationCapability(role, 'presentation_create')) return true;
  res.status(403).json({
    success: false,
    error: 'Permission denied',
    code: 'PERMISSION_DENIED',
    requiredCapability: 'presentation_create',
  });
  return false;
}

const VALID_FORMATS: DeliverableFormat[] = ['deck', 'doc', 'sheet'];

function handleServiceError(res: Response, err: unknown): void {
  if (err instanceof DeliverablesGenerationError) {
    const httpByCode = {
      not_implemented: 501,
      not_found: 404,
      invalid_state: 409,
      invalid_setup: 400,
    } as const;
    res.status(httpByCode[err.code]).json({ success: false, error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[DeliverablesGen:routes] ${message}`);
  res.status(500).json({ success: false, error: 'Generation failed', code: 'internal_error' });
}

// POST / — krok PLAN
router.post('/', async (req: any, res: Response) => {
  if (!ensureGenerateCapability(req, res)) return;
  const body = (req.body || {}) as Partial<CreateGenerationRequest>;
  if (!body.format || !VALID_FORMATS.includes(body.format)) {
    res.status(400).json({
      success: false,
      error: `format must be one of: ${VALID_FORMATS.join(', ')}`,
      code: 'invalid_setup',
    });
    return;
  }
  try {
    const result = await plan({
      format: body.format,
      setup: body.setup || {},
      intent: body.intent,
      organizationId: getOrgId(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /:id/generate — krok GENERATE (async, 202 + poll)
router.post('/:id/generate', async (req: any, res: Response) => {
  if (!ensureGenerateCapability(req, res)) return;
  const body = (req.body || {}) as Partial<StartGenerationRequest> & {
    format?: DeliverableFormat;
  };
  try {
    const result = await start({
      generationId: String(req.params.id),
      format: body.format || 'deck',
      setup: body.setup || {},
      plan: body.plan,
      organizationId: getOrgId(req),
    });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /:id — poll stanu
router.get('/:id', async (req: any, res: Response) => {
  try {
    const result = await status({
      generationId: String(req.params.id),
      organizationId: getOrgId(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

export default router;
