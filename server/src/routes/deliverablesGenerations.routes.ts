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
import { z } from 'zod';

import { featureFlags } from '../config/FeatureFlags.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import {
  DeliverablesGenerationError,
  plan,
  start,
  status,
} from '../services/deliverables/deliverablesGenerationService.js';
import { getDeliverableMetrics } from '../services/deliverables/deliverablesMetricsService.js';
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

function getUserId(req: any): string {
  return req.user?.id || req.userId || 'system';
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

// P1-2 (audyt): whitelist pól setupu — user-JSON nie płynie dalej bez schemy.
// zod domyślnie wycina nieznane klucze (strip), więc nadmiarowe pola po prostu znikają.
const SourceRefSchema = z.object({
  sourceType: z.string().max(64),
  sourceId: z.string().max(128),
  sourceTitle: z.string().max(300).optional(),
});

const DocSheetSetupSchema = z.object({
  intent: z.string().min(1).max(4000).optional(),
  language: z.enum(['pl', 'en']).optional(),
  title: z.string().max(200).optional(),
  conversationContext: z.string().max(8000).optional(),
  conversationId: z.string().max(128).optional(),
  sourceRefs: z.array(SourceRefSchema).max(20).optional(),
  audience: z.array(z.string().max(120)).max(10).optional(),
});

const DeckSetupSchema = z.object({
  title: z.string().min(1).max(200),
  templateId: z.string().max(128).optional(),
  audience: z.enum(['sponsor', 'executive', 'investor', 'internal']),
  goal: z.enum(['inform', 'decide', 'sell', 'align']),
  language: z.enum(['pl', 'en']),
  theme: z.enum(['corporate', 'minimal', 'modern']),
  confidentiality: z.enum(['confidential', 'internal', 'public']),
  brandColor: z.string().max(32).optional(),
  sourceType: z.string().max(64).optional(),
  sourceId: z.string().max(128).optional(),
  sourceArtifacts: z
    .array(
      z.object({
        type: z.string().max(64),
        id: z.string().max(128).optional(),
        artifactId: z.string().max(128).optional(),
        label: z.string().max(300),
        confidence: z.number().min(0).max(1).optional(),
        readiness: z.string().max(64).optional(),
      })
    )
    .max(20)
    .default([]),
  visuals: z
    .object({
      enabled: z.boolean().optional(),
      priority: z.enum(['quality', 'cost']).optional(),
      imageDensity: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

function parseSetupOrRespond(
  res: Response,
  format: DeliverableFormat,
  rawSetup: unknown
): Record<string, unknown> | null {
  const schema = format === 'deck' ? DeckSetupSchema : DocSheetSetupSchema;
  const parsed = schema.safeParse(rawSetup ?? {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid setup for '${format}': ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'setup'} — ${i.message}`)
        .join('; ')}`,
      code: 'invalid_setup',
    });
    return null;
  }
  return parsed.data as Record<string, unknown>;
}

const IntentSchema = z.string().max(4000).optional();

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
// P1-3 (audyt): każdy POST = wywołanie LLM — limit jak inne endpointy AI (30/min prod).
router.post('/', aiRateLimiter, async (req: any, res: Response) => {
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
  const setup = parseSetupOrRespond(res, body.format, body.setup);
  if (!setup) return;
  const intentParsed = IntentSchema.safeParse(body.intent);
  try {
    const result = await plan({
      format: body.format,
      setup,
      intent: intentParsed.success ? intentParsed.data : undefined,
      organizationId: getOrgId(req),
      userId: getUserId(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /:id/generate — krok GENERATE (async, 202 + poll)
router.post('/:id/generate', aiRateLimiter, async (req: any, res: Response) => {
  if (!ensureGenerateCapability(req, res)) return;
  const body = (req.body || {}) as Partial<StartGenerationRequest> & {
    format?: DeliverableFormat;
  };
  // L-05 (M02): an absent/invalid format must FAIL LOUDLY, not silently default
  // to 'deck'. A missing format means a miswired caller — generating a deck for
  // a doc/sheet request is a worse outcome than a 400. All live FE callers send
  // an explicit format ('deck' | 'doc' | 'sheet'), so this only rejects bugs.
  if (!body.format || !VALID_FORMATS.includes(body.format)) {
    return res.status(400).json({
      success: false,
      error: `format is required and must be one of: ${VALID_FORMATS.join(', ')}`,
    });
  }
  const format = body.format;
  const setup = parseSetupOrRespond(res, format, body.setup);
  if (!setup) return;
  try {
    const result = await start({
      generationId: String(req.params.id),
      format,
      setup,
      plan: body.plan,
      organizationId: getOrgId(req),
      userId: getUserId(req),
    });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /metrics — agregaty §8 dla decyzji D3 (admin org-scoped).
// MUSI być przed `/:id`, inaczej router potraktuje "metrics" jako generationId.
router.get('/metrics', async (req: any, res: Response) => {
  const role = String(req.user?.role || req.userRole || '')
    .trim()
    .toUpperCase();
  if (!['ADMIN', 'OWNER', 'SUPERADMIN', 'ADMINISTRATOR'].includes(role)) {
    res.status(403).json({ success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' });
    return;
  }
  const windowDays = Math.min(365, Math.max(1, Number(req.query.windowDays) || 30));
  try {
    const metrics = await getDeliverableMetrics(getOrgId(req), windowDays);
    res.status(200).json({ success: true, metrics });
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
