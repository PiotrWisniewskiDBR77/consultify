/**
 * Idea Business Case routes — Program D / epic E08.
 *
 * GET /api/idea-business-case/:ideaId  → IdeaBusinessCaseRow | null
 * PUT /api/idea-business-case/:ideaId  → upsert (shallow per-section merge)
 *
 * Org-scoped: `:ideaId` must exist in `my_ideas` under the caller's
 * organization (same existence check `GET /my-ideas/:id/map` uses in
 * my-work.routes.ts) — a caller cannot attach a business case to an idea it
 * cannot already see, and cannot silently create one against a foreign-org
 * idea id. `idea_business_cases` itself is then org-scoped the same way
 * `artifact_evidence` is (RES-011 pattern): a case already existing under a
 * different organization for this idea id is rejected, not overwritten.
 *
 * Table `idea_business_cases` comes from
 * `server/migrations/20260810_idea_business_case.sql`, which is ★ NOT
 * applied to any database by this change — `requireTables` below returns a
 * clean 503 until that migration is actually run, never a crash.
 *
 * ── Idea → Document/Presentation/Workbook artifact handoff (Lane C, added
 * IDEA-DOCUMENT-HANDOFF-SUBPACKET-001) ─────────────────────────────────────
 * These sub-routes live HERE, not on `my-work.routes.ts` (the natural home,
 * since that is where `POST /my-work/my-ideas/:id/convert` already lives) —
 * `my-work.routes.ts` is owned and leased by a different lane in this
 * closure program and is explicitly out of scope for this worker. This
 * router is this lane's own mounted surface (`/api/idea-business-case`,
 * `Gateway.ts`), and `:ideaId` scoping is already this file's idiom (see
 * `assertIdeaInOrg` above), so the governed handoff — propose → human
 * approve/reject → materialize exactly once, via
 * `../services/ideaHandoff/ideaHandoffService.ts` — is exposed as sibling
 * sub-paths under the same `:ideaId` prefix:
 *   POST /api/idea-business-case/:ideaId/artifact-proposals
 *   GET  /api/idea-business-case/:ideaId/artifact-proposals/:proposalId
 *   POST /api/idea-business-case/:ideaId/artifact-proposals/:proposalId/decision
 *   POST /api/idea-business-case/:ideaId/artifact-proposals/:proposalId/materialize
 * This is the concrete fix for `/convert`'s missing idempotency key/content
 * hash/approval step/receipt (duplicate `reports`/`my_idea_conversions` rows
 * on a double call) and for its `target='presentation'` branch being a dead
 * 501 — see the header of `ideaHandoffService.ts` for the full defect
 * writeup and the cross-lane contract for how another lane is expected to
 * consume a materialized receipt.
 */
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireTables, requireUser } from './my-work/_helpers.js';
import ideaBusinessCaseService, {
  IdeaBusinessCaseForeignOrgError,
} from '../services/ideaBusinessCaseService.js';
import {
  decideIdeaArtifact,
  getIdeaArtifactProposal,
  IDEA_ARTIFACT_TARGET_KINDS,
  IdeaHandoffError,
  materializeIdeaArtifact,
  proposeIdeaArtifact,
} from '../services/ideaHandoff/ideaHandoffService.js';
import { HandoffSpineError } from '../services/artifactHandoff/handoffSpineService.js';
import { getDatabase } from '../database/Database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

// Loose on purpose: section content shapes are large and owned by the client
// type (`src/types/ideaBusinessCase.ts`); the server's job is persistence,
// not re-validating fourteen nested schemas. Each entry must at least be a
// plain object with a `content` key, matching `UpsertIdeaBusinessCaseBody`.
const SectionPatchSchema = z.record(
  z.string(),
  z.object({
    content: z.unknown(),
    lineage: z.array(z.record(z.string(), z.unknown())).optional(),
    claims: z.array(z.record(z.string(), z.unknown())).optional(),
  })
);

const UpsertBodySchema = z.object({
  sections: SectionPatchSchema,
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
 * GET /api/idea-business-case/:ideaId
 * Returns `{ businessCase: null }` when the idea has no case yet — a valid,
 * common state (this feature ships behind a default-OFF flag; most ideas
 * will have none), never a 404.
 */
router.get(
  '/:ideaId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (!(await requireTables(res, ['my_ideas', 'idea_business_cases']))) return;

    if (!(await assertIdeaInOrg(ideaId, orgId))) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const businessCase = await ideaBusinessCaseService.getBusinessCase(ideaId, orgId);
    res.json({ businessCase });
  })
);

/**
 * PUT /api/idea-business-case/:ideaId
 * Shallow per-section upsert — body's `sections` keys REPLACE the matching
 * section in storage, keys omitted from the body are left untouched (see
 * ideaBusinessCaseService.upsertBusinessCase).
 */
router.put(
  '/:ideaId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (!(await requireTables(res, ['my_ideas', 'idea_business_cases']))) return;

    if (!(await assertIdeaInOrg(ideaId, orgId))) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const bodyResult = UpsertBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid business case body', details: bodyResult.error.flatten() });
      return;
    }

    let businessCase;
    try {
      businessCase = await ideaBusinessCaseService.upsertBusinessCase({
        ideaId,
        organizationId: orgId,
        sections: bodyResult.data.sections,
        updatedBy: userId ?? null,
      });
    } catch (error) {
      if (error instanceof IdeaBusinessCaseForeignOrgError) {
        res.status(404).json({ error: 'Idea not found' });
        return;
      }
      throw error;
    }
    res.json({ businessCase });
  })
);

// ============================================================================
// Idea → artifact handoff (propose → human approve/reject → materialize once)
// ============================================================================

const ProposeArtifactBodySchema = z.object({
  targetKind: z.enum(IDEA_ARTIFACT_TARGET_KINDS),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

const DecisionBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(1).max(2000).optional(),
});

/**
 * Maps the two error families this handoff can throw to HTTP status codes.
 * `IdeaHandoffError` (this lane's own guard — idea/proposal not found, bad
 * target kind) and `HandoffSpineError` (the shared spine's invariants — bad
 * argument, not found, invalid state transition, human-actor requirement)
 * are handled uniformly so every sub-route below stays a thin body.
 */
function respondToHandoffError(res: Response, error: unknown): boolean {
  if (error instanceof IdeaHandoffError) {
    if (error.code === 'IDEA_NOT_FOUND' || error.code === 'PROPOSAL_NOT_FOUND') {
      res.status(404).json({ error: error.message, code: error.code });
      return true;
    }
    res.status(400).json({ error: error.message, code: error.code });
    return true;
  }
  if (error instanceof HandoffSpineError) {
    const statusByCode: Record<string, number> = {
      INVALID_ARGUMENT: 400,
      NOT_A_HUMAN_ACTOR: 400,
      NOT_FOUND: 404,
      INVALID_STATE_TRANSITION: 409,
      NOT_APPROVED: 409,
    };
    res
      .status(statusByCode[error.code] ?? 500)
      .json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

/**
 * POST /api/idea-business-case/:ideaId/artifact-proposals
 * Body: { targetKind: 'document'|'presentation'|'workbook', idempotencyKey?: string }
 *
 * Tenant/idea scoping: `proposeIdeaArtifact` reads the idea from `my_ideas`
 * filtered on `id = :ideaId AND organization_id = orgId` — the same boundary
 * `assertIdeaInOrg` enforces for the business-case routes above. `createdBy`
 * is always the AUTHENTICATED caller's own user id (never a client-supplied
 * value), matching this file's existing idiom of trusting `requireUser`'s
 * identity, not the request body, for who performed an action.
 */
router.post(
  '/:ideaId/artifact-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (
      !(await requireTables(res, [
        'my_ideas',
        'artifact_handoff_proposals',
        'artifact_handoff_receipts',
      ]))
    )
      return;

    const bodyResult = ProposeArtifactBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid artifact proposal body', details: bodyResult.error.flatten() });
      return;
    }

    try {
      const { proposal, replayed } = await proposeIdeaArtifact({
        organizationId: orgId,
        ideaId,
        targetKind: bodyResult.data.targetKind,
        createdBy: userId,
        idempotencyKey: bodyResult.data.idempotencyKey ?? null,
      });
      res.status(replayed ? 200 : 201).json({ proposal, replayed });
    } catch (error) {
      if (respondToHandoffError(res, error)) return;
      throw error;
    }
  })
);

/**
 * GET /api/idea-business-case/:ideaId/artifact-proposals/:proposalId
 * Cold reopen: always a fresh read against `artifact_handoff_proposals` /
 * `artifact_handoff_receipts` — never a cached value — so re-fetching later
 * proves the pinned `sourceContentHash` and (once materialized) the single
 * `receipt.targetRecordId` are stable.
 */
router.get(
  '/:ideaId/artifact-proposals/:proposalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    const proposalId = String(req.params.proposalId || '').trim();
    if (!ideaId || !proposalId) {
      return res.status(400).json({ error: 'Missing ideaId or proposalId' });
    }

    if (
      !(await requireTables(res, ['artifact_handoff_proposals', 'artifact_handoff_receipts']))
    )
      return;

    try {
      const result = await getIdeaArtifactProposal(orgId, ideaId, proposalId);
      res.json(result);
    } catch (error) {
      if (respondToHandoffError(res, error)) return;
      throw error;
    }
  })
);

/**
 * POST /api/idea-business-case/:ideaId/artifact-proposals/:proposalId/decision
 * Body: { action: 'approve'|'reject', reason?: string }
 *
 * `decidedBy` is always the authenticated caller's own user id — this is
 * what makes "a human approved this" a fact about WHO called the API, not a
 * client-suppliable field. The spine additionally rejects a decider id that
 * normalizes to the 'system' sentinel (`HandoffSpineError` code
 * `NOT_A_HUMAN_ACTOR`, mapped to 400 below).
 */
router.post(
  '/:ideaId/artifact-proposals/:proposalId/decision',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    const proposalId = String(req.params.proposalId || '').trim();
    if (!ideaId || !proposalId) {
      return res.status(400).json({ error: 'Missing ideaId or proposalId' });
    }

    if (!(await requireTables(res, ['artifact_handoff_proposals']))) return;

    const bodyResult = DecisionBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid decision body', details: bodyResult.error.flatten() });
      return;
    }

    try {
      const proposal = await decideIdeaArtifact({
        organizationId: orgId,
        ideaId,
        proposalId,
        decidedBy: userId,
        action: bodyResult.data.action,
        reason: bodyResult.data.reason ?? null,
      });
      res.json({ proposal });
    } catch (error) {
      if (respondToHandoffError(res, error)) return;
      throw error;
    }
  })
);

/**
 * POST /api/idea-business-case/:ideaId/artifact-proposals/:proposalId/materialize
 * On an APPROVED proposal, records exactly one receipt. See the CROSS-LANE
 * CONTRACT header in `ideaHandoffService.ts` for what `targetRecordId` on
 * the returned receipt does (and does not) mean.
 */
router.post(
  '/:ideaId/artifact-proposals/:proposalId/materialize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    const proposalId = String(req.params.proposalId || '').trim();
    if (!ideaId || !proposalId) {
      return res.status(400).json({ error: 'Missing ideaId or proposalId' });
    }

    if (
      !(await requireTables(res, ['artifact_handoff_proposals', 'artifact_handoff_receipts']))
    )
      return;

    try {
      const { receipt, replayed } = await materializeIdeaArtifact({
        organizationId: orgId,
        ideaId,
        proposalId,
        materializedBy: userId,
      });
      res.status(replayed ? 200 : 201).json({ receipt, replayed });
    } catch (error) {
      if (respondToHandoffError(res, error)) return;
      throw error;
    }
  })
);

export default router;
