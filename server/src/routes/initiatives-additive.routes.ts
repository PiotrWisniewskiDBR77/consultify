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
import {
  getInitiativeFunnel,
  getInitiativeLineage,
} from '../services/initiative/initiativeLineageService.js';
import {
  checkPortfolioMece,
  type MeceExistingInitiative,
} from '../services/initiative/portfolioMeceService.js';
import { proposeCandidates as runPropose } from '../services/initiative/proposeEngineService.js';
import {
  createSuggestedChange,
  listSuggestedChanges,
  resolveSuggestedChange,
  type SuggestedChangeStatus,
} from '../services/initiative/suggestedChangesService.js';
import {
  createEconomicsLinkage,
  getLinkagesByInitiative,
} from '../services/v8/financeIntegrationService.js';
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
// FEATURE 3 — ECONOMICS LINKAGES (M16 → M13 display)
// ==========================================

/**
 * GET /api/initiatives/:initiativeId/economics-links
 *
 * Read-side of the M16 Finance → M13 Initiatives integration. M16 finance WRITES
 * rows into v8_initiative_economics_linkages (finance_model_ref, linkage_type,
 * status) but nothing on the M13 surface ever READ them — the linkages were
 * write-only / dead. This exposes them, strictly org-scoped, so the initiative
 * detail can display which finance models an initiative is linked to.
 *
 * Org isolation: getLinkagesByInitiative() filters on (initiative_id, organization_id);
 * we additionally 404 when the initiative itself is not in the caller's org, so a
 * foreign org can never confirm existence or read another org's linkages.
 */
router.get(
  '/:initiativeId/economics-links',
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

    const linkages = await getLinkagesByInitiative(initiativeId, orgId);

    // Shape for the FE detail surface: the linkage row IS the display record
    // (finance_model_ref is the model identifier; linkage_type + status carry the
    // semantics). No cross-module finance-model table is guaranteed to exist, so we
    // do not over-couple — we surface exactly what M16 wrote, org-scoped.
    const links = linkages.map((l) => ({
      linkageId: l.linkageId,
      financeModelRef: l.financeModelRef,
      linkageType: l.linkageType,
      status: l.status,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));

    res.json({ links, items: links });
  })
);

/**
 * POST /api/initiatives/:initiativeId/economics-links
 *
 * Create a finance ↔ initiative linkage ("Powiąż" action in FinanceHub).
 * Body: { financeModelRef, linkageType?, status? }
 * financeModelRef = any finance entity ref string (model id, analysis id, etc.)
 */
const CreateLinkageSchema = z.object({
  financeModelRef: z.string().min(1).max(500),
  linkageType: z
    .enum(['financial_model', 'budget', 'analysis', 'valuation', 'investment_case'])
    .optional()
    .default('financial_model'),
  status: z.enum(['not_started', 'in_progress', 'complete']).optional().default('not_started'),
});

function toCanonicalEconomicsLinkage(input: z.infer<typeof CreateLinkageSchema>): {
  linkageType: 'budget' | 'forecast' | 'actual' | 'variance';
  status:
    | 'not_started'
    | 'local_only'
    | 'linked_to_finance_model'
    | 'linked_to_finance_scenario'
    | 'linked_to_roi_tracking'
    | 'stale_vs_finance_model';
} {
  // This additive endpoint predates the canonical Finance integration contract:
  // its `linkageType` describes the referenced artifact, while the owner service
  // stores the economic series kind. Legacy model/analysis/valuation/investment
  // references are forward-looking projections; never pass their labels through
  // to the owner and rely on an unsafe cast (the owner validates at runtime).
  const linkageType = input.linkageType === 'budget' ? 'budget' : 'forecast';
  const status =
    input.status === 'complete'
      ? 'linked_to_finance_model'
      : input.status === 'in_progress'
        ? 'local_only'
        : 'not_started';
  return { linkageType, status };
}

router.post(
  '/:initiativeId/economics-links',
  requireOrgRole('user'),
  validateBody(CreateLinkageSchema),
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
    const { financeModelRef, linkageType, status } = req.body as z.infer<
      typeof CreateLinkageSchema
    >;
    const canonical = toCanonicalEconomicsLinkage({ financeModelRef, linkageType, status });
    const linkage = await createEconomicsLinkage({
      organizationId: orgId,
      initiativeId,
      financeModelRef,
      ...canonical,
    });
    res.status(201).json({ linkage });
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

// ==========================================
// FEATURE 4 — PORTFOLIO MECE CHECK (uspójnienie F3.7)
// ==========================================

const ValidatePortfolioMeceSchema = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().min(1).max(2000),
        description: z.string().max(20000).optional().nullable(),
        goalKey: z.string().max(255).optional().nullable(),
      })
    )
    .min(1)
    .max(50),
});

/**
 * POST /api/initiatives/validate-portfolio-mece
 *
 * Validate a batch of candidate initiatives against the org's EXISTING portfolio
 * for MECE (overlaps + goalKey coverage gaps). Loads the existing initiatives
 * org-scoped, runs the pure {@link checkPortfolioMece}, returns the verdict.
 * Advisory only — never mutates anything.
 */
router.post(
  '/validate-portfolio-mece',
  requireOrgRole('user'),
  validateBody(ValidatePortfolioMeceSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let existing: MeceExistingInitiative[] = [];
    try {
      const rows = await queryHelpers.queryAll(
        `SELECT id,
                COALESCE(title, name, '') AS title,
                COALESCE(summary, '')     AS summary,
                COALESCE(goal_key, '')    AS goal_key
           FROM initiatives
          WHERE organization_id = ?
            AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'ARCHIVED')
          LIMIT 500`,
        [orgId]
      );
      existing = (rows as any[]).map((r) => ({
        id: String(r.id),
        title: String(r.title || ''),
        summary: String(r.summary || ''),
        goalKey: String(r.goal_key || '') || undefined,
      }));
    } catch {
      // Schema drift (e.g. no goal_key column) → fall back to title/summary only,
      // so the check still runs (overlaps by similarity) instead of 500-ing.
      try {
        const rows = await queryHelpers.queryAll(
          `SELECT id,
                  COALESCE(title, name, '') AS title,
                  COALESCE(summary, '')     AS summary
             FROM initiatives
            WHERE organization_id = ?
              AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'ARCHIVED')
            LIMIT 500`,
          [orgId]
        );
        existing = (rows as any[]).map((r) => ({
          id: String(r.id),
          title: String(r.title || ''),
          summary: String(r.summary || ''),
        }));
      } catch {
        existing = [];
      }
    }

    const candidates = (req.body.candidates as any[]).map((c) => ({
      title: String(c.title || ''),
      description: c.description ?? undefined,
      goalKey: c.goalKey ?? undefined,
    }));

    const result = checkPortfolioMece(existing, candidates);
    res.json(result);
  })
);

// ==========================================
// FEATURE 5 — CHAIN OBSERVABILITY (uspójnienie F5.1 + F5.2)
// ==========================================

/**
 * GET /api/initiatives/funnel/stats
 *
 * F5.2 — org-wide funnel: counts per status, per source_type, and the
 * created → in-execution → tracking conversion of the whole portfolio.
 * Read-only, org-scoped. Registered BEFORE /:id/lineage so the literal
 * "funnel" segment is never captured as an :id.
 */
router.get(
  '/funnel/stats',
  requireOrgRole('user'),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const funnel = await getInitiativeFunnel(orgId);
    res.json(funnel);
  })
);

/**
 * GET /api/initiatives/:id/lineage
 *
 * F5.1 — the chain for one initiative: source (analysis/insight/idea) →
 * initiative → execution → results (tracked benefits/KPIs). Read-only,
 * org-scoped; 404 when the initiative does not resolve in the caller's org.
 */
router.get(
  '/:id/lineage',
  requireOrgRole('user'),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const initiativeId = String(req.params.id || '');
    if (!initiativeId) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const lineage = await getInitiativeLineage(orgId, initiativeId);
    if (!lineage) {
      res.status(404).json({ error: 'Initiative not found' });
      return;
    }
    res.json(lineage);
  })
);

export default router;
