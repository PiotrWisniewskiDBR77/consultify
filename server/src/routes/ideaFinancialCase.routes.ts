/**
 * Idea FINANCIAL Case routes — Program E / epic E09, stream S6-E09 (RISK-12).
 *
 * GET /api/idea-financial-case/:ideaId  → { financialCase: IdeaFinancialCaseRow | null }
 * PUT /api/idea-financial-case/:ideaId  → whole-case upsert with optimistic concurrency
 *
 * Closes the gap settled in
 * docs/qa/ideas-complete-transformation-2026-08-09/10_FINANCIAL_CASE_ACCEPTANCE.md
 * §5.4 verdict (c): "there is no save path at all, and the UI silently
 * discards the user's work". Shaped after `ideaBusinessCase.routes.ts` on
 * purpose — same auth stack, same org-scoped existence check, same
 * `requireTables` 503-instead-of-crash behaviour on an unmigrated database.
 *
 * ── STATUS CODES, AND WHY EACH ONE ─────────────────────────────────────────
 *   400 — body fails `UpsertBodySchema` (zod). The financial case has a real
 *         shape (currency/discountRatePct/startPeriod/horizonMonths/drivers/
 *         scenarios); unlike E08's fourteen prose sections there IS something
 *         worth validating, so we do.
 *   404 — `:ideaId` is not visible to the caller's organization. Deliberately
 *         NOT 403: answering 403 would confirm the idea exists in someone
 *         else's tenant. Same non-disclosure choice as the business case.
 *   403 — the caller CAN see the idea, but an `idea_financial_cases` row for
 *         it already exists under a DIFFERENT organization. Here 404 would be
 *         a lie the caller can trivially disprove with GET /my-ideas/:id, so
 *         this one is an honest "you may not write this resource"
 *         (`IDEA_FINANCIAL_CASE_FOREIGN_ORG`). This is the one deliberate
 *         divergence from `ideaBusinessCase.routes.ts`, which returns 404 for
 *         both cases and thereby tells the caller their own idea vanished.
 *   409 — optimistic-concurrency conflict: the stored `version` is not the one
 *         the client loaded. The response carries the CURRENT row so the UI
 *         can show the conflict and let the user reload — never a silent
 *         overwrite of a colleague's drivers.
 *   503 — `idea_financial_cases` does not exist in this environment yet
 *         (migration 20260812 not applied). Via `requireTables`.
 */
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { requireTables, requireUser } from './my-work/_helpers.js';
import ideaFinancialCaseService, {
  IdeaFinancialCaseForeignOrgError,
  IdeaFinancialCaseVersionConflictError,
} from '../services/ideaFinancialCaseService.js';
import { getDatabase } from '../database/Database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);

/**
 * Driver entries stay loose on their leaf values (monthlyValues is an open
 * 'YYYY-MM' -> number map, evidence refs are client-owned), but the fields the
 * engine actually reads are pinned. A driver without `id`/`kind` is not a
 * driver, and silently storing one produces a case whose totals cannot be
 * reconciled later — exactly the class of defect epic E09 exists to prevent.
 */
const DriverSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['cost', 'benefit']),
    label: z.string().optional(),
    costType: z.enum(['investment', 'recurring']).optional(),
    benefitType: z.enum(['cash', 'non_cash', 'risk_avoidance']).optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    monthlyValues: z.record(z.string(), z.number()).optional(),
    scenarioMultipliers: z.record(z.string(), z.number()).optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    evidence: z.array(z.record(z.string(), z.unknown())).optional(),
    notes: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

const CaseInputSchema = z
  .object({
    currency: z.string().min(1),
    discountRatePct: z.number(),
    startPeriod: z.string().min(1),
    horizonMonths: z.number().int().positive(),
    drivers: z.array(DriverSchema),
    scenarios: z.array(z.enum(['base', 'upside', 'downside'])),
  })
  .passthrough();

const UpsertBodySchema = z.object({
  case: z.object({
    input: CaseInputSchema,
    // The last computed snapshot. `null` is the honest value when the case is
    // empty or stale — never a fabricated zero result (Z3).
    result: z.record(z.string(), z.unknown()).nullable().optional(),
    lastComputedAt: z.string().nullable().optional(),
  }),
  /** The version the client loaded. Omitted only when creating the first row. */
  version: z.number().int().nonnegative().optional(),
});

async function assertIdeaInOrg(ideaId: string, organizationId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.query<{ id: string }>(
    `SELECT id FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
    [ideaId, organizationId]
  );
  return Boolean(result.rows?.[0]);
}

/**
 * GET /api/idea-financial-case/:ideaId
 * `{ financialCase: null }` when the idea has no case yet — a valid, common
 * state (the feature ships behind a default-OFF flag), never a 404.
 */
router.get(
  '/:ideaId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (!(await requireTables(res, ['my_ideas', 'idea_financial_cases']))) return;

    if (!(await assertIdeaInOrg(ideaId, orgId))) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const financialCase = await ideaFinancialCaseService.getFinancialCase(ideaId, orgId);
    res.json({ financialCase });
  })
);

/**
 * PUT /api/idea-financial-case/:ideaId
 * Whole-case replace under optimistic concurrency (see the service header for
 * why whole-case and not per-driver patch).
 */
router.put(
  '/:ideaId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (!(await requireTables(res, ['my_ideas', 'idea_financial_cases']))) return;

    if (!(await assertIdeaInOrg(ideaId, orgId))) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const bodyResult = UpsertBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid financial case body', details: bodyResult.error.flatten() });
      return;
    }

    // Read the pre-state BEFORE the write — this is the `before` half of the
    // audit pair. Without it the audit trail records that someone touched the
    // financial case and never what the numbers used to be, which for a
    // decision-grade artifact is the difference between an audit trail and a
    // hit counter (see requireAudit.middleware.ts's own header).
    const previous = await ideaFinancialCaseService.getFinancialCase(ideaId, orgId);

    let financialCase;
    try {
      financialCase = await ideaFinancialCaseService.upsertFinancialCase({
        ideaId,
        organizationId: orgId,
        payload: {
          input: bodyResult.data.case.input as Record<string, unknown>,
          result: (bodyResult.data.case.result ?? null) as Record<string, unknown> | null,
          lastComputedAt: bodyResult.data.case.lastComputedAt ?? null,
        },
        expectedVersion: bodyResult.data.version,
        updatedBy: userId ?? null,
      });
    } catch (error) {
      if (error instanceof IdeaFinancialCaseVersionConflictError) {
        res.status(409).json({
          error: 'Financial case was modified by someone else',
          code: 'IDEA_FINANCIAL_CASE_VERSION_CONFLICT',
          expectedVersion: error.expectedVersion,
          currentVersion: error.current.version,
          financialCase: error.current,
        });
        return;
      }
      if (error instanceof IdeaFinancialCaseForeignOrgError) {
        res.status(403).json({
          error: 'Financial case for this idea belongs to a different organization',
          code: 'IDEA_FINANCIAL_CASE_FOREIGN_ORG',
        });
        return;
      }
      throw error;
    }

    // Awaited (not fire-and-forget like IDEA_UPDATE) so the audit row is
    // durable before the client is told the save succeeded, and so tests can
    // read it back deterministically. Still non-fatal: an environment without
    // `audit_events` must not turn a good save into a 503.
    await req
      .emitAuditEvent?.({
        actorType: 'USER',
        action: 'IDEA_FINANCIAL_CASE_UPDATE',
        resourceType: 'idea_financial_case',
        resourceId: ideaId,
        before: previous
          ? {
              version: previous.version,
              driverCount: Array.isArray((previous.payload.input as any)?.drivers)
                ? (previous.payload.input as any).drivers.length
                : 0,
              currency: (previous.payload.input as any)?.currency ?? null,
              horizonMonths: (previous.payload.input as any)?.horizonMonths ?? null,
              discountRatePct: (previous.payload.input as any)?.discountRatePct ?? null,
              lastComputedAt: previous.payload.lastComputedAt,
            }
          : { version: 0, driverCount: 0, currency: null, horizonMonths: null, discountRatePct: null, lastComputedAt: null },
        after: {
          version: financialCase.version,
          driverCount: Array.isArray((financialCase.payload.input as any)?.drivers)
            ? (financialCase.payload.input as any).drivers.length
            : 0,
          currency: (financialCase.payload.input as any)?.currency ?? null,
          horizonMonths: (financialCase.payload.input as any)?.horizonMonths ?? null,
          discountRatePct: (financialCase.payload.input as any)?.discountRatePct ?? null,
          lastComputedAt: financialCase.payload.lastComputedAt,
        },
      })
      .catch((err: any) =>
        logger.warn('[IdeaFinancialCase] Audit log failed:', err?.message)
      );

    res.json({ financialCase });
  })
);

export default router;
