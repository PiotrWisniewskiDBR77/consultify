/**
 * Initiatives — additive routes (server-only, additive to the initiative module).
 *
 * Two slices the frontend already calls but the backend did not yet serve:
 *
 *   FEATURE 1 — Suggested changes (Faza 4)
 *     POST  /initiatives/:initiativeId/suggested-changes   create a PENDING change
 *     GET   /initiatives/:initiativeId/suggested-changes   list (?status=pending)
 *     PATCH /initiatives/suggested-changes/:id             resolve (accepted|rejected)
 *
 *   FEATURE 2 — Propose engine (Faza 2b)
 *     POST  /initiatives/propose                           text -> candidate initiatives
 *
 * Mounted at /api/initiatives (see Gateway.ts) AFTER the main PMO initiatives router,
 * so it only catches paths the main router does not already define. All routes are
 * org-scoped and reuse the existing auth/permission middleware.
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess, requireOrgRole } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { proposeCandidates as runPropose } from '../services/initiative/proposeEngineService.js';
import {
  createSuggestedChange,
  listSuggestedChanges,
  resolveSuggestedChange,
  type SuggestedChangeStatus,
} from '../services/initiative/suggestedChangesService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string | null {
  const orgId = req.user?.organizationId || req.organizationId;
  return orgId ? String(orgId) : null;
}

/** Defensive org-scoped existence check so we never leak / write cross-org. */
async function initiativeExistsInOrg(initiativeId: string, orgId: string): Promise<boolean> {
  const row = await queryHelpers.queryOne(
    `SELECT id FROM initiatives WHERE id = ? AND organization_id = ? LIMIT 1`,
    [initiativeId, orgId]
  );
  return !!row;
}

// ==========================================
// FEATURE 1 — SUGGESTED CHANGES
// ==========================================

const CreateSuggestedChangeSchema = z.object({
  kind: z.enum(['extend', 'evidence', 'conflict', 're_prioritize']),
  title: z.string().min(1).max(2000),
  rationale: z.string().max(20000).optional().default(''),
  sourceType: z.string().max(255).optional().nullable(),
  sourceId: z.string().max(255).optional().nullable(),
});

const ResolveSuggestedChangeSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

/**
 * POST /api/initiatives/:initiativeId/suggested-changes
 * Create a PENDING suggested change against an existing initiative.
 */
router.post(
  '/:initiativeId/suggested-changes',
  requireOrgRole('user'),
  validateBody(CreateSuggestedChangeSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const initiativeId = String(req.params.initiativeId || '');
    if (!initiativeId) {
      res.status(400).json({ error: 'initiativeId is required' });
      return;
    }
    if (!(await initiativeExistsInOrg(initiativeId, orgId))) {
      res.status(404).json({ error: 'Initiative not found' });
      return;
    }

    const change = await createSuggestedChange({
      initiativeId,
      organizationId: orgId,
      kind: req.body.kind,
      title: req.body.title,
      rationale: req.body.rationale ?? '',
      sourceType: req.body.sourceType ?? null,
      sourceId: req.body.sourceId ?? null,
      createdBy: req.user?.id || null,
    });

    res.status(201).json({ change });
  })
);

/**
 * GET /api/initiatives/:initiativeId/suggested-changes?status=pending
 * List suggested changes for an initiative (org-scoped).
 */
router.get(
  '/:initiativeId/suggested-changes',
  requireOrgRole('user'),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const initiativeId = String(req.params.initiativeId || '');
    if (!initiativeId) {
      res.status(400).json({ error: 'initiativeId is required' });
      return;
    }
    if (!(await initiativeExistsInOrg(initiativeId, orgId))) {
      res.status(404).json({ error: 'Initiative not found' });
      return;
    }

    const rawStatus = typeof req.query?.status === 'string' ? String(req.query.status).trim() : '';
    const status: SuggestedChangeStatus | undefined =
      rawStatus === 'pending' || rawStatus === 'accepted' || rawStatus === 'rejected'
        ? (rawStatus as SuggestedChangeStatus)
        : undefined;

    const items = await listSuggestedChanges({ initiativeId, organizationId: orgId, status });
    res.json({ items, changes: items });
  })
);

/**
 * PATCH /api/initiatives/suggested-changes/:id
 * Resolve a suggested change (the mini-gate). On 'accepted' we ONLY mark it accepted;
 * we never auto-mutate the initiative (applying is a separate, manual step).
 */
router.patch(
  '/suggested-changes/:id',
  requireOrgRole('user'),
  validateBody(ResolveSuggestedChangeSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const change = await resolveSuggestedChange({
      id,
      organizationId: orgId,
      status: req.body.status,
      resolvedBy: req.user?.id || null,
    });
    if (!change) {
      res.status(404).json({ error: 'Suggested change not found' });
      return;
    }
    res.json({ change });
  })
);

// ==========================================
// FEATURE 2 — PROPOSE ENGINE
// ==========================================

const ProposeSchema = z.object({
  text: z.string().min(1).max(20000),
  goalKeys: z.array(z.string().max(255)).max(50).optional(),
  max: z.number().int().min(1).max(10).optional(),
  projectId: z.string().max(255).optional().nullable(),
});

/**
 * POST /api/initiatives/propose
 * Extract candidate initiatives from free text using the cheap LLM service with a
 * strict timeout. On timeout / error / unavailable / empty → { candidates: [] }
 * (the frontend has its own deterministic fallback). Never hangs, never 500s on AI.
 */
router.post(
  '/propose',
  requireOrgRole('user'),
  validateBody(ProposeSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let candidates: Awaited<ReturnType<typeof runPropose>> = [];
    try {
      candidates = await runPropose({
        text: req.body.text,
        goalKeys: req.body.goalKeys,
        max: req.body.max,
        projectId: req.body.projectId ?? null,
      });
    } catch {
      // Defensive: the service is designed never to throw, but degrade anyway.
      candidates = [];
    }

    res.json({ candidates });
  })
);

export default router;
