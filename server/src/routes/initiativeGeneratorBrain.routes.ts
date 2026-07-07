/**
 * Initiative generator routes (F1 — MÓZG GENERATORA / fast track).
 *
 * Standalone, additive router. Exposes the brain's two capabilities:
 *
 *   POST /initiatives/:id/generate-full   { brief?, sourceType?, type?, language? }
 *        → fills the 6 core cards (+ auto-heal) for an existing initiative.
 *   POST /initiatives/propose-cards        { type, sourceType? }
 *        → returns { core, proposed, type } (deterministic card proposal).
 *
 * Mirrors the auth/permission chain of initiativeMaterialize.routes.ts
 * (verifyToken + requireOrgAccess + asyncHandler). Strictly org-scoped.
 *
 * MOUNT ORDER (see WIRING NOTE in handoff): mount this BEFORE `initiativesRoutes`
 * in Gateway.ts. Both methods are POST: `/:id/generate-full` does not shadow the
 * main GET `/:id`, but the concrete `/propose-cards` COULD be captured by a main
 * `POST /:id` if one exists — mounting first guarantees it resolves here.
 */
import { type Response, Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  defaultDeps,
  generateFullInitiative,
  proposeCards,
} from '../services/initiative/initiativeGeneratorBrain.js';
import { persistCards } from '../services/ai/tools/generateInitiative.js';
import initiativeGenerationService from '../services/initiativeGenerationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string | null {
  const orgId = req.user?.organizationId || req.organizationId;
  return orgId ? String(orgId) : null;
}

const ProposeCardsSchema = z.object({
  type: z.string().trim().max(200).optional(),
  sourceType: z.string().trim().max(200).optional(),
  brief: z.string().trim().max(8000).optional(),
});

const GenerateFullSchema = z.object({
  brief: z.string().trim().max(8000).optional(),
  sourceType: z.string().trim().max(200).optional(),
  type: z.string().trim().max(200).optional(),
  language: z.enum(['en', 'pl']).optional(),
});

const GenerateSectionCardSchema = z.object({
  sectionKey: z.string().trim().min(1).max(200),
  initiativeName: z.string().trim().max(500).optional(),
  brief: z.string().trim().max(8000).optional(),
  language: z.enum(['en', 'pl']).optional(),
  /** D12 auto-heal budget (0 = single attempt, default 1 = one regen). */
  maxRegen: z.number().int().min(0).max(2).optional(),
});

// POST /initiatives/propose-cards — deterministic card proposal (no :id).
// Registered BEFORE /:id/generate-full so "propose-cards" is never read as an :id.
router.post(
  '/propose-cards',
  validateBody(ProposeCardsSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, sourceType, brief } = req.body as z.infer<typeof ProposeCardsSchema>;
    const result = proposeCards(type, sourceType, brief ? { brief } : undefined);
    return res.status(200).json(result);
  }),
);

// POST /initiatives/:id/generate-full — fast track fill of one initiative.
router.post(
  '/:id/generate-full',
  validateBody(GenerateFullSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = String(req.params.id);

    const { brief, sourceType, type, language } = req.body as z.infer<typeof GenerateFullSchema>;

    const result = await generateFullInitiative(defaultDeps(), {
      initiativeId,
      brief,
      sourceType,
      initiativeType: type,
      language,
      organizationId: orgId,
    });

    // PERSIST + HYDRATE: the brain only returns cards in-memory. Persist them to the
    // JSON sink AND map onto the AUTHORITATIVE typed columns (problem_statement/
    // scope_in/target_state/…) so the object/UI/judge — which read typed columns —
    // see real content, not an empty skeleton. Non-destructive + fail-soft.
    try {
      await persistCards(initiativeId, orgId, result.cards ?? {});
    } catch (persistErr: any) {
      logger.warn(
        '[initiativeGenerator] generate-full persist/hydrate failed (ignored):',
        persistErr?.message || persistErr,
      );
    }

    logger.info('[initiativeGenerator] generate-full', {
      initiativeId,
      orgId,
      filled: result.qualitySummary.filled,
      failed: result.qualitySummary.failed,
      healed: result.qualitySummary.healed,
    });

    return res.status(200).json(result);
  }),
);

// POST /initiatives/:id/generate-section-card — R2: emit ONE section as a CardSpec
// (block grammar) gated by validateCardSpec (CRITICAL → one regen). Returns
// { cardSpec, issues, ok, regenerated, ... }; ok=false → caller falls back to the
// per-field builder. Reachable surface for the F3/R2 structured-generation path.
router.post(
  '/:id/generate-section-card',
  validateBody(GenerateSectionCardSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = String(req.params.id);

    const { sectionKey, initiativeName, brief, language, maxRegen } =
      req.body as z.infer<typeof GenerateSectionCardSchema>;

    const result = await initiativeGenerationService.generateSectionCardSpec(
      sectionKey,
      {
        initiativeId,
        initiativeName: initiativeName || '',
        language: language || 'pl',
        ...(brief ? { summary: brief } : {}),
      },
      orgId,
      typeof maxRegen === 'number' ? { maxRegen } : undefined,
    );

    logger.info('[initiativeGenerator] generate-section-card', {
      initiativeId,
      orgId,
      sectionKey,
      ok: result.ok,
      regenerated: result.regenerated,
    });

    return res.status(200).json(result);
  }),
);

export default router;
